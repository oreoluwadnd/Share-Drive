"""Cut tagged trips into 1 km pieces: the conditions of each piece and the harsh events in it."""

import numpy as np
import pandas as pd

from fairdrive.events import EVENT_TYPES, event_starts
from fairdrive.geo import step_distances_m

SEGMENT_M = 1000.0
HIGHWAY = {"motorway", "motorway_link", "trunk", "trunk_link"}
MAIN_ROAD = {"primary", "primary_link", "secondary", "secondary_link"}
# Conditions only: nothing here depends on how the person drove.
# Hour and weekday are left out on purpose. In UAH-DriveSet each driver recorded on their own days and
# hours, so those columns let the model recognise the driver instead of the conditions: on held-out
# drivers it was 1.1% better than a simple average with them and 21.6% better without them.
FEATURES = ["highway_share", "main_road_share", "speed_limit_kmh", "is_dark", "temp_c", "precip_mm", "visibility_km"]


def is_tagged(details: dict) -> bool:
    return "time" in details


def segments(points: pd.DataFrame, details: dict) -> pd.DataFrame:
    """One row per full kilometre of a tagged trip: FEATURES plus a count per event type. A last partial km is dropped."""
    km = np.cumsum(step_distances_m(points["lat"].to_numpy(), points["lon"].to_numpy())) // SEGMENT_M
    piece = pd.Series(km.astype(int), index=points.index)
    full = piece[piece < piece.iloc[-1]] if len(piece.unique()) > 1 else piece.iloc[:0]

    time, weather = details["time"], details.get("weather") or {}
    road = points["road_type"]
    rows = []
    for _, idx in full.groupby(full).groups.items():
        part = points.loc[idx]
        counts = {kind: len(starts) for kind, starts in event_starts(part).items()}
        rows.append({
            "highway_share": road.loc[idx].isin(HIGHWAY).mean(),
            "main_road_share": road.loc[idx].isin(MAIN_ROAD).mean(),
            "speed_limit_kmh": part["speed_limit_kmh"].median(),
            "is_dark": float(time["is_dark"]),
            "temp_c": weather.get("temp_c", np.nan),
            "precip_mm": weather.get("precip_mm", np.nan),
            "visibility_km": weather.get("visibility_km", np.nan),
            **counts,
        })
    return pd.DataFrame(rows, columns=[*FEATURES, *EVENT_TYPES]).astype(float)
