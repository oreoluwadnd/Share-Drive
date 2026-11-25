"""Scores through an API (FD-26). Start it with `uv run fairdrive api`.

Every call except sign up and sign in needs "Authorization: Bearer <token>".

Drivers (phone app):
POST   /auth/signup             {name, email, password} -> {token, driver}
POST   /auth/login              {email, password} -> {token, driver}
POST   /auth/logout             ends this sign-in
GET    /me                      the signed-in driver
DELETE /me                      deletes the driver's account and every trip they uploaded
POST   /trips                   upload a Sensor Logger JSON export (form field: file); adds road, time and weather
GET    /me/trips                the driver's trips, newest first, with scores and harsh moments
GET    /me/trips/{trip_id}      one of the driver's trips: scores, reasons and route

Admins (web dashboard), with an account made by `fairdrive add-admin`:
POST   /admin/login             {email, password} -> {token, email}
GET    /admin/trips             every stored trip, scored or not
GET    /admin/trips/{trip_id}   any trip: scores, reasons and route
"""

import os
import secrets
import tempfile
import urllib.error
from pathlib import Path

import pandas as pd
from fastapi import Depends, FastAPI, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fairdrive.accounts import AccountExists, Accounts
from fairdrive.features import is_tagged
from fairdrive.model import NotEnoughTrips, model_dir
from fairdrive.scoring import score_trips
from fairdrive.sensorlogger import RecordingError
from fairdrive.sessions import Sessions
from fairdrive.store import TripStore
from fairdrive.tagging import tag_all
from fairdrive.upload import upload

store = TripStore(Path(os.environ.get("FAIRDRIVE_DATA", "data")))
admins = Accounts(store.root / "admins.json")
drivers = Accounts(store.root / "drivers.json")
sessions = Sessions(store.root / "sessions.json")
app = FastAPI(title="FairDrive", description="Driving scores that judge you against what is normal for your roads, time and weather.")
# The web dashboard is served from another port. Calls carry a bearer token, not cookies, so any origin is safe.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
_cache: dict[tuple, pd.DataFrame] = {}
ADMIN_SESSION_SECONDS = 12 * 3600
DRIVER_SESSION_SECONDS = 90 * 24 * 3600
ROUTE_POINTS = 300
MOMENT_LABELS = {"hard_brake": "Hard braking", "hard_accel": "Sharp speeding up", "hard_corner": "Sharp turns"}


# Driver accounts

class SignUp(BaseModel):
    name: str
    email: str
    password: str


class Login(BaseModel):
    email: str
    password: str


@app.post("/auth/signup", status_code=201)
def sign_up(form: SignUp) -> dict:
    if not form.name.strip():
        raise HTTPException(400, "Enter your name")
    try:
        driver = drivers.add(form.email, form.password, name=form.name.strip(), driver_id=f"u{secrets.token_hex(4)}")
    except AccountExists as error:
        raise HTTPException(409, f"{error}. Sign in instead.")
    except ValueError as error:
        raise HTTPException(400, str(error))
    return {"token": sessions.start("driver", driver["email"], DRIVER_SESSION_SECONDS), "driver": driver}


@app.post("/auth/login")
def sign_in(login: Login) -> dict:
    driver = drivers.check(login.email, login.password)
    if driver is None:
        raise HTTPException(401, "Wrong email or password")
    return {"token": sessions.start("driver", driver["email"], DRIVER_SESSION_SECONDS), "driver": driver}


def _token(authorization: str | None = Header(default=None)) -> str:
    return (authorization or "").removeprefix("Bearer ").strip()


def _driver(token: str = Depends(_token)) -> dict:
    """The signed-in driver, or a 401."""
    email = sessions.who(token, "driver")
    if email is None:
        raise HTTPException(401, "Sign in first")
    return drivers.get(email)


@app.post("/auth/logout", status_code=204)
def sign_out(token: str = Depends(_token), _: dict = Depends(_driver)) -> None:
    sessions.end(token)


@app.get("/me")
def me(driver: dict = Depends(_driver)) -> dict:
    return driver


@app.delete("/me", status_code=204)
def delete_me(driver: dict = Depends(_driver)) -> None:
    for trip_id in _trip_ids(driver["driver_id"]):
        store.delete(trip_id)
    sessions.end_all("driver", driver["email"])
    drivers.remove(driver["email"])


# Trips

