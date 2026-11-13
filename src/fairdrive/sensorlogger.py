"""Read Sensor Logger JSON exports: a list of records, each tagged with its sensor."""

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
PHONE_FIELDS = {"device name": "device", "platform": "platform"}


class RecordingError(ValueError):
    """The file can't be used. Nothing is saved."""


class MissingColumnError(RecordingError):
    def __init__(self, columns: list[str]):
        self.columns = columns
        super().__init__(f"Missing column(s): {', '.join(columns)}")


def read_recording(path: Path) -> tuple[dict[str, pd.DataFrame], dict | None]:
    """Return ({sensor: DataFrame indexed by UTC time}, {"device", "platform"} or None).

    The phone comes from a "Metadata" record when the file has one (the FairDrive app always writes it).
    Raises RecordingError when a sensor recorded nothing, MissingColumnError naming every absent column.
    """
    try:
        records = json.loads(Path(path).read_text())
    except (UnicodeDecodeError, json.JSONDecodeError):
        records = None
    if not isinstance(records, list):
        raise RecordingError(f"{Path(path).name} is not a Sensor Logger JSON export")

    by_sensor: dict[str, list[dict]] = {}
    for record in records:
        by_sensor.setdefault(record["sensor"], []).append(record)

    empty = [sensor for sensor in REQUIRED if not by_sensor.get(sensor)]
    if empty:
        raise RecordingError(f"No readings in {', '.join(empty)}. Check the phone let the app record them "
                             "(for Location: Settings → the app → Location → Always)")
    missing = [f"{sensor}.{c}" for sensor, columns in REQUIRED.items() for c in ("time", *columns) if c not in by_sensor[sensor][0]]
    if missing:
        raise MissingColumnError(missing)

    sensors = {sensor: _to_frame(by_sensor[sensor], columns) for sensor, columns in REQUIRED.items()}
    meta = (by_sensor.get("Metadata") or [{}])[0]
    phone = {key: str(meta[field]) for field, key in PHONE_FIELDS.items()} if all(f in meta for f in PHONE_FIELDS) else None
    return sensors, phone


def _to_frame(rows: list[dict], columns: tuple[str, ...]) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=["time", *columns])
    df = df.apply(pd.to_numeric)
    df.index = pd.to_datetime(df.pop("time").astype("int64"), unit="ns", utc=True)
    df = df[~df.index.duplicated()].sort_index()
    return df
