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
uv run fairdrive load-uah path/to/UAH-DRIVESET-v1     # load the UAH-DriveSet public dataset
uv run fairdrive summary                              # drivers, trips and km per source
uv run fairdrive tag                                  # road type, speed limit, time of day, weather (needs internet)
```

`tag` can be re-run any time. It skips trips that are done and fills in weather that Environment Canada hadn't published yet (it runs a few days behind).

For UAH-DriveSet only the `.txt` files are needed (about 13 MB zipped, versus 3.5 GB with videos):

```
unzip -q UAH-DRIVESET-v1.zip '*.txt' -d uah-text
```

Trips are saved under `data/`. Raw sensor data is never saved, and the first and last 500 m of each trip are removed.

Keep the phone in one mount position for the whole drive. Acceleration is turned into the car's forward, sideways and vertical directions using GPS, which only works if the phone stays still in its mount.
