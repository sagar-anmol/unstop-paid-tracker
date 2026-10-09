#!/usr/bin/env python3
"""
techFEST '26 payment claim reconciler
------------------------------------
Compares claims raised by coordinators against the techfest26.in payments
snapshot and writes a verdict back to Neon.

Design rules
------------
* Never auto-approves. CI attaches evidence; a human makes the final call.
* Matches on lowercased email across both `email` and `allEmails`.
* Terminal states are never re-queried, so a settled claim costs nothing.
* The win-back auto-clear is guarded: a registration only counts as a revert if
  it was created *after* the cancellation, so historical registrations cannot
  silently clear a cancelled flag (implemented in build_participant_events_index.py).

Verdicts
--------
PENDING_RECONCILE    claim not checked yet
AWAITING_SETTLEMENT  email matched, but the payment is still pending
MATCH_FOUND          completed payment found, needs a human to confirm
NO_MATCH             no registration for this email (dispute)
AMBIGUOUS            several registrations share the email, needs review

Claims are read from Neon by apply_payment_verdicts.js, which writes a
data/payment_claims_pending.json snapshot for this script to evaluate. Verdicts
are written back to data/payment_verdicts.json and applied to Neon by the same
Node script. Splitting it this way keeps a single database driver in the repo.
"""

import json
import logging
import os
import sys
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SNAPSHOT_FILE = os.path.join(BASE_DIR, "data", "techfest26_payments.json")
VERDICT_FILE = os.path.join(BASE_DIR, "data", "payment_verdicts.json")
CLAIMS_FILE = os.path.join(BASE_DIR, "data", "payment_claims_pending.json")

# Verdicts are written to a file and applied to Neon by apply_payment_verdicts.js.
# Talking raw Postgres from Python would mean adding a driver dependency, and the
# Neon HTTP driver already exists in this repo.
WRITE_VERDICTS = os.environ.get("WRITE_VERDICTS", "true").lower() in ("1", "true", "yes")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("reconcile")

# Terminal states are decided by a human and never re-evaluated by CI
TERMINAL_STATES = {"VERIFIED_PAID", "REJECTED"}


