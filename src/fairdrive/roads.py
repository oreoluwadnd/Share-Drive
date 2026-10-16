"""Match each GPS point to its OpenStreetMap road: road type and speed limit."""

import json
import urllib.parse
import urllib.request

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
# overpass-api.de answers 406 to the default "Python-urllib" User-Agent, so name the app.
USER_AGENT = "FairDrive/0.1 (student project; github.com/oreoluwadnd/Share-Drive)"
DRIVABLE = "motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service"
BBOX_PAD_DEG = 0.001  # about 100 m
VERTEX_SPACING_M = 5.0
KMH_PER_MPH = 1.609344

# Ontario Highway Traffic Act s.128: 50 km/h unless posted, 80 km/h outside built-up areas.
# OSM rarely says which side of a town line a road is on, so highways get 80 and everything else 50.
ONTARIO_DEFAULT_KMH = {"motorway": 80, "motorway_link": 80, "trunk": 80, "trunk_link": 80}
ONTARIO_DEFAULT_OTHER_KMH = 50


def fetch_roads(lat: np.ndarray, lon: np.ndarray) -> list[dict]:
    """Drivable OSM ways (tags and shape) inside the trip's bounding box."""
    south, west = lat.min() - BBOX_PAD_DEG, lon.min() - BBOX_PAD_DEG
    north, east = lat.max() + BBOX_PAD_DEG, lon.max() + BBOX_PAD_DEG
    query = f'[out:json][timeout:120];way({south},{west},{north},{east})[highway~"^({DRIVABLE})(_link)?$"];out tags geom;'
    request = urllib.request.Request(OVERPASS_URL, urllib.parse.urlencode({"data": query}).encode(), {"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=180) as response:
        ways = json.load(response)["elements"]
    if not ways:
        raise ValueError(f"OpenStreetMap returned no roads around the trip ({south},{west},{north},{east})")
    return ways


def match_roads(lat: np.ndarray, lon: np.ndarray, ways: list[dict], ontario: bool) -> pd.DataFrame:
    """road_type, speed_limit_kmh and speed_limit_source ("posted", "default" or "missing") per point.

    Defaults are only applied in Ontario. Elsewhere an untagged road's limit stays missing.
    """
    origin = (lat.mean(), lon.mean())
    vertex_xy, vertex_way = _densify(ways, origin)
    _, nearest = cKDTree(vertex_xy).query(_to_xy(lat, lon, origin))
    way_index = vertex_way[nearest]

    road_type = np.array([w["tags"]["highway"] for w in ways])
    posted = np.array([_posted_kmh(w["tags"].get("maxspeed")) for w in ways], dtype=float)
    if ontario:
        default = np.array([ONTARIO_DEFAULT_KMH.get(t, ONTARIO_DEFAULT_OTHER_KMH) for t in road_type], dtype=float)
    else:
        default = np.full(len(ways), np.nan)

    limit = np.where(np.isnan(posted), default, posted)
    source = np.where(~np.isnan(posted), "posted", np.where(np.isnan(default), "missing", "default"))
    return pd.DataFrame({
        "road_type": road_type[way_index],
        "speed_limit_kmh": limit[way_index],
        "speed_limit_source": source[way_index],
    })


def _posted_kmh(maxspeed: str | None) -> float:
    """km/h from an OSM maxspeed tag like "50" or "30 mph". NaN when absent or not a number."""
    if maxspeed is None:
        return np.nan
    value, _, unit = maxspeed.strip().partition(" ")
    if not value.isdigit():
        return np.nan
    return float(value) * (KMH_PER_MPH if unit == "mph" else 1.0)


def _densify(ways: list[dict], origin: tuple[float, float]) -> tuple[np.ndarray, np.ndarray]:
    """Points every VERTEX_SPACING_M along every way, with the index of the way each belongs to."""
    xy_parts, way_parts = [], []
    for i, way in enumerate(ways):
        shape = _to_xy(np.array([p["lat"] for p in way["geometry"]]), np.array([p["lon"] for p in way["geometry"]]), origin)
        for a, b in zip(shape[:-1], shape[1:]):
            steps = max(1, int(np.ceil(np.linalg.norm(b - a) / VERTEX_SPACING_M)))
            xy_parts.append(a + np.outer(np.arange(steps) / steps, b - a))
            way_parts.append(np.full(steps, i))
        xy_parts.append(shape[-1:])
        way_parts.append([i])
    return np.concatenate(xy_parts), np.concatenate(way_parts)


def _to_xy(lat: np.ndarray, lon: np.ndarray, origin: tuple[float, float]) -> np.ndarray:
    """Metres east and north of origin. Accurate enough over a trip's few tens of km."""
    metres_per_deg = 111_195.0
    x = (lon - origin[1]) * metres_per_deg * np.cos(np.radians(origin[0]))
    y = (lat - origin[0]) * metres_per_deg
    return np.column_stack([x, y])
