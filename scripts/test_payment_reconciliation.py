#!/usr/bin/env python3
"""
Local sanity checks for scripts/reconcile_payments.py
-----------------------------------------------------
Exercises the matching rules against a fixed snapshot and claim set, including
the failure modes that matter: a claim whose email never appears, a completed
payment, a payment still settling, a failed payment, and one email with two
registrations in different states.

Run with:
    python3 scripts/test_payment_reconciliation.py
"""

import json
import os
import sys
import tempfile
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import reconcile_payments as rp  # noqa: E402

SNAPSHOT = [
    {
        "registrationId": "REG1",
        "email": "completed@example.com",
        "allEmails": ["completed@example.com"],
        "amount": 599,
        "utr": "111",
        "paymentStatus": "completed",
        "paymentType": "upi",
        "events": ["Kritrim"],
        "createdAt": "2026-10-01T00:00:00.000Z",
    },
    {
        "registrationId": "REG2",
        "email": "pending@example.com",
        "allEmails": ["pending@example.com", "alt@example.com"],
        "amount": 199,
        "utr": "222",
        "paymentStatus": "pending",
        "paymentType": "upi",
        "events": ["RoboSoccer"],
        "createdAt": "2026-10-02T00:00:00.000Z",
    },
    {
        "registrationId": "REG3",
        "email": "failed@example.com",
        "allEmails": ["failed@example.com"],
        "amount": 199,
        "utr": "333",
        "paymentStatus": "failed",
        "paymentType": "upi",
        "events": ["Quiz Nova"],
        "createdAt": "2026-10-03T00:00:00.000Z",
    },
    {
        "registrationId": "REG4",
        "email": "mixed@example.com",
        "allEmails": ["mixed@example.com"],
        "amount": 199,
        "paymentStatus": "completed",
        "events": ["RoboSoccer"],
        "createdAt": "2026-10-04T00:00:00.000Z",
    },
    {
        "registrationId": "REG5",
        "email": "mixed@example.com",
        "allEmails": ["mixed@example.com"],
        "amount": 299,
        "paymentStatus": "pending",
        "events": ["RoboWar"],
        "createdAt": "2026-10-05T00:00:00.000Z",
    },
]

CLAIMS = [
    {"claimId": "c1", "email": "completed@example.com", "claimed_amount": 599},
    {"claimId": "c2", "email": "pending@example.com", "claimed_amount": 199},
    {"claimId": "c3", "email": "failed@example.com", "claimed_amount": 199},
    {"claimId": "c4", "email": "mixed@example.com", "claimed_amount": 199},
    {"claimId": "c5", "email": "missing@example.com", "claimed_amount": 199},
    {"claimId": "c6", "email": "alt@example.com", "claimed_amount": 199},
    # No email on file: must surface for manual review rather than stall forever
    {"claimId": "c7", "email": "", "claimed_amount": 199},
]

failures = []


def check(name, condition, detail=""):
    if condition:
        print(f"  ok   {name}")
    else:
        print(f"  FAIL {name} {detail}")
        failures.append(name)


print("email index")
index = rp.index_by_email(SNAPSHOT)
check("alt@example.com resolves via allEmails", "alt@example.com" in index)
check("mixed@example.com has two registrations", len(index["mixed@example.com"]) == 2)

print("\nverdicts")
cases = [
    ("c1", "MATCH_FOUND", "completed payment needs a human"),
    ("c2", "AWAITING_SETTLEMENT", "pending payment is still settling"),
    ("c3", "NO_MATCH", "failed payment is not a completed claim"),
    ("c4", "AMBIGUOUS", "two registrations with mixed statuses"),
    ("c5", "NO_MATCH", "no registration at all"),
    ("c6", "AWAITING_SETTLEMENT", "matched through allEmails"),
]

