"""Save and list processed trips on disk.

Layout:
    <root>/trips/<trip_id>.json      trip details (always)
    <root>/trips/<trip_id>.parquet   cleaned points (only for scorable trips)
"""

import json
from pathlib import Path
from typing import Callable, TypeVar

import pandas as pd

from fairdrive.geo import step_distances_m
from fairdrive.trips import Trip

T = TypeVar("T")
_memo: dict[tuple, tuple] = {}


class TripStore:
    def __init__(self, root: Path):
        self.root = Path(root)
        self.trips_dir = self.root / "trips"

    @staticmethod
    def trip_id(driver: str, trip: Trip) -> str:
        return f"{driver}-{trip.start:%Y%m%dT%H%M%SZ}"

    def exists(self, trip_id: str) -> bool:
        return (self.trips_dir / f"{trip_id}.json").exists()

    def save(self, driver: str, trip: Trip, source: str, labels: dict | None = None, phone: dict | None = None) -> str:
        """labels: optional known facts about the trip, such as a dataset's driving style.
        phone: the recording phone's model and platform, when known."""
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
            "labels": labels,
            "phone": phone,
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

    def version(self, trip_id: str) -> tuple[int, ...]:
        """Changes whenever the trip's files are rewritten (saved or tagged)."""
        return tuple(p.stat().st_mtime_ns for p in sorted(self.trips_dir.glob(f"{trip_id}.*")))

    def remembered(self, kind: str, trip_id: str, work: Callable[[], T]) -> T:
        """work()'s result for this trip, worked out again only after the trip's files change.

        Kept in memory for as long as the process runs (the API), one result per trip and kind.
        """
        key, version = (str(self.root), kind, trip_id), self.version(trip_id)
        if _memo.get(key, (None,))[0] != version:
            _memo[key] = (version, work())
        return _memo[key][1]

    def details(self, trip_id: str) -> dict:
        return json.loads((self.trips_dir / f"{trip_id}.json").read_text())

    def delete(self, trip_id: str) -> None:
        """Remove a trip's details and points."""
        (self.trips_dir / f"{trip_id}.json").unlink()
        (self.trips_dir / f"{trip_id}.parquet").unlink(missing_ok=True)

    def update(self, trip_id: str, details: dict, points: pd.DataFrame) -> None:
        """Replace a trip's details and points (used when adding tags)."""
        points.to_parquet(self.trips_dir / f"{trip_id}.parquet")
        (self.trips_dir / f"{trip_id}.json").write_text(json.dumps(details, indent=2))
