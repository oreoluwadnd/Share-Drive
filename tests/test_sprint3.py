"""Sprint 3: braking study (FD-22), context leakage (FD-24) and fairness by phone (FD-25)."""

import numpy as np
import pandas as pd
import pytest

from fairdrive.braking import brake_rows, macro_f1
from fairdrive.leakage import leakage
from fairdrive.phones import phone_noise, stopped_noise_g


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


# FD-24: Detect context leakage. The shared test trips put the same driving on city and highway roads,
# by day (even drivers) and by night (odd drivers), so any score gap between those groups is leakage.

def test_fairdrive_gap_between_road_types_is_at_least_half_the_baselines(scores):
    result = leakage(scores).set_index("context")
    urban = result.loc["Urban vs mostly highway"]
    assert urban["meets_target"], urban
    # The baseline gives the road type away: city trips always score lower.
    assert urban["baseline_guess_accuracy"] > 0.8, urban
    # FairDrive gives less away. Not nothing: with no noise in these trips, the smoothing's 3-point
    # difference for drivers with no harsh moments (96 on highways, 99 in the city) still sorts them.
    assert urban["fairdrive_guess_accuracy"] < urban["baseline_guess_accuracy"], urban


def test_night_planted_with_identical_driving_does_not_leak(scores):
    night = leakage(scores).set_index("context").loc["Night vs daytime"]
    assert not night["fairdrive_leaks"], night
    assert night["baseline_gap"] == 0 and pd.isna(night["gap_reduction_pct"])  # nothing planted, nothing to remove


def test_too_few_trips_on_one_side_gives_no_verdict(scores):
    few_night = scores.assign(is_dark=scores.index < 3)
    night = leakage(few_night).set_index("context").loc["Night vs daytime"]
    assert night["in_group"] == 3 and pd.isna(night["gap_reduction_pct"])


# FD-25: Check fairness by phone type

def test_score_noise_is_reported_per_phone(store, scores):
    for trip_id in scores["trip_id"]:
        details = store.details(trip_id)
        cheap = details["driver"] in ("driver0", "driver1", "driver2")
        details["phone"] = {"device": "Budget A10", "platform": "android"} if cheap else {"device": "iPhone 13", "platform": "ios"}
        store.update(trip_id, details, store.points(trip_id))
    table = phone_noise(scores, store).set_index("phone")
    assert list(table.index) == ["Budget A10 (android)", "iPhone 13 (ios)"]
    assert table["trips"].tolist() == [18, 18] and table["drivers"].tolist() == [3, 3]
    budget = scores[scores["driver"].isin(["driver0", "driver1", "driver2"])]
    expected = budget.groupby(["driver", "style"])["driving_score"].std().mean()
    assert table.loc["Budget A10 (android)", "score_spread"] == pytest.approx(expected, abs=1e-3)


def test_trips_without_phone_details_are_grouped_by_source(store, scores):
    assert phone_noise(scores, store)["phone"].tolist() == ["unknown (sensorlogger)"]


def test_sensor_noise_is_measured_only_while_stopped():
    index = pd.date_range("2026-03-01", periods=200, freq="100ms", tz="UTC")
    rng = np.random.default_rng(0)
    points = pd.DataFrame({"speed": np.r_[np.zeros(100), np.full(100, 20.0)],
                           "acc_forward": np.r_[rng.normal(0, 0.02 * 9.80665, 100), np.full(100, 5.0)]}, index=index)
    assert stopped_noise_g(points) == pytest.approx(0.02, rel=0.2)
    assert np.isnan(stopped_noise_g(points.assign(speed=20.0)))
