"""Scores through an API (FD-26). Start it with `uv run fairdrive api`.

Every call except sign up and sign in needs "Authorization: Bearer <token>".

Anyone:
GET    /companies               approved insurance companies, for the sign-up dropdown
POST   /companies/signup        {company, name, email, password}: a new company, waiting for approval
GET    /invites/{code}          {email, company} of a team invite
POST   /invites/{code}/accept   {name, password} -> {token, account}: joins that company's team

Drivers (phone app):
POST   /auth/signup             {name, email, password, company_id} -> {token, driver}
POST   /auth/login              {email, password} -> {token, driver}
POST   /auth/logout             ends this sign-in
GET    /me                      the signed-in driver, with their insurance company (null if none)
PUT    /me/company              {company_id}: choose an insurance company, for a driver who has none
DELETE /me                      deletes the driver's account and every trip they uploaded
POST   /trips                   upload a Sensor Logger JSON export (form field: file); adds road, time and weather
GET    /me/trips                the driver's trips, newest first, with scores and harsh moments
GET    /me/trips/{trip_id}      one of the driver's trips: scores, reasons and route

Staff (web dashboard). A super admin (made by `fairdrive add-admin`) sees everything; a company's
owner and members see only that company's drivers. Only the owner changes the team or removes drivers.
POST   /admin/login             {email, password} -> {token, account}
GET    /admin/trips             trips, scored or not
GET    /admin/trips/{trip_id}   one trip: scores, reasons and route
GET    /admin/drivers           drivers with an account
DELETE /admin/drivers/{id}      owner: the driver leaves the company
GET    /admin/team              owner: team members and open invites
POST   /admin/team/invites      owner: {email} -> {code} for a one-time link
DELETE /admin/team/{email}      owner: removes a team member
GET    /admin/companies         super admin: every company
POST   /admin/companies/{id}/approve, /reject    super admin
"""

import os
import secrets
import tempfile
import threading
import urllib.error
from contextlib import asynccontextmanager
from pathlib import Path

import pandas as pd
from fastapi import Depends, FastAPI, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fairdrive.accounts import AccountExists, Accounts
from fairdrive.companies import Companies, Invites
from fairdrive.features import is_tagged
from fairdrive.model import NotEnoughTrips, model_dir
from fairdrive.scoring import score_trips
from fairdrive.sensorlogger import RecordingError
from fairdrive.sessions import Sessions
from fairdrive.store import TripStore
from fairdrive.tagging import tag_all
from fairdrive.upload import upload

store = TripStore(Path(os.environ.get("FAIRDRIVE_DATA", "data")))
staff = Accounts(store.root / "staff.json")
drivers = Accounts(store.root / "drivers.json")
companies = Companies(store.root / "companies.json")
invites = Invites(store.root / "invites.json")
sessions = Sessions(store.root / "sessions.json")


@asynccontextmanager
async def _warm_up(_: FastAPI):
    """Score everything in the background as the server starts, so the first visitor after a deploy doesn't wait."""
    threading.Thread(target=_scores, daemon=True).start()
    yield


app = FastAPI(title="FairDrive", description="Driving scores that judge you against what is normal for your roads, time and weather.",
              lifespan=_warm_up)
# The web dashboard is served from another port. Calls carry a bearer token, not cookies, so any origin is safe.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
_cache: dict[tuple, pd.DataFrame] = {}
STAFF_SESSION_SECONDS = 12 * 3600
INVITE_SECONDS = 7 * 24 * 3600
DRIVER_SESSION_SECONDS = 90 * 24 * 3600
ROUTE_POINTS = 300
MOMENT_LABELS = {"hard_brake": "Hard braking", "hard_accel": "Sharp speeding up", "hard_corner": "Sharp turns"}


# Driver accounts

class SignUp(BaseModel):
    name: str
    email: str
    password: str
    company_id: str


class Login(BaseModel):
    email: str
    password: str


