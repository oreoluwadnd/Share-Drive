"""Insurance companies on the web dashboard: sign up, wait for approval, see only your own drivers, run your team."""

import pytest

from tests.conftest import PASSWORD, add_company, add_tagged_trip, admin_headers, sign_up, staff_headers


@pytest.fixture
def client(store, make_client):
    return make_client(store)


def company_sign_up(client, company="Acme Insurance", email="owner@acme.com"):
    return client.post("/companies/signup", json={"company": company, "name": "Olu", "email": email, "password": PASSWORD})


def login(client, email):
    return client.post("/admin/login", json={"email": email, "password": PASSWORD})


def drive(client, store, name, company_id):
    """A driver of that company with one scored trip. Returns the trip id."""
    driver = sign_up(client, name, company_id)["driver"]
    return add_tagged_trip(store, driver["driver_id"], "residential", 5, 1.0, 98, "normal")


# Sign up and approval

def test_a_new_company_waits_for_approval_then_logs_in(client):
    response = company_sign_up(client)
    assert response.status_code == 201
    company = response.json()["company"]
    assert company["name"] == "Acme Insurance" and company["status"] == "pending"

    waiting = login(client, "owner@acme.com")
    assert waiting.status_code == 403 and "waiting for FairDrive to approve" in waiting.json()["detail"]
    assert all(c["name"] != "Acme Insurance" for c in client.get("/companies").json()["companies"])  # not in the app yet

    listed = client.get("/admin/companies", headers=admin_headers(client)).json()["companies"]
    assert listed[0]["owner"] == {"name": "Olu", "email": "owner@acme.com"} and listed[0]["drivers"] == 0
    assert client.post(f"/admin/companies/{company['company_id']}/approve", headers=admin_headers_again(client)).status_code == 204

    account = login(client, "owner@acme.com").json()["account"]
    assert account["role"] == "owner" and account["company"] == {"company_id": company["company_id"], "name": "Acme Insurance"}
    assert [c["name"] for c in client.get("/companies").json()["companies"]] == ["Acme Insurance"]


def admin_headers_again(client):
    return staff_headers(client, "admin@example.com")


def test_a_rejected_company_cant_log_in(client):
    company_id = company_sign_up(client).json()["company"]["company_id"]
    assert client.post(f"/admin/companies/{company_id}/reject", headers=admin_headers(client)).status_code == 204
    response = login(client, "owner@acme.com")
    assert response.status_code == 403 and "didn't approve" in response.json()["detail"]


def test_a_company_rejected_later_is_logged_out(client):
    company_id = add_company()
    headers = staff_headers(client, "owner@acme.com")
    client.post(f"/admin/companies/{company_id}/reject", headers=admin_headers(client))
    assert client.get("/admin/trips", headers=headers).status_code == 403


@pytest.mark.parametrize("form, status, message", [
    ({"company": " ", "name": "Olu", "email": "new@acme.com", "password": PASSWORD}, 400, "company's name"),
    ({"company": "New Co", "name": "", "email": "new@acme.com", "password": PASSWORD}, 400, "Enter your name"),
    ({"company": "acme insurance", "name": "Olu", "email": "new@acme.com", "password": PASSWORD}, 409, "already has a FairDrive account"),
    ({"company": "New Co", "name": "Olu", "email": "owner@acme.com", "password": PASSWORD}, 409, "Log in instead"),
    ({"company": "New Co", "name": "Olu", "email": "new@acme.com", "password": "short"}, 400, "at least 8"),
])
def test_company_sign_up_problems_are_explained(client, form, status, message):
    company_sign_up(client)
    response = client.post("/companies/signup", json=form)
    assert response.status_code == status and message in response.json()["detail"]
    assert len(client.get("/admin/companies", headers=admin_headers(client)).json()["companies"]) == 1  # nothing half-made


def test_only_a_super_admin_manages_companies(client):
    company_id = add_company()
    owner = staff_headers(client, "owner@acme.com")
    assert client.get("/admin/companies", headers=owner).status_code == 403
    assert client.post(f"/admin/companies/{company_id}/approve", headers=owner).status_code == 403
    assert client.post("/admin/companies/c-made-up/approve", headers=admin_headers(client)).status_code == 404


# Each company sees only its own drivers

def test_a_company_sees_only_its_own_drivers_and_trips(client, store):
    anas = drive(client, store, "Ana", add_company("Acme Insurance"))
    bens = drive(client, store, "Ben", add_company("Beta Cover"))
    acme = staff_headers(client, "owner@acme.com")

    trips = client.get("/admin/trips", headers=acme).json()["trips"]
    assert [t["trip_id"] for t in trips] == [anas] and trips[0]["driver_name"] == "Ana"
    assert client.get(f"/admin/trips/{anas}", headers=acme).status_code == 200
    assert client.get(f"/admin/trips/{bens}", headers=acme).status_code == 404
    assert [d["name"] for d in client.get("/admin/drivers", headers=acme).json()["drivers"]] == ["Ana"]

    everything = client.get("/admin/trips", headers=admin_headers(client)).json()["trips"]
    assert len(everything) == len(store.list()) == 38  # every company's, and drivers without an account
    drivers = client.get("/admin/drivers", headers=admin_headers_again(client)).json()["drivers"]
    assert [(d["name"], d["company"], d["trips"]) for d in drivers] == [("Ana", "Acme Insurance", 1), ("Ben", "Beta Cover", 1)]


