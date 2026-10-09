// Sanity checks for src/utils/paymentUtils.js against the real dataset.
//
// The module is dependency-free ESM, so it can be imported directly by Node.
// These checks confirm the predicates partition every participant exactly once,
// which is what the KPI cards and progress bars rely on.
//
//   node scripts/check_payment_classification.mjs

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isParticipantPaid,
  isParticipantRefunded,
  isParticipantUnpaid,
  isParticipantCancelled
} from '../src/utils/paymentUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const data = JSON.parse(readFileSync(path.join(ROOT, 'data.json'), 'utf8'));
const participants = data.participants || [];

const failures = [];
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    console.log(`  FAIL ${name} ${detail}`);
    failures.push(name);
  }
}

console.log(`Loaded ${participants.length} participant rows from data.json`);

let paid = 0;
let refunded = 0;
let unpaid = 0;
let cancelled = 0;
let overlaps = 0;
let unclassified = 0;

for (const p of participants) {
  const flags = [
    isParticipantPaid(p),
    isParticipantRefunded(p),
    isParticipantUnpaid(p),
    isParticipantCancelled(p)
  ];
  const count = flags.filter(Boolean).length;

  if (count > 1) overlaps++;
  if (count === 0) unclassified++;
  if (flags[0]) paid++;
  if (flags[1]) refunded++;
  if (flags[2]) unpaid++;
  if (flags[3]) cancelled++;
}

console.log('\nexclusive classification');
check('no participant matches two states at once', overlaps === 0, `${overlaps} overlaps`);
check('every participant lands in exactly one state', unclassified === 0, `${unclassified} unclassified`);
check(
  'state counts add up to the row total',
  paid + refunded + unpaid + cancelled === participants.length,
  `${paid} + ${refunded} + ${unpaid} + ${cancelled} vs ${participants.length}`
);

console.log('\ncurrent dataset expectations');
// Unstop reporting was retired, so nothing should read as paid and no
// cancellation should be inferred from the legacy status text.
check('no rows are marked paid from Unstop', paid === 0, `${paid} paid`);
check(
  'the refunded rows still carry a nonzero amount',
  refunded > 0 && refunded === participants.filter(p => Number(p.amount) > 0).length,
  `${refunded} refunded`
);
check('cancelled count is zero until the scraper detects them', cancelled === 0, `${cancelled} cancelled`);

console.log('\ncancellation flag behaviour');
const cancelledRow = {
  id: 'x',
  email: 'a@b.com',
  payment_status: 'CANCELLED',
  is_cancelled: true,
  cancel_reverted: false,
  amount: 0
};
check('a cancelled row reads as cancelled', isParticipantCancelled(cancelledRow));
check('a cancelled row is not also unpaid', !isParticipantUnpaid(cancelledRow));
check('a cancelled row is not also refunded', !isParticipantRefunded(cancelledRow));
check(
  'a cancelled row with amount > 0 is not mistaken for a refund',
  !isParticipantRefunded({ ...cancelledRow, amount: 599 })
);

const revertedRow = { ...cancelledRow, cancel_reverted: true };
check('a reverted row is still reported as cancelled', isParticipantCancelled(revertedRow));

console.log('\nrefund detection');
check(
  'status text is honoured',
  isParticipantRefunded({ id: 'y', payment_status: 'REFUNDED', amount: 599 })
);
check(
  'a nonzero legacy amount reads as refunded',
  isParticipantRefunded({ id: 'z', payment_status: 'UNPAID', amount: 599 })
);
check(
  'a zero-amount unpaid row is not refunded',
  !isParticipantRefunded({ id: 'w', payment_status: 'UNPAID', amount: 0 })
);

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed: ${failures.join(', ')}`);
  process.exit(1);
}

console.log('\nAll payment classification checks passed.');