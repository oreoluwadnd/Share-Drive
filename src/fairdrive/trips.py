"""Clean a recording, split it into trips and flag trips that can't be scored."""

from dataclasses import dataclass

import numpy as np
import pandas as pd

from fairdrive.geo import step_distances_m
from fairdrive.orient import to_car_frame

STEP = pd.Timedelta("100ms")
STOP_SPEED_MS = 1.0
LONG_STOP = pd.Timedelta(minutes=5)
MIN_DURATION = pd.Timedelta(minutes=2)
MAX_GPS_GAP = pd.Timedelta(seconds=30)
# Distance cut from each end of a trip so home and work locations stay private.
HIDDEN_END_M = 500.0
# A car can't push sideways this hard for long. In UAH-DriveSet two recordings spent 21% and 45%
# of the trip above 0.3 g sideways (the phone moved or the sensor failed); all others under 0.2%.
SIDEWAYS_LIMIT_MS2 = 0.3 * 9.80665
MAX_SIDEWAYS_SHARE = 0.05

POINT_COLUMNS = ["lat", "lon", "speed", "acc_forward", "acc_lateral", "acc_vertical"]


@dataclass
class Trip:
    start: pd.Timestamp
    end: pd.Timestamp
    # Why the trip can't be scored, or None if it can.
    flag: str | None
    # Cleaned points in the car's frame with both ends hidden. None when flagged.
    points: pd.DataFrame | None


def process_recording(recording: dict[str, pd.DataFrame]) -> list[Trip]:
    gps = recording["Location"]
    gps = gps[(gps["latitude"] != 0) | (gps["longitude"] != 0)]  # 0,0 means no fix yet
    timeline = build_timeline(recording["Accelerometer"], recording["Gravity"], gps)
    return [_make_trip(segment, gps.index) for segment in split_trips(timeline)]


def build_timeline(acc: pd.DataFrame, gravity: pd.DataFrame, gps: pd.DataFrame) -> pd.DataFrame:
    """Put every sensor on one 10 Hz UTC timeline covered by all three sensors."""
    acc = acc.resample(STEP).mean()
    gravity = gravity.resample(STEP).mean()
    start = max(acc.index[0], gravity.index[0], gps.index[0]).ceil(STEP)
    end = min(acc.index[-1], gravity.index[-1], gps.index[-1]).floor(STEP)
    index = pd.date_range(start, end, freq=STEP).as_unit("ns")

    timeline = pd.DataFrame(index=index)
    timeline[["ax", "ay", "az"]] = acc.reindex(index).interpolate(limit_direction="both").to_numpy()
    timeline[["gx", "gy", "gz"]] = gravity.reindex(index).interpolate(limit_direction="both").to_numpy()

    timeline["lat"] = interp_onto(index, gps["latitude"])
    timeline["lon"] = interp_onto(index, gps["longitude"])
    timeline["speed"] = interp_onto(index, gps["speed"].where(gps["speed"] >= 0))
    bearing = gps["bearing"].where(gps["bearing"] >= 0).dropna()
    heading = pd.Series(np.unwrap(np.radians(bearing.to_numpy())), index=bearing.index)
    timeline["heading"] = interp_onto(index, heading)
    return timeline


def split_trips(timeline: pd.DataFrame) -> list[pd.DataFrame]:
    """Split wherever the car is stopped for longer than LONG_STOP. The long stops are dropped."""
    moving = timeline["speed"] >= STOP_SPEED_MS
    run_id = (moving != moving.shift()).cumsum()
    run_duration = timeline.groupby(run_id)["speed"].transform("size") * STEP
    long_stop = ~moving & (run_duration > LONG_STOP)
    segment_id = (long_stop != long_stop.shift()).cumsum()
    kept = timeline[~long_stop]
    return [segment for _, segment in kept.groupby(segment_id[~long_stop])]


def _make_trip(segment: pd.DataFrame, fix_times: pd.DatetimeIndex) -> Trip:
    start, end = segment.index[0], segment.index[-1]
    flag = flag_reason(start, end, fix_times)
    if flag:
        return Trip(start, end, flag, None)
    points = pd.concat([segment[["lat", "lon", "speed"]], to_car_frame(segment)], axis=1)
    return finish_trip(start, end, points)


def finish_trip(start: pd.Timestamp, end: pd.Timestamp, points: pd.DataFrame) -> Trip:
    """Flag a cleaned trip with impossible sideways readings, otherwise drop its first and last HIDDEN_END_M."""
    if (points["acc_lateral"].abs() > SIDEWAYS_LIMIT_MS2).mean() > MAX_SIDEWAYS_SHARE:
        return Trip(start, end, "sideways readings impossible for a car (phone moved?)", None)
    distance = np.cumsum(step_distances_m(points["lat"].to_numpy(), points["lon"].to_numpy()))
    if distance[-1] < 2 * HIDDEN_END_M:
        return Trip(start, end, f"shorter than {2 * HIDDEN_END_M / 1000:g} km", None)
    keep = (distance >= HIDDEN_END_M) & (distance <= distance[-1] - HIDDEN_END_M)
    return Trip(start, end, None, points[keep])


def flag_reason(start: pd.Timestamp, end: pd.Timestamp, fix_times: pd.DatetimeIndex) -> str | None:
    """Why a trip can't be scored, or None if it can."""
    if end - start < MIN_DURATION:
        return f"shorter than {MIN_DURATION.total_seconds() / 60:g} minutes"
    fixes = fix_times[(fix_times >= start) & (fix_times <= end)]
    edges = pd.DatetimeIndex([start, *fixes, end])
    if (edges[1:] - edges[:-1]).max() > MAX_GPS_GAP:
        return f"GPS gap over {MAX_GPS_GAP.total_seconds():g} seconds"
    return None


def interp_onto(index: pd.DatetimeIndex, values: pd.Series) -> np.ndarray:
    """Linear interpolation of a time series onto index, ignoring missing values."""
    values = values.dropna()
    return np.interp(index.asi8, values.index.as_unit("ns").asi8, values.to_numpy())