@app.post("/trips", status_code=201)
def add_trip(file: UploadFile, driver: dict = Depends(_driver)) -> dict:
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / Path(file.filename or "recording.json").name
        path.write_bytes(file.file.read())
        try:
            trip_ids = upload(path, driver["driver_id"], store)
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


@app.get("/me/trips")
def my_trips(driver: dict = Depends(_driver)) -> dict:
    scores = _scores().set_index("trip_id")
    return {"trips": [_trip_row(trip_id, scores) for trip_id in _trip_ids(driver["driver_id"])]}


@app.get("/me/trips/{trip_id}")
def my_trip(trip_id: str, driver: dict = Depends(_driver)) -> dict:
    if trip_id not in _trip_ids(driver["driver_id"]):
        raise HTTPException(404, f"No trip {trip_id}")
    return _trip_detail(trip_id)


# Admins

@app.post("/admin/login")
def admin_login(login: Login) -> dict:
    admin = admins.check(login.email, login.password)
    if admin is None:
        raise HTTPException(401, "Wrong email or password")
    return {"token": sessions.start("admin", admin["email"], ADMIN_SESSION_SECONDS), "email": admin["email"]}


def _admin(token: str = Depends(_token)) -> str:
    """The logged-in admin's email, or a 401."""
    email = sessions.who(token, "admin")
    if email is None:
        raise HTTPException(401, "Log in first")
    return email


@app.get("/admin/trips")
def admin_trips(_: str = Depends(_admin)) -> dict:
    names = _driver_names()
    scores = _scores().set_index("trip_id")
    rows = [_trip_row(trip_id, scores) for trip_id in _trip_ids()]
    return {"trips": [row | {"driver_name": names.get(row["driver"], row["driver"])} for row in rows]}


@app.get("/admin/trips/{trip_id}")
def admin_trip(trip_id: str, _: str = Depends(_admin)) -> dict:
    if not store.exists(trip_id):
        raise HTTPException(404, f"No trip {trip_id}")
    trip = _trip_detail(trip_id)
    return trip | {"driver_name": _driver_names().get(trip["driver"], trip["driver"])}


def _driver_names() -> dict[str, str]:
    """Driver id -> name, for drivers with an account. Older trips (such as UAH-DriveSet) have none."""
    return {d["driver_id"]: d["name"] for d in drivers.all()}


# Shared

def _trip_ids(driver_id: str | None = None) -> list[str]:
    """Trip ids, newest first: one driver's, or everyone's."""
    trips = store.list().sort_values("start", ascending=False)
    if driver_id is not None:
        trips = trips[trips["driver"] == driver_id]
    return trips["trip_id"].tolist()


def _trip_row(trip_id: str, scores: pd.DataFrame) -> dict:
    """scores: _scores() indexed by trip_id."""
    details = store.details(trip_id)
    row = {"trip_id": trip_id, "driver": details["driver"], "start": details["start"], "distance_km": details["distance_km"],
           "phone": details.get("phone")}
    if trip_id not in scores.index:
        return row | {"scored": False, "why": _why_not_scored(details), "driving_score": None, "conditions_score": None,
                      "old_score": None, "moments": None}
    score = _score_body(trip_id, scores.loc[trip_id])
    return row | {"scored": True, "why": None, "driving_score": score["driving_score"], "conditions_score": score["conditions_score"],
                  "old_score": score["old_score"], "moments": score["moments"]}


def _trip_detail(trip_id: str) -> dict:
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


def _why_not_scored(details: dict) -> str:
    if details["flag"]:
        return details["flag"]
    if not is_tagged(details):
        return "it still needs road, time and weather (run `fairdrive tag`)"
    if _scores().empty:
        return "FairDrive needs tagged trips from at least 2 drivers before it can score any"
    return "less than 1 km is left once 500 m is hidden at each end. Drive at least 3 km"


def _scores() -> pd.DataFrame:
    """Scores for every trip, recomputed only when a trip or the model changes."""
    files = sorted(store.trips_dir.glob("*")) + sorted(model_dir(store).glob("*"))
    key = tuple((f.name, f.stat().st_mtime_ns) for f in files)
    if key not in _cache:
        _cache.clear()
        try:
            _cache[key] = score_trips(store)
        except NotEnoughTrips:
            _cache[key] = pd.DataFrame(columns=["trip_id"])
    return _cache[key]
