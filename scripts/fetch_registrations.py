#!/usr/bin/env python3
"""
Unstop Multi-Event Paid Registrations Fetcher & Sync Script
----------------------------------------------------------
1. Discovers ALL events / opportunities from Unstop Workspace listing.
2. Loops through each event and fetches participant registrations.
3. Filters verified PAID / Complete registrations.
4. Associates each participant with their respective event.
5. Outputs structured JSON for the multi-event web dashboard.
"""

import os
import json
import logging
import base64
import time
from datetime import datetime, timezone
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "paid_participants.json")
SUMMARY_FILE = os.path.join(DATA_DIR, "summary.json")
ROOT_DATA_FILE = os.path.join(BASE_DIR, "data.json")

UNSTOP_TOKEN = os.environ.get("UNSTOP_TOKEN", "").strip()
UNSTOP_COOKIES = os.environ.get("UNSTOP_COOKIES", "").strip()
UNSTOP_ACCOUNT_ID = os.environ.get("UNSTOP_ACCOUNT_ID", "2313619").strip()
UNSTOP_EMAIL = os.environ.get("UNSTOP_EMAIL", "").strip()
UNSTOP_PASSWORD = os.environ.get("UNSTOP_PASSWORD", "").strip()
MOCK_MODE = os.environ.get("MOCK_MODE", "false").lower() in ("true", "1", "yes")
# One-shot discovery: set UNSTOP_RAW_DUMP=1 to write data/unstop_status_values.json
RAW_DUMP = os.environ.get("UNSTOP_RAW_DUMP", "false").lower() in ("true", "1", "yes")

os.makedirs(DATA_DIR, exist_ok=True)


def get_http_session():
    """Create a resilient requests Session with retries."""
    session = requests.Session()
    retry_strategy = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "POST"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def parse_jwt_expiry(token: str):
    """Extract expiry date from JWT token."""
    try:
        clean_token = token.replace("Bearer ", "").strip()
        parts = clean_token.split(".")
        if len(parts) >= 2:
            payload_b64 = parts[1] + "==="
            payload = json.loads(base64.urlsafe_b64decode(payload_b64.encode("utf-8")))
            if "exp" in payload:
                return datetime.fromtimestamp(payload["exp"], timezone.utc).isoformat()
    except Exception as e:
        logging.debug(f"Could not parse JWT expiry: {e}")
    return None


def is_token_valid(token: str, margin_seconds: int = 600) -> bool:
    """Check if token is a valid JWT and has more than margin_seconds remaining."""
    if not token:
        return False
    try:
        clean_token = token.replace("Bearer ", "").strip()
        parts = clean_token.split(".")
        if len(parts) >= 2:
            payload_b64 = parts[1] + "==="
            payload = json.loads(base64.urlsafe_b64decode(payload_b64.encode("utf-8")))
            if "exp" in payload:
                now_ts = datetime.now(timezone.utc).timestamp()
                return (payload["exp"] - now_ts) > margin_seconds
    except Exception:
        pass
    return False


