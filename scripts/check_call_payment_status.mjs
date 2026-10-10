// Checks for the caller-facing Paid / Unpaid field in src/utils/paymentUtils.js.
//
// The calling desk reads this before dialling, so a wrong answer is worse than a
// missing one: it either skips a candidate who owes money or asks someone who
// already paid to pay again. Runs against the real snapshot and participants.
//
//   node scripts/check_call_payment_status.mjs

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildTechfestPaymentIndex,
  getTechfestPaymentsFor,
  getCallPaymentStatus,
  getCallPaymentBadge,
  reconcileParticipantsWithTechfest
} from '../src/utils/paymentUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const participants = JSON.parse(readFileSync(path.join(ROOT, 'data.json'), 'utf8')).participants || [];
const snapshot = JSON.parse(readFileSync(path.join(ROOT, 'data/techfest26_payments.json'), 'utf8'));
const records = snapshot.records || [];

const failures = [];
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    console.log(`  FAIL ${name}${detail ? ` -> ${detail}` : ''}`);
    failures.push(name);
  }
}

const index = buildTechfestPaymentIndex(snapshot);

console.log('the index is keyed on every email a registration was filed under');
const multi = records.find((r) => (r.allEmails || []).length > 0);
if (multi) {
  check('allEmails resolve to the same registration', getTechfestPaymentsFor(index, {
    email: multi.allEmails[0]
  }).some((r) => r.registrationId === multi.registrationId));
}
const primaryOnly = records.find((r) => (r.allEmails || []).length === 0) || records[0];
check('primary email resolves', getTechfestPaymentsFor(index, { email: primaryOnly.email })
  .some((r) => r.registrationId === primaryOnly.registrationId));

console.log('\na completed payment reads as Paid and carries the UTR');
const completed = records.find((r) => r.paymentStatus === 'completed');
const paidStatus = getCallPaymentStatus({ email: completed.email }, index);
check('key is PAID', paidStatus.key === 'PAID', paidStatus.key);
check('label reads Paid', paidStatus.label === 'Paid', paidStatus.label);
check('amount comes from the record', paidStatus.amount === Number(completed.amount));
check('UTR is shown to the caller', paidStatus.utr === completed.utr);
check('registration id is shown', paidStatus.registrationId === completed.registrationId);
check('badge is the paid colour', getCallPaymentBadge(paidStatus).dot === 'bg-emerald-500');

console.log('\na payment awaiting confirmation reads as Pending, never as Unpaid');
const pendingView = { records: records.map((r) => ({ ...r, paymentStatus: 'pending' })) };
const pendingIndex = buildTechfestPaymentIndex(pendingView);
const pendingStatus = getCallPaymentStatus({ email: completed.email }, pendingIndex);
check('key is PENDING', pendingStatus.key === 'PENDING', pendingStatus.key);
check('still shows the UTR for verification', pendingStatus.utr === completed.utr);
check('badge is the pending colour', getCallPaymentBadge(pendingStatus).dot === 'bg-amber-500');

console.log('\na failed payment is not silently shown as Unpaid');
const failedIndex = buildTechfestPaymentIndex({
  records: records.map((r) => ({ ...r, paymentStatus: 'failed' }))
});
check('key is FAILED', getCallPaymentStatus({ email: completed.email }, failedIndex).key === 'FAILED');

console.log('\nno payment on record reads as Unpaid');
const stranger = getCallPaymentStatus({ email: 'nobody-here@example.com' }, index);
check('key is UNPAID', stranger.key === 'UNPAID', stranger.key);
check('no UTR is invented', !stranger.utr);
check('amount stays empty', stranger.amount === null);

console.log('\nUnstop refunds and cancellations keep their own state');
const refunded = getCallPaymentStatus({
  email: 'x@example.com',
  payment_status: 'REFUNDED',
  amount: 999
}, index);
check('refunded Unstop row reads REFUNDED', refunded.key === 'REFUNDED', refunded.key);

const cancelled = getCallPaymentStatus({
  email: 'y@example.com',
  is_cancelled: true
}, index);
check('cancelled row reads CANCELLED', cancelled.key === 'CANCELLED', cancelled.key);

const reverted = getCallPaymentStatus({
  email: 'z@example.com',
  is_cancelled: true,
  cancel_reverted: true
}, index);
check('won-back row reads REVERTED', reverted.key === 'REVERTED', reverted.key);

console.log('\na payment beats the Unstop row, so nobody is asked to pay twice');
const refundButPaid = getCallPaymentStatus({
  email: completed.email,
  payment_status: 'REFUNDED',
  amount: 599
}, index);
check('techfest26 payment wins over the Unstop refund', refundButPaid.key === 'PAID', refundButPaid.key);

console.log('\nteam registrations resolve through a member email');
const teamMember = { email: 'captain@example.com', team_members: [{ email: completed.email }] };
check('member email finds the payment', getCallPaymentStatus(teamMember, index).key === 'PAID');
check('match is reported on the payment email',
  getCallPaymentStatus(teamMember, index).matchedOn === completed.email.toLowerCase());

console.log('\nmissing data degrades quietly instead of throwing');
check('no participant is safe', getCallPaymentStatus(null, index) === null);
check('a missing index falls back to Unpaid',
  getCallPaymentStatus({ email: completed.email }, null).key === 'UNPAID');
check('a malformed index falls back to Unpaid',
  getCallPaymentStatus({ email: completed.email }, {}).key === 'UNPAID');
check('empty snapshot is safe', getCallPaymentStatus({ email: completed.email }, {}).key === 'UNPAID');

