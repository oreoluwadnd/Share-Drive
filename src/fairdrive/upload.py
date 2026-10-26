"""Upload a Sensor Logger recording: check it, process it into trips and save them.

Raw sensor data is never written to the store. Only trips with both ends hidden are saved.
"""

from pathlib import Path

from fairdrive.sensorlogger import read_recording
from fairdrive.store import TripStore
from fairdrive.trips import process_recording

SOURCE = "sensorlogger"


def upload(path: Path, driver: str, store: TripStore) -> list[str]:
    """Return the ids of the saved trips. Nothing is saved if the file is invalid."""
    trips = process_recording(read_recording(path))
    duplicates = [store.trip_id(driver, t) for t in trips if store.exists(store.trip_id(driver, t))]
    if duplicates:
        raise FileExistsError(f"Trip(s) already uploaded: {', '.join(duplicates)}")
    return [store.save(driver, trip, SOURCE) for trip in trips]
