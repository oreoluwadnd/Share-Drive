# FairDrive

Context-aware driving scores from phone sensor trips.

## Setup

```
uv sync
uv run pytest
```

## Usage

Record a drive with [Sensor Logger](https://github.com/tszheichoi/awesome-sensor-logger) (Accelerometer, Gravity and Location turned on) and export it as JSON.

```
uv run fairdrive upload recording.json --driver ana   # check, clean, split and save trips
uv run fairdrive trips                                # list trips (flagged ones are not scored)
uv run fairdrive baseline                             # naive event-count score per driver
```

Trips are saved under `data/`. Raw sensor data is never saved, and the first and last 500 m of each trip are removed.

Keep the phone in one mount position for the whole drive. Acceleration is turned into the car's forward, sideways and vertical directions using GPS, which only works if the phone stays still in its mount.
