#!/usr/bin/env python3
"""Raccoglie gli errori Taotl e, se configurato, avvisa tramite Telegram.

Usa soltanto la libreria standard Python e gira sulla VPS esistente. Non accede
direttamente a Oracle e non conserva body delle richieste, password o token.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


BIND = os.environ.get("TAOTL_MONITOR_BIND", "127.0.0.1")
PORT = int(os.environ.get("TAOTL_MONITOR_PORT", "8091"))
MONITOR_KEY = os.environ.get("TAOTL_MONITOR_KEY") or os.environ.get("EXPO_PUBLIC_APP_KEY", "")
LOG_PATH = Path(
    os.environ.get(
        "TAOTL_ERROR_LOG_PATH",
        str(Path.home() / ".local/state/taotl-monitor/errors.jsonl"),
    )
)
TELEGRAM_TOKEN = os.environ.get("TAOTL_TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.environ.get("TAOTL_TELEGRAM_CHAT_ID", "").strip()
EXPO_HEALTH_URL = os.environ.get(
    "TAOTL_EXPO_HEALTH_URL",
    "https://expo-taotl.130.110.16.97.sslip.io",
).strip()
ORDS_HEALTH_URL = os.environ.get("EXPO_PUBLIC_API_BASE_URL", "").rstrip("/") + "/players/"

MAX_BODY_BYTES = 64 * 1024
MAX_LOG_BYTES = 10 * 1024 * 1024
RATE_LIMIT_PER_MINUTE = 60
NOTIFICATION_COOLDOWN_SECONDS = 300
WATCHDOG_INTERVAL_SECONDS = 60
AUTO_RECOVERY_COOLDOWN_SECONDS = 600
WATCHDOG_STARTUP_GRACE_SECONDS = 300
ORACLE_MAINTENANCE_FLAG = Path("/run/taotl-oracle-maintenance")
watchdog_started_monotonic = time.monotonic()

EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)
BEARER_RE = re.compile(r"Bearer\s+[A-Za-z0-9._~-]+", re.IGNORECASE)
SECRET_RE = re.compile(
    r"(password|token|secret|app[_-]?key)\s*[:=]\s*[^\s,;]+",
    re.IGNORECASE,
)

lock = threading.RLock()
recent_errors: deque[dict[str, Any]] = deque(maxlen=500)
rate_windows: dict[str, deque[float]] = defaultdict(deque)
last_notifications: dict[str, float] = {}
health_state: dict[str, Any] = {
    "startedAt": datetime.now(timezone.utc).isoformat(),
    "expo": "unknown",
    "ords": "unknown",
    "expoFailures": 0,
    "ordsFailures": 0,
    "expoDetail": "non ancora verificato",
    "ordsDetail": "non ancora verificato",
    "ordsAlerted": False,
    "lastExpoRecovery": 0.0,
}


def redact_text(value: Any, limit: int = 4_000) -> str:
    text = str(value or "")
    text = EMAIL_RE.sub("[email]", text)
    text = BEARER_RE.sub("Bearer [redacted]", text)
    text = SECRET_RE.sub(r"\1=[redacted]", text)
    return text[:limit]


def safe_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Il payload deve essere un oggetto JSON.")
    error = payload.get("error") if isinstance(payload.get("error"), dict) else {}
    context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
    safe_context: dict[str, Any] = {}
    for key, value in list(context.items())[:20]:
        safe_key = redact_text(key, 80)
        safe_context[safe_key] = value if isinstance(value, (int, float, bool)) or value is None else redact_text(value, 1_000)
    return {
        "occurredAt": redact_text(payload.get("occurredAt"), 64),
        "source": redact_text(payload.get("source"), 120),
        "platform": redact_text(payload.get("platform"), 30),
        "error": {
            "name": redact_text(error.get("name"), 80),
            "message": redact_text(error.get("message"), 1_000),
            "stack": redact_text(error.get("stack"), 6_000) if error.get("stack") else None,
        },
        "context": safe_context,
    }


def fingerprint_for(payload: dict[str, Any]) -> str:
    material = "|".join(
        [
            payload.get("source", ""),
            payload.get("platform", ""),
            payload.get("error", {}).get("name", ""),
            payload.get("error", {}).get("message", ""),
            str(payload.get("context", {}).get("path", "")),
        ]
    )
    return hashlib.sha256(material.encode("utf-8", errors="replace")).hexdigest()[:16]


def rotate_log_if_needed() -> None:
    if not LOG_PATH.exists() or LOG_PATH.stat().st_size < MAX_LOG_BYTES:
        return
    rotated = LOG_PATH.with_suffix(LOG_PATH.suffix + ".1")
    if rotated.exists():
        rotated.unlink()
    LOG_PATH.replace(rotated)


def append_error(payload: dict[str, Any], client_ip: str) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    record = {
        "id": f"E-{now.strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6]}",
        "receivedAt": now.isoformat(),
        "clientIpHash": hashlib.sha256(client_ip.encode()).hexdigest()[:12],
        "fingerprint": fingerprint_for(payload),
        **payload,
    }
    with lock:
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        rotate_log_if_needed()
        with LOG_PATH.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
        LOG_PATH.chmod(0o600)
        recent_errors.append(record)
    notify_error(record)
    return record


def telegram_call(method: str, payload: dict[str, Any], timeout: int = 35) -> Any:
    if not TELEGRAM_TOKEN:
        return None
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/{method}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        result = json.loads(response.read().decode("utf-8"))
    return result.get("result") if result.get("ok") else None


def send_telegram(text: str) -> None:
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    try:
        telegram_call("sendMessage", {"chat_id": TELEGRAM_CHAT_ID, "text": text[:4_000]})
    except Exception:
        # Il registro deve continuare a funzionare anche quando Telegram è offline.
        pass


def notify_error(record: dict[str, Any]) -> None:
    fingerprint = record["fingerprint"]
    now = time.monotonic()
    with lock:
        previous = last_notifications.get(fingerprint, 0.0)
        if now - previous < NOTIFICATION_COOLDOWN_SECONDS:
            return
        last_notifications[fingerprint] = now
    context = record.get("context", {})
    lines = [
        "🚨 Errore Taotl",
        f"ID: {record['id']}",
        f"Origine: {record.get('source') or 'sconosciuta'}",
        f"Piattaforma: {record.get('platform') or 'sconosciuta'}",
        f"Messaggio: {record.get('error', {}).get('message') or 'senza messaggio'}",
    ]
    if context.get("path"):
        lines.append(f"API: {context.get('method', 'GET')} {context['path']} · HTTP {context.get('status', '?')}")
    lines.append("Comandi: /status · /ultimi · /errore ID")
    send_telegram("\n".join(lines))


def is_authorized(headers: Any) -> bool:
    supplied = headers.get("X-Monitor-Key", "")
    if not supplied:
        authorization = headers.get("Authorization", "")
        if authorization.lower().startswith("bearer "):
            supplied = authorization[7:].strip()
    return bool(MONITOR_KEY) and hmac.compare_digest(supplied, MONITOR_KEY)


def allowed_by_rate_limit(client_ip: str) -> bool:
    now = time.monotonic()
    with lock:
        window = rate_windows[client_ip]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= RATE_LIMIT_PER_MINUTE:
            return False
        window.append(now)
        return True


def check_url(url: str, headers: dict[str, str] | None = None) -> tuple[bool, str]:
    if not url:
        return False, "URL non configurato"
    try:
        request = urllib.request.Request(url, headers=headers or {}, method="GET")
        with urllib.request.urlopen(request, timeout=15) as response:
            # Consuma la risposta: il proxy può così chiudere la richiesta senza
            # registrare falsi errori "context canceled".
            response.read()
            return 200 <= response.status < 400, f"HTTP {response.status}"
    except urllib.error.HTTPError as error:
        body = error.read(8_192).decode("utf-8", errors="replace")
        oracle_codes = sorted(set(re.findall(r"ORA-\d{5}", body)))
        suffix = f" ({', '.join(oracle_codes)})" if oracle_codes else ""
        return False, f"HTTP {error.code}{suffix}"
    except Exception as error:
        return False, redact_text(f"{type(error).__name__}: {error}", 300)


def watchdog_loop() -> None:
    while True:
        expo_ok, expo_detail = check_url(
            EXPO_HEALTH_URL,
            {"Accept": "application/expo+json", "Expo-Platform": "android"},
        )
        ords_ok, ords_detail = check_url(ORDS_HEALTH_URL)
        in_startup_grace = time.monotonic() - watchdog_started_monotonic < WATCHDOG_STARTUP_GRACE_SECONDS
        oracle_maintenance = ORACLE_MAINTENANCE_FLAG.exists()
        with lock:
            previous_expo = health_state["expo"]
            ords_alerted = health_state["ordsAlerted"]
            health_state["expo"] = "online" if expo_ok else "offline"
            health_state["ords"] = "online" if ords_ok else "offline"
            health_state["expoFailures"] = 0 if expo_ok else health_state["expoFailures"] + 1
            health_state["ordsFailures"] = 0 if ords_ok else health_state["ordsFailures"] + 1
            health_state["expoDetail"] = expo_detail
            health_state["ordsDetail"] = ords_detail
            expo_failures = health_state["expoFailures"]
            ords_failures = health_state["ordsFailures"]
            last_recovery = health_state["lastExpoRecovery"]

        if not expo_ok:
            print(f"Watchdog Expo Go: {expo_detail}", flush=True)
        if not ords_ok:
            print(f"Watchdog Oracle/ORDS: {ords_detail}", flush=True)

        if expo_failures >= 2 and time.monotonic() - last_recovery >= AUTO_RECOVERY_COOLDOWN_SECONDS:
            with lock:
                health_state["lastExpoRecovery"] = time.monotonic()
            try:
                subprocess.run(
                    ["systemctl", "--user", "restart", "taotl-expo-go.service"],
                    check=True,
                    timeout=30,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                time.sleep(5)
                recovered, _ = check_url(
                    EXPO_HEALTH_URL,
                    {"Accept": "application/expo+json", "Expo-Platform": "android"},
                )
                send_telegram(
                    "✅ Expo Go Taotl riavviato automaticamente e di nuovo online."
                    if recovered
                    else "⚠️ Ho riavviato Expo Go, ma il servizio risulta ancora offline. Serve un controllo manuale."
                )
            except Exception:
                send_telegram("⚠️ Expo Go è offline e il riavvio automatico non è riuscito.")
        elif previous_expo == "online" and not expo_ok:
            send_telegram("⚠️ Expo Go Taotl non risponde. Ritento prima del recupero automatico.")

        should_alert_ords = not in_startup_grace and not oracle_maintenance
        ords_message = None
        if should_alert_ords and not ords_ok and not ords_alerted:
            if "ORA-04036" in ords_detail:
                ords_message = (
                    "🛑 Oracle ha raggiunto il limite di memoria PGA (ORA-04036). "
                    "ORDS può rifiutare temporaneamente le richieste; non riavvio automaticamente il database."
                )
            elif ords_failures >= 2:
                ords_message = f"🛑 Oracle/ORDS non risponde dopo due controlli: {ords_detail}."

        if ords_message:
            with lock:
                health_state["ordsAlerted"] = True
            send_telegram(ords_message)
        elif ords_ok and ords_alerted:
            with lock:
                health_state["ordsAlerted"] = False
            send_telegram("✅ Oracle/ORDS Taotl è tornato online.")

        time.sleep(WATCHDOG_INTERVAL_SECONDS)


def find_error(error_id: str) -> dict[str, Any] | None:
    with lock:
        for record in reversed(recent_errors):
            if record.get("id", "").lower() == error_id.lower():
                return record
    return None


def handle_bot_command(text: str) -> str:
    command, _, argument = text.strip().partition(" ")
    command = command.split("@", 1)[0].lower()
    if command == "/status":
        with lock:
            return (
                "Stato Taotl\n"
                f"Expo Go: {health_state['expo']}\n"
                f"Oracle/ORDS: {health_state['ords']} ({health_state['ordsDetail']})\n"
                f"Errori in memoria: {len(recent_errors)}"
            )
    if command == "/ultimi":
        with lock:
            latest = list(recent_errors)[-5:]
        if not latest:
            return "Nessun errore registrato."
        return "\n\n".join(
            f"{item['id']}\n{item.get('source')} · {item.get('error', {}).get('message')}" for item in reversed(latest)
        )[:4_000]
    if command == "/errore" and argument:
        item = find_error(argument.strip())
        if not item:
            return "Errore non trovato. Usa /ultimi per vedere gli ID recenti."
        return json.dumps(item, ensure_ascii=False, indent=2)[:4_000]
    return "Comandi disponibili:\n/status\n/ultimi\n/errore ID"


def telegram_polling_loop() -> None:
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    offset = 0
    while True:
        try:
            updates = telegram_call("getUpdates", {"offset": offset, "timeout": 25}, timeout=35) or []
            for update in updates:
                offset = max(offset, int(update.get("update_id", 0)) + 1)
                message = update.get("message") or {}
                chat_id = str((message.get("chat") or {}).get("id", ""))
                text = message.get("text")
                if chat_id == TELEGRAM_CHAT_ID and isinstance(text, str) and text.startswith("/"):
                    send_telegram(handle_bot_command(text))
        except Exception:
            time.sleep(10)


class MonitorHandler(BaseHTTPRequestHandler):
    server_version = "TaotlMonitor/1.0"

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Monitor-Key")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = urllib.parse.urlsplit(self.path)
        if path.path == "/health":
            with lock:
                status = dict(health_state)
            self.send_json(HTTPStatus.OK, {"ok": True, **status})
            return
        if path.path == "/v1/errors":
            if not is_authorized(self.headers):
                self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Unauthorized"})
                return
            query = urllib.parse.parse_qs(path.query)
            try:
                limit = max(1, min(100, int(query.get("limit", [20])[0])))
            except ValueError:
                limit = 20
            with lock:
                items = list(recent_errors)[-limit:]
            self.send_json(HTTPStatus.OK, {"items": items})
            return
        self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not Found"})

    def do_POST(self) -> None:  # noqa: N802
        if urllib.parse.urlsplit(self.path).path != "/v1/errors":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not Found"})
            return
        if not is_authorized(self.headers):
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Unauthorized"})
            return
        client_ip = self.headers.get("X-Forwarded-For", self.client_address[0]).split(",", 1)[0].strip()
        if not allowed_by_rate_limit(client_ip):
            self.send_json(HTTPStatus.TOO_MANY_REQUESTS, {"error": "Too Many Requests"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY_BYTES:
                raise ValueError("Dimensione payload non valida.")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            record = append_error(safe_payload(payload), client_ip)
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": redact_text(error, 300)})
            return
        self.send_json(HTTPStatus.CREATED, {"ok": True, "id": record["id"]})

    def log_message(self, _format: str, *_args: Any) -> None:
        # Niente body/header nei log HTTP: i dati utili sono già nel JSONL ripulito.
        return


def load_recent_errors() -> None:
    if not LOG_PATH.exists():
        return
    try:
        lines = LOG_PATH.read_text(encoding="utf-8").splitlines()[-500:]
        for line in lines:
            item = json.loads(line)
            if isinstance(item, dict):
                recent_errors.append(item)
    except Exception:
        pass


def main() -> None:
    if not MONITOR_KEY:
        raise SystemExit("TAOTL_MONITOR_KEY o EXPO_PUBLIC_APP_KEY non configurata.")
    load_recent_errors()
    threading.Thread(target=watchdog_loop, name="watchdog", daemon=True).start()
    threading.Thread(target=telegram_polling_loop, name="telegram", daemon=True).start()
    server = ThreadingHTTPServer((BIND, PORT), MonitorHandler)
    server.serve_forever()


if __name__ == "__main__":
    main()
