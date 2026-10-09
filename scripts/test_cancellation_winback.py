#!/usr/bin/env python3
"""
Tests for the cancellation win-back guard in
scripts/build_participant_events_index.py.

The rule under test: a cancelled participant is marked won back only when their
email appears again in a techfest26.in registration created *after* the
cancellation. A registration that predates the cancellation must never clear the
flag, and a missing cancellation date must not either.

    python3 scripts/test_cancellation_winback.py
"""

import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import build_participant_events_index as indexer  # noqa: E402

failures = []


def check(name, condition, detail=""):
    if condition:
        print(f"  ok   {name}")
    else:
        print(f"  FAIL {name} {detail}")
        failures.append(name)


def write(path, payload):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh)


def build(cancelled_rows, payment_records):
    """Runs the builder against temporary inputs and returns the index."""
    with tempfile.TemporaryDirectory() as tmp:
        data_json = os.path.join(tmp, "data.json")
        payments = os.path.join(tmp, "payments.json")
        out = os.path.join(tmp, "participant_events.json")

        write(data_json, {"participants": cancelled_rows})
        write(payments, {"records": payment_records})

        indexer.DATA_JSON = data_json
        indexer.PAYMENTS_JSON = payments
        indexer.OUTPUT_FILE = out

        indexer.main()
        with open(out, "r", encoding="utf-8") as fh:
            return json.load(fh)["events"]


def participant(email, cancelled_at):
    return {
        "id": f"reg_{email}",
        "email": email,
        "event_name": "RoboSoccer",
        "is_cancelled": True,
        "cancelled_at": cancelled_at,
        "cancel_reverted": False,
    }


def registration(email, created_at, reg_id="REG1"):
    return {
        "registrationId": reg_id,
        "email": email,
        "allEmails": [email],
        "amount": 199,
        "paymentStatus": "completed",
        "events": ["RoboSoccer"],
        "createdAt": created_at,
    }


print("registration after the cancellation wins the participant back")
events = build(
    [participant("late@example.com", "2026-10-01T00:00:00.000Z")],
    [registration("late@example.com", "2026-10-05T10:00:00.000Z")],
)
check("marked reverted", events["late@example.com"]["reverted"] is True)

print("\nregistration before the cancellation does not")
events = build(
    [participant("early@example.com", "2026-10-10T00:00:00.000Z")],
    [registration("early@example.com", "2026-09-01T10:00:00.000Z")],
)
check(
    "still cancelled",
    events["early@example.com"]["reverted"] is False,
    json.dumps(events["early@example.com"]),
)
check("cancellation flag retained", events["early@example.com"]["cancelled"] is True)

print("\nregistration at the same instant counts as a win-back")
events = build(
    [participant("same@example.com", "2026-10-05T10:00:00.000Z")],
    [registration("same@example.com", "2026-10-05T10:00:00.000Z")],
)
check("clock-granuity allowance applied", events["same@example.com"]["reverted"] is True)

print("\nno cancellation date means no auto-clear")
events = build(
    [{"id": "x", "email": "nodate@example.com", "event_name": "Quiz Nova", "is_cancelled": True}],
    [registration("nodate@example.com", "2026-10-05T10:00:00.000Z")],
)
check(
    "left for manual confirmation",
    events["nodate@example.com"]["reverted"] is False,
    json.dumps(events["nodate@example.com"]),
)

print("\nno matching registration leaves the row cancelled")
events = build(
    [participant("gone@example.com", "2026-10-01T00:00:00.000Z")],
    [registration("someone.else@example.com", "2026-10-05T10:00:00.000Z")],
)
check("not reverted", events["gone@example.com"]["reverted"] is False)

print("\nmatch through allEmails still counts")
events = build(
    [participant("alias@example.com", "2026-10-01T00:00:00.000Z")],
    [
        {
            "registrationId": "REG2",
            "email": "primary@example.com",
            "allEmails": ["primary@example.com", "alias@example.com"],
            "amount": 199,
            "paymentStatus": "completed",
            "events": ["RoboSoccer"],
            "createdAt": "2026-10-06T10:00:00.000Z",
        }
    ],
)
check("reverted via allEmails", events["alias@example.com"]["reverted"] is True)

print("\na pending registration still counts as a win-back")
events = build(
    [participant("pending@example.com", "2026-10-01T00:00:00.000Z")],
    [
        {
            "registrationId": "REG3",
            "email": "pending@example.com",
            "allEmails": ["pending@example.com"],
            "amount": 199,
            "paymentStatus": "pending",
            "events": ["RoboWar"],
            "createdAt": "2026-10-06T10:00:00.000Z",
        }
    ],
)
check("reverted while pending", events["pending@example.com"]["reverted"] is True)

print("\nnon-cancelled participants are never marked reverted")
events = build(
    [{"id": "ok", "email": "active@example.com", "event_name": "RoboSoccer"}],
    [registration("active@example.com", "2026-10-06T10:00:00.000Z")],
)
check(
    "no revert on an active row",
    events["active@example.com"]["reverted"] is False
    and events["active@example.com"]["cancelled"] is False,
)

print("\nevent merging stays correct across both sources")
events = build(
    [
        {
            "id": "r1",
            "email": "both@example.com",
            "event_name": "RoboSoccer",
            "is_cancelled": False,
        }
    ],
    [registration("both@example.com", "2026-10-06T10:00:00.000Z")],
)
record = events["both@example.com"]
check(
    "counts per source and union of events",
    record["unstop"] == 1 and record["techfest26"] == 1 and record["total"] == 1,
    json.dumps(record),
)

print("\nindex generation is deterministic")
a = build(
    [participant("dup@example.com", "2026-10-01T00:00:00.000Z")],
    [registration("dup@example.com", "2026-10-06T10:00:00.000Z")],
)
b = build(
    [participant("dup@example.com", "2026-10-01T00:00:00.000Z")],
    [registration("dup@example.com", "2026-10-06T10:00:00.000Z")],
)
check("identical input yields identical output", a == b)

if failures:
    print(f"\n{len(failures)} check(s) failed: {', '.join(failures)}")
    sys.exit(1)

print("\nAll win-back guard checks passed.")