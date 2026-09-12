import io
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

from error_collector import check_url


class HealthTests(unittest.TestCase):
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
