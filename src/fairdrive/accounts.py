"""Accounts for drivers (phone app) and staff (web dashboard). Passwords are stored only as salted scrypt hashes.

Drivers sign up in the app. Staff use the web dashboard: super admins are added on the server with
`fairdrive add-admin EMAIL`; insurance company owners sign up on the dashboard and invite their team.
"""

import hashlib
import hmac
import json
import secrets
import threading
from pathlib import Path

MIN_PASSWORD_LENGTH = 8


class Accounts:
    """One JSON file of accounts, keyed by lower-case email. `profile` holds anything else to keep, such as a name."""

    def __init__(self, path: Path):
        self.path = Path(path)
        self._lock = threading.Lock()

    def add(self, email: str, password: str, **profile) -> dict:
        email = email.strip().lower()
        with self._lock:
            accounts = self._read()
            if email in accounts:
                raise AccountExists(f"{email} already has an account")
            if "@" not in email:
                raise ValueError("Enter a valid email address")
            if len(password) < MIN_PASSWORD_LENGTH:
                raise ValueError(f"Use a password of at least {MIN_PASSWORD_LENGTH} characters")
            salt = secrets.token_bytes(16)
            accounts[email] = {"salt": salt.hex(), "hash": _hash(password, salt).hex(), **profile}
            self._write(accounts)
        return {"email": email, **profile}

    def check(self, email: str, password: str) -> dict | None:
        """The account, if the password is right."""
        email = email.strip().lower()
        account = self._read().get(email)
        if account is None or not hmac.compare_digest(_hash(password, bytes.fromhex(account["salt"])).hex(), account["hash"]):
            return None
        return _public(email, account)

    def get(self, email: str) -> dict:
        return _public(email, self._read()[email])

    def all(self) -> list[dict]:
        return [_public(email, account) for email, account in self._read().items()]

    def update(self, email: str, **profile) -> dict:
        """Changes profile fields (not the password)."""
        with self._lock:
            accounts = self._read()
            accounts[email] |= profile
            self._write(accounts)
        return self.get(email)

    def remove(self, email: str) -> None:
        with self._lock:
            accounts = self._read()
            del accounts[email]
            self._write(accounts)

    def _read(self) -> dict:
        return json.loads(self.path.read_text()) if self.path.exists() else {}

    def _write(self, accounts: dict) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(accounts, indent=2))


class AccountExists(ValueError):
    """Someone already signed up with that email."""


def _public(email: str, account: dict) -> dict:
    return {"email": email} | {k: v for k, v in account.items() if k not in ("salt", "hash")}


def _hash(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
