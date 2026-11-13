"""FD-30: ten phone recordings go through the whole flow (upload, tag, train, score, explain) with no errors.

Only the two internet lookups are replaced: OpenStreetMap returns one residential street around the
drive, and Environment Canada returns one hour of weather. Everything else is the real code.
"""

import pytest
from fastapi.testclient import TestClient

from fairdrive import api, tagging
from fairdrive.model import train
from tests import synthetic

DRIVERS = ["ana", "ben", "chi", "dev", "eli"]


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
def client(tmp_path, monkeypatch):
    from fairdrive.store import TripStore
    monkeypatch.setattr(api, "store", TripStore(tmp_path / "data"))
    monkeypatch.setattr(tagging, "fetch_roads", fake_roads)
    monkeypatch.setattr(tagging, "weather_tags", fake_weather)
    api._cache.clear()
    return TestClient(api.app)


def test_ten_trips_from_upload_to_explained_scores(client, tmp_path):
    trip_ids = []
    for d in range(len(DRIVERS)):
        for t in range(2):
            path = recording(tmp_path, d, t)
            response = client.post("/trips", files={"file": (path.name, path.read_bytes())}, data={"driver": DRIVERS[d]})
            assert response.status_code == 201, response.text
            [trip] = response.json()["trips"]
            assert trip["flag"] is None, trip
            trip_ids.append(trip["trip_id"])

    assert train(api.store)["drivers"] == 5

    for trip_id in trip_ids:
        score = client.get(f"/trips/{trip_id}/score")
        assert score.status_code == 200, score.text
        body = score.json()
        assert all(0 <= body[k] <= 100 for k in ("driving_score", "conditions_score", "old_score"))
        explain = client.get(f"/trips/{trip_id}/explain").json()
        assert len(explain["driving_reasons"]) == 3 and len(explain["conditions_reasons"]) == 3
        assert "Weather: 4 °C, Cloudy." in explain["conditions_reasons"][2]
