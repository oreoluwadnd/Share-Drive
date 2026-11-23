"""Shared test trips: six drivers driving calmly, normally and harshly on highway and city roads, already tagged."""

import numpy as np
import pandas as pd
import pytest

from fairdrive.scoring import score_trips
from fairdrive.store import TripStore
from fairdrive.trips import Trip

STEP_S, SPEED_MS = 0.1, 20.0
# Normal hard-brake rate per km on each kind of road. City streets need far more braking.
NORMAL_PER_KM = {"motorway": 0.2, "residential": 1.0}


def add_tagged_trip(store, driver, road, km, per_km, day, style, dark=False):
    """A straight 20 m/s trip on one kind of road, already tagged. Each 'incident' is a hard brake,
    a sharp speed-up 5 s later and a sharp turn 10 s later, spaced evenly at per_km incidents per km."""
    n = int(km * 1000 / SPEED_MS / STEP_S)
    index = pd.date_range(pd.Timestamp("2026-03-01 14:00", tz="UTC") + pd.Timedelta(days=day), periods=n, freq="100ms")
    north_m = np.arange(n) * SPEED_MS * STEP_S
    forward, sideways = np.zeros(n), np.zeros(n)
    incidents = int(round(km * per_km))
    for i in range(incidents):
        at = int((i + 0.5) * n / incidents)
        forward[at:at + 5] = -3.0
        forward[at + 50:at + 55] = 3.0
        sideways[at + 100:at + 105] = 3.0
    points = pd.DataFrame({
        "lat": 43.6 + north_m / 111_195, "lon": np.full(n, -79.4), "speed": SPEED_MS,
        "acc_forward": forward, "acc_lateral": sideways, "acc_vertical": 0.0,
        "road_type": road, "speed_limit_kmh": 100.0 if road == "motorway" else 50.0, "speed_limit_source": "posted",
    }, index=index)
    trip_id = store.save(driver, Trip(index[0], index[-1], None, points.iloc[:, :6]), "sensorlogger", {"style": style})
    details = store.details(trip_id) | {
        "time": {"local_time": index[0].isoformat(), "local_hour": 10, "weekday": "Tuesday", "is_dark": dark},
        "weather": {"temp_c": 5.0, "precip_mm": 0.0, "visibility_km": 20.0, "wind_kmh": 10, "description": "Clear",
                    "station": "TEST", "station_km": 1.0, "hour_utc": index[0].isoformat()},
    }
    store.update(trip_id, details, points)
    return trip_id


@pytest.fixture
def store(tmp_path):
    """Six drivers. Each drives a highway and a city trip calmly (no incidents), normally, and harshly (3x normal)."""
    store = TripStore(tmp_path / "data")
    day = 1
    for d in range(6):
        for style, factor in [("calm", 0), ("normal", 1), ("harsh", 3)]:
            for road in NORMAL_PER_KM:
                add_tagged_trip(store, f"driver{d}", road, 20, NORMAL_PER_KM[road] * factor, day, style, dark=(d % 2 == 1))
                day += 1
    return store


@pytest.fixture
def scores(store):
    return score_trips(store)


PASSWORD = "correct horse battery"


@pytest.fixture
def make_client(monkeypatch):
    """make_client(store): an API test client on that store, with no accounts or sessions yet."""
    def make(store):
        from fastapi.testclient import TestClient
        from fairdrive import api
        from fairdrive.accounts import Accounts
        from fairdrive.sessions import Sessions
        monkeypatch.setattr(api, "store", store)
        monkeypatch.setattr(api, "admins", Accounts(store.root / "admins.json"))
        monkeypatch.setattr(api, "drivers", Accounts(store.root / "drivers.json"))
        monkeypatch.setattr(api, "sessions", Sessions(store.root / "sessions.json"))
        api._cache.clear()
        return TestClient(api.app)
    return make


def sign_up(client, name: str) -> dict:
    """Signs up a driver called `name` and returns {"headers", "driver"}."""
    response = client.post("/auth/signup", json={"name": name, "email": f"{name.lower()}@example.com", "password": PASSWORD})
    assert response.status_code == 201, response.text
    body = response.json()
    return {"headers": {"Authorization": f"Bearer {body['token']}"}, "driver": body["driver"]}


def admin_headers(client) -> dict:
    """Adds an admin and returns the headers of a logged-in session."""
    from fairdrive import api
    api.admins.add("admin@example.com", PASSWORD)
    token = client.post("/admin/login", json={"email": "admin@example.com", "password": PASSWORD}).json()["token"]
    return {"Authorization": f"Bearer {token}"}