@app.post("/auth/signup", status_code=201)
def sign_up(form: SignUp) -> dict:
    if not form.name.strip():
        raise HTTPException(400, "Enter your name")
    if form.company_id not in {c["company_id"] for c in _approved_companies()}:
        raise HTTPException(400, "Choose your insurance company")
    try:
        driver = drivers.add(form.email, form.password, name=form.name.strip(), driver_id=f"u{secrets.token_hex(4)}",
                             company_id=form.company_id)
    except AccountExists as error:
        raise HTTPException(409, f"{error}. Sign in instead.")
    except ValueError as error:
        raise HTTPException(400, str(error))
    return {"token": sessions.start("driver", driver["email"], DRIVER_SESSION_SECONDS), "driver": _driver_view(driver)}


@app.post("/auth/login")
def sign_in(login: Login) -> dict:
    driver = drivers.check(login.email, login.password)
    if driver is None:
        raise HTTPException(401, "Wrong email or password")
    return {"token": sessions.start("driver", driver["email"], DRIVER_SESSION_SECONDS), "driver": _driver_view(driver)}


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
    return _driver_view(driver)


class Choice(BaseModel):
    company_id: str


@app.put("/me/company")
def choose_company(choice: Choice, driver: dict = Depends(_driver)) -> dict:
    """For drivers without an insurer: older accounts, or ones a company removed."""
    if _driver_view(driver)["company"] is not None:
        raise HTTPException(409, "You already have an insurance company")
    if choice.company_id not in {c["company_id"] for c in _approved_companies()}:
        raise HTTPException(400, "Choose your insurance company")
    return _driver_view(drivers.update(driver["email"], company_id=choice.company_id))


def _driver_view(driver: dict) -> dict:
    """The driver as the app sees them. `company` is their insurer while it is approved, else None."""
    approved = {c["company_id"]: c["name"] for c in _approved_companies()}
    company_id = driver.get("company_id")
    company = {"company_id": company_id, "name": approved[company_id]} if company_id in approved else None
    return {"email": driver["email"], "name": driver["name"], "driver_id": driver["driver_id"], "company": company}


@app.delete("/me", status_code=204)
def delete_me(driver: dict = Depends(_driver)) -> None:
    for trip_id in _trip_ids({driver["driver_id"]}):
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
        # Saved but not tagged: the next upload (or `fairdrive tag` on the server) finishes it.
        raise HTTPException(502, "Your drive was saved, but the map or weather service didn't answer, so it can't be scored yet. "
                                 "FairDrive tries again each time a drive is sent. You'll find it under Trips.")
    trips = store.list().set_index("trip_id").loc[trip_ids]
    return {"trips": [{"trip_id": t, "distance_km": float(row["distance_km"]), "flag": row["flag"]} for t, row in trips.iterrows()]}


@app.get("/me/trips")
def my_trips(driver: dict = Depends(_driver)) -> dict:
    scores = _scores().set_index("trip_id")
    return {"trips": [_trip_row(trip_id, scores) for trip_id in _trip_ids({driver["driver_id"]})]}


@app.get("/me/trips/{trip_id}")
def my_trip(trip_id: str, driver: dict = Depends(_driver)) -> dict:
    if trip_id not in _trip_ids({driver["driver_id"]}):
        raise HTTPException(404, f"No trip {trip_id}")
    return _trip_detail(trip_id)


# Companies and invites (no sign-in)

class CompanySignUp(BaseModel):
    company: str
    name: str
    email: str
    password: str


class Join(BaseModel):
    name: str
    password: str


@app.get("/companies")
def approved_companies() -> dict:
    return {"companies": [{"company_id": c["company_id"], "name": c["name"]} for c in _approved_companies()]}


@app.post("/companies/signup", status_code=201)
def company_sign_up(form: CompanySignUp) -> dict:
    if not form.company.strip():
        raise HTTPException(400, "Enter your company's name")
    if not form.name.strip():
        raise HTTPException(400, "Enter your name")
    if companies.name_taken(form.company):
        raise HTTPException(409, f"{form.company.strip()} already has a FairDrive account")
    company_id = f"c{secrets.token_hex(4)}"
    _add_staff(form.email, form.password, name=form.name.strip(), role="owner", company_id=company_id)
    return {"company": companies.add(company_id, form.company)}


