# techFEST '26 — Operations Console

Internal console for the techFEST '26 fest team (SLIET Longowal): registrations, calling desk, payment verification, and cancellation win-back.

Deployed as a static site on GitHub Pages. No application server — data comes from files committed by GitHub Actions, and live ops state syncs through Neon PostgreSQL when a database URL is configured.

## Quick start

```bash
npm install
npm run dev            # local dev server
npm run verify         # lint + tests + production build
```

## Setup

Everything works without a database: call logs, audit entries, password hashes and record overrides fall back to `localStorage` on the current device.

To enable cross-device sync, copy `.env.example` to `.env.local` and set:

```
VITE_NEON_DATABASE_URL=postgresql://...
```

Then create the schema once:

```bash
NEON_DATABASE_URL=postgresql://... npm run migrate:neon
```

> A `VITE_*` value is inlined into the browser bundle, so anyone who opens the
> deployed site can read it. For a publicly reachable site, prefer leaving it
> empty and using localStorage, and rotate the credential if the site is ever
> exposed to people you would not trust with it. CI-only secrets belong in
> GitHub Actions secrets, never here.

## GitHub Actions secrets

| Secret | Used by | Purpose |
|---|---|---|
| `ADMIN_API_KEY` | `sync-payments.yml` | `x-api-key` for `https://app.techfest26.com/api/admin/payments` |
| `NEON_DATABASE_URL` | `sync-payments.yml` | Applies reconciliation verdicts to Neon |
| `UNSTOP_TOKEN` / `UNSTOP_COOKIES` | `sync.yml` | Optional overrides for the Unstop scraper |
| `UNSTOP_EMAIL` / `UNSTOP_PASSWORD` | `sync.yml` | Automated Unstop login when the token expires |
| `UNSTOP_ACCOUNT_ID` | `sync.yml` | Unstop workspace id |

## Workflows

- **`sync.yml`** (manual) — pulls Unstop registrations into `data.json`. Cron is
  intentionally disabled: Unstop payment reporting was retired when fees were
  refunded, and registrations moved to techfest26.in.
- **`sync-payments.yml`** (hourly + manual) — fetches the techfest26.in payments
  snapshot, reconciles coordinator claims against it, and rebuilds the lookup
  index. Every step is incremental: unchanged data produces no commit.

## Data layout

| Path | Contents |
|---|---|
| `data.json` | Registrations from Unstop (fetched at runtime, not bundled) |
| `data/techfest26_payments.json` | Payments snapshot from techfest26.in |
| `data/payment_claims_pending.json` | Open claims exported for reconciliation |
| `data/payment_verdicts.json` | Verdicts awaiting application to Neon |
| `api/participant_events.json` | `email → events entered`, merged across both sources |
| `data/cancelled_registrations.json` | Registrations cancelled on Unstop |

## Cancellation win-back

Registrations cancelled on Unstop are detected by the scraper, marked
`is_cancelled`, and surfaced with a red row, a dedicated **Cancelled** tab, and
an alert banner counting the ones nobody has called yet. Calling a cancelled
participant requires capturing the reason and whether they re-registered; the
outcomes are `Won Back`, `Agreed to re-register`, and `Still cancelled`.

Once the same email appears again in the techfest26.in snapshot **with a
registration created after the cancellation**, the row turns green
automatically. The date guard prevents a registration that predates the
cancellation from silently clearing the flag — a person is only ever
un-flagged by evidence, never by assumption.

## Payment reconciliation

A coordinator logging a call as `PAYMENT_CLAIMED` creates a claim. The hourly job
matches it against the techfest26.in API by email and records a verdict:

| Verdict | Meaning |
|---|---|
| `MATCH_FOUND` | Completed payment found — a human confirms |
| `AWAITING_SETTLEMENT` | Registration exists, payment still pending |
| `NO_MATCH` | No registration for that email (dispute) |
| `AMBIGUOUS` | Several registrations share the email |
| `VERIFIED_PAID` / `REJECTED` | Human decisions; never re-evaluated |

CI never auto-approves. Approve/reject requires `super_admin` or an explicit
`can_verify_payments` grant.

## Cancellation detection caveat

Unstop does not document its cancellation fields, so `is_registration_cancelled()`
in `scripts/fetch_registrations.py` checks every plausible signal and treats an
unknown status as *not* cancelled. Run the scraper once with `UNSTOP_RAW_DUMP=1`
to capture the real vocabulary in `data/unstop_status_values.json`, then tighten
`CANCEL_TOKENS` to match.

## Access model

Sign-in runs in the browser, so it provides accountability rather than
authentication: every call, export, record change and credential change is
attributed to a named account, and accounts can be deactivated. Anyone with
devtools access can bypass the login screen entirely. Closing that gap requires
a server-side session, which means a backend.

Two roles exist beyond the built-in directory:

- `operations_calling` (the default for new accounts) — all 13 domains, calling, record edits
- `can_verify_payments` — an explicit grant that adds approve/reject on the
  Verification Desk without granting Super Admin, which would also expose the
  password manager and team account controls

Every account created from the Team tab must replace its initial password at
first sign-in, and the change is enforced again on every later login while the
account remains on a default value.

## Tests

```bash
npm test
```

Covers:
- the SHA-256 fallback against Node's crypto (both paths must agree)
- payment-state classification over the real `data.json`, asserting the states
  partition every row exactly once and that a cancellation is never mistaken for
  a refund
- the reconciliation rules including no-match, mixed-status, missing-email, and
  no-op stability
- the win-back guard: only a registration created after the cancellation clears
  the flag, and a missing cancellation date never does

```bash
npm run check:bundle
```

Fails the build if the compiled output contains a database password, an admin
API key, a bearer token, or a connection string.