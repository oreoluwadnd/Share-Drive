"""Hourly weather from the nearest Environment Canada station (api.weather.gc.ca)."""

import json
import urllib.parse
import urllib.request

import numpy as np
import pandas as pd

from fairdrive.geo import step_distances_m

API = "https://api.weather.gc.ca/collections"
STATION_SEARCH_DEG = 1.0  # look for stations within about 100 km
# Toronto City Centre's gauge has reported ~610 mm in an hour since Sept 2026, unflagged.
# Real hourly rainfall in Ontario stays far below this, so higher readings are treated as missing.
MAX_PRECIP_MM_PER_HOUR = 50.0


def weather_tags(time_utc: pd.Timestamp, lat: float, lon: float) -> dict | None:
    """Conditions at the nearest station with hourly data for this hour, or None if not published yet."""
    hour = time_utc.round("h").tz_convert("UTC").tz_localize(None)
    station = nearest_station(hour, lat, lon)
    if station is None:
        return None
    rows = _get("climate-hourly", {"STN_ID": station["STN_ID"], "UTC_DATE": hour.strftime("%Y-%m-%dT%H:%M:%S")})
    if not rows:
        return None
    row = rows[0]["properties"]
    precip = row["PRECIP_AMOUNT"]
    return {
        "station": row["STATION_NAME"],
        "station_km": station["km"],
        "hour_utc": row["UTC_DATE"],
        "temp_c": row["TEMP"],
        "precip_mm": precip if precip is not None and precip <= MAX_PRECIP_MM_PER_HOUR else None,
        "visibility_km": row["VISIBILITY"],
        "wind_kmh": row["WIND_SPEED"],
        "description": None if row["WEATHER_ENG_DESC"] in (None, "NA") else row["WEATHER_ENG_DESC"],
    }


def nearest_station(hour: pd.Timestamp, lat: float, lon: float) -> dict | None:
    """The closest station whose hourly record covers this hour.

    None when the hour is newer than any station's published data (Environment Canada runs a few days behind).
    """
    bbox = f"{lon - STATION_SEARCH_DEG},{lat - STATION_SEARCH_DEG},{lon + STATION_SEARCH_DEG},{lat + STATION_SEARCH_DEG}"
    stations = _get("climate-stations", {"bbox": bbox, "HAS_HOURLY_DATA": "Y"})
    if stations and hour > max(pd.Timestamp(f["properties"]["HLY_LAST_DATE"]) for f in stations):
        return None
    candidates = []
    for feature in stations:
        p = feature["properties"]
        if pd.Timestamp(p["HLY_FIRST_DATE"]) <= hour <= pd.Timestamp(p["HLY_LAST_DATE"]):
            s_lon, s_lat = feature["geometry"]["coordinates"]
            km = step_distances_m(np.array([lat, s_lat]), np.array([lon, s_lon]))[1] / 1000
            candidates.append({"STN_ID": p["STN_ID"], "km": round(km, 1)})
    if not candidates:
        raise ValueError(f"No Environment Canada hourly station within {STATION_SEARCH_DEG} degrees of {lat},{lon} for {hour}")
    return min(candidates, key=lambda c: c["km"])


def _get(collection: str, params: dict) -> list[dict]:
    query = urllib.parse.urlencode({"f": "json", "limit": 500, **params})
    with urllib.request.urlopen(f"{API}/{collection}/items?{query}", timeout=60) as response:
        return json.load(response)["features"]
