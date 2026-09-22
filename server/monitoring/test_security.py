"""Security regression tests; no real Telegram messages or production writes."""
import json
import threading
import unittest
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer
from unittest.mock import patch
import error_collector as collector


class CollectorSecurityTests(unittest.TestCase):
    def setUp(self):
        collector.rate_windows.clear()
        collector.last_notifications.clear()

    def test_log_access_requires_server_secret(self):
        with patch.object(collector, 'MONITOR_KEY', 'server-only-secret'):
            self.assertFalse(collector.is_authorized({'X-App-Key': 'old-client-key'}))
            self.assertFalse(collector.is_authorized({'X-Monitor-Key': 'old-client-key'}))
            self.assertFalse(collector.is_authorized({}))
            self.assertTrue(collector.is_authorized({'X-Monitor-Key': 'server-only-secret'}))

    def test_rate_limit_caps_and_expires(self):
        with patch.object(collector.time, 'monotonic', return_value=1000):
            for _ in range(collector.RATE_LIMIT_PER_MINUTE):
                self.assertTrue(collector.allowed_by_rate_limit('test-client'))
            self.assertFalse(collector.allowed_by_rate_limit('test-client'))
        with patch.object(collector.time, 'monotonic', return_value=1061):
            self.assertTrue(collector.allowed_by_rate_limit('test-client'))

    def test_different_messages_cannot_bypass_notification_cooldown(self):
        with patch.object(collector, 'send_telegram') as send, patch.object(collector.time, 'monotonic', return_value=1000):
            for i in range(10):
                collector.notify_error({'fingerprint': str(i), 'id': 'fixture', 'error': {'message': str(i)}})
            self.assertEqual(send.call_count, 1)
            self.assertIn('non verificata', send.call_args.args[0])

    def test_public_ingestion_does_not_grant_log_reading(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), collector.MonitorHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f'http://127.0.0.1:{server.server_port}/v1/errors'
        try:
            with patch.object(collector, 'append_error', return_value={'id': 'fixture'}) as append:
                req = urllib.request.Request(url, data=json.dumps({'error': {'message': 'fixture'}}).encode(), headers={'Content-Type': 'application/json', 'X-Forwarded-For': 'forged, 192.0.2.5'})
                with urllib.request.urlopen(req) as response:
                    self.assertEqual(response.status, 201)
                self.assertEqual(append.call_args.args[1], '192.0.2.5')
            with self.assertRaises(urllib.error.HTTPError) as ctx:
                urllib.request.urlopen(url)
            self.assertEqual(ctx.exception.code, 401)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()