def login_to_unstop(email: str, password: str, session: requests.Session = None):
    """
    Autonomous login to Unstop using email and password via OAuth microservice.
    Returns (access_token, cookie_str).
    """
    if not email or not password:
        return None, None

    if session is None:
        session = requests.Session()

    login_headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://unstop.com",
        "Referer": "https://unstop.com/auth/login"
    }

    try:
        logging.info("Requesting Unstop CSRF cookie...")
        csrf_url = "https://unstop.com/api/micro/oauth/v2/generate/csrf-cookie"
        session.get(csrf_url, headers=login_headers, timeout=15)
        xsrf = session.cookies.get("XSRF-TOKEN")
        if xsrf:
            import urllib.parse
            login_headers["X-XSRF-TOKEN"] = urllib.parse.unquote(xsrf)

        logging.info(f"Authenticating autonomously as {email}...")
        login_url = "https://unstop.com/api/micro/oauth/v2/user/login"
        payload = {
            "grant_type": "password",
            "username": email,
            "email": email,
            "password": password,
            "scope": "*",
            "network": "",
            "access_token": "",
            "e": True
        }

        resp = session.post(login_url, json=payload, headers=login_headers, timeout=20)
        if resp.status_code == 200:
            token = session.cookies.get("access_token", "")
            if not token:
                try:
                    data = resp.json()
                    token = data.get("access_token", "")
                except Exception:
                    pass

            cookie_str = "; ".join([f"{k}={v}" for k, v in session.cookies.get_dict().items()])
            logging.info("✅ Autonomous Unstop login successful! Fresh token acquired.")
            return token, cookie_str
        else:
            logging.error(f"Unstop login failed (HTTP {resp.status_code}): {resp.text[:300]}")
            return None, None
    except Exception as e:
        logging.error(f"Exception during Unstop login: {e}")
        return None, None


def get_headers(token=None, cookies=None):
    tok = token if token is not None else UNSTOP_TOKEN
    cks = cookies if cookies is not None else UNSTOP_COOKIES
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://unstop.com/organiser-panel/opportunities",
        "Origin": "https://unstop.com",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
        "selected-account": UNSTOP_ACCOUNT_ID
    }

    if tok:
        if not tok.lower().startswith("bearer ") and not tok.lower().startswith("token "):
            headers["Authorization"] = f"Bearer {tok}"
        else:
            headers["Authorization"] = tok

    if cks:
        headers["Cookie"] = cks

    return headers


def is_registration_paid(record: dict) -> bool:
    """Check if registration is completed / paid."""
    regi_status = str(record.get("regi_status", "")).strip().lower()
    reg_status_text = str(record.get("registrationStatus", "")).strip().lower()

    # Explicit signals that payment or registration is NOT complete
    for neg in ("not paid", "incomplete", "not complete", "not filled"):
        if neg in reg_status_text or neg in regi_status:
            return False

    if regi_status == "complete":
        return True

    if reg_status_text in ("complete registration", "complete", "paid") or "complete registration" in reg_status_text:
        return True

    for amt_field in ("paid_amount", "paidAmount", "amount_paid", "amount"):
        val = record.get(amt_field)
        try:
            if val is not None and float(val) > 0:
                return True
        except (ValueError, TypeError):
            pass

    return False


# Tokens that indicate a registration was cancelled. Unstop does not document
# its status vocabulary, so this is intentionally broad; an unrecognised or
# empty status is never treated as cancelled. Run with UNSTOP_RAW_DUMP=1 once to
# capture the real values in data/unstop_status_values.json, then tighten this.
CANCEL_TOKENS = (
    "cancel",
    "deleted",
    "withdraw",
    "dropped",
    "refund requested",
)


def is_registration_cancelled(record: dict) -> bool:
    """
    Detect a cancelled registration.

    The exact field names are not documented by Unstop, so this checks every
    plausible signal and only treats an explicit cancellation token as a match.
    An empty/unknown status never counts as cancelled.

    Run the scraper with UNSTOP_RAW_DUMP=1 once to capture the real vocabulary
    in data/unstop_status_values.json, then tighten CANCEL_TOKENS if needed.
    """
    status_fields = (
        "regi_status",
        "registrationStatus",
        "status",
        "status_text",
        "state",
    )

    for field in status_fields:
        value = str(record.get(field, "") or "").strip().lower()
        if not value:
            continue
        if any(token in value for token in CANCEL_TOKENS):
            return True

    # Explicit boolean flags, if Unstop exposes them
    for flag in ("is_cancelled", "isCanceled", "cancelled", "canceled", "is_deleted", "isDeleted"):
        if record.get(flag) is True:
            return True

    # A populated cancellation timestamp is unambiguous
    for field in ("cancelled_at", "canceled_at", "deleted_at", "cancelledAt"):
        if record.get(field):
            return True

    return False


