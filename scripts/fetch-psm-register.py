#!/usr/bin/env python3
"""Fetch all products from the BAES PSM Register API and cache them locally."""

import json
import random
import string
import time
from email.utils import parsedate_to_datetime
from pathlib import Path

import requests

BASE_URL = "https://psmregister-neu.baes.gv.at/apipsm/api/v1/psm"
OUTPUT_PATH = Path(__file__).parent.parent / "data" / "psm-register.json"
SEARCH_CHARS = string.ascii_lowercase + string.digits + "äöü"
REQUEST_DELAY = 10  # seconds before each product query, including the first
MAX_RETRIES = 5
RETRY_BACKOFF = 3  # seconds
RATE_LIMIT_BACKOFF = 30  # seconds, doubled for each HTTP 429 retry

session = requests.Session()


def retry_after_seconds(value):
    """Parse a Retry-After header containing seconds or an HTTP date."""
    if not value:
        return 0
    try:
        return max(0, int(value))
    except ValueError:
        try:
            return max(0, parsedate_to_datetime(value).timestamp() - time.time())
        except (TypeError, ValueError, OverflowError):
            return 0


def fetch_with_retry(method, url, **kwargs):
    """Retry connection errors and rate limits with exponential backoff."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = session.request(method, url, **kwargs)
            r.raise_for_status()
            return r
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout,
                requests.exceptions.HTTPError) as e:
            rate_limited = e.response is not None and e.response.status_code == 429
            if isinstance(e, requests.exceptions.HTTPError) and not rate_limited:
                raise
            print(f"  Request failed (attempt {attempt}/{MAX_RETRIES}): {e}", flush=True)
            if attempt == MAX_RETRIES:
                raise
            backoff = RATE_LIMIT_BACKOFF if rate_limited else RETRY_BACKOFF
            sleep_time = backoff * 2 ** (attempt - 1)
            if rate_limited:
                sleep_time = max(sleep_time, retry_after_seconds(e.response.headers.get("Retry-After")))
            print(f"  Retrying in {sleep_time:g}s...", flush=True)
            time.sleep(sleep_time)


def fetch_last_update():
    r = fetch_with_retry("GET", f"{BASE_URL}/last-update", timeout=10)
    return r.json()["date"]


def fetch_products_for_char(char):
    r = fetch_with_retry(
        "GET",
        f"{BASE_URL}/suggest-tradename-regnr",
        params={"searchString": char, "page": 1, "size": 500},
        timeout=10,
    )
    return r.json().get("items", [])


def fetch_all_products():
    seen = {}
    for char in SEARCH_CHARS:
        time.sleep(REQUEST_DELAY + random.uniform(0, 0.5))
        items = fetch_products_for_char(char)
        for item in items:
            reg_nr = item["registrationNumber"]
            if reg_nr not in seen:
                seen[reg_nr] = item["tradeName"]
    return [
        {"tradeName": name, "registrationNumber": reg_nr}
        for reg_nr, name in sorted(seen.items(), key=lambda x: x[1].lower())
    ]


def main():
    print("Checking last update date...")
    last_update = fetch_last_update()
    print(f"API last update: {last_update}")

    if OUTPUT_PATH.exists():
        old_data = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
        if old_data.get("lastUpdate") == last_update:
            print("Local data is already up to date. No changes needed.")
            return
        print(f"Local data is from {old_data.get('lastUpdate')}, fetching new data...")
    else:
        print("No local data found, fetching all products...")

    products = fetch_all_products()
    output = {"lastUpdate": last_update, "products": products}

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Saved {len(products)} products to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
