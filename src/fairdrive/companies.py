"""Insurance companies and team invites.

A company signs up on the dashboard and waits until a FairDrive super admin approves it.
Its owner then invites team members with one-time links.
"""

import hashlib
import json
import secrets
import threading
import time
from pathlib import Path

STATUSES = ("pending", "approved", "rejected")


class Companies:
    """One JSON file of companies, keyed by company id."""

    def __init__(self, path: Path):
        self.path = Path(path)
        self._lock = threading.Lock()

    def name_taken(self, name: str) -> bool:
        """Another company not rejected already has this name (any letter case)."""
        return any(c["name"].lower() == name.strip().lower() and c["status"] != "rejected" for c in self.all())

    def add(self, company_id: str, name: str) -> dict:
        with self._lock:
            companies = self._read()
            companies[company_id] = {"name": name.strip(), "status": "pending", "created": time.time()}
            self._write(companies)
        return self.get(company_id)

    def get(self, company_id: str) -> dict:
        return {"company_id": company_id} | self._read()[company_id]

    def all(self) -> list[dict]:
        return [{"company_id": company_id} | company for company_id, company in self._read().items()]

    def set_status(self, company_id: str, status: str) -> None:
        if status not in STATUSES:
            raise ValueError(f"Unknown status {status}")
        with self._lock:
            companies = self._read()
            companies[company_id]["status"] = status
            self._write(companies)

    def _read(self) -> dict:
        return json.loads(self.path.read_text()) if self.path.exists() else {}

    def _write(self, companies: dict) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(companies, indent=2))


class Invites:
    """One-time links that let someone join a company's team. Only a SHA-256 of each code is stored."""

    def __init__(self, path: Path):
        self.path = Path(path)
        self._lock = threading.Lock()

    def start(self, company_id: str, email: str, seconds: int) -> str:
        code = secrets.token_urlsafe(24)
        with self._lock:
            invites = {k: i for k, i in self._read().items() if i["expires"] > time.time()}
            invites[_key(code)] = {"company_id": company_id, "email": email.strip().lower(), "expires": time.time() + seconds}
            self._write(invites)
        return code

    def get(self, code: str) -> dict | None:
        """{company_id, email}, or None if the code is unknown, used or expired."""
        invite = self._read().get(_key(code))
        if invite is None or invite["expires"] < time.time():
            return None
        return {"company_id": invite["company_id"], "email": invite["email"]}

    def open_for(self, company_id: str) -> list[dict]:
        """Unused, unexpired invites of one company: [{email, expires}]."""
        return [{"email": i["email"], "expires": i["expires"]} for i in self._read().values()
                if i["company_id"] == company_id and i["expires"] > time.time()]

    def use(self, code: str) -> None:
        with self._lock:
            invites = self._read()
            del invites[_key(code)]
            self._write(invites)

    def _read(self) -> dict:
        return json.loads(self.path.read_text()) if self.path.exists() else {}

    def _write(self, invites: dict) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(invites, indent=2))


def _key(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()