@app.get("/invites/{code}")
def invite(code: str) -> dict:
    found = _invite(code)
    return {"email": found["email"], "company": companies.get(found["company_id"])["name"]}


@app.post("/invites/{code}/accept", status_code=201)
def accept_invite(code: str, form: Join) -> dict:
    found = _invite(code)
    if not form.name.strip():
        raise HTTPException(400, "Enter your name")
    account = _add_staff(found["email"], form.password, name=form.name.strip(), role="member", company_id=found["company_id"])
    invites.use(code)
    return _staff_session(account)


def _invite(code: str) -> dict:
    found = invites.get(code)
    if found is None:
        raise HTTPException(404, "This invite link has expired or was already used. Ask for a new one.")
    return found


def _add_staff(email: str, password: str, **profile) -> dict:
    try:
        return staff.add(email, password, **profile)
    except AccountExists as error:
        raise HTTPException(409, f"{error}. Log in instead.")
    except ValueError as error:
        raise HTTPException(400, str(error))


def _approved_companies() -> list[dict]:
    return sorted((c for c in companies.all() if c["status"] == "approved"), key=lambda c: c["name"].lower())


# Staff (web dashboard)

@app.post("/admin/login")
def staff_login(login: Login) -> dict:
    account = staff.check(login.email, login.password)
    if account is None:
        raise HTTPException(401, "Wrong email or password")
    _check_company(account)
    return _staff_session(account)


def _staff_session(account: dict) -> dict:
    company = None if account["role"] == "super" else companies.get(account["company_id"])
    return {"token": sessions.start("staff", account["email"], STAFF_SESSION_SECONDS),
            "account": account | {"company": company and {"company_id": company["company_id"], "name": company["name"]}}}


def _check_company(account: dict) -> None:
    """Company staff can only use the dashboard once FairDrive has approved their company."""
    if account["role"] == "super":
        return
    company = companies.get(account["company_id"])
    if company["status"] == "pending":
        raise HTTPException(403, f"{company['name']} is waiting for FairDrive to approve it. Try again once it's approved.")
    if company["status"] == "rejected":
        raise HTTPException(403, f"FairDrive didn't approve {company['name']}. Contact the FairDrive team.")


def _staff(token: str = Depends(_token)) -> dict:
    """The logged-in staff account, or a 401."""
    email = sessions.who(token, "staff")
    if email is None:
        raise HTTPException(401, "Log in first")
    account = staff.get(email)
    _check_company(account)
    return account


def _owner(account: dict = Depends(_staff)) -> dict:
    if account["role"] != "owner":
        raise HTTPException(403, "Only your company's owner can do this")
    return account


def _super(account: dict = Depends(_staff)) -> dict:
    if account["role"] != "super":
        raise HTTPException(403, "Only the FairDrive team can do this")
    return account


def _drivers_of(account: dict) -> list[dict]:
    """Driver accounts this staff account may see: all for a super admin, else its company's."""
    return [d for d in drivers.all() if account["role"] == "super" or d.get("company_id") == account["company_id"]]


def _visible_trip_ids(account: dict) -> list[str]:
    """A super admin sees every trip, including those of drivers without an account (such as UAH-DriveSet)."""
    return _trip_ids(None if account["role"] == "super" else {d["driver_id"] for d in _drivers_of(account)})


@app.get("/admin/trips")
def staff_trips(account: dict = Depends(_staff)) -> dict:
    names = _driver_names()
    scores = _scores().set_index("trip_id")
    rows = [_trip_row(trip_id, scores) for trip_id in _visible_trip_ids(account)]
    return {"trips": [row | {"driver_name": names.get(row["driver"], row["driver"])} for row in rows]}


@app.get("/admin/trips/{trip_id}")
def staff_trip(trip_id: str, account: dict = Depends(_staff)) -> dict:
    if trip_id not in _visible_trip_ids(account):
        raise HTTPException(404, f"No trip {trip_id}")
    trip = _trip_detail(trip_id)
    return trip | {"driver_name": _driver_names().get(trip["driver"], trip["driver"])}


