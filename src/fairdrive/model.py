"""Context model (FD-16): how many harsh events per km are normal for a given road, time and weather."""

import json
from dataclasses import dataclass
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from fairdrive.events import EVENT_TYPES
from fairdrive.features import FEATURES, is_tagged, segments
from fairdrive.store import TripStore

# Small trees and a minimum leaf size: the data is a few hundred km from a handful of drivers.
PARAMS = {"objective": "poisson", "learning_rate": 0.05, "num_leaves": 7, "min_data_in_leaf": 30,
          "verbose": -1, "seed": 0, "deterministic": True, "force_row_wise": True}
ROUNDS = 150


@dataclass
class ContextModel:
    boosters: dict[str, lgb.Booster]

    def expected(self, segs: pd.DataFrame) -> pd.DataFrame:
        """Expected count of each event type in each 1 km segment."""
        return pd.DataFrame({kind: self.boosters[kind].predict(segs[FEATURES]) for kind in EVENT_TYPES}, index=segs.index)

    def save(self, folder: Path) -> None:
        folder.mkdir(parents=True, exist_ok=True)
        for kind, booster in self.boosters.items():
            booster.save_model(folder / f"{kind}.txt")

    @classmethod
    def load(cls, folder: Path) -> "ContextModel":
        return cls({kind: lgb.Booster(model_file=folder / f"{kind}.txt") for kind in EVENT_TYPES})


def model_dir(store: TripStore) -> Path:
    return store.root / "model"


def training_segments(store: TripStore) -> pd.DataFrame:
    """Segments of every scorable, tagged trip, with trip_id and driver."""
    trips = store.list()
    parts = []
    for trip in trips[trips["flag"].isna()].itertuples():
        details = store.details(trip.trip_id)
        if is_tagged(details):
            segs = segments(store.points(trip.trip_id), details)
            parts.append(segs.assign(trip_id=trip.trip_id, driver=trip.driver))
    if not parts:
        raise ValueError("No tagged trips to learn from. Run `fairdrive tag` first.")
    return pd.concat(parts, ignore_index=True)


def fit(segs: pd.DataFrame) -> ContextModel:
    missing = [kind for kind in EVENT_TYPES if segs[kind].sum() == 0]
    if missing:
        raise ValueError(f"No {', '.join(missing)} events in the training trips, so their normal rate can't be learned.")
    data = lambda kind: lgb.Dataset(segs[FEATURES], label=segs[kind], params={"verbose": -1})
    return ContextModel({kind: lgb.train(PARAMS, data(kind), num_boost_round=ROUNDS) for kind in EVENT_TYPES})


def held_out_expected(segs: pd.DataFrame) -> pd.DataFrame:
    """Expected count of each event type per segment, from a model trained without that segment's driver.

    A model that has seen a trip partly memorises its harsh moments: on UAH-DriveSet the in-sample
    expected rate followed each trip's own rate (correlation 0.61), the held-out one did not (-0.02).
    """
    drivers = segs["driver"].unique()
    if len(drivers) < 2:
        raise ValueError("Need trips from at least 2 drivers to know what is normal without the driver being scored.")
    parts = [fit(segs[segs["driver"] != d]).expected(segs[segs["driver"] == d]) for d in drivers]
    return pd.concat(parts).reindex(segs.index)


def evaluate(segs: pd.DataFrame) -> dict:
    """Leave one driver out: train on the others, predict the held-out driver's segments.

    Compares the model's error with always predicting the training average, using mean Poisson
    deviance (the standard error measure for counts) on all harsh events per km.
    """
    observed = segs[list(EVENT_TYPES)].sum(axis=1)
    totals = observed.groupby(segs["driver"]).agg(["sum", "size"])
    others_average = (totals["sum"].sum() - totals["sum"]) / (totals["size"].sum() - totals["size"])
    model_error = _poisson_deviance(observed, held_out_expected(segs).sum(axis=1))
    average_error = _poisson_deviance(observed, segs["driver"].map(others_average))
    return {
        "drivers": int(segs["driver"].nunique()),
        "segments_km": int(len(segs)),
        "model_error": round(model_error, 4),
        "average_error": round(average_error, 4),
        "improvement_pct": round(100 * (1 - model_error / average_error), 1),
    }


def train(store: TripStore) -> dict:
    """Evaluate on held-out drivers, then fit on everything and save. Returns the evaluation."""
    segs = training_segments(store)
    evaluation = evaluate(segs)
    folder = model_dir(store)
    fit(segs).save(folder)
    (folder / "evaluation.json").write_text(json.dumps(evaluation, indent=2))
    return evaluation


def _poisson_deviance(observed: pd.Series, predicted: pd.Series) -> float:
    y, mu = observed.to_numpy(), np.clip(predicted.to_numpy(), 1e-9, None)
    y_log = np.where(y > 0, y * np.log(np.where(y > 0, y, 1) / mu), 0.0)
    return float(np.mean(2 * (y_log - (y - mu))))
