"""Scoring stays quick as drivers are added: per-trip work is remembered, and the number of models is capped."""

import time

import numpy as np
import pandas as pd

from fairdrive import model
from fairdrive.events import EVENT_TYPES
from fairdrive.features import FEATURES


def test_remembered_work_is_redone_only_after_the_trip_changes(store):
    trip_id = store.list()["trip_id"].iloc[0]
    calls = []
    work = lambda: calls.append(1) or len(calls)
    assert store.remembered("test", trip_id, work) == 1
    assert store.remembered("test", trip_id, work) == 1  # unchanged trip: not redone
    time.sleep(0.01)
    store.update(trip_id, store.details(trip_id), store.points(trip_id))  # e.g. the trip was tagged again
    assert store.remembered("test", trip_id, work) == 2


def test_many_drivers_share_ten_models_none_of_which_saw_them(monkeypatch):
    drivers = [f"driver{d}" for d in range(25)]
    segs = pd.DataFrame({**{f: 0.0 for f in FEATURES}, **{k: 1.0 for k in EVENT_TYPES},
                         "driver": np.repeat(drivers, 4)})
    trained_on = []

    class Remembers:
        def __init__(self, seen):
            self.seen = seen

        def expected(self, part):
            assert not set(part["driver"]) & self.seen, "scored by a model that saw the driver"
            return pd.DataFrame({k: 1.0 for k in EVENT_TYPES}, index=part.index)

    def fit(train):
        trained_on.append(set(train["driver"]))
        return Remembers(set(train["driver"]))

    monkeypatch.setattr(model, "fit", fit)
    expected = model.held_out_expected(segs)
    assert len(trained_on) <= model.MAX_FOLDS
    assert expected.index.equals(segs.index) and expected.notna().all().all()


def test_few_drivers_are_each_left_out_on_their_own(monkeypatch):
    segs = pd.DataFrame({**{f: 0.0 for f in FEATURES}, **{k: 1.0 for k in EVENT_TYPES}, "driver": ["a", "a", "b", "c"]})
    trained_on = []
    monkeypatch.setattr(model, "fit", lambda train: trained_on.append(set(train["driver"])) or
                        type("M", (), {"expected": lambda self, part: pd.DataFrame({k: 1.0 for k in EVENT_TYPES}, index=part.index)})())
    model.held_out_expected(segs)
    assert sorted(map(sorted, trained_on)) == [["a", "b"], ["a", "c"], ["b", "c"]]


def test_scores_are_worked_out_as_the_server_starts(store, make_client):
    from fastapi.testclient import TestClient
    from fairdrive import api
    make_client(store)
    with TestClient(api.app):
        for _ in range(600):
            if api._cache:
                break
            time.sleep(0.1)
    assert api._cache and len(next(iter(api._cache.values()))) == 36