console.log('\nreal dataset: no caller is told "Unpaid" when they have paid');
const overlap = participants.filter((p) => p.email && index.has(String(p.email).trim().toLowerCase()));
let mismatches = 0;
for (const p of overlap) {
  const status = getCallPaymentStatus(p, index);
  if (status.key === 'UNPAID') mismatches += 1;
}
check(`all ${overlap.length} overlapping participants resolve to a payment`, mismatches === 0, `${mismatches} showed Unpaid`);

console.log('\ntechfest26.in registrants are merged onto the calling desk');
const merged = reconcileParticipantsWithTechfest(participants, snapshot);
const beforeEmails = new Set(participants.map((p) => String(p.email || '').trim().toLowerCase()));
const afterEmails = new Set(merged.map((p) => String(p.email || '').trim().toLowerCase()));
check(`rows grew from ${participants.length} to ${merged.length}`, merged.length > participants.length);

// A registrant already on Unstop keeps their Unstop row (upgraded to PAID)
// rather than gaining a duplicate row, so coverage is asserted by email.
const mergedByEmail = new Map();
for (const p of merged) {
  const email = String(p.email || '').trim().toLowerCase();
  if (email && !mergedByEmail.has(email)) mergedByEmail.set(email, p);
}
const uncovered = records.filter((r) => !mergedByEmail.has(r.email.trim().toLowerCase()));
check('every techfest26 registrant is represented on the desk',
  uncovered.length === 0,
  uncovered.map((r) => r.name).join(', '));

const appended = merged.filter((p) => p.source === 'techfest26');

// A registrant whose Unstop row was refunded and who then re-registered on
// techfest26.in is intentionally not upgraded: the refund is still the truth on
// Unstop, and quietly overwriting it would hide the money that went back.
const refundedOnUnstop = records.filter((r) => {
  const row = mergedByEmail.get(r.email.trim().toLowerCase());
  return row && row.payment_status === 'REFUNDED';
});
check('a refunded Unstop row is not overwritten by a new payment',
  refundedOnUnstop.every((r) => r.paymentStatus === 'completed'),
  `${refundedOnUnstop.length} refunded row(s) were wrongly upgraded`);

const shownUnpaid = records.filter((r) => {
  const row = mergedByEmail.get(r.email.trim().toLowerCase());
  return row && row.payment_status !== 'PAID' && row.payment_status !== 'REFUNDED';
});
check('no registrant is left showing as unpaid', shownUnpaid.length === 0,
  shownUnpaid.map((r) => r.name).join(', '));

// Rows are compared per registrant, not per name: common names legitimately
// repeat across different people.
const rowsPerRegistrant = records.map((r) => {
  const email = r.email.trim().toLowerCase();
  const onUnstop = participants.filter((p) => String(p.email || '').trim().toLowerCase() === email).length;
  const appendedCount = appended.filter((p) => String(p.email || '').trim().toLowerCase() === email).length;
  return { name: r.name, email, onUnstop, appendedCount };
});
const duplicated = rowsPerRegistrant.filter((x) =>
  x.onUnstop > 0 && x.appendedCount > 0
);
check('an Unstop registrant does not gain duplicate rows', duplicated.length === 0,
  duplicated.map((x) => x.name).join(', '));

console.log('\nmerged rows carry the fields the calling desk needs');
check('every appended row has a phone', appended.every((p) => p.phone && p.phone !== 'N/A'));
check('every appended row has an event name', appended.every((p) => !!p.event_name));
check('every appended row has a unique id',
  new Set(appended.map((p) => p.id)).size === appended.length);
check('paid registrants are marked paid', appended.every((p) => p.payment_status === 'PAID' && p.is_paid === true));

// The fee is charged once per registration. Appending a row per event must not
// multiply it, so the appended rows for a registration sum to that fee.
check('the fee is counted once per registration, not per event', (() => {
  const byReg = new Map();
  for (const row of appended) {
    byReg.set(row.payment_id, (byReg.get(row.payment_id) || 0) + Number(row.amount || 0));
  }
  const mismatched = [...byReg.entries()].filter(([regId, total]) => {
    const record = records.find((r) => r.registrationId === regId);
    return record && Math.abs(Number(record.amount || 0) - total) > 0.01;
  });
  return mismatched.length === 0;
})(), 'per-event rows duplicated the fee');

console.log('\nmerging never contradicts a cancellation or a refund');
const cancelledRow = {
  id: 'x1', email: 'cancelled@example.com', is_cancelled: true,
  payment_status: 'CANCELLED', event_name: 'Hackathon (Karyarachna)'
};
const refundedRow = {
  id: 'x2', email: completed.email, payment_status: 'REFUNDED',
  amount: 599, event_name: 'Pitchverse (Genesis)'
};
const guard = reconcileParticipantsWithTechfest([cancelledRow, refundedRow], {
  records: [{ ...completed, email: 'cancelled@example.com' }]
});
check('a cancelled row stays cancelled', guard[0].payment_status === 'CANCELLED');
check('a refunded Unstop row is not upgraded to paid', guard[1].payment_status === 'REFUNDED');

console.log('\nmerging is safe when the snapshot has not loaded yet');
check('empty snapshot returns the list untouched',
  reconcileParticipantsWithTechfest([cancelledRow], { records: [] }).length === 1);
check('missing snapshot returns the list untouched',
  reconcileParticipantsWithTechfest([cancelledRow], null).length === 1);

console.log('');
if (failures.length) {
  console.log(`${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('All caller payment-status checks passed.');