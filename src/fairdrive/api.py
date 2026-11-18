"""Scores through an API (FD-26). Start it with `uv run fairdrive api`.

POST /trips                    upload a Sensor Logger JSON export (form fields: file, driver); adds road, time and weather
GET  /trips/{trip_id}/score    both scores, the old score, and each kind of harsh moment against what's normal
GET  /trips/{trip_id}/explain  three plain-language reasons for each score

Admin (web dashboard), after logging in with an account made by `fairdrive add-admin`:
POST /admin/login              {email, password} -> {token}; send it as "Authorization: Bearer <token>"
GET  /admin/trips              every stored trip, scored or not
GET  /admin/trips/{trip_id}    one trip: scores, reasons and route
"""

import os
import secrets
import tempfile
import time
import urllib.error
from pathlib import Path

import pandas as pd
from fastapi import Depends, FastAPI, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fairdrive.admins import AdminAccounts
from fairdrive.features import is_tagged
from fairdrive.model import model_dir
from fairdrive.scoring import score_trips
from fairdrive.sensorlogger import RecordingError
from fairdrive.store import TripStore
from fairdrive.tagging import tag_all
from fairdrive.upload import upload

store = TripStore(Path(os.environ.get("FAIRDRIVE_DATA", "data")))
admins = AdminAccounts(store.root / "admins.json")
app = FastAPI(title="FairDrive", description="Driving scores that judge you against what is normal for your roads, time and weather.")
# The web dashboard is served from another port. Admin calls carry a bearer token, not cookies, so any origin is safe.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
_cache: dict[tuple, pd.DataFrame] = {}
SESSION_SECONDS = 12 * 3600
ROUTE_POINTS = 300
_sessions: dict[str, tuple[str, float]] = {}  # token -> (email, expiry); cleared when the server restarts
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
    return _score_body(trip_id, _scored(trip_id))


@app.get("/trips/{trip_id}/explain")
def explain(trip_id: str) -> dict:
    return {"trip_id": trip_id, **_reasons(_scored(trip_id))}


class Login(BaseModel):
    email: str
    password: str


@app.post("/admin/login")
def admin_login(login: Login) -> dict:
    if not admins.check(login.email, login.password):
        raise HTTPException(401, "Wrong email or password")
    token = secrets.token_urlsafe(32)
    _sessions[token] = (login.email.strip().lower(), time.time() + SESSION_SECONDS)
    return {"token": token, "email": login.email.strip().lower()}


def _admin(authorization: str | None = Header(default=None)) -> str:
    """The logged-in admin's email, or a 401."""
    token = (authorization or "").removeprefix("Bearer ").strip()
    email, expiry = _sessions.get(token, ("", 0.0))
    if time.time() > expiry:
        _sessions.pop(token, None)
        raise HTTPException(401, "Log in first")
    return email


@app.get("/admin/trips")
def admin_trips(_: str = Depends(_admin)) -> dict:
    scores = _scores().set_index("trip_id")
    rows = []
    for trip in store.list().sort_values("start", ascending=False).itertuples():
        details = store.details(trip.trip_id)
        scored = trip.trip_id in scores.index
        row = scores.loc[trip.trip_id] if scored else None
        rows.append({
            "trip_id": trip.trip_id, "driver": trip.driver, "start": trip.start, "distance_km": float(trip.distance_km),
            "phone": details.get("phone"), "scored": scored, "why": None if scored else _why_not_scored(details),
            "driving_score": float(row["driving_score"]) if scored else None,
            "conditions_score": float(row["conditions_score"]) if scored else None,
            "old_score": float(row["baseline_score"]) if scored else None,
        })
    return {"trips": rows}


@app.get("/admin/trips/{trip_id}")
def admin_trip(trip_id: str, _: str = Depends(_admin)) -> dict:
    if not store.exists(trip_id):
        raise HTTPException(404, f"No trip {trip_id}")
    details = store.details(trip_id)
    scores = _scores().set_index("trip_id")
    trip = {"trip_id": trip_id, "driver": details["driver"], "start": details["start"], "distance_km": details["distance_km"],
            "phone": details.get("phone"), "route": _route(trip_id, details)}
    if trip_id not in scores.index:
        return {**trip, "scored": False, "why": _why_not_scored(details)}
    row = scores.loc[trip_id]
    return {**trip, "scored": True, "score": _score_body(trip_id, row), "reasons": _reasons(row)}


def _score_body(trip_id: str, row: pd.Series) -> dict:
    return {"trip_id": trip_id, "driver": row["driver"], "km": int(row["km"]), "driving_score": float(row["driving_score"]),
            "conditions_score": float(row["conditions_score"]), "old_score": float(row["baseline_score"]),
            "moments": [{"kind": kind, "label": label, "count": int(row[kind]), "normal": round(float(row[f"expected_{kind}"]), 1)}
                        for kind, label in MOMENT_LABELS.items()]}


def _reasons(row: pd.Series) -> dict:
    return {"driving_reasons": row["driving_reasons"], "conditions_reasons": row["conditions_reasons"]}


def _route(trip_id: str, details: dict) -> list[list[float]]:
    """At most ROUTE_POINTS [lat, lon] pairs along the kept part of the trip. Flagged trips keep no points."""
    if details["flag"]:
        return []
    points = store.points(trip_id)[["lat", "lon"]]
    step = max(1, len(points) // ROUTE_POINTS + 1)
    return points.iloc[::step].round(6).to_numpy().tolist()


def _scored(trip_id: str) -> pd.Series:
    if not store.exists(trip_id):
        raise HTTPException(404, f"No trip {trip_id}")
    scores = _scores().set_index("trip_id")
    if trip_id not in scores.index:
        raise HTTPException(422, f"Trip {trip_id} is not scored: {_why_not_scored(store.details(trip_id))}")
    return scores.loc[trip_id]


def _why_not_scored(details: dict) -> str:
    if details["flag"]:
        return details["flag"]
    if not is_tagged(details):
        return "it still needs road, time and weather (run `fairdrive tag`)"
    return "less than 1 km is left once 500 m is hidden at each end. Drive at least 3 km"


def _scores() -> pd.DataFrame:
    """Scores for every trip, recomputed only when a trip or the model changes."""
    files = sorted(store.trips_dir.glob("*")) + sorted(model_dir(store).glob("*"))
    key = tuple((f.name, f.stat().st_mtime_ns) for f in files)
    if key not in _cache:
        _cache.clear()
        _cache[key] = score_trips(store)
    return _cache[key]