def dump_status_vocabulary(records: list) -> None:
    """
    One-shot discovery helper. With UNSTOP_RAW_DUMP=1 this writes the distinct
    status values and a sample record's key list so the cancellation detector
    can be written against real data instead of assumptions.
    """
    field_values = {}
    sample_keys = set()

    for record in records:
        if not isinstance(record, dict):
            continue
        sample_keys.update(record.keys())
        for field in ("regi_status", "registrationStatus", "status", "status_text", "state"):
            value = record.get(field)
            if value is not None:
                field_values.setdefault(field, {})
                text = str(value)
                field_values[field][text] = field_values[field].get(text, 0) + 1

    payload = {
        "dumped_at": datetime.now(timezone.utc).isoformat(),
        "record_count": len(records),
        "available_keys": sorted(sample_keys),
        "status_values": field_values,
    }

    out_path = os.path.join(DATA_DIR, "unstop_status_values.json")
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True, ensure_ascii=False)
        handle.write("\n")

    logging.info(f"Status vocabulary written to {out_path}")
    for field, values in field_values.items():
        logging.info(f"  {field}: {values}")


def normalize_record(record: dict, index: int, event_info: dict) -> dict:
    """Normalize Unstop record into standard dashboard format."""
    players = record.get("players") or []
    primary_player = players[0] if players else {}
    user_obj = record.get("user") or {}

    name = (
        primary_player.get("name")
        or user_obj.get("name")
        or record.get("full_name")
        or f"Participant #{index}"
    )

    email = (
        primary_player.get("unlock_email")
        or record.get("email")
        or "N/A"
    )

    phone = (
        primary_player.get("unlock_mobile")
        or record.get("phone")
        or record.get("mobile")
        or "N/A"
    )

    college = (
        primary_player.get("organisation")
        or record.get("college")
        or "N/A"
    )

    team_name = record.get("team_name") or "Individual"
    if isinstance(team_name, dict):
        team_name = team_name.get("name") or "Individual"

    members = []
    if players:
        for p in players:
            members.append({
                "name": p.get("name") or "Team Member",
                "email": p.get("unlock_email") or "",
                "phone": p.get("unlock_mobile") or "",
                "college": p.get("organisation") or college,
                "course": p.get("course_specialization") or ""
            })

    amount = 0.0
    for amt_field in ("paid_amount", "paidAmount", "amount_paid", "amount"):
        val = record.get(amt_field)
        try:
            if val is not None:
                amount = float(val)
                break
        except (ValueError, TypeError):
            pass

    regn_id = record.get("regn_id") or str(record.get("id")) or f"REG-{index:04d}"
    registered_at = record.get("last_seen") or record.get("created_at") or datetime.now(timezone.utc).isoformat()
    
    # Cancellation is checked before the refund rule: someone who cancelled
    # after paying must show as CANCELLED, not REFUNDED, so the win-back queue
    # picks them up.
    is_cancelled = is_registration_cancelled(record)

    cancelled_at = None
    for field in ("cancelled_at", "canceled_at", "deleted_at", "cancelledAt"):
        if record.get(field):
            cancelled_at = record[field]
            break

    if is_cancelled:
        is_refunded = False
        is_paid = False
        payment_status = "CANCELLED"
        status_label = "Registration Cancelled"
    else:
        # All Unstop fees were refunded back to candidates, so a nonzero amount
        # from Unstop means "was paid, now refunded".
        is_refunded = amount > 0 or record.get("is_refunded") is True
        is_paid = False
        if is_refunded:
            payment_status = "REFUNDED"
            status_label = "Refunded (Unstop)"
        else:
            payment_status = "UNPAID"
            status_label = "Payment Pending (techfest26.in)"

    return {
        "id": regn_id,
        "internal_id": record.get("id"),
        "event_id": event_info.get("id"),
        "event_name": event_info.get("title", "Event"),
        "event_type": event_info.get("type", "competitions"),
        "name": name,
        "email": email,
        "phone": phone,
        "college": college,
        "team_name": team_name,
        "team_size": max(1, len(members)),
        "team_members": members,
        "payment_id": f"UNSTOP-{record.get('id')}",
        "amount": amount,
        "payment_status": payment_status,
        "is_paid": is_paid,
        "is_refunded": is_refunded,
        "is_cancelled": is_cancelled,
        "cancelled_at": cancelled_at,
        "cancel_reverted": False,
        "status_label": status_label,
        "registered_at": registered_at,
        "resume_url": record.get("resume_url"),
        "specialization": primary_player.get("course_specialization"),
        "passing_year": primary_player.get("passing_out_year")
    }


