import numpy as np
import pandas as pd
import pytest

from fairdrive.baseline import driver_scores
from fairdrive.events import count_events
from fairdrive.cli import main
from fairdrive.sensorlogger import MissingColumnError
from fairdrive.store import TripStore
from fairdrive.trips import HIDDEN_END_M, POINT_COLUMNS
from fairdrive.upload import upload
from tests import synthetic


@pytest.fixture
def store(tmp_path):
    return TripStore(tmp_path / "data")


def recording(tmp_path, phases, platform="android", seed=0, gps_gap=None, name="trip.json"):
    truth = synthetic.simulate(phases, seed=seed)
    path = synthetic.write(synthetic.to_records(truth, platform, seed, gps_gap), tmp_path / name)
    return path, truth


# FD-10: Upload a trip file

def test_valid_upload_appears_in_trip_list(tmp_path, store):
    path, _ = recording(tmp_path, synthetic.city_drive(5))
    trip_ids = upload(path, "ana", store)
    trips = store.list()
    assert list(trips["trip_id"]) == trip_ids
    assert len(trip_ids) == 1
    assert trips["flag"].isna().all()


@pytest.mark.parametrize("drop, expected", [
    (("Location", "latitude"), "Location.latitude"),
    (("Accelerometer", None), "Accelerometer.x"),
])
def test_missing_column_names_it_and_saves_nothing(tmp_path, store, drop, expected):
    truth = synthetic.simulate(synthetic.city_drive(3))
    records = synthetic.to_records(truth)
    sensor, column = drop
    if column is None:
        records = [r for r in records if r["sensor"] != sensor]
    else:
        for r in records:
            if r["sensor"] == sensor:
                del r[column]
    path = synthetic.write(records, tmp_path / "bad.json")

    with pytest.raises(MissingColumnError, match=expected):
        upload(path, "ana", store)
    assert not store.root.exists()


def test_cli_reports_missing_column(tmp_path, store):
    truth = synthetic.simulate(synthetic.city_drive(3))
    records = [r for r in synthetic.to_records(truth) if r["sensor"] != "Gravity"]
    path = synthetic.write(records, tmp_path / "bad.json")
    with pytest.raises(SystemExit, match="Missing column\\(s\\): Gravity.time, Gravity.x"):
        main(["--data-dir", str(store.root), "upload", str(path), "--driver", "ana"])


# FD-11: Clean and split raw trips

@pytest.mark.parametrize("platform", ["android", "ios"])
@pytest.mark.parametrize("seed", [1, 2, 3])
def test_acceleration_is_in_car_directions_for_any_mount(tmp_path, store, platform, seed):
    path, truth = recording(tmp_path, synthetic.city_drive(5), platform, seed)
    [trip_id] = upload(path, "ana", store)
    points = store.points(trip_id)
    expected = truth[["forward", "right", "up"]].resample("100ms").mean().reindex(points.index)

    for got, want in [("acc_forward", "forward"), ("acc_lateral", "right"), ("acc_vertical", "up")]:
        corr = np.corrcoef(points[got], expected[want])[0, 1]
        error = (points[got] - expected[want]).abs().mean()
        assert corr > 0.95, f"{got}: correlation {corr:.3f}"
        assert error < 0.15, f"{got}: mean error {error:.3f} m/s²"


def test_stop_over_5_minutes_splits_trip(tmp_path, store):
    path, _ = recording(tmp_path, synthetic.city_drive(4) + synthetic.stop(6) + synthetic.city_drive(4))
    assert len(upload(path, "ana", store)) == 2


def test_stop_under_5_minutes_keeps_one_trip(tmp_path, store):
    path, _ = recording(tmp_path, synthetic.city_drive(4) + synthetic.stop(4) + synthetic.city_drive(4))
    assert len(upload(path, "ana", store)) == 1


def test_short_recording_is_flagged_and_not_scored(tmp_path, store):
    path, _ = recording(tmp_path, synthetic.city_drive(1.5))
    [trip_id] = upload(path, "ana", store)
    trip = store.list().iloc[0]
    assert trip["flag"] == "shorter than 2 minutes"
    assert not (store.trips_dir / f"{trip_id}.parquet").exists()
    assert driver_scores(store).empty


def test_gps_gap_over_30_seconds_is_flagged(tmp_path, store):
    path, _ = recording(tmp_path, synthetic.city_drive(5), gps_gap=(120, 160))
    upload(path, "ana", store)
    assert store.list()["flag"].tolist() == ["GPS gap over 30 seconds"]


# FD-14: Hide trip start and end points

def test_first_and_last_500m_are_removed(tmp_path, store):
    path, truth = recording(tmp_path, synthetic.city_drive(5))
    [trip_id] = upload(path, "ana", store)
    points = store.points(trip_id)
    moved = truth["distance"]
    first, last = moved.asof(points.index[0]), moved.asof(points.index[-1])
    assert first >= HIDDEN_END_M - 2
    assert moved.iloc[-1] - last >= HIDDEN_END_M - 2


