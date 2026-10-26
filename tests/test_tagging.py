"""FD-12: Tag trips with road and weather. Network calls are replaced with recorded-style responses."""

import numpy as np
import pandas as pd
import pytest

from fairdrive import roads, tagging, weather
from fairdrive.roads import match_roads
from fairdrive.store import TripStore
from fairdrive.timeofday import sun_elevation_deg, time_tags
from fairdrive.upload import upload
from tests import synthetic


def way(highway, maxspeed, points):
    tags = {"highway": highway} | ({"maxspeed": maxspeed} if maxspeed else {})
    return {"type": "way", "tags": tags, "geometry": [{"lat": la, "lon": lo} for la, lo in points]}


# Two parallel streets 200 m apart running east, plus an untagged motorway further north.
WAYS = [
    way("residential", "30", [(43.6500, -79.40), (43.6500, -79.38)]),
    way("tertiary", None, [(43.6518, -79.40), (43.6518, -79.38)]),
    way("motorway", None, [(43.6600, -79.40), (43.6600, -79.38)]),
    way("primary", "30 mph", [(43.6700, -79.40), (43.6700, -79.38)]),
]


def test_points_get_nearest_road_and_speed_limit_in_ontario():
    lat = np.array([43.65003, 43.65175, 43.66010, 43.67002])  # a few metres off each road
    lon = np.array([-79.395, -79.390, -79.385, -79.381])
    tags = match_roads(lat, lon, WAYS, ontario=True)
    assert tags["road_type"].tolist() == ["residential", "tertiary", "motorway", "primary"]
    assert tags["speed_limit_kmh"].round(1).tolist() == [30.0, 50.0, 80.0, 48.3]
    assert tags["speed_limit_source"].tolist() == ["posted", "default", "default", "posted"]


def test_untagged_limits_stay_missing_outside_ontario():
    tags = match_roads(np.array([43.6518]), np.array([-79.39]), WAYS, ontario=False)
    assert tags["speed_limit_source"].tolist() == ["missing"]
    assert tags["speed_limit_kmh"].isna().all()


def test_sun_elevation_matches_toronto_midsummer():
    # Toronto, 21 June 2026: sun about 69.8 degrees high at solar noon, sets about 9:03 pm EDT (01:03 UTC).
    noon = max(sun_elevation_deg(pd.Timestamp(f"2026-06-21 17:{m:02d}", tz="UTC"), 43.65, -79.38) for m in range(0, 60, 5))
    assert noon == pytest.approx(69.8, abs=0.3)
    assert sun_elevation_deg(pd.Timestamp("2026-06-22 00:50", tz="UTC"), 43.65, -79.38) > -0.833
    assert sun_elevation_deg(pd.Timestamp("2026-06-22 01:15", tz="UTC"), 43.65, -79.38) < -0.833


def test_time_tags_use_local_time():
    tags = time_tags(pd.Timestamp("2026-01-15 23:30", tz="UTC"), 43.65, -79.38, "America/Toronto")
    assert (tags["local_hour"], tags["weekday"], tags["is_dark"]) == (18, "Thursday", True)


def fake_ec(collection, params):
    if collection == "climate-stations":
        return [
            {"properties": {"STN_ID": 1, "HLY_FIRST_DATE": "2000-01-01 00:00:00", "HLY_LAST_DATE": "2030-01-01 00:00:00"}, "geometry": {"coordinates": [-79.63, 43.68]}},
            {"properties": {"STN_ID": 2, "HLY_FIRST_DATE": "2000-01-01 00:00:00", "HLY_LAST_DATE": "2030-01-01 00:00:00"}, "geometry": {"coordinates": [-79.40, 43.63]}},
            {"properties": {"STN_ID": 3, "HLY_FIRST_DATE": "1953-01-01 00:00:00", "HLY_LAST_DATE": "1969-05-31 00:00:00"}, "geometry": {"coordinates": [-79.38, 43.65]}},
        ]
    assert params["STN_ID"] == 2  # nearest station that covers the hour (3 is closer but closed in 1969)
    return [{"properties": {"STATION_NAME": "TORONTO CITY CENTRE", "UTC_DATE": params["UTC_DATE"], "TEMP": 4.2,
                            "PRECIP_AMOUNT": 609.6, "VISIBILITY": 9.7, "WIND_SPEED": 22, "WEATHER_ENG_DESC": "NA"}}]


def test_weather_from_nearest_station_and_hour(monkeypatch):
    monkeypatch.setattr(weather, "_get", fake_ec)
    tags = weather.weather_tags(pd.Timestamp("2026-10-12 15:20", tz="UTC"), 43.65, -79.38)
    assert tags["station"] == "TORONTO CITY CENTRE"
    assert tags["hour_utc"] == "2026-10-12T15:00:00"
    assert tags["temp_c"] == 4.2
    assert tags["precip_mm"] is None      # impossible gauge reading dropped
    assert tags["description"] is None    # "NA" means not recorded


def test_weather_not_published_yet_is_none(monkeypatch):
    monkeypatch.setattr(weather, "_get", fake_ec)
    assert weather.weather_tags(pd.Timestamp("2030-06-01 12:00", tz="UTC"), 43.65, -79.38) is None


def test_tag_all_tags_each_trip_once(tmp_path, monkeypatch):
    store = TripStore(tmp_path / "data")
    path = synthetic.write(synthetic.to_records(synthetic.simulate(synthetic.city_drive(5))), tmp_path / "trip.json")
    [trip_id] = upload(path, "ana", store)
    pts = store.points(trip_id)
    road = way("residential", None, [(pts.lat.min() - 0.01, pts.lon.min() - 0.01), (pts.lat.max() + 0.01, pts.lon.max() + 0.01)])
    monkeypatch.setattr(tagging, "fetch_roads", lambda lat, lon: [road])
    monkeypatch.setattr(tagging, "weather_tags", lambda t, lat, lon: {"temp_c": 4.2})

    assert tagging.tag_all(store) == [trip_id]
    details, points = store.details(trip_id), store.points(trip_id)
    assert points["speed_limit_kmh"].eq(50).all() and points["road_type"].eq("residential").all()
    assert details["speed_limit_default_share"] == 1.0
    assert details["weather"] == {"temp_c": 4.2}
    assert {"local_hour", "weekday", "is_dark"} <= set(details["time"])
    assert tagging.tag_all(store) == []