def fetch_all_opportunities(session, headers):
    """Fetch all active events/opportunities under the workspace."""
    events = []
    page = 1
    logging.info("Discovering all workspace opportunities...")

    while True:
        url = "https://unstop.com/api/listing/my-listing"
        params = {
            "page": page,
            "per_page": 50,
            "filterName": "integration_type,type",
            "filterValue": "assessment,all",
            "undefined": "true"
        }
        try:
            resp = session.get(url, headers=headers, params=params, timeout=25)
            if resp.status_code in (401, 403):
                logging.warning(f"Got HTTP {resp.status_code} fetching opportunities listing.")
                if UNSTOP_EMAIL and UNSTOP_PASSWORD:
                    logging.info("Attempting auto-login refresh...")
                    fresh_tok, fresh_cks = login_to_unstop(UNSTOP_EMAIL, UNSTOP_PASSWORD, session)
                    if fresh_tok:
                        headers.update(get_headers(fresh_tok, fresh_cks))
                        resp = session.get(url, headers=headers, params=params, timeout=25)

                if resp.status_code in (401, 403):
                    logging.error(f"Failed to fetch opportunities listing (HTTP {resp.status_code})")
                    print(f"::error::Unstop Token expired or invalid! HTTP {resp.status_code}")
                    return []

            resp.raise_for_status()
            data = resp.json()

            items = []
            last_page = 1
            if isinstance(data, dict):
                d_val = data.get("data")
                if isinstance(d_val, dict):
                    items = d_val.get("data", [])
                    last_page = d_val.get("last_page", 1)
                elif isinstance(d_val, list):
                    items = d_val

            if not items:
                break

            for it in items:
                events.append({
                    "id": it.get("id"),
                    "title": it.get("title"),
                    "type": it.get("type"),
                    "status": it.get("status")
                })

            if page >= last_page:
                break
            page += 1

        except Exception as e:
            logging.error(f"Error fetching opportunities on page {page}: {e}")
            break

    logging.info(f"Discovered {len(events)} total opportunities across workspace.")
    return events


def fetch_event_registrations(session, headers, event):
    """Fetch registrations for a specific event."""
    eid = event["id"]
    title = event.get("title", f"Event #{eid}")
    all_records = []
    page = 1

    while True:
        url = f"https://unstop.com/api/opportunity/{eid}/job-profiles/paginated"
        params = {
            "page": page,
            "per_page": 50,
            "filterName": "status",
            "filterValue": ""
        }
        try:
            resp = session.get(url, headers=headers, params=params, timeout=25)
            if resp.status_code in (401, 403):
                logging.warning(f"Got HTTP {resp.status_code} fetching '{title}'. Refreshing token...")
                if UNSTOP_EMAIL and UNSTOP_PASSWORD:
                    fresh_tok, fresh_cks = login_to_unstop(UNSTOP_EMAIL, UNSTOP_PASSWORD, session)
                    if fresh_tok:
                        headers.update(get_headers(fresh_tok, fresh_cks))
                        resp = session.get(url, headers=headers, params=params, timeout=25)

            if resp.status_code != 200:
                break
            data = resp.json()
            container = data.get("data") if isinstance(data, dict) else None
            items = []
            last_page = 1

            if isinstance(container, dict):
                items = container.get("data", [])
                last_page = container.get("last_page", 1)
            elif isinstance(container, list):
                items = container

            if not items:
                break

            all_records.extend(items)
            if page >= last_page:
                break
            page += 1

        except Exception as e:
            logging.warning(f"Timeout/Error fetching page {page} for '{title}' (ID {eid}): {e}")
            break

    return all_records


