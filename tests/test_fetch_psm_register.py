import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import requests


spec = importlib.util.spec_from_file_location(
    "fetch_psm_register",
    Path(__file__).resolve().parents[1] / "scripts" / "fetch-psm-register.py",
)
fetcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetcher)


def response(status, retry_after=None):
    result = requests.Response()
    result.status_code = status
    result.url = "https://example.test/products"
    if retry_after is not None:
        result.headers["Retry-After"] = retry_after
    return result


class FetchRegisterTests(unittest.TestCase):
    def test_rate_limit_retries_same_request_after_server_delay(self):
        success = response(200)
        with patch.object(fetcher.session, "request", side_effect=[response(429, "90"), success]) as request:
            with patch.object(fetcher.time, "sleep") as sleep:
                result = fetcher.fetch_with_retry("GET", success.url, params={"searchString": "o"}, timeout=10)
        self.assertIs(result, success)
        self.assertEqual(request.call_count, 2)
        self.assertEqual(request.call_args_list[0], request.call_args_list[1])
        sleep.assert_called_once_with(90)

    def test_retry_after_http_date(self):
        with patch.object(fetcher.time, "time", return_value=1445412420):
            self.assertEqual(fetcher.retry_after_seconds("Wed, 21 Oct 2015 07:28:00 GMT"), 60)
            self.assertEqual(fetcher.retry_after_seconds("Wed, 21 Oct 2015 07:26:00 GMT"), 0)

    def test_rate_limit_backoff_without_valid_server_delay(self):
        success = response(200)
        with patch.object(fetcher.session, "request", side_effect=[
            response(429), response(429, "invalid"), response(429, "0"), success,
        ]):
            with patch.object(fetcher.time, "sleep") as sleep:
                self.assertIs(fetcher.fetch_with_retry("GET", success.url), success)
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [30, 60, 120])

    def test_permanent_rate_limit_stops_after_maximum_attempts(self):
        with patch.object(fetcher.session, "request", return_value=response(429)) as request:
            with patch.object(fetcher.time, "sleep") as sleep:
                with self.assertRaises(requests.exceptions.HTTPError):
                    fetcher.fetch_with_retry("GET", "https://example.test/products")
        self.assertEqual(request.call_count, fetcher.MAX_RETRIES)
        self.assertEqual(sleep.call_count, fetcher.MAX_RETRIES - 1)

    def test_other_http_errors_are_not_retried(self):
        with patch.object(fetcher.session, "request", return_value=response(404)) as request:
            with patch.object(fetcher.time, "sleep") as sleep:
                with self.assertRaises(requests.exceptions.HTTPError):
                    fetcher.fetch_with_retry("GET", "https://example.test/products")
        request.assert_called_once()
        sleep.assert_not_called()

    def test_connection_and_timeout_errors_still_retry(self):
        success = response(200)
        with patch.object(fetcher.session, "request", side_effect=[
            requests.exceptions.ConnectionError("Connection failed"),
            requests.exceptions.Timeout("Timed out"), success,
        ]):
            with patch.object(fetcher.time, "sleep") as sleep:
                self.assertIs(fetcher.fetch_with_retry("GET", success.url), success)
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [3, 6])

    def test_failed_fetch_preserves_existing_register(self):
        old_data = json.dumps({"lastUpdate": "old", "products": [{"tradeName": "Existing product"}]})
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "register.json"
            output.write_text(old_data, encoding="utf-8")
            with patch.object(fetcher, "OUTPUT_PATH", output), \
                 patch.object(fetcher, "SEARCH_CHARS", "ab"), \
                 patch.object(fetcher, "fetch_last_update", return_value="new"), \
                 patch.object(fetcher, "fetch_products_for_char", side_effect=[
                     [{"registrationNumber": "123", "tradeName": "Partial result"}],
                     requests.exceptions.HTTPError(response=response(429)),
                 ]), patch.object(fetcher.time, "sleep"):
                with self.assertRaises(requests.exceptions.HTTPError):
                    fetcher.main()
            self.assertEqual(output.read_text(encoding="utf-8"), old_data)


if __name__ == "__main__":
    unittest.main()
