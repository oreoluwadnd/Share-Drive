"""Simulated Sensor Logger JSON exports with a known ground truth.

A drive is a list of phases: (seconds, forward acceleration m/s², turn rate deg/s,
positive = clockwise/right). The phone sits in a random fixed mount position.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

G = 9.80665
RATE_HZ = 100
START_NS = 1_760_000_000 * 10**9
START_LAT, START_LON = 43.6532, -79.3832  # Toronto


def simulate(phases: list[tuple[float, float, float]], seed: int = 0) -> pd.DataFrame:
    """Ground truth at 100 Hz in the car's frame (right and up positive)."""
    dt = 1 / RATE_HZ
    rows, speed, heading, north, east = [], 0.0, 0.0, 0.0, 0.0
    rng = np.random.default_rng(seed)
    t = 0.0
    for seconds, accel, turn_deg_s in phases:
        for _ in range(round(seconds * RATE_HZ)):
            a = accel if speed + accel * dt > 0 else -speed / dt
            yaw = np.radians(turn_deg_s) if speed > 0 else 0.0
            speed = max(speed + a * dt, 0.0)
            heading += yaw * dt
            north += speed * np.cos(heading) * dt
            east += speed * np.sin(heading) * dt
            bump = 0.8 * np.sin(2 * np.pi * 1.3 * t) * (speed > 0) + 0.05 * rng.standard_normal()
            rows.append((t, a, speed * yaw, bump, speed, heading, north, east))
            t += dt
    truth = pd.DataFrame(rows, columns=["t", "forward", "right", "up", "speed", "heading", "north", "east"])
    truth["lat"] = START_LAT + np.degrees(truth["north"] / 6_371_000)
    truth["lon"] = START_LON + np.degrees(truth["east"] / (6_371_000 * np.cos(np.radians(START_LAT))))
    truth["distance"] = np.cumsum(truth["speed"] / RATE_HZ)
    truth.index = pd.to_datetime(START_NS + (truth["t"] * 1e9).round().astype("int64"), unit="ns", utc=True)
    return truth


def mount(seed: int) -> np.ndarray:
    """Random phone orientation: columns are the car's forward, left and up axes in phone coordinates."""
    q, r = np.linalg.qr(np.random.default_rng(seed).standard_normal((3, 3)))
    q = q * np.sign(np.diag(r))
    if np.linalg.det(q) < 0:
        q[:, 2] *= -1
    return q


def to_records(truth: pd.DataFrame, platform: str = "android", seed: int = 0, gps_gap: tuple[float, float] | None = None) -> list[dict]:
    """Sensor Logger records. iOS flips the sign of acceleration and gravity."""
    m = mount(seed)
    forward, left, up = m[:, 0], m[:, 1], m[:, 2]
    sign = -1.0 if platform == "ios" else 1.0
    noise = np.random.default_rng(seed + 1).normal(0, 0.15, (len(truth), 3))
    acc = sign * (np.outer(truth["forward"], forward) - np.outer(truth["right"], left) + np.outer(truth["up"], up) + noise)
    gravity = sign * G * up
    times = START_NS + (truth["t"].to_numpy() * 1e9).round().astype("int64")

    records = []
    for i, ns in enumerate(times):
        records.append({"sensor": "Accelerometer", "time": str(ns), "seconds_elapsed": f"{truth['t'].iat[i]}", "z": str(acc[i, 2]), "y": str(acc[i, 1]), "x": str(acc[i, 0])})
    for i, ns in enumerate(times):
        records.append({"sensor": "Gravity", "time": str(ns), "seconds_elapsed": f"{truth['t'].iat[i]}", "z": str(gravity[2]), "y": str(gravity[1]), "x": str(gravity[0])})
    for i in range(0, len(truth), RATE_HZ):
        t = truth["t"].iat[i]
        if gps_gap and gps_gap[0] <= t < gps_gap[1]:
            continue
        records.append({
            "sensor": "Location", "time": str(times[i]), "seconds_elapsed": f"{t}",
            "bearingAccuracy": "5", "speedAccuracy": "0.5", "verticalAccuracy": "3", "horizontalAccuracy": "5",
            "speed": str(truth["speed"].iat[i]), "bearing": str(np.degrees(truth["heading"].iat[i]) % 360),
            "altitude": "100", "longitude": str(truth["lon"].iat[i]), "latitude": str(truth["lat"].iat[i]),
        })
    return records


def write(records: list[dict], path: Path) -> Path:
    path.write_text(json.dumps(records))
    return path


# Reusable drive pieces.
def city_drive(minutes: float) -> list[tuple[float, float, float]]:
    """Repeating block of speeding up, cruising, right and left turns and braking (~1 minute each)."""
    block = [(8, 1.8, 0), (15, 0, 0), (6, 0, 6), (10, 0, 0), (6, 0, -6), (8, 0, 0), (7.2, -2.0, 0), (2, 0, 0)]
    repeats = max(1, round(minutes * 60 / sum(p[0] for p in block)))
    return block * repeats


def stop(minutes: float) -> list[tuple[float, float, float]]:
    return [(minutes * 60, 0, 0)]
