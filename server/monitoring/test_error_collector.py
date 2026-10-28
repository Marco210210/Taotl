import io
import unittest
import json
import tempfile
from pathlib import Path
import error_collector as collector
from unittest.mock import patch
from urllib.error import HTTPError

from error_collector import check_url, notify_error, last_notifications


class HealthTests(unittest.TestCase):
    def test_expo_recovery_survives_restart_and_is_sent_once(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(collector, "EXPO_ALERT_STATE_PATH", Path(directory) / "state.json"), patch.dict(collector.health_state, {"expoAlerted": False}), patch("error_collector.send_telegram", return_value=True) as send:
            collector.notify_expo_health(True)
            send.assert_not_called()
            collector.notify_expo_health(False)
            collector.notify_expo_health(False)
            send.assert_called_once()
            # Simula la rilettura dello stato dopo il riavvio del processo.
            collector.health_state["expoAlerted"] = json.loads(collector.EXPO_ALERT_STATE_PATH.read_text())["alerted"]
            collector.notify_expo_health(True)
            collector.notify_expo_health(True)
            self.assertEqual(send.call_count, 2)
            self.assertIn("tornato online", send.call_args.args[0])
            self.assertFalse(json.loads(collector.EXPO_ALERT_STATE_PATH.read_text())["alerted"])

    def test_failed_recovery_notification_is_retried(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(collector, "EXPO_ALERT_STATE_PATH", Path(directory) / "state.json"), patch.dict(collector.health_state, {"expoAlerted": True}), patch("error_collector.send_telegram", side_effect=[False, True]) as send:
            collector.notify_expo_health(True)
            self.assertTrue(collector.health_state["expoAlerted"])
            collector.notify_expo_health(True)
            self.assertFalse(collector.health_state["expoAlerted"])
            self.assertEqual(send.call_count, 2)

    def test_network_reports_do_not_alert_or_throttle_real_errors(self):
        with patch.dict(last_notifications, {}, clear=True), patch("error_collector.send_telegram") as send:
            for source in ("api.timeout", "api.network"):
                notify_error({"source": source})
            send.assert_not_called()
            self.assertEqual(last_notifications, {})
            notify_error({"id": "test", "fingerprint": "server-failure", "source": "api.request", "context": {"status": 500}})
            send.assert_called_once()

    def test_expected_session_response_is_reachable_only_for_ords(self):
        for allowed in (False, True):
            error = HTTPError("https://example.invalid", 401, "Unauthorized", {}, io.BytesIO(b'{"message":"Sessione mancante."}'))
            with self.subTest(allowed=allowed), patch("urllib.request.urlopen", side_effect=error):
                self.assertEqual(check_url("https://example.invalid", allow_session_required=allowed)[0], allowed)

    def test_unexpected_unauthorized_response_is_still_failure(self):
        for body in (b'{"message":"Unauthorized"}', b'[]', b'<html>Unauthorized</html>'):
            error = HTTPError("https://example.invalid", 401, "Unauthorized", {}, io.BytesIO(body))
            with self.subTest(body=body), patch("urllib.request.urlopen", side_effect=error):
                self.assertFalse(check_url("https://example.invalid", allow_session_required=True)[0])

    def test_database_failure_is_still_reported(self):
        error = HTTPError("https://example.invalid", 500, "Error", {}, io.BytesIO(b'ORA-04036'))
        with patch("urllib.request.urlopen", side_effect=error):
            self.assertEqual(check_url("https://example.invalid", allow_session_required=True), (False, "HTTP 500 (ORA-04036)"))


if __name__ == "__main__":
    unittest.main()
