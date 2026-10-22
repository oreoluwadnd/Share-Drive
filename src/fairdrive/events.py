"""Harsh driving events. One definition, used by the baseline and by FairDrive."""

import pandas as pd

G = 9.80665
# Measured on UAH-DriveSet (793 km): at 0.3 g harsh events appeared in only 2-4% of kilometres,
# too rare to learn from. At 0.15 g hard braking appears in 14% and sharp turns in 18%.
THRESHOLD_G = 0.15
THRESHOLD_MS2 = THRESHOLD_G * G
# Threshold crossings closer together than this are one event (noise around the threshold).
MERGE_WITHIN = "1s"
EVENT_TYPES = ("hard_brake", "hard_accel", "hard_corner")


def event_starts(points: pd.DataFrame) -> dict[str, pd.DatetimeIndex]:
    """When each harsh event began, by type."""
    beyond = {
        "hard_brake": points["acc_forward"] <= -THRESHOLD_MS2,
        "hard_accel": points["acc_forward"] >= THRESHOLD_MS2,
        "hard_corner": points["acc_lateral"].abs() >= THRESHOLD_MS2,
    }
    return {kind: _starts(above) for kind, above in beyond.items()}


def count_events(points: pd.DataFrame) -> dict[str, int]:
    return {kind: len(starts) for kind, starts in event_starts(points).items()}


def _starts(above: pd.Series) -> pd.DatetimeIndex:
    recently_above = above.shift(fill_value=False).astype(float).rolling(MERGE_WITHIN).max() == 1
    return above.index[above & ~recently_above]
