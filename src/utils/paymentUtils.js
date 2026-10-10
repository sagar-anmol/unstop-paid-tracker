/**
 * src/utils/paymentUtils.js
 * Single Source of Truth for TechFEST '26 payment & refund status
 */

/**
 * Returns true if the registration was cancelled on Unstop.
 * A participant who won them back keeps this false once cancel_reverted is set.
 */
export function isParticipantCancelled(p) {
  if (!p) return false;
  if (p.is_cancelled === true || p.payment_status === 'CANCELLED') return true;
  const label = (p.status_label || '').toLowerCase();
  return label.includes('cancel');
}

/**
 * Returns true once a cancelled registration has been won back, either because
 * the same email re-registered on techfest26.in or a caller confirmed it.
 */
export function isParticipantReverted(p) {
  if (!p) return false;
  return isParticipantCancelled(p) === false && p.cancel_reverted === true;
}

/**
 * Win-back stage for a cancelled registration:
 *   'CANCELLED'        not contacted yet
 *   'REVERTED'         won back
 *   null               not a cancellation
 */
export function getCancellationStage(p) {
  if (!isParticipantCancelled(p)) return null;
  return p.cancel_reverted ? 'REVERTED' : 'CANCELLED';
}

/**
 * Returns true if participant's previous Unstop payment was refunded
 */
export function isParticipantRefunded(p) {
  if (!p) return false;
  // A cancellation is a distinct state and must not read as a refund
  if (isParticipantCancelled(p)) return false;
  if (p.is_refunded === true || p.payment_status === 'REFUNDED') return true;
  if (Number(p.amount) > 0 && p.payment_status !== 'PAID') return true;
  const label = (p.status_label || '').toLowerCase();
  if (label.includes('refund')) return true;
  return false;
}

/**
 * Returns true if participant has confirmed payment on techfest26.in
 */
export function isParticipantPaid(p) {
  if (!p) return false;
  if (isParticipantRefunded(p)) return false;
  if (isParticipantCancelled(p)) return false;
  return p.is_paid === true && p.payment_status === 'PAID';
}

/**
 * Returns true if participant has not paid (pending on techfest26.in).
 * Cancellations are excluded: they are neither paid nor awaiting payment.
 */
export function isParticipantUnpaid(p) {
  if (isParticipantCancelled(p)) return false;
  return !isParticipantPaid(p) && !isParticipantRefunded(p);
}

/**
 * src/utils/paymentUtils.js — techfest26.in payment lookup for the calling desk
 * ---------------------------------------------------------------------------
 * The calling desk works from the Unstop participant list, but money is actually
 * collected on techfest26.in. The two populations overlap only partially, so a
 * caller asking "did they pay?" needs both sources: the Unstop row says whether
 * the registration was cancelled or refunded, and the techfest26.in snapshot
 * says whether a payment exists for that person.
 */

function normaliseEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email && email !== 'n/a' ? email : '';
}

/**
 * Builds an email -> payment records index from the techfest26.in snapshot.
 * A registration can be filed under several emails, so every one of them is
 * indexed and points at the same record.
 */
export function buildTechfestPaymentIndex(techfestPayments) {
  const byEmail = new Map();
  const records = Array.isArray(techfestPayments?.records) ? techfestPayments.records : [];

  for (const record of records) {
    const emails = new Set();
    const primary = normaliseEmail(record?.email);
    if (primary) emails.add(primary);
    for (const extra of record?.allEmails || []) {
      const email = normaliseEmail(extra);
      if (email) emails.add(email);
    }

    for (const email of emails) {
      if (!byEmail.has(email)) byEmail.set(email, []);
      byEmail.get(email).push(record);
    }
  }

  return byEmail;
}

/**
 * All payment records filed against a participant, matched on their own email
 * and on every team member's email so a team registration still resolves.
 */
