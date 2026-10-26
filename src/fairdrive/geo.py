import numpy as np

EARTH_RADIUS_M = 6_371_000.0


def step_distances_m(lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    """Haversine distance between consecutive points, with 0 for the first point."""
    lat, lon = np.radians(lat), np.radians(lon)
    dlat, dlon = np.diff(lat), np.diff(lon)
    a = np.sin(dlat / 2) ** 2 + np.cos(lat[:-1]) * np.cos(lat[1:]) * np.sin(dlon / 2) ** 2
    return np.concatenate([[0.0], 2 * EARTH_RADIUS_M * np.arcsin(np.sqrt(a))])
