"""Tag stored trips with road type, speed limit, time of day and weather."""

import pandas as pd

from fairdrive.roads import fetch_roads, match_roads
from fairdrive.store import TripStore
from fairdrive.timeofday import time_tags
from fairdrive.weather import weather_tags

# Where each source's trips were driven. Our own recordings are from Ontario.
REGIONS = {
    "sensorlogger": {"timezone": "America/Toronto", "ontario": True},
    "uah-driveset": {"timezone": "Europe/Madrid", "ontario": False},
}


def tag_all(store: TripStore) -> list[str]:
    """Tag every scorable trip that still needs it. Saves after each trip, so a failed run can be re-run."""
    trips = store.list()
    tagged = []
    for trip_id in trips[trips["flag"].isna()]["trip_id"]:
        details = store.details(trip_id)
        region = REGIONS[details["source"]]
        needs_roads = "time" not in details
        needs_weather = region["ontario"] and details.get("weather") is None
        if not (needs_roads or needs_weather):
            continue
        points = store.points(trip_id)
        middle = points.iloc[len(points) // 2]
        if needs_roads:
            roads = match_roads(points["lat"].to_numpy(), points["lon"].to_numpy(), fetch_roads(points["lat"].to_numpy(), points["lon"].to_numpy()), region["ontario"])
            points = pd.concat([points, roads.set_index(points.index)], axis=1)
            details["speed_limit_default_share"] = round(float((roads["speed_limit_source"] == "default").mean()), 3)
            details["speed_limit_missing_share"] = round(float((roads["speed_limit_source"] == "missing").mean()), 3)
            details["time"] = time_tags(middle.name, middle["lat"], middle["lon"], region["timezone"])
        if needs_weather:
            details["weather"] = weather_tags(middle.name, middle["lat"], middle["lon"])
        store.update(trip_id, details, points)
        tagged.append(trip_id)
    return tagged
