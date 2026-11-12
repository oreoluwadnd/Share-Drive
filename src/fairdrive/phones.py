"""Fairness by phone (FD-25): is the score as reliable on every phone?

Per phone model: how noisy its accelerometer is while the car is stopped (pure sensor noise, since
nothing is moving), and how much a driver's score varies between their trips on that phone.
"""

import numpy as np
import pandas as pd

from fairdrive.events import G
from fairdrive.store import TripStore

STOPPED_MS = 0.5


def phone_name(details: dict) -> str:
    phone = details.get("phone")
    return f"{phone['device']} ({phone['platform']})" if phone else f"unknown ({details['source']})"


def stopped_noise_g(points: pd.DataFrame) -> float:
    """Spread of the forward reading while stopped, in g. NaN if the trip never stopped."""
    stopped = points.loc[points["speed"] < STOPPED_MS, "acc_forward"]
    return float(stopped.std() / G) if len(stopped) > 1 else np.nan


def phone_noise(scores: pd.DataFrame, store: TripStore) -> pd.DataFrame:
    """One row per phone: trips, drivers, sensor noise and the spread of each driver's scores on it."""
    trips = scores.assign(
        phone=[phone_name(store.details(t)) for t in scores["trip_id"]],
        sensor_noise_g=[stopped_noise_g(store.points(t)) for t in scores["trip_id"]],
    )
    # Spread within one driver (and driving style, when labelled) on one phone, so different drivers don't count as noise.
    spread = (trips.assign(style=trips["style"].fillna("unlabelled"))
              .groupby(["phone", "driver", "style"])["driving_score"].std().groupby("phone").mean())
    table = trips.groupby("phone").agg(trips=("trip_id", "size"), drivers=("driver", "nunique"),
                                       sensor_noise_g=("sensor_noise_g", "median"), average_score=("driving_score", "mean"))
    table["score_spread"] = spread
    return table.reset_index().round(3)
