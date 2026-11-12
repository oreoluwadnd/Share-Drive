"""Read Sensor Logger zip exports: one CSV per sensor plus Metadata.csv."""

import io
import zipfile
from pathlib import Path

import pandas as pd

# Sensors and columns the pipeline needs. Accelerometer is motion without
# gravity; Gravity gives the phone's tilt, used to find "up".
REQUIRED = {
    "Accelerometer": ("x", "y", "z"),
    "Gravity": ("x", "y", "z"),
    "Location": ("latitude", "longitude", "speed", "bearing"),
}
PHONE_COLUMNS = {"device name": "device", "platform": "platform"}


class RecordingError(ValueError):
    """The file can't be used. Nothing is saved."""


class MissingColumnError(RecordingError):
    def __init__(self, columns: list[str]):
        self.columns = columns
        super().__init__(f"Missing column(s): {', '.join(columns)}")


def read_recording(path: Path) -> tuple[dict[str, pd.DataFrame], dict]:
    """Return ({sensor: DataFrame indexed by UTC time}, {"device", "platform"}).

    Raises MissingColumnError naming every required column that is absent, and RecordingError
    when a sensor was switched on but recorded nothing.
    """
    if not zipfile.is_zipfile(path):
        raise RecordingError(f"{Path(path).name} is not a Sensor Logger zip export")
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        tables = {name: _csv(archive, f"{name}.csv") for name in [*REQUIRED, "Metadata"] if f"{name}.csv" in names}

    empty = [name for name, table in tables.items() if table is None or table.empty]
    if empty:
        raise RecordingError(f"No readings in {', '.join(empty)}. Check the phone let Sensor Logger record them "
                             "(for Location: Settings → Sensor Logger → Location → Always)")
    missing = [f"{sensor}.{c}" for sensor, columns in REQUIRED.items() for c in ("time", *columns)
               if c not in tables.get(sensor, pd.DataFrame()).columns]
    missing += [f"Metadata.{c}" for c in PHONE_COLUMNS if c not in tables.get("Metadata", pd.DataFrame()).columns]
    if missing:
        raise MissingColumnError(missing)

    sensors = {sensor: _by_time(tables[sensor], columns) for sensor, columns in REQUIRED.items()}
    meta = tables["Metadata"].iloc[0]
    return sensors, {key: str(meta[column]) for column, key in PHONE_COLUMNS.items()}


def _csv(archive: zipfile.ZipFile, name: str) -> pd.DataFrame | None:
    """None for a 0-byte file (a sensor that recorded nothing)."""
    data = archive.read(name)
    return pd.read_csv(io.BytesIO(data)) if data.strip() else None


def _by_time(table: pd.DataFrame, columns: tuple[str, ...]) -> pd.DataFrame:
    df = table[["time", *columns]].apply(pd.to_numeric)
    df.index = pd.to_datetime(df.pop("time").astype("int64"), unit="ns", utc=True)
    df = df[~df.index.duplicated()].sort_index()
    return df
