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