def test_scores_compare_against_every_companys_drives(client, store):
    """One shared idea of normal: a company with a single driver still gets scores."""
    anas = drive(client, store, "Ana", add_company())
    trip = client.get(f"/admin/trips/{anas}", headers=staff_headers(client, "owner@acme.com")).json()
    assert trip["scored"]


def test_the_owner_removes_a_driver_from_the_company(client, store):
    anas = drive(client, store, "Ana", add_company())
    ana = client.post("/auth/login", json={"email": "ana@example.com", "password": PASSWORD}).json()
    owner = staff_headers(client, "owner@acme.com")

    assert client.delete(f"/admin/drivers/{ana['driver']['driver_id']}", headers=owner).status_code == 204
    assert client.get("/admin/trips", headers=owner).json()["trips"] == []
    assert client.get(f"/admin/trips/{anas}", headers=owner).status_code == 404
    driver_headers = {"Authorization": f"Bearer {ana['token']}"}
    assert [t["trip_id"] for t in client.get("/me/trips", headers=driver_headers).json()["trips"]] == [anas]  # still theirs
    assert client.delete(f"/admin/drivers/{ana['driver']['driver_id']}", headers=owner).status_code == 404


# Team

def invite(client, owner, email="sam@acme.com"):
    response = client.post("/admin/team/invites", json={"email": email}, headers=owner)
    assert response.status_code == 201, response.text
    return response.json()["code"]


def test_an_invited_member_joins_and_sees_the_companys_drivers(client, store):
    anas = drive(client, store, "Ana", add_company())
    owner = staff_headers(client, "owner@acme.com")
    code = invite(client, owner, " Sam@Acme.com ")
    assert client.get(f"/invites/{code}").json() == {"email": "sam@acme.com", "company": "Acme Insurance"}
    assert client.get("/admin/team", headers=owner).json()["invites"][0]["email"] == "sam@acme.com"

    joined = client.post(f"/invites/{code}/accept", json={"name": "Sam", "password": PASSWORD})
    assert joined.status_code == 201
    assert joined.json()["account"]["role"] == "member" and joined.json()["account"]["company"]["name"] == "Acme Insurance"
    sam = {"Authorization": f"Bearer {joined.json()['token']}"}
    assert [t["trip_id"] for t in client.get("/admin/trips", headers=sam).json()["trips"]] == [anas]

    assert client.get(f"/invites/{code}").status_code == 404  # used once
    team = client.get("/admin/team", headers=owner).json()
    assert [(m["name"], m["role"]) for m in team["members"]] == [("Acme Insurance owner", "owner"), ("Sam", "member")]
    assert team["invites"] == []


def test_only_the_owner_runs_the_team(client):
    add_company()
    code = invite(client, staff_headers(client, "owner@acme.com"))
    sam = {"Authorization": f"Bearer {client.post(f'/invites/{code}/accept', json={'name': 'Sam', 'password': PASSWORD}).json()['token']}"}
    assert client.get("/admin/team", headers=sam).status_code == 403
    assert client.post("/admin/team/invites", json={"email": "x@acme.com"}, headers=sam).status_code == 403
    assert client.delete("/admin/team/owner@acme.com", headers=sam).status_code == 403
    assert client.delete("/admin/drivers/u123", headers=sam).status_code == 403


def test_the_owner_removes_a_member_and_their_login_ends(client):
    add_company()
    owner = staff_headers(client, "owner@acme.com")
    code = invite(client, owner)
    sam = {"Authorization": f"Bearer {client.post(f'/invites/{code}/accept', json={'name': 'Sam', 'password': PASSWORD}).json()['token']}"}

    assert client.delete("/admin/team/owner@acme.com", headers=owner).status_code == 400
    assert client.delete("/admin/team/sam@acme.com", headers=owner).status_code == 204
    assert client.get("/admin/trips", headers=sam).status_code == 401
    assert login(client, "sam@acme.com").status_code == 401


def test_an_owner_cant_touch_another_companys_team(client):
    add_company("Acme Insurance")
    add_company("Beta Cover")
    beta = staff_headers(client, "owner@beta.com")
    assert client.delete("/admin/team/owner@acme.com", headers=beta).status_code == 404


@pytest.mark.parametrize("email, status", [("nope", 400), ("owner@acme.com", 409)])
def test_bad_invites_are_refused(client, email, status):
    add_company()
    response = client.post("/admin/team/invites", json={"email": email}, headers=staff_headers(client, "owner@acme.com"))
    assert response.status_code == status


def test_unknown_invite_links_are_explained(client):
    response = client.post("/invites/made-up/accept", json={"name": "Sam", "password": PASSWORD})
    assert response.status_code == 404 and "expired or was already used" in response.json()["detail"]


def test_staff_and_driver_tokens_dont_mix(client):
    add_company()
    ana = sign_up(client, "Ana")
    assert client.get("/admin/trips", headers=ana["headers"]).status_code == 401
    assert client.get("/me", headers=staff_headers(client, "owner@acme.com")).status_code == 401
