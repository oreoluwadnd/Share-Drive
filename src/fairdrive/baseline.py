"""Naive baseline: harsh events per km compared with the average trip, ignoring road, time and weather."""

import pandas as pd

from fairdrive.events import EVENT_TYPES, count_events
from fairdrive.scale import halving_score
from fairdrive.store import TripStore


def trip_scores(store: TripStore) -> pd.DataFrame:
    """One row per scorable trip. score is 50 at the average events per km of all stored trips, 100 with none."""
    trips = store.list()
    trips = trips[trips["flag"].isna()]
    rows = [{"trip_id": t.trip_id, "driver": t.driver, "distance_km": t.distance_km, **count_events(store.points(t.trip_id))}
            for t in trips.itertuples()]
    scores = pd.DataFrame(rows, columns=["trip_id", "driver", "distance_km", *EVENT_TYPES])
    scores["events_per_km"] = scores[list(EVENT_TYPES)].sum(axis=1) / scores["distance_km"]
    if scores.empty:
        return scores.assign(score=pd.Series(dtype=float))
    average = scores[list(EVENT_TYPES)].sum().sum() / scores["distance_km"].sum()
    scores["score"] = halving_score(scores["events_per_km"], average).round(1)
    return scores


def driver_scores(store: TripStore) -> pd.DataFrame:
    """One row per driver: totals, events per 100 km and the average of their trip scores."""
    trips = trip_scores(store)
    drivers = trips.groupby("driver").agg(
        trips=("trip_id", "size"), distance_km=("distance_km", "sum"),
        **{kind: (kind, "sum") for kind in EVENT_TYPES}, score=("score", "mean"),
    )
    drivers.insert(len(drivers.columns) - 1, "events_per_100km", (100 * drivers[list(EVENT_TYPES)].sum(axis=1) / drivers["distance_km"]).round(1))
    return drivers.round({"distance_km": 1, "score": 1}).reset_index()
