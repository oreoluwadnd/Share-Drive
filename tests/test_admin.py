"""Staff accounts, and what a FairDrive super admin sees on the web dashboard. Companies and teams: test_companies.py."""

import pytest

from fairdrive.accounts import Accounts
from fairdrive.cli import main
from tests.conftest import PASSWORD, sign_up


@pytest.fixture
def client(store, make_client):
    from fairdrive import api
    client = make_client(store)
    api.staff.add("ana@example.com", PASSWORD, role="super", company_id=None)
    return client


def login(client) -> dict:
    token = client.post("/admin/login", json={"email": "ana@example.com", "password": PASSWORD}).json()["token"]
    return {"Authorization": f"Bearer {token}"}


# Accounts

def test_password_is_stored_hashed_and_checked(tmp_path):
    accounts = Accounts(tmp_path / "staff.json")
    accounts.add("Ana@Example.com", PASSWORD)
    assert PASSWORD not in (tmp_path / "staff.json").read_text()
    assert accounts.check("ana@example.com", PASSWORD)  # email case doesn't matter
    assert not accounts.check("ana@example.com", "wrong password")
    assert not accounts.check("ben@example.com", PASSWORD)


def test_duplicate_admin_and_short_password_are_refused(tmp_path):
    accounts = Accounts(tmp_path / "staff.json")
    accounts.add("ana@example.com", PASSWORD)
    with pytest.raises(ValueError, match="already"):
        accounts.add("ana@example.com", PASSWORD)
    with pytest.raises(ValueError, match="at least 8"):
        accounts.add("ben@example.com", "short")


def test_cli_adds_an_admin(tmp_path, monkeypatch):
    monkeypatch.setattr("fairdrive.cli.getpass", lambda prompt: PASSWORD)
    main(["--data-dir", str(tmp_path), "add-admin", "ben@example.com"])
    assert Accounts(tmp_path / "staff.json").check("ben@example.com", PASSWORD)["role"] == "super"


def test_cli_refuses_passwords_that_dont_match(tmp_path, monkeypatch):
    answers = iter([PASSWORD, "something else"])
    monkeypatch.setattr("fairdrive.cli.getpass", lambda prompt: next(answers))
    with pytest.raises(SystemExit, match="didn't match"):
        main(["--data-dir", str(tmp_path), "add-admin", "ben@example.com"])


# Endpoints

def test_wrong_password_is_refused(client):
    response = client.post("/admin/login", json={"email": "ana@example.com", "password": "nope"})
    assert response.status_code == 401


def test_admin_endpoints_need_a_login(client, store):
    trip_id = store.list()["trip_id"].iloc[0]
    assert client.get("/admin/trips").status_code == 401
    assert client.get(f"/admin/trips/{trip_id}").status_code == 401
    assert client.get("/admin/trips", headers={"Authorization": "Bearer made-up"}).status_code == 401


def test_super_admin_trip_list_has_every_trip_with_scores(client, store):
    trips = client.get("/admin/trips", headers=login(client)).json()["trips"]
    assert len(trips) == len(store.list()) == 36
    first = trips[0]
    assert {"trip_id", "driver", "driver_name", "start", "distance_km", "phone", "scored", "why", "driving_score",
            "conditions_score", "old_score", "moments"} <= set(first)
    assert all(t["scored"] and 0 <= t["driving_score"] <= 100 for t in trips)


def test_unscored_trip_is_listed_with_the_reason(client, store):
    from tests.conftest import add_tagged_trip
    add_tagged_trip(store, "shorty", "residential", 0.8, 0, 99, "calm")
    trips = {t["driver"]: t for t in client.get("/admin/trips", headers=login(client)).json()["trips"]}
    assert not trips["shorty"]["scored"] and trips["shorty"]["driving_score"] is None
    assert "less than 1 km" in trips["shorty"]["why"]


def test_trip_detail_has_score_reasons_and_route(client, store):
    trip_id = store.list()["trip_id"].iloc[0]
    trip = client.get(f"/admin/trips/{trip_id}", headers=login(client)).json()
    assert trip["scored"] and len(trip["score"]["moments"]) == 3
    assert len(trip["reasons"]["driving_reasons"]) == 3
    assert 2 <= len(trip["route"]) <= 300 and all(len(p) == 2 for p in trip["route"])


def test_trip_list_names_drivers_with_accounts(client, store):
    from tests.conftest import add_tagged_trip
    ana = sign_up(client, "Ana")
    add_tagged_trip(store, ana["driver"]["driver_id"], "residential", 5, 1.0, 98, "normal")
    trips = client.get("/admin/trips", headers=login(client)).json()["trips"]
    names = {t["driver"]: t["driver_name"] for t in trips}
    assert names[ana["driver"]["driver_id"]] == "Ana"
    assert names["driver0"] == "driver0"  # no account: the stored id is shown
    anas = next(t["trip_id"] for t in trips if t["driver_name"] == "Ana")
    assert client.get(f"/admin/trips/{anas}", headers=login(client)).json()["driver_name"] == "Ana"


def test_a_driver_token_is_not_an_admin_token(client):
    assert client.get("/admin/trips", headers=sign_up(client, "Ana")["headers"]).status_code == 401


def test_unknown_trip_detail_is_a_404(client):
    assert client.get("/admin/trips/nobody-20260101T000000Z", headers=login(client)).status_code == 404


# Before the model can run: no trips at all, or tagged trips from only one driver.

@pytest.fixture
def lonely_client(tmp_path, make_client):
    from fairdrive import api
    from fairdrive.store import TripStore
    store = TripStore(tmp_path / "data")
    client = make_client(store)
    api.staff.add("ana@example.com", PASSWORD, role="super", company_id=None)
    return client, store


def test_trip_list_is_empty_before_any_trips(lonely_client):
    client, _ = lonely_client
    response = client.get("/admin/trips", headers=login(client))
    assert response.status_code == 200 and response.json()["trips"] == []


def test_one_drivers_trips_are_listed_as_waiting_for_a_second_driver(lonely_client):
    from tests.conftest import add_tagged_trip
    client, store = lonely_client
    trip_id = add_tagged_trip(store, "ana", "residential", 5, 1.0, 1, "normal")
    trips = client.get("/admin/trips", headers=login(client)).json()["trips"]
    assert [t["scored"] for t in trips] == [False]
    assert "at least 2 drivers" in trips[0]["why"]
    assert client.get(f"/admin/trips/{trip_id}", headers=login(client)).json()["scored"] is False
