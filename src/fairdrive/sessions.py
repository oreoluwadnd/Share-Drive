"""Sign-in sessions, saved to disk so a server restart doesn't sign everyone out.

Only a SHA-256 of each token is stored, so the file can't be used to sign in.
"""

import hashlib
import json
import secrets
import threading
import time
from pathlib import Path


class Sessions:
    def __init__(self, path: Path):
        self.path = Path(path)
        self._lock = threading.Lock()

    def start(self, kind: str, who: str, seconds: int) -> str:
        """A new token for `who` (an email) of `kind` ("driver" or "admin")."""
        token = secrets.token_urlsafe(32)
        with self._lock:
            sessions = {k: s for k, s in self._read().items() if s["expires"] > time.time()}
            sessions[_key(token)] = {"kind": kind, "who": who, "expires": time.time() + seconds}
            self._write(sessions)
        return token

    def who(self, token: str, kind: str) -> str | None:
        """The email signed in with this token, or None if it's unknown, expired or of another kind."""
        session = self._read().get(_key(token))
        if session is None or session["kind"] != kind or session["expires"] < time.time():
            return None
        return session["who"]

    def end(self, token: str) -> None:
        with self._lock:
            sessions = self._read()
            sessions.pop(_key(token), None)
            self._write(sessions)

    def end_all(self, kind: str, who: str) -> None:
        with self._lock:
            self._write({k: s for k, s in self._read().items() if (s["kind"], s["who"]) != (kind, who)})

    def _read(self) -> dict:
        return json.loads(self.path.read_text()) if self.path.exists() else {}

    def _write(self, sessions: dict) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(sessions, indent=2))


def _key(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
