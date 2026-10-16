"""Naive baseline: count harsh events with fixed thresholds, ignoring road, time and weather."""

import pandas as pd

from fairdrive.store import TripStore

G = 9.80665
# Fixed thresholds (0.3 g each). Starting values for comparison, not tuned.
HARD_BRAKE_MS2 = 0.3 * G
HARD_ACCEL_MS2 = 0.3 * G
HARD_CORNER_MS2 = 0.3 * G
# Threshold crossings closer together than this are one event (noise around the threshold).
MERGE_WITHIN = "1s"
# Points lost per harsh event per 100 km. A driver with 50+ events per 100 km scores 0.
PENALTY_PER_EVENT_PER_100KM = 2.0


def count_events(points: pd.DataFrame) -> dict[str, int]:
    """Each stretch past a threshold counts as one event, merging stretches less than MERGE_WITHIN apart."""
    return {
        "hard_brake": _runs(points["acc_forward"] <= -HARD_BRAKE_MS2),
        "hard_accel": _runs(points["acc_forward"] >= HARD_ACCEL_MS2),
        "hard_corner": _runs(points["acc_lateral"].abs() >= HARD_CORNER_MS2),
    }


def driver_scores(store: TripStore) -> pd.DataFrame:
    """One row per driver with event counts and a 0 to 100 score. Flagged trips are skipped."""
    trips = store.list()
    trips = trips[trips["flag"].isna()]
    rows = [{"driver": t.driver, "distance_km": t.distance_km, **count_events(store.points(t.trip_id))} for t in trips.itertuples()]
    per_trip = pd.DataFrame(rows, columns=["driver", "distance_km", "hard_brake", "hard_accel", "hard_corner"])
    scores = per_trip.groupby("driver").sum()
    scores.insert(0, "trips", per_trip.groupby("driver").size())
    events = scores[["hard_brake", "hard_accel", "hard_corner"]].sum(axis=1)
    scores["events_per_100km"] = (100 * events / scores["distance_km"]).round(1)
    scores["score"] = (100 - PENALTY_PER_EVENT_PER_100KM * scores["events_per_100km"]).clip(0, 100).round(1)
    return scores.reset_index()


def _runs(above: pd.Series) -> int:
    recently_above = above.shift(fill_value=False).astype(float).rolling(MERGE_WITHIN).max() == 1
    return int((above & ~recently_above).sum())