def load_snapshot():
    if not os.path.exists(SNAPSHOT_FILE):
        log.error("Missing %s. Run fetch_techfest26_payments.py first.", SNAPSHOT_FILE)
        sys.exit(1)
    with open(SNAPSHOT_FILE, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload.get("records", [])


def index_by_email(records):
    """email -> list of registration records."""
    index = {}
    for record in records:
        emails = set()
        if record.get("email"):
            emails.add(record["email"].strip().lower())
        for extra in record.get("allEmails") or []:
            if extra:
                emails.add(extra.strip().lower())
        for email in emails:
            index.setdefault(email, []).append(record)
    return index





def decide(claim, matches):
    """Returns (state, note, evidence)."""
    if not matches:
        return (
            "NO_MATCH",
            "No registration with this email on techfest26.in. Confirm with the "
            "candidate whether they used a different email before rejecting.",
            None,
        )

    completed = [m for m in matches if m.get("paymentStatus") == "completed"]
    pending = [m for m in matches if m.get("paymentStatus") == "pending"]
    failed = [m for m in matches if m.get("paymentStatus") == "failed"]

    # Several registrations with mixed outcomes need a human decision
    if len(matches) > 1 and (completed and pending):
        return (
            "AMBIGUOUS",
            "Email matches {n} registrations with mixed statuses ({c} completed, "
            "{p} pending, {f} failed). Review each registration ID.".format(
                n=len(matches), c=len(completed), p=len(pending), f=len(failed)
            ),
            completed[0] if completed else matches[0],
        )

    if completed:
        match = completed[0]
        note = "Completed payment found: {rid}, ₹{amt} via {mode}".format(
            rid=match.get("registrationId"),
            amt=match.get("amount"),
            mode=(match.get("paymentType") or "UPI").upper(),
        )
        claimed_amount = claim.get("claimed_amount") or 0
        match_amount = match.get("amount") or 0
        if claimed_amount and match_amount and float(claimed_amount) != float(match_amount):
            note += ". Note: caller quoted ₹{c} but the gateway shows ₹{m}".format(
                c=claimed_amount, m=match_amount
            )
        return ("MATCH_FOUND", note, match)

    if failed:
        match = failed[0]
        return (
            "NO_MATCH",
            "Registration exists but its payment status is 'failed' ({rid}).".format(
                rid=match.get("registrationId")
            ),
            match,
        )

    if pending:
        match = pending[0]
        return (
            "AWAITING_SETTLEMENT",
            "Registration found ({rid}) but payment is still pending: ₹{amt}.".format(
                rid=match.get("registrationId"), amt=match.get("amount")
            ),
            match,
        )

    match = matches[0]
    return (
        "AWAITING_SETTLEMENT",
        "Registration found ({rid}) with status '{st}'.".format(
            rid=match.get("registrationId"), st=match.get("paymentStatus") or "unknown"
        ),
        match,
    )


def load_open_claims():
    """Reads the claim snapshot exported by apply_payment_verdicts.js."""
    if not os.path.exists(CLAIMS_FILE):
        log.warning(
            "No %s yet. Run apply_payment_verdicts.js --export-claims first.",
            os.path.basename(CLAIMS_FILE),
        )
        return []

    with open(CLAIMS_FILE, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    return payload.get("claims", []) or []


def main():
    records = load_snapshot()
    index = index_by_email(records)
    log.info("Indexed %s registrations across %s emails", len(records), len(index))

    claims = load_open_claims()
    log.info("Evaluating %s open claims", len(claims))

    if not claims:
        log.info("Nothing to reconcile.")
        return 0

    verdicts = []
    counts = {}

    for claim in claims:
        if claim.get("state") in TERMINAL_STATES:
            continue
        if not claim.get("email"):
            # Unstop rows without an email cannot be matched automatically.
            # Flag it so a human resolves it rather than leaving a claim that
            # silently never clears.
            log.warning(
                "Claim %s has no email on file; marking NO_MATCH so it surfaces "
                "for manual review",
                claim["claimId"],
            )
            state = "NO_MATCH"
            note = (
                "No email recorded for this participant, so the claim cannot be "
                "matched automatically. Confirm the payment with the candidate "
                "and record the correct email."
            )
            verdicts.append(
                {
                    "claimId": claim["claimId"],
                    "participantId": claim.get("participantId"),
                    "email": "",
                    "participantName": claim.get("participantName"),
                    "state": state,
                    "matchNote": note,
                    "apiRegistrationId": None,
                    "apiUtr": None,
                    "apiAmount": None,
                    "apiStatus": None,
                }
            )
            counts[state] = counts.get(state, 0) + 1
            continue

        matches = index.get(claim["email"], [])
        state, note, evidence = decide(claim, matches)
        counts[state] = counts.get(state, 0) + 1

        verdicts.append(
            {
                "claimId": claim["claimId"],
                "participantId": claim.get("participantId"),
                "email": claim["email"],
                "participantName": claim.get("participantName"),
                "state": state,
                "matchNote": note,
                "apiRegistrationId": (evidence or {}).get("registrationId"),
                "apiUtr": (evidence or {}).get("utr"),
                "apiAmount": (evidence or {}).get("amount"),
                "apiStatus": (evidence or {}).get("paymentStatus"),
            }
        )

        log.info(
            "%s -> %s | %s",
            claim.get("participantName") or claim.get("participantId"),
            state,
            note,
        )

    log.info("Verdict summary: %s", counts or "none")

    if not verdicts:
        # Nothing to apply. Leave the previous file alone so a no-op run keeps
        # the working tree clean instead of rewriting an identical payload.
        log.info("No verdicts to write; %s left as is.", os.path.basename(VERDICT_FILE))
        return 0

    if not WRITE_VERDICTS:
        log.info("WRITE_VERDICTS=false: nothing written to %s", VERDICT_FILE)
        return 0

    payload = {
        "verdicts": sorted(verdicts, key=lambda v: str(v["claimId"])),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "note": "Generated by scripts/reconcile_payments.py. Applied to Neon by apply_payment_verdicts.js.",
    }
    with open(VERDICT_FILE, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True, ensure_ascii=False)
        handle.write("\n")

    log.info("Wrote %s verdicts to %s", len(verdicts), VERDICT_FILE)
    return 0


if __name__ == "__main__":
    sys.exit(main())