def main():
    global UNSTOP_TOKEN, UNSTOP_COOKIES
    sync_time = datetime.now(timezone.utc).isoformat()
    session = get_http_session()

    # Step 1: Ensure valid token via automated login if expired or absent
    if not is_token_valid(UNSTOP_TOKEN):
        if UNSTOP_EMAIL and UNSTOP_PASSWORD:
            logging.info("Token missing or expiring soon. Performing autonomous login...")
            fresh_token, fresh_cookies = login_to_unstop(UNSTOP_EMAIL, UNSTOP_PASSWORD, session)
            if fresh_token:
                UNSTOP_TOKEN = fresh_token
                if fresh_cookies:
                    UNSTOP_COOKIES = fresh_cookies
        else:
            logging.warning("No UNSTOP_EMAIL & UNSTOP_PASSWORD provided, using existing UNSTOP_TOKEN.")

    token_expiry = parse_jwt_expiry(UNSTOP_TOKEN) if UNSTOP_TOKEN else None
    headers = get_headers(UNSTOP_TOKEN, UNSTOP_COOKIES)

    all_participants = []
    all_paid_participants = []
    events_summary = []
    total_fest_applicants = 0
    raw_dump_records = []

    if not MOCK_MODE and UNSTOP_TOKEN:
        events = fetch_all_opportunities(session, headers)

        if not events:
            # Fallback to key known events if listing is empty
            events = [
                {"id": 1744819, "title": "The Aqua-Epoch", "type": "competitions"},
                {"id": 1744818, "title": "Technical Quiz Competition", "type": "competitions"},
                {"id": 1744809, "title": "WPTC - Wireless Power Transfer", "type": "competitions"},
                {"id": 1744782, "title": "Quiz Nova", "type": "quizzes"},
                {"id": 1744780, "title": "The Big Bull", "type": "competitions"}
            ]

        for idx, ev in enumerate(events):
            eid = ev["id"]
            title = ev.get("title", f"Event #{eid}")
            records = fetch_event_registrations(session, headers, ev)
            paid_records = [r for r in records if is_registration_paid(r)]
            total_fest_applicants += len(records)

            if RAW_DUMP and records:
                raw_dump_records.extend(records)

            events_summary.append({
                "id": eid,
                "title": title,
                "type": ev.get("type", "competitions"),
                "total_registrations": len(records),
                "paid_registrations": len(paid_records),
                "incomplete_registrations": len(records) - len(paid_records)
            })

            for r in records:
                norm = normalize_record(r, len(all_participants) + 1, ev)
                all_participants.append(norm)
                if norm.get("is_paid"):
                    all_paid_participants.append(norm)

            if len(records) > 0:
                logging.info(f"[{idx+1}/{len(events)}] '{title}' (ID {eid}): {len(records)} registered | {len(paid_records)} Paid | {len(records) - len(paid_records)} Incomplete")

            time.sleep(0.15)  # Polite pacing to avoid rate limits

    if RAW_DUMP and raw_dump_records:
        dump_status_vocabulary(raw_dump_records)

    # If API not configured or zero returned, retain cached data if present
    if not all_participants:
        if os.path.exists(ROOT_DATA_FILE) and os.path.getsize(ROOT_DATA_FILE) > 30:
            logging.info(f"Retaining existing cached data from {ROOT_DATA_FILE}")
            with open(ROOT_DATA_FILE, "r", encoding="utf-8") as f:
                cached_data = json.load(f)
                all_participants = cached_data.get("participants", [])
                all_paid_participants = [p for p in all_participants if p.get("is_paid")]
            if os.path.exists(SUMMARY_FILE):
                with open(SUMMARY_FILE, "r", encoding="utf-8") as f:
                    prev_summary = json.load(f)
                    events_summary = prev_summary.get("events_list", [])
                    total_fest_applicants = prev_summary.get("total_unstop_registrations", len(all_participants))

    # Compute summary
    total_count = len(all_participants)
    refunded_participants = [p for p in all_participants if p.get("is_refunded")]
    total_refunded_count = len(refunded_participants)
    cancelled_participants = [p for p in all_participants if p.get("is_cancelled")]
    total_cancelled_count = len(cancelled_participants)
    total_paid_count = 0  # Unstop no longer reports payments; techfest26.in owns this now
    total_unpaid_count = total_count - total_refunded_count - total_cancelled_count
    total_refunded_amount = sum(p.get("amount", 0) for p in refunded_participants)
    colleges = list({p.get("college") for p in all_participants if p.get("college") and p.get("college") != "N/A"})
    active_events = [e for e in events_summary if e.get("total_registrations", 0) > 0]

    summary = {
        "last_synced_at": sync_time,
        "token_expires_at": token_expiry,
        "auth_mode": "automated_login" if (UNSTOP_EMAIL and UNSTOP_PASSWORD) else "static_token",
        "total_unstop_registrations": total_count,
        "total_paid_registrations": 0,
        "total_refunded_registrations": total_refunded_count,
        "total_cancelled_registrations": total_cancelled_count,
        "total_unpaid_registrations": total_unpaid_count,
        "total_amount_collected": 0.0,
        "total_amount_refunded": round(total_refunded_amount, 2),
        "total_colleges": len(colleges),
        "total_events_scanned": len(events_summary),
        "events_with_paid": 0,
        "events_list": events_summary,
        "status": "HEALTHY",
        "note": (
            "Unstop payments fully refunded; live payment status comes from "
            "techfest26.in via the sync-payments workflow."
        )
    }

    # Save outputs
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(refunded_participants, f, indent=2, ensure_ascii=False)
    logging.info(f"Saved {total_refunded_count} refunded records to {OUTPUT_FILE}")

    if total_paid_count == 0:
        logging.info(
            "No paid registrations: Unstop payment reporting is retired. Live payment "
            "status comes from techfest26.in via the sync-payments workflow."
        )

    with open(SUMMARY_FILE, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    logging.info(f"Saved summary to {SUMMARY_FILE}")

    combined_web_data = {
        "summary": summary,
        "participants": all_participants
    }
    with open(ROOT_DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(combined_web_data, f, indent=2, ensure_ascii=False)
    logging.info(f"Saved {total_count} total records to {ROOT_DATA_FILE}")

    # Cancellations get their own file for quick reference by the calling desk
    if total_cancelled_count > 0:
        cancelled_file = os.path.join(DATA_DIR, "cancelled_registrations.json")
        with open(cancelled_file, "w", encoding="utf-8") as f:
            json.dump(cancelled_participants, f, indent=2, ensure_ascii=False)
        logging.info(f"Saved {total_cancelled_count} cancelled registrations to {cancelled_file}")

    print("\nMulti-Event Sync Completed Successfully!")
    print(f"Events Scanned: {len(events_summary)} | With Registrations: {len(active_events)}")
    print(
        f"Registrations: {total_count} | Refunded: {total_refunded_count} | "
        f"Cancelled: {total_cancelled_count} | Awaiting payment: {total_unpaid_count}"
    )
    print(f"Unique Colleges: {len(colleges)}")
    print("Payment status is owned by techfest26.in; see the sync-payments workflow.")
    if token_expiry:
        print(f"Current Token Valid Until: {token_expiry}")


if __name__ == "__main__":
    main()
