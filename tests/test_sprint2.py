"""Sprint 2: context model (FD-16), two-part score (FD-17), reasons (FD-18), dashboard (FD-19),
stability (FD-20) and comparison (FD-21), on small trips where we control the truth."""

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from fairdrive import model as model_module
from fairdrive.compare import comparison
from fairdrive.features import segments
from fairdrive.model import ContextModel, model_dir, train
from fairdrive.scoring import TOP_TIER, conditions_tier, score_trips, tier
from fairdrive.stability import stability
from fairdrive.store import TripStore
from fairdrive.trips import Trip

STEP_S, SPEED_MS = 0.1, 20.0
# Normal hard-brake rate per km on each kind of road. City streets need far more braking.
NORMAL_PER_KM = {"motorway": 0.2, "residential": 1.0}


def add_tagged_trip(store, driver, road, km, per_km, day, style, dark=False):
    """A straight 20 m/s trip on one kind of road, already tagged. Each 'incident' is a hard brake,
    a sharp speed-up 5 s later and a sharp turn 10 s later, spaced evenly at per_km incidents per km."""
    n = int(km * 1000 / SPEED_MS / STEP_S)
    index = pd.date_range(pd.Timestamp("2026-03-01 14:00", tz="UTC") + pd.Timedelta(days=day), periods=n, freq="100ms")
    north_m = np.arange(n) * SPEED_MS * STEP_S
    forward, sideways = np.zeros(n), np.zeros(n)
    incidents = int(round(km * per_km))
    for i in range(incidents):
        at = int((i + 0.5) * n / incidents)
        forward[at:at + 5] = -3.0
        forward[at + 50:at + 55] = 3.0
        sideways[at + 100:at + 105] = 3.0
    points = pd.DataFrame({
        "lat": 43.6 + north_m / 111_195, "lon": np.full(n, -79.4), "speed": SPEED_MS,
        "acc_forward": forward, "acc_lateral": sideways, "acc_vertical": 0.0,
        "road_type": road, "speed_limit_kmh": 100.0 if road == "motorway" else 50.0, "speed_limit_source": "posted",
    }, index=index)
    trip_id = store.save(driver, Trip(index[0], index[-1], None, points.iloc[:, :6]), "sensorlogger", {"style": style})
    details = store.details(trip_id) | {
        "time": {"local_time": index[0].isoformat(), "local_hour": 10, "weekday": "Tuesday", "is_dark": dark},
        "weather": {"temp_c": 5.0, "precip_mm": 0.0, "visibility_km": 20.0, "wind_kmh": 10, "description": "Clear",
                    "station": "TEST", "station_km": 1.0, "hour_utc": index[0].isoformat()},
    }
    store.update(trip_id, details, points)
    return trip_id


@pytest.fixture
def store(tmp_path):
    """Six drivers. Each drives a highway and a city trip calmly (no incidents), normally, and harshly (3x normal)."""
    store = TripStore(tmp_path / "data")
    day = 1
    for d in range(6):
        for style, factor in [("calm", 0), ("normal", 1), ("harsh", 3)]:
            for road in NORMAL_PER_KM:
                add_tagged_trip(store, f"driver{d}", road, 20, NORMAL_PER_KM[road] * factor, day, style, dark=(d % 2 == 1))
                day += 1
    return store


@pytest.fixture
def scores(store):
    return score_trips(store)


# FD-16: Predict expected events per context

def test_segments_have_conditions_and_counts(store):
    trip_id = store.list()["trip_id"].iloc[2]  # driver0, normal, highway
    segs = segments(store.points(trip_id), store.details(trip_id))
    assert len(segs) == 19  # 20 km, the last partial km dropped
    assert segs["highway_share"].eq(1.0).all()
    assert segs["hard_brake"].sum() == pytest.approx(19 * 0.2, abs=1)


