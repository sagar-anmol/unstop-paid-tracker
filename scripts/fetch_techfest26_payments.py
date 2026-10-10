#!/usr/bin/env python3
"""
techFEST '26 payments sync — incremental fetcher
------------------------------------------------
Pulls registrations from the techfest26.com admin payments API and upserts them
into data/techfest26_payments.json, keyed on registrationId.

The script is incremental on purpose: it writes nothing when the API returns the
same data as the previous run, so the hourly workflow produces an empty git diff
and skips the commit entirely.

Environment
-----------
ADMIN_API_KEY  (required) x-api-key header value
"""

import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_FILE = os.path.join(BASE_DIR, "data", "techfest26_payments.json")
OVERRIDE_FILE = os.path.join(BASE_DIR, "data", "payment_status_overrides.json")

API_KEY = os.environ.get("ADMIN_API_KEY", "").strip()
BASE_URL = os.environ.get(
    "TECHFEST26_API_BASE", "https://app.techfest26.com/api/admin/payments"
).strip()
PAGE_SIZE = int(os.environ.get("TECHFEST26_PAGE_SIZE", "500"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("sync-payments")


def build_session():
    session = requests.Session()
    retry = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    session.mount("https://", HTTPAdapter(max_retries=retry))
    return session


def fetch_all_records(session):
    """Walks every page and returns the full record list."""
    records = []
    page = 1
    total_pages = 1

    while page <= total_pages:
        separator = "&" if urlparse(BASE_URL).query else "?"
        url = (
            f"{BASE_URL}{separator}"
            + urlencode({"page": page, "limit": PAGE_SIZE})
        )
        resp = session.get(url, headers={"x-api-key": API_KEY}, timeout=30)

        if resp.status_code in (401, 403):
            log.error("Admin API rejected the key (HTTP %s). Rotate ADMIN_API_KEY.", resp.status_code)
            sys.exit(1)
        if resp.status_code != 200:
            log.warning("HTTP %s on page %s, stopping pagination.", resp.status_code, page)
            break

        body = resp.json()
        if not isinstance(body, dict):
            log.error("Unexpected response shape on page %s", page)
            break

        batch = body.get("records") or []
        records.extend(batch)

        pagination = body.get("pagination") or {}
        total_pages = int(pagination.get("totalPages") or 1)
        total_matching = pagination.get("totalMatchingRecords")
        log.info(
            "Fetched page %s/%s (%s records so far)",
            page,
            total_pages,
            len(records),
        )

        if total_matching is not None:
            log.info("API reports %s total matching records", total_matching)

        page += 1
        if page > 1:
            time.sleep(0.2)

    return records


def normalise(record):
    """Keeps the fields the dashboard and reconciler rely on."""
    return {
        "registrationId": record.get("registrationId"),
        "email": (record.get("email") or "").strip().lower(),
        "allEmails": [
            (e or "").strip().lower() for e in (record.get("allEmails") or []) if e
        ],
        "name": record.get("name") or "",
        "phone": record.get("phone") or "",
        "college": record.get("college") or "",
        "accommodation": bool(record.get("accommodation")),
        "amount": record.get("amount") or 0,
        "utr": record.get("utr") or "",
        "paymentType": record.get("paymentType") or "",
        "paymentStatus": record.get("paymentStatus") or "",
        "events": record.get("events") or [],
        "createdAt": record.get("createdAt") or None,
        "updatedAt": record.get("updatedAt") or None,
    }


def load_status_overrides():
    """Team-confirmed statuses that outrank whatever the API reports.

    The techfest26.in admin API keeps reporting 'pending' until a payment is
    confirmed on their side, which happens long after the team has verified the
    UTR. Without this layer the hourly sync would silently undo every manual
    confirmation on the next run.
    """
    if not os.path.exists(OVERRIDE_FILE):
        return {}
    try:
        with open(OVERRIDE_FILE, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        statuses = payload.get("statuses") or {}
        return {str(k): str(v) for k, v in statuses.items() if v}
    except (json.JSONDecodeError, OSError) as exc:
        log.warning("Could not read %s (%s); ignoring overrides.",
                    os.path.basename(OVERRIDE_FILE), exc)
        return {}


def apply_status_overrides(records, overrides):
    """Force confirmed statuses on top of the snapshot. Returns how many changed."""
    applied = 0
    for row in records:
        override = overrides.get(str(row.get("registrationId")))
        if override and row.get("paymentStatus") != override:
            row["paymentStatus"] = override
            applied += 1
    return applied


def load_existing():
    """Previous snapshot, or an empty one when the file is missing or corrupt."""
    if not os.path.exists(OUTPUT_FILE):
        return {"records": [], "last_synced_at": None}
    try:
        with open(OUTPUT_FILE, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, dict) and isinstance(data.get("records"), list):
            return data
    except (json.JSONDecodeError, OSError) as exc:
        log.warning("Could not read existing snapshot (%s); starting fresh.", exc)
    return {"records": [], "last_synced_at": None}


def build_payload(existing, records, overrides=None):
    """Upsert by registrationId. Records only change when the API says so."""
    overrides = overrides or {}
    by_id = {}
    for row in existing.get("records", []):
        if row.get("registrationId"):
            by_id[row["registrationId"]] = row

    added, updated, unchanged = 0, 0, 0

    for raw in records:
        row = normalise(raw)
        reg_id = row["registrationId"]
        if not reg_id:
            log.warning("Skipping a record without registrationId")
            continue

        previous = by_id.get(reg_id)
        if previous is None:
            by_id[reg_id] = row
            added += 1
            continue

        # Compare everything except updatedAt so a heartbeat does not count as a change
        comparable_keys = [k for k in row if k != "updatedAt"]
        if all(previous.get(k) == row.get(k) for k in comparable_keys):
            unchanged += 1
            # Keep the newest updatedAt for freshness reporting
            by_id[reg_id]["updatedAt"] = row["updatedAt"]
            continue

        updated += 1
        by_id[reg_id] = row

    ordered = sorted(by_id.values(), key=lambda r: str(r.get("registrationId")))

    # Team-confirmed statuses win over the API, so a sync never reverts a
    # payment the team has already verified from its UTR.
    overridden = apply_status_overrides(ordered, overrides)

    return (
        {
            "records": ordered,
            "last_synced_at": datetime.now(timezone.utc).isoformat(),
            "source": BASE_URL,
            "note": "Generated by scripts/fetch_techfest26_payments.py — do not edit by hand.",
        },
        added,
        updated,
        unchanged,
        overridden,
    )


def main():
    if not API_KEY:
        log.error("ADMIN_API_KEY is not set. Add it as a repository secret.")
        sys.exit(1)

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    log.info("Fetching techfest26.in payments from %s", BASE_URL)
    session = build_session()
    records = fetch_all_records(session)
    log.info("API returned %s records", len(records))

    existing = load_existing()
    overrides = load_status_overrides()
    payload, added, updated, unchanged, overridden = build_payload(existing, records, overrides)

    log.info("Added %s | Updated %s | Unchanged %s", added, updated, unchanged)
    if overridden:
        log.info("Applied %s manual status override(s) from %s",
                 overridden, os.path.basename(OVERRIDE_FILE))

    if added == 0 and updated == 0 and overridden == 0:
        log.info("No API changes. Leaving %s untouched so CI skips the commit.", OUTPUT_FILE)
        return 0

    with open(OUTPUT_FILE, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True, ensure_ascii=False)
        handle.write("\n")

    log.info("Wrote %s (%s records)", OUTPUT_FILE, len(payload["records"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())