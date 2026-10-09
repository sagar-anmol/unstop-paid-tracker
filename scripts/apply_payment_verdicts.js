/**
 * techFEST '26 — payment claim bridge for the CI reconciler
 * --------------------------------------------------------
 * The Python reconciler owns the matching logic and never touches the database.
 * This script handles the two database legs using the Neon driver already in
 * this repo:
 *
 *   --export-claims   read claims awaiting a verdict into
 *                     data/payment_claims_pending.json
 *   (default)         read data/payment_verdicts.json and write them back
 *
 * Usage:
 *   NEON_DATABASE_URL=... node scripts/apply_payment_verdicts.js --export-claims
 *   NEON_DATABASE_URL=... node scripts/apply_payment_verdicts.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = path.resolve(__dirname, '..');
const CLAIMS_FILE = path.join(BASE_DIR, 'data', 'payment_claims_pending.json');
const VERDICT_FILE = path.join(BASE_DIR, 'data', 'payment_verdicts.json');

const databaseUrl = process.env.NEON_DATABASE_URL || '';
const exportClaims = process.argv.includes('--export-claims');

// A claim already carrying a verdict is only reconsidered once this much time
// has passed, so each hourly run costs work proportional to new claims rather
// than to the full history.
const RECHECK_AFTER_MINUTES = 30;

if (!databaseUrl) {
  console.error('Missing NEON_DATABASE_URL. Export it before running this script.');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function exportOpenClaims() {
  const rows = await sql`
    SELECT claim_id, participant_id, email, participant_name, claimed_at, state, claimed_amount
    FROM payment_claims
    WHERE state = 'PENDING_RECONCILE'
       OR last_checked_at IS NULL
       OR last_checked_at < NOW() - INTERVAL '${RECHECK_AFTER_MINUTES} minutes'
    ORDER BY claimed_at ASC
    LIMIT 500
  `;

  const claims = rows.map(r => ({
    claimId: r.claim_id,
    participantId: r.participant_id,
    email: (r.email || '').trim().toLowerCase(),
    participantName: r.participant_name || '',
    claimedAt: r.claimed_at,
    state: r.state,
    claimedAmount: r.claimed_amount
  }));

  const payload = {
    claims,
    exported_at: new Date().toISOString(),
    note: 'Claims awaiting a verdict, exported for scripts/reconcile_payments.py'
  };

  fs.mkdirSync(path.dirname(CLAIMS_FILE), { recursive: true });
  fs.writeFileSync(CLAIMS_FILE, JSON.stringify(payload, null, 2) + '\n');
  console.log(
    `Exported ${claims.length} claim(s) awaiting a verdict to ` +
      path.relative(BASE_DIR, CLAIMS_FILE)
  );
}

async function applyVerdicts() {
  if (!fs.existsSync(VERDICT_FILE)) {
    console.log('No verdict file found. Nothing to apply.');
    return;
  }

  const payload = JSON.parse(fs.readFileSync(VERDICT_FILE, 'utf8'));
  const verdicts = Array.isArray(payload.verdicts) ? payload.verdicts : [];

  if (verdicts.length === 0) {
    console.log('Verdict file contains no verdicts.');
    return;
  }

  let applied = 0;
  let failed = 0;

  for (const v of verdicts) {
    try {
      // Neon opens one HTTP request per statement. Wrapping the claim update and
      // its audit row in a transaction keeps the two consistent without paying
      // for a separate round-trip.
      await sql.transaction(async (tx) => {
        await tx`
          UPDATE payment_claims
             SET state = ${v.state},
                 resolved_at = NOW(),
                 resolved_by = 'ci_reconciler',
                 api_registration_id = ${v.apiRegistrationId || null},
                 api_utr = ${v.apiUtr || null},
                 api_amount = ${v.apiAmount ?? null},
                 api_status = ${v.apiStatus || null},
                 last_checked_at = NOW(),
                 match_note = ${v.matchNote || null}
           WHERE claim_id = ${v.claimId}
        `;

        await tx`
          INSERT INTO audit_logs
            (id, timestamp, actor_name, actor_role, actor_team, action, target_id, target_name, event_name, prev_status, next_status, details)
          VALUES (
            ${`reconcile_${v.claimId}`},
            NOW(),
            'CI Reconciler',
            'system',
            'Automation',
            'CLAIM_RESOLVED',
            ${String(v.participantId || '')},
            ${v.participantName || v.email || 'Participant'},
            'Payment Reconciliation',
            'PENDING_RECONCILE',
            ${v.state},
            ${v.matchNote || ''}
          )
          ON CONFLICT (id) DO NOTHING
        `;
      });

      applied++;
    } catch (err) {
      failed++;
      // Never echo the raw driver message: it can contain host and role names.
      console.error(`Could not apply verdict for claim ${v.claimId}: ${err.message}`);
    }
  }

  console.log(`Applied ${applied} verdict(s). ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

try {
  if (exportClaims) {
    await exportOpenClaims();
  } else {
    await applyVerdicts();
  }
} catch (err) {
  console.error('Database step failed:', err.message);
  process.exit(1);
}