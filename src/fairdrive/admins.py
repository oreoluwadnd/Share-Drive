"""Admin accounts for the web dashboard. Passwords are stored only as salted scrypt hashes.

Accounts are added on the server with `fairdrive add-admin EMAIL`; there is no sign-up page.
"""

import hashlib
import hmac
import json
import secrets
from pathlib import Path

MIN_PASSWORD_LENGTH = 8


class AdminAccounts:
    def __init__(self, path: Path):
        self.path = Path(path)

    def add(self, email: str, password: str) -> None:
        email = email.strip().lower()
        accounts = self._read()
        if email in accounts:
            raise ValueError(f"{email} is already an admin")
        if len(password) < MIN_PASSWORD_LENGTH:
            raise ValueError(f"Use a password of at least {MIN_PASSWORD_LENGTH} characters")
        salt = secrets.token_bytes(16)
        accounts[email] = {"salt": salt.hex(), "hash": _hash(password, salt).hex()}
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(accounts, indent=2))

    def check(self, email: str, password: str) -> bool:
        account = self._read().get(email.strip().lower())
        if account is None:
            return False
        return hmac.compare_digest(_hash(password, bytes.fromhex(account["salt"])).hex(), account["hash"])

    def _read(self) -> dict:
        return json.loads(self.path.read_text()) if self.path.exists() else {}


def _hash(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
