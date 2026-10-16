"""Save and list processed trips on disk.

Layout:
    <root>/trips/<trip_id>.json      trip details (always)
    <root>/trips/<trip_id>.parquet   cleaned points (only for scorable trips)
"""

import json
from pathlib import Path

import pandas as pd

from fairdrive.geo import step_distances_m
from fairdrive.trips import Trip


class TripStore:
    def __init__(self, root: Path):
        self.root = Path(root)
        self.trips_dir = self.root / "trips"

    @staticmethod
    def trip_id(driver: str, trip: Trip) -> str:
        return f"{driver}-{trip.start:%Y%m%dT%H%M%SZ}"

    def exists(self, trip_id: str) -> bool:
        return (self.trips_dir / f"{trip_id}.json").exists()

    def save(self, driver: str, trip: Trip, source: str) -> str:
        trip_id = self.trip_id(driver, trip)
        self.trips_dir.mkdir(parents=True, exist_ok=True)
        distance_km = 0.0
        if trip.points is not None:
            trip.points.to_parquet(self.trips_dir / f"{trip_id}.parquet")
            distance_km = step_distances_m(trip.points["lat"].to_numpy(), trip.points["lon"].to_numpy()).sum() / 1000
        details = {
            "trip_id": trip_id,
            "driver": driver,
            "source": source,
            "start": trip.start.isoformat(),
            "duration_min": round((trip.end - trip.start).total_seconds() / 60, 1),
            "distance_km": round(distance_km, 2),
            "flag": trip.flag,
        }
        (self.trips_dir / f"{trip_id}.json").write_text(json.dumps(details, indent=2))
        return trip_id

    def list(self) -> pd.DataFrame:
        rows = [json.loads(p.read_text()) for p in sorted(self.trips_dir.glob("*.json"))]
        return pd.DataFrame(rows, columns=["trip_id", "driver", "source", "start", "duration_min", "distance_km", "flag"])

    def summary(self) -> pd.DataFrame:
        """Drivers, trips and kilometres (of stored points) per source."""
        trips = self.list()
        return trips.groupby("source").agg(
            drivers=("driver", "nunique"), trips=("trip_id", "size"), km=("distance_km", "sum")
        ).round(1).reset_index()

    def points(self, trip_id: str) -> pd.DataFrame:
        return pd.read_parquet(self.trips_dir / f"{trip_id}.parquet")
