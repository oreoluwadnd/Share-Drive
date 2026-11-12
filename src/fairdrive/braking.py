"""Braking quality study (FD-22): can a phone tell a planned stop from a panic stop?

Label: UAH-DriveSet's road camera measures the gap to the car ahead. Ontario's driver's handbook asks for
at least 2 seconds; a hard brake that starts within 3 s of a car being closer than that is "reactive",
any other hard brake is "anticipated". The camera is only used for the label: the classifier sees what a
phone records (speed and forward push around the brake), and is tested on drivers it never saw.
"""

from datetime import datetime
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from fairdrive.events import G, event_starts
from fairdrive.uah import TIMEZONE, load_trip

FOLLOWING_RULE_S = 2.0
LOOK_BACK = pd.Timedelta("3s")
BEFORE, AFTER = pd.Timedelta("5s"), pd.Timedelta("3s")
FEATURES = ["speed_kmh", "speed_drop_before", "mean_decel_before", "peak_decel", "secs_to_peak", "max_jerk", "speed_drop_during"]
PARAMS = {"objective": "binary", "learning_rate": 0.05, "num_leaves": 4, "min_data_in_leaf": 10,
          "verbose": -1, "seed": 0, "deterministic": True, "force_row_wise": True}
ROUNDS = 100
TARGET_F1 = 0.80


def brake_rows(points: pd.DataFrame, vehicles: pd.DataFrame) -> pd.DataFrame:
    """One row per hard brake: phone features and the camera label.

    vehicles: gap to the car ahead in seconds ("gap_s"), indexed by UTC time, only for frames with a car.
    """
    rows = []
    for t in event_starts(points)["hard_brake"]:
        before, during = points.loc[t - BEFORE:t], points.loc[t:t + AFTER]
        push_before, push_during = before["acc_forward"] / G, during["acc_forward"] / G
        gaps = vehicles.loc[t - LOOK_BACK:t, "gap_s"]
        rows.append({
            "time": t,
            "reactive": int((gaps < FOLLOWING_RULE_S).any()),
            "speed_kmh": points["speed"].asof(t) * 3.6,
            "speed_drop_before": (before["speed"].iloc[0] - before["speed"].iloc[-1]) * 3.6,
            "mean_decel_before": -push_before.mean(),
            "peak_decel": -push_during.min(),
            "secs_to_peak": (push_during.idxmin() - t).total_seconds(),
            "max_jerk": (-push_during.diff() / 0.1).max(),
            "speed_drop_during": (during["speed"].iloc[0] - during["speed"].iloc[-1]) * 3.6,
        })
    return pd.DataFrame(rows, columns=["time", "reactive", *FEATURES]).astype({"reactive": int} | dict.fromkeys(FEATURES, float))


def study(root: Path) -> dict:
    """Train on all but one driver, test on that driver, for every driver. Returns the results."""
    parts = []
    for folder in sorted(p.parent for p in Path(root).glob("D*/*/RAW_GPS.txt")):
        driver, trip, _ = load_trip(folder)
        if trip.flag is None:
            parts.append(brake_rows(trip.points, _vehicles(folder)).assign(driver=driver))
    brakes = pd.concat(parts, ignore_index=True)
    if brakes["driver"].nunique() < 2:
        raise ValueError("Need brakes from at least 2 drivers to test on a driver the model never saw.")

    reactive_chance = pd.Series(0.0, index=brakes.index)
    for driver in brakes["driver"].unique():
        held_out = brakes["driver"] == driver
        train = brakes[~held_out]
        booster = lgb.train(PARAMS, lgb.Dataset(train[FEATURES], train["reactive"], params={"verbose": -1}), ROUNDS)
        reactive_chance[held_out] = booster.predict(brakes.loc[held_out, FEATURES])

    y = brakes["reactive"].to_numpy()
    f1 = macro_f1(y, (reactive_chance.to_numpy() > 0.5).astype(int))
    majority = macro_f1(y, np.full_like(y, int(y.mean() > 0.5)))
    return {
        "drivers": int(brakes["driver"].nunique()),
        "hard_brakes": int(len(brakes)),
        "reactive": int(y.sum()),
        "macro_f1": round(f1, 3),
        "always_majority_macro_f1": round(majority, 3),
        "target_macro_f1": TARGET_F1,
        "meets_target": bool(f1 >= TARGET_F1),
        "median_by_label": brakes.groupby("reactive")[FEATURES].median().round(3).rename(index={0: "anticipated", 1: "reactive"}).to_dict("index"),
    }


def macro_f1(y: np.ndarray, predicted: np.ndarray) -> float:
    """Average of the F1 score for each of the two labels."""
    scores = []
    for label in (0, 1):
        tp = np.sum((predicted == label) & (y == label))
        wrong = np.sum((predicted == label) != (y == label))
        scores.append(2 * tp / max(2 * tp + wrong, 1))
    return float(np.mean(scores))


def _vehicles(folder: Path) -> pd.DataFrame:
    """PROC_VEHICLE_DETECTION: seconds, distance to the car ahead (m, -1 = none), that gap in seconds, ..."""
    start = pd.Timestamp(datetime.strptime(folder.name[:14], "%Y%m%d%H%M%S"), tz=TIMEZONE).tz_convert("UTC")
    frames = pd.read_csv(folder / "PROC_VEHICLE_DETECTION.txt", sep=r"\s+", header=None, usecols=[0, 1, 2], names=["s", "dist_m", "gap_s"])
    frames = frames[frames["dist_m"] > 0]
    frames.index = pd.DatetimeIndex(start + pd.to_timedelta(frames.pop("s"), unit="s")).as_unit("ns")
    return frames.sort_index()
