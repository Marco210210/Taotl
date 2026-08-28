#!/usr/bin/env python3
"""Collega una casella Gmail al worker Taotl usando OAuth 2.0."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow


GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"
CONFIG_DIR = Path("/home/ubuntu/.config/taotl")
CLIENT_FILE = CONFIG_DIR / "google-oauth-client.json"
PENDING_FILE = CONFIG_DIR / "google-oauth-pending.json"
TOKEN_FILE = CONFIG_DIR / "google-oauth-token.json"
REDIRECT_URI = "http://localhost"


def save_private(path: Path, content: str) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(content, encoding="utf-8")
    os.chmod(temporary, 0o600)
    temporary.replace(path)


def start() -> None:
    flow = InstalledAppFlow.from_client_secrets_file(
        CLIENT_FILE,
        scopes=[GMAIL_SEND_SCOPE],
        autogenerate_code_verifier=True,
    )
    flow.redirect_uri = REDIRECT_URI
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true",
        login_hint="apptaotl@gmail.com",
    )
    save_private(
        PENDING_FILE,
        json.dumps(
            {
                "state": state,
                "code_verifier": flow.code_verifier,
            }
        ),
    )
    print(authorization_url)


def finish(authorization_response: str) -> None:
    pending = json.loads(PENDING_FILE.read_text(encoding="utf-8"))
    flow = InstalledAppFlow.from_client_secrets_file(
        CLIENT_FILE,
        scopes=[GMAIL_SEND_SCOPE],
        state=pending["state"],
        code_verifier=pending["code_verifier"],
    )
    flow.redirect_uri = REDIRECT_URI
    flow.fetch_token(authorization_response=authorization_response)
    if not flow.credentials.refresh_token:
        raise RuntimeError("Google non ha restituito un refresh token.")
    save_private(TOKEN_FILE, flow.credentials.to_json())
    PENDING_FILE.unlink(missing_ok=True)
    print(f"Autorizzazione salvata in {TOKEN_FILE}")


def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "start":
        start()
        return
    if len(sys.argv) == 3 and sys.argv[1] == "finish":
        finish(sys.argv[2])
        return
    raise SystemExit(f"Uso: {sys.argv[0]} start | finish URL_DI_REINDIRIZZAMENTO")


if __name__ == "__main__":
    main()

