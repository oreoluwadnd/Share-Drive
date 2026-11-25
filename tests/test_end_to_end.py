"""FD-30: ten phone recordings go through the whole flow (upload, tag, train, score, explain) with no errors.

Only the two internet lookups are replaced: OpenStreetMap returns one residential street around the
drive, and Environment Canada returns one hour of weather. Everything else is the real code.
"""

import pytest

from fairdrive import api, tagging
from fairdrive.model import train
from tests import synthetic
from tests.conftest import sign_up

DRIVERS = ["Ana", "Ben", "Chi", "Dev", "Eli"]


def fake_roads(lat, lon):
    corners = [(lat.min() - 0.01, lon.min() - 0.01), (lat.min() - 0.01, lon.max() + 0.01),
               (lat.max() + 0.01, lon.max() + 0.01), (lat.max() + 0.01, lon.min() - 0.01)]
    return [{"tags": {"highway": "residential"}, "geometry": [{"lat": a, "lon": b} for a, b in corners]}]


def fake_weather(time_utc, lat, lon):
    return {"station": "TEST", "station_km": 1.0, "hour_utc": time_utc.isoformat(), "temp_c": 4.0,
            "precip_mm": 0.0, "visibility_km": 15.0, "wind_kmh": 10, "description": "Cloudy"}


def recording(tmp_path, driver: int, trip: int):
    """An 8-minute city drive; later drivers brake harder. Each trip starts on its own day."""
    phases = [(s, a * (1 + 0.15 * driver), turn) for s, a, turn in synthetic.city_drive(8)]
    records = synthetic.to_records(synthetic.simulate(phases, seed=10 * driver + trip), seed=10 * driver + trip)
    offset = (driver * 2 + trip) * 86_400 * 10**9
    for r in records:
        if "time" in r:
            r["time"] = str(int(r["time"]) + offset)
    return synthetic.write(records, tmp_path / f"{DRIVERS[driver]}-{trip}.json")


@pytest.fixture
def client(tmp_path, make_client, monkeypatch):
    from fairdrive.store import TripStore
    monkeypatch.setattr(tagging, "fetch_roads", fake_roads)
    monkeypatch.setattr(tagging, "weather_tags", fake_weather)
    return make_client(TripStore(tmp_path / "data"))


def test_ten_trips_from_upload_to_explained_scores(client, tmp_path):
    uploaded = []  # (trip id, its driver's headers)
    for d in range(len(DRIVERS)):
        headers = sign_up(client, DRIVERS[d])["headers"]
        for t in range(2):
            path = recording(tmp_path, d, t)
            response = client.post("/trips", files={"file": (path.name, path.read_bytes())}, headers=headers)
            assert response.status_code == 201, response.text
            [trip] = response.json()["trips"]
            assert trip["flag"] is None, trip
            uploaded.append((trip["trip_id"], headers))

    assert train(api.store)["drivers"] == 5

    for trip_id, headers in uploaded:
        trip = client.get(f"/me/trips/{trip_id}", headers=headers)
        assert trip.status_code == 200, trip.text
        assert trip.json()["scored"], trip.json()
        score, reasons = trip.json()["score"], trip.json()["reasons"]
        assert all(0 <= score[k] <= 100 for k in ("driving_score", "conditions_score", "old_score"))
        assert len(reasons["driving_reasons"]) == 3 and len(reasons["conditions_reasons"]) == 3
        assert "Weather: 4 °C, Cloudy." in reasons["conditions_reasons"][2]
