"""Sprint 3: braking study (FD-22)."""

import numpy as np
import pandas as pd
import pytest

from fairdrive.braking import brake_rows, macro_f1


def one_brake_trip():
    """60 s at 25 m/s with one hard brake (0.3 g for 1 s) starting at 30 s."""
    index = pd.date_range("2026-03-01 14:00", periods=600, freq="100ms", tz="UTC")
    forward = np.zeros(600)
    forward[300:310] = -0.3 * 9.80665
    return pd.DataFrame({"speed": 25.0, "acc_forward": forward, "acc_lateral": 0.0}, index=index)


def car_ahead(points, seconds_in, gap_s):
    return pd.DataFrame({"gap_s": [gap_s]}, index=[points.index[0] + pd.Timedelta(seconds=seconds_in)])


@pytest.mark.parametrize("vehicles, reactive", [
    ("close", 1),        # 1.0 s gap 2 s before the brake: closer than the 2-second rule
    ("far", 0),          # 3.0 s gap: a safe following distance
    ("too_early", 0),    # close, but 10 s before the brake
    ("none", 0),         # no car seen
])
def test_brake_is_reactive_only_when_a_car_was_too_close_just_before(vehicles, reactive):
    points = one_brake_trip()
    frames = {
        "close": car_ahead(points, 28, 1.0),
        "far": car_ahead(points, 28, 3.0),
        "too_early": car_ahead(points, 20, 1.0),
        "none": pd.DataFrame({"gap_s": []}, index=pd.DatetimeIndex([], tz="UTC")),
    }[vehicles]
    rows = brake_rows(points, frames)
    assert len(rows) == 1
    assert rows["reactive"].item() == reactive
    assert rows["peak_decel"].item() == pytest.approx(0.3)


def test_trip_without_brakes_gives_numeric_empty_table():
    points = one_brake_trip().assign(acc_forward=0.0)
    rows = brake_rows(points, car_ahead(points, 28, 1.0))
    assert rows.empty and rows["peak_decel"].dtype == float


def test_macro_f1():
    y = np.array([0, 0, 1, 1])
    assert macro_f1(y, y) == 1.0
    assert macro_f1(y, np.array([1, 1, 0, 0])) == 0.0
    # Always guessing one label: F1 of 2/3 for that label, 0 for the other.
    assert macro_f1(y, np.zeros(4, dtype=int)) == pytest.approx(1 / 3)