def test_model_returns_events_per_km_and_beats_simple_average(store):
    evaluation = train(store)
    assert evaluation["drivers"] == 6
    assert evaluation["improvement_pct"] >= 10
    model = ContextModel.load(model_dir(store))
    trips = store.list()["trip_id"]
    expected = {road: model.expected(segments(store.points(t), store.details(t))).sum(axis=1).mean()
                for road, t in [("highway", trips.iloc[0]), ("city", trips.iloc[1])]}
    # Average driver here: 0.8 incidents per km on highways, 4 in the city, 3 harsh moments each.
    assert expected["highway"] == pytest.approx(0.8, rel=0.15)
    assert expected["city"] == pytest.approx(4.0, rel=0.15)


def test_no_events_of_a_type_is_a_clear_error(store):
    segs = model_module.training_segments(store).assign(hard_accel=0.0)
    with pytest.raises(ValueError, match="hard_accel"):
        model_module.fit(segs)


# FD-17: Show two-part score

def test_both_scores_are_0_to_100(scores):
    assert scores["driving_score"].between(0, 100).all()
    assert scores["conditions_score"].between(0, 100).all()


def test_same_driving_on_different_roads_gets_the_same_driving_score(scores):
    normal = scores[scores["style"] == "normal"].groupby("driver")
    gaps = normal["driving_score"].agg(lambda s: s.max() - s.min())
    assert (gaps <= 5).all(), gaps
    # The old score punishes the city trip for the extra braking the city demands.
    old_gaps = normal["baseline_score"].agg(lambda s: s.max() - s.min())
    assert (old_gaps > 30).all(), old_gaps


def test_harsh_driving_scores_lower_and_city_conditions_score_lower(scores):
    by_style = scores.groupby("style")["driving_score"].mean()
    assert by_style["harsh"] < by_style["normal"] - 20
    by_road = scores.groupby(scores["highway_share"] > 0.5)["conditions_score"].mean()
    assert by_road[True] > by_road[False]


# FD-18: Explain scores in plain language

TECHNICAL = ["ratio", "percentile", "model", "poisson", "lateral", "deviance", " g ", "segment", "feature"]


def test_three_plain_reasons_per_score(scores):
    for _, row in scores.iterrows():
        for reasons in (row["driving_reasons"], row["conditions_reasons"]):
            assert len(reasons) == 3
            text = " ".join(reasons).lower()
            assert not [word for word in TECHNICAL if word in text], text


def test_top_tier_says_nothing_needs_to_change(scores):
    top = scores[scores["driving_score"] >= TOP_TIER]
    assert len(top)
    for reasons in top["driving_reasons"]:
        assert "needs no change" in reasons[0]


def test_tiers_name_every_score_in_words():
    assert [tier(s) for s in (95, 70, 50, 10)] == ["Excellent", "Good", "Fair", "Needs attention"]
    assert [conditions_tier(s) for s in (95, 70, 50, 10)] == ["Easy", "Fairly easy", "Average", "Demanding"]


# FD-20: Test score stability across contexts

def test_fairdrive_varies_at_least_30_percent_less_than_baseline(scores):
    result = stability(scores)
    assert result["groups"] == 18
    assert result["meets_target"], result


# FD-21: Compare FairDrive vs baseline

def test_comparison_has_night_urban_and_high_mileage_groups(scores, tmp_path):
    table = comparison(scores)
    assert {"Night", "Urban (mostly city roads)", "High-mileage drivers"} <= set(table["group"])
    assert table.loc[table["group"] == "All trips", "trips"].item() == 36
    path = tmp_path / "compare.csv"
    table.to_csv(path, index=False)
    assert pd.read_csv(path).shape == table.shape


# FD-19: Show trip history dashboard

def test_dashboard_shows_trips_with_date_distance_and_both_scores(store, monkeypatch):
    from streamlit.testing.v1 import AppTest
    monkeypatch.setenv("FAIRDRIVE_DATA", str(store.root))
    app = AppTest.from_file(str(Path(__file__).parents[1] / "src/fairdrive/app.py"), default_timeout=120).run()
    assert not app.exception
    table = app.dataframe[0].value
    assert {"Date (UTC)", "Distance (km)", "Driving score", "Conditions score"} <= set(table.columns)
    assert len(table) == 36
    assert [tab.label for tab in app.tabs] == ["My trips", "Trip details", "FairDrive vs old score", "Score stability"]
