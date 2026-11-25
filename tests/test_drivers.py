"""Driver accounts in the phone app: sign up, sign in, see only your own trips, delete everything."""

import pytest

from fairdrive.sessions import Sessions
from tests.conftest import PASSWORD, add_company, add_tagged_trip, admin_headers, sign_up


@pytest.fixture
def client(store, make_client):
    return make_client(store)


def test_sign_up_then_sign_in(client):
    ana = sign_up(client, "Ana")
    assert ana["driver"]["name"] == "Ana" and ana["driver"]["email"] == "ana@example.com"
    assert client.get("/me", headers=ana["headers"]).json() == ana["driver"]
    login = client.post("/auth/login", json={"email": "ANA@example.com ", "password": PASSWORD})
    assert login.status_code == 200 and login.json()["driver"] == ana["driver"]


@pytest.mark.parametrize("form, status, message", [
    ({"name": "", "email": "ben@example.com", "password": PASSWORD}, 400, "Enter your name"),
    ({"name": "Ben", "email": "ben", "password": PASSWORD}, 400, "valid email"),
    ({"name": "Ben", "email": "ben@example.com", "password": "short"}, 400, "at least 8"),
    ({"name": "Ana again", "email": "ana@example.com", "password": PASSWORD}, 409, "Sign in instead"),
    ({"name": "Ben", "email": "ben@example.com", "password": PASSWORD, "company_id": "c-made-up"}, 400, "insurance company"),
    ({"name": "Ben", "email": "ben@example.com", "password": PASSWORD, "company_id": "c-waiting"}, 400, "insurance company"),
])
def test_sign_up_problems_are_explained(client, form, status, message):
    sign_up(client, "Ana")
    add_company("Waiting Mutual", status="pending")
    response = client.post("/auth/signup", json={"company_id": add_company()} | form)
    assert response.status_code == status and message in response.json()["detail"]


def test_wrong_password_and_no_token_are_refused(client):
    sign_up(client, "Ana")
    assert client.post("/auth/login", json={"email": "ana@example.com", "password": "wrong password"}).status_code == 401
    assert client.get("/me").status_code == 401
    assert client.get("/me", headers={"Authorization": "Bearer made-up"}).status_code == 401


def test_sign_out_ends_only_that_sign_in(client):
    first = sign_up(client, "Ana")
    token = client.post("/auth/login", json={"email": "ana@example.com", "password": PASSWORD}).json()["token"]
    assert client.post("/auth/logout", headers=first["headers"]).status_code == 204
    assert client.get("/me", headers=first["headers"]).status_code == 401
    assert client.get("/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200


def test_sessions_survive_a_restart_and_tokens_are_not_stored(client, store):
    ana = sign_up(client, "Ana")
    token = ana["headers"]["Authorization"].removeprefix("Bearer ")
    assert token not in (store.root / "sessions.json").read_text()
    assert Sessions(store.root / "sessions.json").who(token, "driver") == "ana@example.com"  # a fresh server reads the file
    assert Sessions(store.root / "sessions.json").who(token, "staff") is None


def test_sign_up_lists_only_approved_companies(client):
    add_company("Waiting Mutual", status="pending")
    add_company("Acme Insurance")
    add_company("Beta Cover")
    assert client.get("/companies").json()["companies"] == [
        {"company_id": "c-acme", "name": "Acme Insurance"}, {"company_id": "c-beta", "name": "Beta Cover"}]
    assert sign_up(client, "Ana", "c-beta")["driver"]["company_id"] == "c-beta"


def test_an_admin_token_is_not_a_driver_token(client):
    assert client.get("/me", headers=admin_headers(client)).status_code == 401


def test_drivers_see_only_their_own_trips(client, store):
    ana, ben = sign_up(client, "Ana"), sign_up(client, "Ben")
    mine = add_tagged_trip(store, ana["driver"]["driver_id"], "residential", 5, 1.0, 98, "normal")
    trips = client.get("/me/trips", headers=ana["headers"]).json()["trips"]
    assert [t["trip_id"] for t in trips] == [mine]
    assert trips[0]["scored"] and [m["kind"] for m in trips[0]["moments"]] == ["hard_brake", "hard_accel", "hard_corner"]
    assert client.get(f"/me/trips/{mine}", headers=ana["headers"]).json()["scored"]
    assert client.get("/me/trips", headers=ben["headers"]).json()["trips"] == []
    assert client.get(f"/me/trips/{mine}", headers=ben["headers"]).status_code == 404


def test_delete_account_removes_trips_account_and_sign_ins(client, store):
    ana, ben = sign_up(client, "Ana"), sign_up(client, "Ben")
    mine = add_tagged_trip(store, ana["driver"]["driver_id"], "residential", 5, 1.0, 98, "normal")
    others = len(store.list()) - 1

    assert client.delete("/me", headers=ana["headers"]).status_code == 204
    assert not store.exists(mine) and len(store.list()) == others
    assert not (store.trips_dir / f"{mine}.parquet").exists()
    assert client.get("/me", headers=ana["headers"]).status_code == 401
    assert client.post("/auth/login", json={"email": "ana@example.com", "password": PASSWORD}).status_code == 401
    assert client.get("/me", headers=ben["headers"]).status_code == 200
