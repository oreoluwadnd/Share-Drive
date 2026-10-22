"""Load UAH-DriveSet trips into FairDrive's trip format.

Column meanings come from the dataset's official reader
(github.com/Eromera/uah_driveset_reader). Acceleration is in G with gravity
removed. Axis directions were measured on all 40 trips, against GPS speed and
turns and against the dataset's own braking and turning events:
Z is forward (+ = speeding up), Y is sideways (+ = right), X is vertical
(its sign was not verified).

Roads and speed limits come from the dataset's own OpenStreetMap readings (PROC_OPENSTREETMAP_DATA,
one every ~1.7 s, recorded in 2015 when the trips were driven), so these trips need no map lookup.
"""

from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from fairdrive.store import TripStore
from fairdrive.trips import STEP, Trip, finish_trip, flag_reason, interp_onto

SOURCE = "uah-driveset"
G = 9.80665
# Folder names hold each trip's start time on the phone's clock in Spain.
TIMEZONE = "Europe/Madrid"


def load_trip(folder: Path) -> tuple[str, Trip, dict]:
    """Return (driver, trip, labels) for one trip folder, e.g. D1/20151110175712-16km-D1-NORMAL1-SECONDARY.

    labels holds the dataset's driving style (normal, aggressive, drowsy) and route (motorway, secondary).
    """
    driver = f"uah-{folder.parent.name}"
    _, _, _, style, route = folder.name.split("-")
    labels = {"style": style.rstrip("12").lower(), "route": route.lower()}
    start = pd.Timestamp(datetime.strptime(folder.name[:14], "%Y%m%d%H%M%S"), tz=TIMEZONE).tz_convert("UTC")

    # RAW_ACCELEROMETERS: seconds, activation, x, y, z (G), ...
    acc = np.loadtxt(folder / "RAW_ACCELEROMETERS.txt", usecols=(0, 2, 3, 4))
    # RAW_GPS: seconds, speed (km/h), latitude, longitude, ...
    gps = np.loadtxt(folder / "RAW_GPS.txt", usecols=(0, 1, 2, 3))

    acc = pd.DataFrame(acc[:, 1:] * G, columns=["x", "y", "z"], index=start + pd.to_timedelta(acc[:, 0], unit="s"))
    acc = acc.resample(STEP).mean()
    gps = pd.DataFrame(gps[:, 1:], columns=["speed_kmh", "lat", "lon"], index=start + pd.to_timedelta(gps[:, 0], unit="s"))

    index = pd.date_range(max(acc.index[0], gps.index[0]).ceil(STEP), min(acc.index[-1], gps.index[-1]).floor(STEP), freq=STEP).as_unit("ns")
    acc = acc.reindex(index).interpolate(limit_direction="both")
    points = pd.DataFrame({
        "lat": interp_onto(index, gps["lat"]),
        "lon": interp_onto(index, gps["lon"]),
        "speed": interp_onto(index, gps["speed_kmh"] / 3.6),
        "acc_forward": acc["z"].to_numpy(),
        "acc_lateral": acc["y"].to_numpy(),
        "acc_vertical": acc["x"].to_numpy(),
    }, index=index)
    points = points.join(_roads(folder, start, index))

    flag = flag_reason(index[0], index[-1], gps.index)
    trip = Trip(index[0], index[-1], flag, None) if flag else finish_trip(index[0], index[-1], points)
    return driver, trip, labels


def _roads(folder: Path, start: pd.Timestamp, index: pd.DatetimeIndex) -> pd.DataFrame:
    """road_type, speed_limit_kmh and speed_limit_source at each point, from the nearest dataset reading."""
    # PROC_OPENSTREETMAP_DATA: seconds, maxspeed (-1 = unknown), reliability, road type ("-" = unknown), ...
    osm = pd.read_csv(folder / "PROC_OPENSTREETMAP_DATA.txt", sep=r"\s+", header=None, usecols=[0, 1, 3], names=["s", "maxspeed", "road"])
    osm.index = pd.DatetimeIndex(start + pd.to_timedelta(osm.pop("s"), unit="s")).as_unit("ns")
    osm = osm[~osm.index.duplicated()].sort_index()
    nearest = osm.reindex(index, method="nearest")
    known = nearest["maxspeed"] > 0
    return pd.DataFrame({
        "road_type": nearest["road"].where(nearest["road"] != "-"),
        "speed_limit_kmh": nearest["maxspeed"].where(known),
        "speed_limit_source": np.where(known, "posted", "missing"),
    }, index=index)


def load_dataset(root: Path, store: TripStore) -> list[str]:
    """Load every trip under root (the UAH-DRIVESET-v1 folder). Returns the saved trip ids."""
    folders = sorted(p.parent for p in Path(root).glob("D*/*/RAW_GPS.txt"))
    if not folders:
        raise FileNotFoundError(f"No UAH-DriveSet trips found under {root}")
    trips = [load_trip(folder) for folder in folders]
    duplicates = [store.trip_id(d, t) for d, t, _ in trips if store.exists(store.trip_id(d, t))]
    if duplicates:
        raise FileExistsError(f"Trip(s) already loaded: {', '.join(duplicates)}")
    return [store.save(driver, trip, SOURCE, labels) for driver, trip, labels in trips]