export function getTechfestPaymentsFor(index, participant) {
  // The index is optional so the modal still renders before the snapshot loads
  if (!index || typeof index.get !== 'function' || index.size === 0 || !participant) return [];

  const candidates = [participant?.email];
  for (const member of participant?.team_members || []) {
    if (member?.email) candidates.push(member.email);
  }

  const found = [];
  const seen = new Set();
  for (const value of candidates) {
    const email = normaliseEmail(value);
    if (!email) continue;
    for (const record of index.get(email) || []) {
      if (record?.registrationId && seen.has(record.registrationId)) continue;
      if (record?.registrationId) seen.add(record.registrationId);
      found.push(record);
    }
  }

  return found;
}

// A completed payment beats a pending one, and a later registration beats an
// earlier one, so the caller sees the most settled answer available.
function pickMostSettled(records) {
  const rank = (record) => (record?.paymentStatus === 'completed' ? 2 : record?.paymentStatus === 'pending' ? 1 : 0);
  return [...records].sort((a, b) => {
    const diff = rank(b) - rank(a);
    if (diff !== 0) return diff;
    return String(b?.createdAt || '').localeCompare(String(a?.createdAt || ''));
  })[0] || null;
}

/**
 * Single source of truth for the Paid / Unpaid field the caller reads before
 * dialling. Merges the techfest26.in payment with the Unstop registration state
 * so "Unpaid" can never be shown for someone who already paid on techfest26.in.
 */
export function getCallPaymentStatus(participant, index) {
  if (!participant) return null;

  const matches = getTechfestPaymentsFor(index, participant);
  const record = pickMostSettled(matches);

  const base = {
    key: 'UNPAID',
    label: 'Unpaid',
    amount: null,
    utr: '',
    paymentType: '',
    registrationId: null,
    events: [],
    source: 'none',
    note: 'No payment on record. Ask them to pay and capture the UTR.',
    matchedOn: ''
  };

  if (isParticipantCancelled(participant)) {
    const wonBack = participant?.cancel_reverted === true;
    return {
      ...base,
      key: wonBack ? 'REVERTED' : 'CANCELLED',
      label: wonBack ? 'Won Back' : 'Cancelled',
      note: wonBack
        ? 'Registration was cancelled on Unstop and they re-registered on techfest26.in.'
        : 'Registration cancelled on Unstop. Handle as a win-back call.'
    };
  }

  if (record) {
    const events = Array.isArray(record.events) ? record.events : [];
    const amount = Number(record.amount) || 0;
    const isCompleted = record.paymentStatus === 'completed';

    if (isCompleted) {
      return {
        ...base,
        key: 'PAID',
        label: 'Paid',
        amount,
        utr: record.utr || '',
        paymentType: record.paymentType || '',
        registrationId: record.registrationId,
        events,
        source: 'techfest26',
        matchedOn: normaliseEmail(record.email),
        note: 'Payment received on techfest26.in. Do not collect money again.'
      };
    }

    if (record.paymentStatus === 'pending') {
      return {
        ...base,
        key: 'PENDING',
        label: 'Payment Pending',
        amount,
        utr: record.utr || '',
        paymentType: record.paymentType || '',
        registrationId: record.registrationId,
        events,
        source: 'techfest26',
        matchedOn: normaliseEmail(record.email),
        note: 'They submitted a payment that is not confirmed yet. Verify the UTR.'
      };
    }

    return {
      ...base,
      key: 'FAILED',
      label: 'Payment Failed',
      amount,
      registrationId: record.registrationId,
      events,
      source: 'techfest26',
      matchedOn: normaliseEmail(record.email),
      note: 'Their last payment attempt failed. Ask them to retry.'
    };
  }

  if (isParticipantRefunded(participant)) {
    return {
      ...base,
      key: 'REFUNDED',
      label: 'Refunded',
      amount: Number(participant.amount) || 0,
      source: 'unstop',
      note: 'Unstop fee was refunded. They must pay again on techfest26.in.'
    };
  }

  return base;
}

/**
 * Badge styling for the caller's paid/unpaid field, matching the table's palette.
 */
