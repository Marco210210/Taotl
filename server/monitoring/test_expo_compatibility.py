import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from expo_compatibility import CompatibilityMonitor, assess_compatibility


class CompatibilityTests(unittest.TestCase):
    def test_patch_release_does_not_mean_incompatible(self):
        _, alerts = assess_compatibility("57.0.21", "57.0.0", {"latest": "57.0.22"})
        self.assertEqual(alerts, {})

    def test_preview_is_early_warning_not_stable_alert(self):
        _, alerts = assess_compatibility("57.0.21", "57.0.0", {
            "latest": "57.0.22", "next": "58.0.0-preview.0", "canary": "58.0.0-canary-20260909",
        })
        self.assertEqual(list(alerts), ["preview:57:58"])

    def test_new_stable_sdk_warns_about_expo_go(self):
        _, alerts = assess_compatibility("57.0.21", "57.0.0", {"latest": "58.0.0"})
        self.assertIn("stable:57:58", alerts)

    def test_running_server_on_old_sdk_is_detected(self):
        _, alerts = assess_compatibility("57.0.21", "54.0.0", {"latest": "57.0.22"})
        self.assertEqual(set(alerts), {"manifest:54:57", "stable:54:57"})

    def test_older_preview_is_ignored(self):
        _, alerts = assess_compatibility("57.0.21", "57.0.0", {
            "latest": "57.0.22", "next": "56.0.0-beta.1",
        })
        self.assertEqual(alerts, {})

    def test_invalid_upstream_data_is_not_reported_as_healthy(self):
        for latest in (None, "invalid", "58.0.0-beta.1"):
            with self.subTest(latest=latest), self.assertRaises(ValueError):
                assess_compatibility("57.0.21", "57.0.0", {"latest": latest})


class MonitorTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        package = self.root / "node_modules/expo/package.json"
        package.parent.mkdir(parents=True)
        package.write_text(json.dumps({"version": "57.0.21"}))
        self.notify = Mock(return_value=True)
        self.status = {}
        self.monitor = self.make_monitor()

    def make_monitor(self):
        return CompatibilityMonitor(
            self.root, "https://example.invalid", self.root / "state/compatibility.json",
            self.notify, self.status.update,
        )

    def test_deduplication_survives_restart_and_reminds_next_day(self):
        with patch("expo_compatibility.time.time", return_value=100_000):
            self.monitor.notify_once("stable:57:58", "upgrade")
            self.make_monitor().notify_once("stable:57:58", "upgrade")
        self.assertEqual(self.notify.call_count, 1)
        with patch("expo_compatibility.time.time", return_value=190_000):
            self.make_monitor().notify_once("stable:57:58", "upgrade")
        self.assertEqual(self.notify.call_count, 2)

    def test_undelivered_telegram_alert_is_retried(self):
        self.notify.return_value = False
        self.monitor.notify_once("preview:57:58", "preview")
        self.assertFalse(self.monitor.state_path.exists())
        self.notify.return_value = True
        self.monitor.notify_once("preview:57:58", "preview")
        self.assertEqual(self.notify.call_count, 2)

    def test_bad_persisted_state_does_not_stop_monitor(self):
        self.monitor.state_path.parent.mkdir()
        self.monitor.state_path.write_text("not json")
        self.assertEqual(self.make_monitor().notified, {})

    @patch("expo_compatibility.fetch_json")
    def test_checks_actual_manifest_and_publishes_status(self, fetch):
        fetch.side_effect = [
            {"extra": {"expoClient": {"sdkVersion": "54.0.0"}}}, {"latest": "57.0.22"},
        ]
        self.monitor.check_once()
        self.assertEqual(self.status["expoCompatibility"], "attention")
        self.assertIn("SDK servito 54", self.status["expoCompatibilityDetail"])
        self.assertTrue(self.status["expoCompatibilityCheckedAt"])
        self.assertEqual(self.notify.call_count, 2)

    @patch("expo_compatibility.fetch_json", side_effect=TimeoutError)
    def test_outage_is_visible_without_immediate_false_alarm(self, fetch):
        self.status["expoCompatibilityCheckedAt"] = "last-success"
        self.monitor.check_once()
        self.notify.assert_not_called()
        self.monitor.check_once()
        self.notify.assert_called_once()
        self.assertEqual(self.status["expoCompatibility"], "unknown")
        self.assertEqual(self.status["expoCompatibilityCheckedAt"], "last-success")

    @patch("expo_compatibility.fetch_json")
    def test_monitor_recovers_after_invalid_manifest(self, fetch):
        fetch.side_effect = [
            {}, {"extra": {"expoClient": {"sdkVersion": "57.0.0"}}}, {"latest": "57.0.22"},
        ]
        self.monitor.check_once()
        self.assertEqual(self.status["expoCompatibility"], "unknown")
        self.monitor.check_once()
        self.assertEqual(self.status["expoCompatibility"], "ok")
        self.assertEqual(self.monitor.failures, 0)


if __name__ == "__main__":
    unittest.main()
