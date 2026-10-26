"""Read Sensor Logger JSON exports into one DataFrame per sensor."""

import json
from pathlib import Path

import pandas as pd

# Sensors and columns the pipeline needs. Accelerometer is motion without
# gravity; Gravity gives the phone's tilt, used to find "up".
REQUIRED = {
    "Accelerometer": ("x", "y", "z"),
    "Gravity": ("x", "y", "z"),
    "Location": ("latitude", "longitude", "speed", "bearing"),
}


class MissingColumnError(ValueError):
    def __init__(self, columns: list[str]):
        self.columns = columns
        super().__init__(f"Missing column(s): {', '.join(columns)}")


def read_recording(path: Path) -> dict[str, pd.DataFrame]:
    """Return {sensor: DataFrame indexed by UTC time} for the required sensors.

    Raises MissingColumnError naming every required column that is absent.
    """
    records = json.loads(Path(path).read_text())
    if not isinstance(records, list):
        raise ValueError(f"{path} is not a Sensor Logger JSON export (expected a list of records)")

    by_sensor: dict[str, list[dict]] = {}
    for record in records:
        by_sensor.setdefault(record["sensor"], []).append(record)

    missing = []
    for sensor, columns in REQUIRED.items():
        rows = by_sensor.get(sensor, [])
        present = set(rows[0]) if rows else set()
        missing += [f"{sensor}.{c}" for c in ("time", *columns) if c not in present]
    if missing:
        raise MissingColumnError(missing)

    return {sensor: _to_frame(by_sensor[sensor], columns) for sensor, columns in REQUIRED.items()}


def _to_frame(rows: list[dict], columns: tuple[str, ...]) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=["time", *columns])
    df = df.apply(pd.to_numeric)
    df.index = pd.to_datetime(df.pop("time").astype("int64"), unit="ns", utc=True)
    df = df[~df.index.duplicated()].sort_index()
    return df