export function getCallPaymentBadge(status) {
  switch (status?.key) {
    case 'PAID':
      return {
        chip: 'text-emerald-800 bg-emerald-100/80 border-emerald-300',
        dot: 'bg-emerald-500',
        accent: 'border-emerald-300 bg-emerald-50'
      };
    case 'PENDING':
      return {
        chip: 'text-amber-900 bg-amber-100/80 border-amber-300',
        dot: 'bg-amber-500',
        accent: 'border-amber-300 bg-amber-50'
      };
    case 'FAILED':
      return {
        chip: 'text-rose-800 bg-rose-100/80 border-rose-300',
        dot: 'bg-rose-500',
        accent: 'border-rose-300 bg-rose-50'
      };
    case 'REFUNDED':
      return {
        chip: 'text-violet-800 bg-violet-100/80 border-violet-300',
        dot: 'bg-violet-500',
        accent: 'border-violet-300 bg-violet-50'
      };
    case 'CANCELLED':
    case 'REVERTED':
      return {
        chip: 'text-rose-800 bg-rose-100/80 border-rose-300',
        dot: 'bg-rose-500',
        accent: 'border-rose-300 bg-rose-50'
      };
    default:
      return {
        chip: 'text-zinc-700 bg-zinc-100 border-zinc-300',
        dot: 'bg-zinc-400',
        accent: 'border-zinc-300 bg-zinc-50'
      };
  }
}

/**
 * Get human-readable payment badge config with distinct colors:
 * - REFUNDED: Purple / Indigo (#7c3aed / bg-purple-50 text-purple-700 border-purple-200)
 * - UNPAID: Amber / Zinc (#d97706 / bg-amber-50 text-amber-800 border-amber-200)
 * - PAID: Emerald (#059669 / bg-emerald-50 text-emerald-700 border-emerald-200)
 */
export function getPaymentBadgeConfig(p) {
  const isCancelled = isParticipantCancelled(p);
  const isRefunded = isParticipantRefunded(p);
  const isPaid = isParticipantPaid(p);
  const amt = Number(p.amount) || 0;

  if (isCancelled) {
    const reverted = p.cancel_reverted === true;
    return {
      type: reverted ? 'REVERTED' : 'CANCELLED',
      label: reverted ? 'Won Back' : 'Cancelled',
      pillText: reverted ? 'Won Back' : 'Cancelled',
      fullText: reverted
        ? 'Cancelled on Unstop, re-registered on techfest26.in'
        : 'Registration cancelled — win-back attempt pending',
      className: reverted
        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
        : 'text-rose-700 bg-rose-50 border-rose-200',
      indicatorClass: reverted ? 'bg-emerald-500' : 'bg-rose-500'
    };
  }

  if (isRefunded) {
    return {
      type: 'REFUNDED',
      label: amt > 0 ? `Refunded ₹${amt.toLocaleString('en-IN')}` : 'Refunded',
      pillText: amt > 0 ? `Refunded ₹${amt}` : 'Refunded',
      fullText: amt > 0 ? `Unstop Fee Refunded (₹${amt.toLocaleString('en-IN')})` : 'Unstop Payment Refunded',
      className: 'text-purple-700 bg-purple-50 border-purple-200',
      indicatorClass: 'bg-purple-500'
    };
  }

  if (isPaid) {
    return {
      type: 'PAID',
      label: amt > 0 ? `Paid ₹${amt.toLocaleString('en-IN')}` : 'Paid',
      pillText: amt > 0 ? `Paid ₹${amt}` : 'Paid',
      fullText: 'Payment Confirmed (techfest26.in)',
      className: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      indicatorClass: 'bg-emerald-500'
    };
  }

  return {
    type: 'UNPAID',
    label: 'Unpaid',
    pillText: 'Unpaid',
    fullText: 'Payment Pending (techfest26.in)',
    className: 'text-amber-800 bg-amber-50 border-amber-200',
    indicatorClass: 'bg-amber-500'
  };
}
