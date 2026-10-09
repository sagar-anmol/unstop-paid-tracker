#!/usr/bin/env python3
"""
techFEST '26 — participant events index
---------------------------------------
Builds api/participant_events.json: a lookup from email to the events that
person entered, merged across both sources:

  unstop        registrations captured by scripts/fetch_registrations.py
  techfest26    registrations from the techfest26.in payments API

The generated_at timestamp changes on every run, so pass --check to compare
content without the timestamp. CI uses that to decide whether anything changed.

Usage:
    python scripts/build_participant_events_index.py
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timezone, timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_JSON = os.path.join(BASE_DIR, "data.json")
PAYMENTS_JSON = os.path.join(BASE_DIR, "data", "techfest26_payments.json")
OUTPUT_FILE = os.path.join(BASE_DIR, "api", "participant_events.json")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("events-index")


def normalise_email(value):
    return (value or "").strip().lower()


def parse_timestamp(value):
    """Parses an ISO-8601 timestamp, tolerating a trailing Z. None if unusable."""
    if not value:
        return None
    text = str(value).strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    # Naive timestamps are compared as UTC so the guard stays consistent.
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def load_json(path, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except (json.JSONDecodeError, OSError) as exc:
        log.warning("Could not read %s (%s)", os.path.basename(path), exc)
        return default


def build_index():
    index = {}

    def entry(email):
        email = normalise_email(email)
        if not email or email == "n/a":
            return None
        if email not in index:
            index[email] = {"unstop": set(), "techfest26": set(), "cancelled": False, "reverted": False}
        return index[email]

    # ---- Unstop registrations (one row per participant per event) ----
    unstop = load_json(DATA_JSON, {})
    participants = unstop.get("participants", []) if isinstance(unstop, dict) else unstop

    for participant in participants or []:
        record = entry(participant.get("email"))
        if not record:
            continue

        event_name = participant.get("event_name")
        if event_name:
            record["unstop"].add(event_name)

        if participant.get("is_cancelled"):
            record["cancelled"] = True
            record["cancel_detected_at"] = participant.get("cancelled_at") or participant.get("registered_at")
        if participant.get("cancel_reverted"):
            record["reverted"] = True

    unstop_people = len(index)

    # ---- techfest26.in registrations ----
    payments = load_json(PAYMENTS_JSON, {})
    for record in payments.get("records", []) if isinstance(payments, dict) else []:
        emails = {normalise_email(record.get("email"))}
        emails.update(normalise_email(e) for e in (record.get("allEmails") or []))

        for email in emails:
            target = entry(email)
            if not target:
                continue
            for event_name in record.get("events") or []:
                if event_name:
                    target["techfest26"].add(event_name)

    # ---- Cancellation win-back ----
    # A cancelled participant flips to reverted when their email reappears in a
    # techfest26.in registration created *after* the cancellation. The date
    # guard stops a registration that predates the cancellation from silently
    # clearing the flag.
    #
    # This runs over every cancelled participant, not over open payment claims:
    # a claim is about a payment, while a win-back is about a cancelled
    # registration that may have no claim at all.
    payment_records = payments.get("records", []) if isinstance(payments, dict) else []

    for email, record in index.items():
        if not record.get("cancelled") or record.get("reverted"):
            continue

        detected_at = record.get("cancel_detected_at")
        if not detected_at:
            # Without a cancellation date there is nothing to compare against,
            # so the row stays cancelled until a caller confirms it by hand.
            log.info(
                "Cancellation for %s has no detected date; leaving it for manual confirmation",
                email,
            )
            continue

        detected_dt = parse_timestamp(detected_at)
        if detected_dt is None:
            continue

        # A small window so a registration made in the same second is not missed
        # purely because of clock granularity between the two systems.
        threshold = detected_dt - timedelta(minutes=1)

        for payment in payment_records:
            payment_emails = {normalise_email(payment.get("email"))}
            payment_emails.update(
                normalise_email(e) for e in (payment.get("allEmails") or [])
            )
            if email not in payment_emails:
                continue

            created_dt = parse_timestamp(payment.get("createdAt"))
            if created_dt is None:
                continue

            if created_dt > threshold:
                record["reverted"] = True
                record["reverted_via"] = payment.get("registrationId")
                log.info(
                    "Win-back confirmed for %s via %s (registered %s)",
                    email,
                    payment.get("registrationId"),
                    payment.get("createdAt"),
                )
                break

            log.info(
                "Registration %s for %s predates the cancellation (%s <= %s); "
                "not treated as a win-back",
                payment.get("registrationId"),
                email,
                payment.get("createdAt"),
                detected_at,
            )

    return index, unstop_people


def main():
    parser = argparse.ArgumentParser(description="Build the email -> events lookup index.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit non-zero when the content would change (ignores generated_at).",
    )
    args = parser.parse_args()
    check_only = args.check

    index, unstop_people = build_index()

    output = {}
    for email in sorted(index.keys()):
        record = index[email]
        events = sorted(record["unstop"] | record["techfest26"])
        if not events and not record["cancelled"]:
            continue
        output[email] = {
            "total": len(events),
            "unstop": len(record["unstop"]),
            "techfest26": len(record["techfest26"]),
            "events": events,
            "cancelled": record["cancelled"],
            "reverted": record["reverted"],
        }

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "people": len(output),
        "unstop_people": unstop_people,
        "note": "email -> events entered. Generated by scripts/build_participant_events_index.py",
        "events": output,
    }

    # Compare against what is committed, ignoring the timestamp, so a no-op run
    # leaves the working tree clean instead of rewriting an identical file.
    if check_only:
        if os.path.exists(OUTPUT_FILE):
            with open(OUTPUT_FILE, "r", encoding="utf-8") as handle:
                previous = json.load(handle)
            comparable_new = {k: v for k, v in payload.items() if k != "generated_at"}
            comparable_old = {k: v for k, v in previous.items() if k != "generated_at"}
            if comparable_new == comparable_old:
                log.info("Index is unchanged.")
                return 0
        log.info("Index would change.")
        return 1

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True, ensure_ascii=False)
        handle.write("\n")

    cancelled = sum(1 for v in output.values() if v["cancelled"])
    reverted = sum(1 for v in output.values() if v["reverted"])
    log.info(
        "Indexed %s people (%s cancelled, %s reverted) -> %s",
        len(output),
        cancelled,
        reverted,
        os.path.relpath(OUTPUT_FILE, BASE_DIR),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())