def test_store_holds_no_raw_sensor_data(tmp_path, store):
    path, _ = recording(tmp_path, synthetic.city_drive(5))
    [trip_id] = upload(path, "ana", store)
    files = sorted(p.name for p in store.root.rglob("*") if p.is_file())
    assert files == [f"{trip_id}.json", f"{trip_id}.parquet"]
    assert list(store.points(trip_id).columns) == POINT_COLUMNS


# FD-15: Compute naive baseline score

def test_counts_each_harsh_event_once():
    t = pd.date_range("2026-01-01", periods=100, freq="100ms", tz="UTC")
    points = pd.DataFrame({"acc_forward": 0.0, "acc_lateral": 0.0}, index=t)
    points.iloc[10:15, 0] = -4.0  # one hard brake
    points.iloc[30:33, 0] = -4.0  # another
    points.iloc[50:52, 0] = 3.5   # one hard acceleration
    points.iloc[70:80, 1] = -3.5  # one hard left corner
    assert count_events(points) == {"hard_brake": 2, "hard_accel": 1, "hard_corner": 1}


def test_noise_around_threshold_counts_once():
    t = pd.date_range("2026-01-01", periods=40, freq="100ms", tz="UTC")
    points = pd.DataFrame({"acc_forward": 0.0, "acc_lateral": 0.0}, index=t)
    points.iloc[10:20, 1] = [3.1, 2.8, 3.2, 2.9, 3.0, 2.7, 3.1, 3.0, 2.8, 3.2]  # one turn, flickering
    assert count_events(points)["hard_corner"] == 1


def test_scores_are_0_to_100_and_harsh_driver_scores_lower(tmp_path, store):
    calm = synthetic.city_drive(5)
    harsh = [(4, 3.6, 0), (25, 0, 0), (2, 0, 20), (10, 0, 0), (3, -4.8, 0), (2, 0, 0)] * 5  # 2 s sharp turns: realistic
    upload(recording(tmp_path, calm, name="calm.json")[0], "calm", store)
    upload(recording(tmp_path, harsh, name="harsh.json", seed=4)[0], "harsh", store)
    scores = driver_scores(store).set_index("driver")
    assert scores["score"].between(0, 100).all()
    assert scores.loc["calm", "score"] > scores.loc["harsh", "score"]


# FD-13: Load public driving datasets

def write_uah_trip(root, driver, name, seconds=300):
    """A minimal UAH-DriveSet trip folder: steady 15 m/s due north with one hard brake."""
    folder = root / driver / name
    folder.mkdir(parents=True)
    t_acc = np.arange(0, seconds, 0.1)
    forward_g = np.where((t_acc > 150) & (t_acc < 152), -0.4, 0.0)
    acc = np.column_stack([t_acc, np.ones_like(t_acc), np.zeros_like(t_acc), np.zeros_like(t_acc), forward_g, np.zeros((len(t_acc), 6))])
    np.savetxt(folder / "RAW_ACCELEROMETERS.txt", acc, fmt="%.3f")
    t_gps = np.arange(0, seconds, 1.0)
    lat = 40.5 + 15 * t_gps / 111_195
    gps = np.column_stack([t_gps, np.full_like(t_gps, 54.0), lat, np.full_like(t_gps, -3.4), np.zeros((len(t_gps), 8))])
    np.savetxt(folder / "RAW_GPS.txt", gps, fmt="%.6f")
    osm = [f"{t:.2f} 120.0 1 motorway 3 1 {la:.6f} -3.4 0.5 54.0" for t, la in zip(t_gps[::2], lat[::2])]
    (folder / "PROC_OPENSTREETMAP_DATA.txt").write_text("\n".join(osm) + "\n")


def test_uah_trips_convert_to_trip_format_and_summarise(tmp_path, store):
    from fairdrive.uah import load_dataset
    root = tmp_path / "UAH-DRIVESET-v1"
    write_uah_trip(root, "D1", "20151110175712-16km-D1-NORMAL1-SECONDARY")
    write_uah_trip(root, "D2", "20151120160904-16km-D2-NORMAL1-SECONDARY")
    trip_ids = load_dataset(root, store)

    assert trip_ids == ["uah-D1-20151110T165712Z", "uah-D2-20151120T150904Z"]  # Madrid local time to UTC
    points = store.points(trip_ids[0])
    assert list(points.columns) == [*POINT_COLUMNS, "road_type", "speed_limit_kmh", "speed_limit_source"]
    assert points["road_type"].eq("motorway").all() and points["speed_limit_kmh"].eq(120).all()
    assert points["speed"].round(1).eq(15.0).all()
    assert count_events(points)["hard_brake"] == 1

    path, _ = recording(tmp_path, synthetic.city_drive(5))
    upload(path, "ana", store)
    summary = store.summary().set_index("source")
    assert summary.loc["uah-driveset", ["drivers", "trips"]].tolist() == [2, 2]
    assert summary.loc["sensorlogger", ["drivers", "trips"]].tolist() == [1, 1]
    assert summary.loc["uah-driveset", "km"] == pytest.approx(2 * (4.5 - 1.0), abs=0.1)
