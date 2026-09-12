"""Controllo in sola lettura: SDK servito ai telefoni e nuove release Expo."""

from __future__ import annotations

import json
import re
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

DIST_TAGS_URL = "https://registry.npmjs.org/-/package/expo/dist-tags"
CHECK_INTERVAL_SECONDS = 60 * 60
REMINDER_SECONDS = 24 * 60 * 60
VERSION_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$")


def sdk_major(version: Any, *, stable: bool = False) -> int:
    match = VERSION_RE.fullmatch(str(version))
    if not match or (stable and match[4]):
        raise ValueError("Versione Expo non valida")
    return int(match[1])


def fetch_json(url: str, headers: dict[str, str] | None = None) -> dict[str, Any]:
    request = urllib.request.Request(url, headers=headers or {"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=20) as response:
        data = json.loads(response.read(2 * 1024 * 1024))
    if not isinstance(data, dict):
        raise ValueError("Risposta Expo non valida")
    return data


def assess_compatibility(
    installed: str, served: str, tags: dict[str, Any],
) -> tuple[str, dict[str, str]]:
    """Non confonde patch e prerelease con un nuovo SDK stabile."""
    local_sdk = sdk_major(installed)
    served_sdk = sdk_major(served)
    latest_sdk = sdk_major(tags.get("latest"), stable=True)
    alerts: dict[str, str] = {}
    detail = f"SDK servito {served_sdk} · installato {local_sdk} · stabile Expo {latest_sdk}"
    if served_sdk != local_sdk:
        alerts[f"manifest:{served_sdk}:{local_sdk}"] = (
            f"⚠️ Taotl serve ancora SDK {served_sdk}, ma sul server è installato SDK {local_sdk}. "
            "Verificare il processo Metro prima di usare l'app."
        )
    if served_sdk < latest_sdk:
        alerts[f"stable:{served_sdk}:{latest_sdk}"] = (
            f"🚨 Compatibilità Taotl: disponibile Expo SDK {latest_sdk} stabile; "
            f"l'app aperta dai telefoni usa SDK {served_sdk}. "
            "L'aggiornamento di Expo Go può impedire di aprirla. "
            "Serve una migrazione verificata oppure una build Taotl autonoma. "
            "Nessuna dipendenza è stata modificata automaticamente."
        )
    previews = []
    for tag in ("next", "beta", "canary"):
        if tag in tags:
            candidate = sdk_major(tags[tag])
            if candidate > max(local_sdk, served_sdk, latest_sdk):
                previews.append(candidate)
    if previews:
        upcoming = max(previews)
        detail += f" · anteprima {upcoming}"
        alerts[f"preview:{served_sdk}:{upcoming}"] = (
            f"🔔 Preavviso Taotl: Expo SDK {upcoming} è disponibile in anteprima; "
            f"l'app usa SDK {served_sdk}. Preparare e verificare la migrazione prima "
            "del rilascio stabile e dell'aggiornamento di Expo Go. "
            "È un preavviso, non un blocco rilevato."
        )
    return detail, alerts


class CompatibilityMonitor:
    def __init__(
        self,
        project_root: Path,
        manifest_url: str,
        state_path: Path,
        notify: Callable[[str], bool],
        publish_status: Callable[[dict[str, Any]], None],
    ) -> None:
        self.project_root = project_root
        self.manifest_url = manifest_url
        self.state_path = state_path
        self.notify = notify
        self.publish_status = publish_status
        self.failures = 0
        self.notified: dict[str, float] = {}
        try:
            data = json.loads(state_path.read_text(encoding="utf-8"))
            self.notified = {str(k): float(v) for k, v in data.items()}
        except (OSError, ValueError, TypeError, AttributeError):
            pass

    def notify_once(self, key: str, message: str) -> None:
        now = time.time()
        if key in self.notified and now - self.notified[key] < REMINDER_SECONDS:
            return
        # Un invio fallito non viene segnato come consegnato: si ritenta al controllo successivo.
        if self.notify(message):
            self.notified[key] = now
            self.notified = {k: v for k, v in self.notified.items() if now - v < 7 * REMINDER_SECONDS}
            self.state_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            temporary = self.state_path.with_suffix(".tmp")
            temporary.write_text(json.dumps(self.notified), encoding="utf-8")
            temporary.chmod(0o600)
            temporary.replace(self.state_path)

    def check_once(self) -> None:
        try:
            package = json.loads(
                (self.project_root / "node_modules/expo/package.json").read_text(encoding="utf-8")
            )
            # Il manifest pubblico è ciò che apre il telefono: package.json da solo non basta.
            manifest = fetch_json(self.manifest_url, {
                "Accept": "application/expo+json", "Expo-Platform": "android",
            })
            served = manifest["extra"]["expoClient"]["sdkVersion"]
            detail, alerts = assess_compatibility(package["version"], served, fetch_json(DIST_TAGS_URL))
            self.publish_status({
                "expoCompatibility": "attention" if alerts else "ok",
                "expoCompatibilityDetail": detail,
                "expoCompatibilityCheckedAt": datetime.now(timezone.utc).isoformat(),
            })
            self.failures = 0
            for key, message in alerts.items():
                self.notify_once(key, message)
        except Exception as error:
            self.failures += 1
            # Non includere URL, header o contenuto delle risposte nei log.
            detail = f"Controllo compatibilità non riuscito ({type(error).__name__}); ritento tra un'ora"
            self.publish_status({"expoCompatibility": "unknown", "expoCompatibilityDetail": detail})
            print(detail, flush=True)
            if self.failures >= 2:
                try:
                    self.notify_once("check-unavailable", "⚠️ Taotl: impossibile verificare le nuove versioni Expo da due controlli. Gli avvisi preventivi potrebbero essere in ritardo; /status mostra l'ultimo controllo riuscito.")
                except Exception:
                    pass

    def run(self) -> None:
        while True:
            self.check_once()
            time.sleep(CHECK_INTERVAL_SECONDS)
