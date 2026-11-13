"""Scores through an API (FD-26). Start it with `uv run fairdrive api`.

POST /trips                    upload a Sensor Logger JSON export (form fields: file, driver); adds road, time and weather
GET  /trips/{trip_id}/score    both scores, the old score, and each kind of harsh moment against what's normal
GET  /trips/{trip_id}/explain  three plain-language reasons for each score
"""

import os
import tempfile
import urllib.error
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, Form, HTTPException, UploadFile

from fairdrive.features import is_tagged
from fairdrive.model import model_dir
from fairdrive.scoring import score_trips
from fairdrive.sensorlogger import RecordingError
from fairdrive.store import TripStore
from fairdrive.tagging import tag_all
from fairdrive.upload import upload

store = TripStore(Path(os.environ.get("FAIRDRIVE_DATA", "data")))
app = FastAPI(title="FairDrive", description="Driving scores that judge you against what is normal for your roads, time and weather.")
_cache: dict[tuple, pd.DataFrame] = {}
MOMENT_LABELS = {"hard_brake": "Hard braking", "hard_accel": "Sharp speeding up", "hard_corner": "Sharp turns"}


@app.post("/trips", status_code=201)
def add_trip(file: UploadFile, driver: str = Form()) -> dict:
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / Path(file.filename or "recording.json").name
        path.write_bytes(file.file.read())
        try:
            trip_ids = upload(path, driver.strip(), store)
        except RecordingError as error:
            raise HTTPException(400, f"{error}. Nothing was saved.")
        except FileExistsError as error:
            raise HTTPException(409, str(error))
    try:
        tag_all(store)
    except urllib.error.HTTPError as error:
        raise HTTPException(502, f"Trip(s) {', '.join(trip_ids)} saved, but the map or weather server answered {error.code}. "
                                 "Run `fairdrive tag` later to finish them.")
    trips = store.list().set_index("trip_id").loc[trip_ids]
    return {"trips": [{"trip_id": t, "distance_km": float(row["distance_km"]), "flag": row["flag"]} for t, row in trips.iterrows()]}


@app.get("/trips/{trip_id}/score")
def score(trip_id: str) -> dict:
    row = _scored(trip_id)
    return {"trip_id": trip_id, "driver": row["driver"], "km": int(row["km"]), "driving_score": float(row["driving_score"]),
            "conditions_score": float(row["conditions_score"]), "old_score": float(row["baseline_score"]),
            "moments": [{"kind": kind, "label": label, "count": int(row[kind]), "normal": round(float(row[f"expected_{kind}"]), 1)}
                        for kind, label in MOMENT_LABELS.items()]}


@app.get("/trips/{trip_id}/explain")
def explain(trip_id: str) -> dict:
    row = _scored(trip_id)
    return {"trip_id": trip_id, "driving_reasons": row["driving_reasons"], "conditions_reasons": row["conditions_reasons"]}


def _scored(trip_id: str) -> pd.Series:
    if not store.exists(trip_id):
        raise HTTPException(404, f"No trip {trip_id}")
    scores = _scores().set_index("trip_id")
    if trip_id not in scores.index:
        details = store.details(trip_id)
        if details["flag"]:
            why = details["flag"]
        elif not is_tagged(details):
            why = "it still needs road, time and weather (run `fairdrive tag`)"
        else:
            why = "less than 1 km is left once 500 m is hidden at each end. Drive at least 3 km"
        raise HTTPException(422, f"Trip {trip_id} is not scored: {why}")
    return scores.loc[trip_id]


def _scores() -> pd.DataFrame:
    """Scores for every trip, recomputed only when a trip or the model changes."""
    files = sorted(store.trips_dir.glob("*")) + sorted(model_dir(store).glob("*"))
    key = tuple((f.name, f.stat().st_mtime_ns) for f in files)
    if key not in _cache:
        _cache.clear()
        _cache[key] = score_trips(store)
    return _cache[key]
