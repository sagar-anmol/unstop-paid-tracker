// src/utils/participantOverrides.js
// Stores participant edits (payment status, amount, transaction IDs, remarks) made by WebDev and Admins.

const STORAGE_KEY = 'tf_participant_overrides_v1';

export function getParticipantOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading participant overrides:', e);
  }
  return {};
}

export function saveParticipantOverride(participantId, fields, actor) {
  try {
    const all = getParticipantOverrides();
    const pid = String(participantId);
    
    all[pid] = {
      ...(all[pid] || {}),
      ...fields,
      updatedAt: new Date().toISOString(),
      updatedBy: actor?.name || actor?.username || 'Staff',
      updatedByRole: actor?.role || 'editor'
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return all[pid];
  } catch (e) {
    console.error('Error saving participant override:', e);
    return null;
  }
}

/**
 * Applies saved overrides on top of the raw participants list
 */
export function applyParticipantOverrides(participants) {
  if (!Array.isArray(participants)) return [];
  const overrides = getParticipantOverrides();
  if (Object.keys(overrides).length === 0) return participants;

  return participants.map(p => {
    const pid = String(p.id);
    const ovr = overrides[pid];
    if (!ovr) return p;

    const merged = { ...p };

    if (ovr.payment_status) {
      merged.payment_status = ovr.payment_status;
      merged.is_paid = ovr.payment_status === 'PAID';
      merged.is_refunded = ovr.payment_status === 'REFUNDED';
      merged.is_cancelled = ovr.payment_status === 'CANCELLED';
    }
    if (ovr.amount !== undefined && ovr.amount !== null && ovr.amount !== '') {
      merged.amount = Number(ovr.amount);
    }
    if (ovr.payment_id) {
      merged.payment_id = ovr.payment_id;
    }
    if (ovr.utr_number) {
      merged.utr_number = ovr.utr_number;
    }
    if (ovr.attendance_status) {
      merged.attendance_status = ovr.attendance_status;
    }
    if (ovr.admin_note) {
      merged.admin_note = ovr.admin_note;
    }
    // Cancellation win-back outcome recorded by the calling desk
    if (ovr.is_cancelled !== undefined) {
      merged.is_cancelled = Boolean(ovr.is_cancelled);
      merged.cancel_reverted = Boolean(ovr.cancel_reverted);
    }
    if (ovr.cancel_reason !== undefined) {
      merged.cancel_reason = ovr.cancel_reason;
    }
    if (ovr.status_label) {
      merged.status_label = ovr.status_label;
    }

    merged._hasCustomOverride = true;
    merged._overrideMeta = {
      updatedBy: ovr.updatedBy,
      updatedAt: ovr.updatedAt
    };

    return merged;
  });
}
