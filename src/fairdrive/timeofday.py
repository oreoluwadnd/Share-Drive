"""When a trip happened: local hour, weekday and whether it was dark."""

import numpy as np
import pandas as pd

J2000 = pd.Timestamp("2000-01-01 12:00", tz="UTC")
# The sun's centre is 0.833 degrees below the horizon at sunset (refraction and the sun's radius).
SUNSET_ELEVATION_DEG = -0.833


def time_tags(time_utc: pd.Timestamp, lat: float, lon: float, timezone: str) -> dict:
    local = time_utc.tz_convert(timezone)
    return {
        "local_time": local.isoformat(),
        "local_hour": local.hour,
        "weekday": local.day_name(),
        "is_dark": bool(sun_elevation_deg(time_utc, lat, lon) < SUNSET_ELEVATION_DEG),
    }


def sun_elevation_deg(time_utc: pd.Timestamp, lat: float, lon: float) -> float:
    """Approximate solar elevation (US Naval Observatory low-precision formulas, about 0.1 degree)."""
    d = (time_utc - J2000).total_seconds() / 86400
    mean_anomaly = np.radians(357.529 + 0.98560028 * d)
    mean_longitude = 280.459 + 0.98564736 * d
    ecliptic_longitude = np.radians(mean_longitude + 1.915 * np.sin(mean_anomaly) + 0.020 * np.sin(2 * mean_anomaly))
    obliquity = np.radians(23.439 - 0.00000036 * d)
    right_ascension = np.arctan2(np.cos(obliquity) * np.sin(ecliptic_longitude), np.cos(ecliptic_longitude))
    declination = np.arcsin(np.sin(obliquity) * np.sin(ecliptic_longitude))
    sidereal_hours = (18.697374558 + 24.06570982441908 * d) % 24
    hour_angle = np.radians(sidereal_hours * 15 + lon) - right_ascension
    lat = np.radians(lat)
    return float(np.degrees(np.arcsin(np.sin(lat) * np.sin(declination) + np.cos(lat) * np.cos(declination) * np.cos(hour_angle))))