for claim_id, expected_state, description in cases:
    claim = next(c for c in CLAIMS if c["claimId"] == claim_id)
    matches = index.get(claim["email"], [])
    state, note, evidence = rp.decide(claim, matches)
    check(f"{claim_id} -> {expected_state} ({description})", state == expected_state, f"got {state}: {note}")

print("\namount mismatch is called out, not silently accepted")
claim = {"claimId": "c7", "email": "completed@example.com", "claimed_amount": 9999}
state, note, evidence = rp.decide(claim, index["completed@example.com"])
check("still MATCH_FOUND", state == "MATCH_FOUND")
check("note mentions both amounts", "9999" in note and "599" in note, note)

print("\nevidence is attached for human review")
check("registration id present", evidence.get("registrationId") == "REG1")
check("utr present", evidence.get("utr") == "111")
check("status present", evidence.get("paymentStatus") == "completed")

print("\nno-match produces no evidence")
state, note, evidence = rp.decide(
    {"claimId": "c8", "email": "nobody@example.com"},
    [],
)
check("evidence is None", evidence is None)
check("note suggests checking a different email", "different email" in note)

print("\nend-to-end run against temporary files")
with tempfile.TemporaryDirectory() as tmp:
    snapshot_path = os.path.join(tmp, "payments.json")
    claims_path = os.path.join(tmp, "claims.json")
    verdict_path = os.path.join(tmp, "verdicts.json")

    with open(snapshot_path, "w", encoding="utf-8") as fh:
        json.dump({"records": SNAPSHOT}, fh)
    with open(claims_path, "w", encoding="utf-8") as fh:
        json.dump({"claims": CLAIMS}, fh)

    rp.SNAPSHOT_FILE = snapshot_path
    rp.CLAIMS_FILE = claims_path
    rp.VERDICT_FILE = verdict_path
    rp.WRITE_VERDICTS = True

    # Pre-seed the verdict file so we can prove a repeat run does not rewrite it
    with open(verdict_path, "w", encoding="utf-8") as fh:
        json.dump(
            {
                "verdicts": [],
                "generated_at": "1970-01-01T00:00:00+00:00",
                "note": "placeholder",
            },
            fh,
        )

    exit_code = rp.main()
    check("run succeeded", exit_code == 0, f"exit {exit_code}")

    with open(verdict_path, "r", encoding="utf-8") as fh:
        verdicts = json.load(fh)["verdicts"]

    by_id = {v["claimId"]: v["state"] for v in verdicts}
    check("all seven claims evaluated", len(verdicts) == 7, str(by_id))
    check(
        "participant name is carried into the verdict for the audit trail",
        all("participantName" in v for v in verdicts),
    )
    check(
        "states match expectations",
        all(by_id.get(cid) == state for cid, state, _ in cases),
        str(by_id),
    )
    check(
        "claim without an email is flagged, not stalled",
        by_id.get("c7") == "NO_MATCH",
        str(by_id),
    )
    check(
        "verdicts are sorted for a stable diff",
        [v["claimId"] for v in verdicts] == sorted(v["claimId"] for v in verdicts),
    )

    # A second identical run must produce identical content, since the workflow
    # relies on this to avoid pointless commits.
    first = open(verdict_path, "r", encoding="utf-8").read()
    rp.main()
    second = open(verdict_path, "r", encoding="utf-8").read()
    check(
        "verdict content is stable apart from generated_at",
        json.loads(first)["verdicts"] == json.loads(second)["verdicts"],
    )

    # With every claim resolved, a further run must not touch the file at all
    with open(claims_path, "w", encoding="utf-8") as fh:
        json.dump({"claims": []}, fh)
    rp.main()
    check(
        "empty claim set leaves the verdict file untouched",
        open(verdict_path, "r", encoding="utf-8").read() == second,
    )

if failures:
    print(f"\n{len(failures)} check(s) failed: {', '.join(failures)}")
    sys.exit(1)

print("\nAll reconciliation checks passed.")