@app.get("/admin/drivers")
def staff_drivers(account: dict = Depends(_staff)) -> dict:
    trips = store.list()["driver"].value_counts()
    names = {c["company_id"]: c["name"] for c in companies.all()}
    return {"drivers": [{"driver_id": d["driver_id"], "name": d["name"], "email": d["email"], "trips": int(trips.get(d["driver_id"], 0)),
                         "company": names.get(d.get("company_id"))}
                        for d in sorted(_drivers_of(account), key=lambda d: d["name"].lower())]}


@app.delete("/admin/drivers/{driver_id}", status_code=204)
def remove_driver(driver_id: str, owner: dict = Depends(_owner)) -> None:
    driver = next((d for d in _drivers_of(owner) if d["driver_id"] == driver_id), None)
    if driver is None:
        raise HTTPException(404, f"No driver {driver_id}")
    drivers.update(driver["email"], company_id=None)


@app.get("/admin/team")
def team(owner: dict = Depends(_owner)) -> dict:
    members = [a for a in staff.all() if a.get("company_id") == owner["company_id"]]
    return {"members": sorted(members, key=lambda a: (a["role"] != "owner", a["name"].lower())),
            "invites": invites.open_for(owner["company_id"])}


class Invite(BaseModel):
    email: str


@app.post("/admin/team/invites", status_code=201)
def invite_member(form: Invite, owner: dict = Depends(_owner)) -> dict:
    email = form.email.strip().lower()
    if "@" not in email:
        raise HTTPException(400, "Enter a valid email address")
    if email in {a["email"] for a in staff.all()}:
        raise HTTPException(409, f"{email} already has a dashboard account")
    return {"code": invites.start(owner["company_id"], email, INVITE_SECONDS)}


@app.delete("/admin/team/{email}", status_code=204)
def remove_member(email: str, owner: dict = Depends(_owner)) -> None:
    member = next((a for a in staff.all() if a["email"] == email and a.get("company_id") == owner["company_id"]), None)
    if member is None:
        raise HTTPException(404, f"No team member {email}")
    if member["role"] == "owner":
        raise HTTPException(400, "The owner can't be removed")
    sessions.end_all("staff", email)
    staff.remove(email)


@app.get("/admin/companies")
def all_companies(_: dict = Depends(_super)) -> dict:
    counts = pd.Series([d.get("company_id") for d in drivers.all()], dtype=object).value_counts()
    owners = {a["company_id"]: a for a in staff.all() if a["role"] == "owner"}
    return {"companies": [c | {"drivers": int(counts.get(c["company_id"], 0)),
                               "owner": {"name": owners[c["company_id"]]["name"], "email": owners[c["company_id"]]["email"]}}
                          for c in sorted(companies.all(), key=lambda c: -c["created"])]}


@app.post("/admin/companies/{company_id}/approve", status_code=204)
def approve_company(company_id: str, _: dict = Depends(_super)) -> None:
    _company(company_id)
    companies.set_status(company_id, "approved")


@app.post("/admin/companies/{company_id}/reject", status_code=204)
def reject_company(company_id: str, _: dict = Depends(_super)) -> None:
    _company(company_id)
    companies.set_status(company_id, "rejected")


def _company(company_id: str) -> dict:
    if company_id not in {c["company_id"] for c in companies.all()}:
        raise HTTPException(404, f"No company {company_id}")
    return companies.get(company_id)


def _driver_names() -> dict[str, str]:
    """Driver id -> name, for drivers with an account. Older trips (such as UAH-DriveSet) have none."""
    return {d["driver_id"]: d["name"] for d in drivers.all()}


# Shared

def _trip_ids(driver_ids: set[str] | None = None) -> list[str]:
    """Trip ids, newest first: of these drivers, or everyone's."""
    trips = store.list().sort_values("start", ascending=False)
    if driver_ids is not None:
        trips = trips[trips["driver"].isin(driver_ids)]
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
        return "FairDrive is still looking up the road, time and weather for this drive. Check back later"
    if _scores().empty:
        return "FairDrive needs drives from at least 2 drivers before it can score any"
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
