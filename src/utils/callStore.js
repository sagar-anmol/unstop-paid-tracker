// src/utils/callStore.js
// TechFEST '26 Operations Calling CRM, Timeline History & Audit Trail Engine
import { 
  fetchCallRecordsFromNeon, 
  fetchAuditLogsFromNeon, 
  fetchPaymentVerificationsFromNeon,
  writeCallLogToNeon, 
  writeAuditLogToNeon, 
  writePaymentVerificationToNeon,
  dbStatus
} from './neonDb';
import { getDeviceInfo } from './device';

export const CALL_STATUSES = {
  PAYMENT_CLAIMED: {
    id: 'PAYMENT_CLAIMED',
    label: 'Payment Completed',
    shortLabel: 'Paid Claimed',
    color: 'emerald',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    indicator: 'bg-emerald-500',
    description: 'Participant claims to have completed registration payment. Moved to Verification Queue.'
  },
  INTERESTED: {
    id: 'INTERESTED',
    label: 'Interested / Follow Up',
    shortLabel: 'Interested',
    color: 'amber',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    indicator: 'bg-amber-500',
    description: 'Hot/warm lead. Promised to register or pay soon.'
  },
  CALL_LATER: {
    id: 'CALL_LATER',
    label: 'Call Later / Callback',
    shortLabel: 'Callback',
    color: 'sky',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    indicator: 'bg-sky-500',
    description: 'Requested call back at a later specific time or evening.'
  },
  NOT_PICKED: {
    id: 'NOT_PICKED',
    label: 'Not Picked / Busy',
    shortLabel: 'Not Picked',
    color: 'rose',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    indicator: 'bg-rose-500',
    description: 'Ringing, busy, call rejected, or phone switched off.'
  },
  DECLINED: {
    id: 'DECLINED',
    label: 'Declined / Not Interested',
    shortLabel: 'Declined',
    color: 'slate',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    indicator: 'bg-slate-400',
    description: 'Cannot attend TechFEST or declined participation.'
  },
  WRONG_NUMBER: {
    id: 'WRONG_NUMBER',
    label: 'Wrong / Invalid Number',
    shortLabel: 'Invalid No',
    color: 'slate',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    indicator: 'bg-slate-400',
    description: 'Number does not exist, out of service, or wrong contact.'
  }
};

const CALL_RECORDS_KEY = 'tf_call_records_v2';
const AUDIT_LOGS_KEY = 'tf_audit_logs_v2';
const MANUAL_VERIFICATIONS_KEY = 'tf_payment_verifications_v2';

const INITIAL_CALL_RECORDS_SEED = {};
const INITIAL_AUDIT_LOGS_SEED = [];

export function getCallRecords() {
  try {
    const raw = localStorage.getItem(CALL_RECORDS_KEY);
    if (raw) {
      const records = JSON.parse(raw);
      if (records && typeof records === 'object') {
        delete records['p_demo_seed_1'];
        return records;
      }
    }
  } catch (e) {
    console.error('Error loading call records:', e);
  }
  return {};
}

export function saveCallRecords(records) {
  try {
    const cleanRecords = { ...records };
    delete cleanRecords['p_demo_seed_1'];
    localStorage.setItem(CALL_RECORDS_KEY, JSON.stringify(cleanRecords));
  } catch (e) {
    console.error('Error saving call records:', e);
  }
}

export function getParticipantCallRecord(participantIdOrObj, defaultId = null) {
  if (!participantIdOrObj) return null;
  const records = getCallRecords();

  // If passed an object (candidate with multiple registrations or phone)
  if (typeof participantIdOrObj === 'object') {
    const p = participantIdOrObj;
    if (p.id && records[String(p.id)]) return records[String(p.id)];
    if (p.uniqueKey && records[p.uniqueKey]) return records[p.uniqueKey];
    if (Array.isArray(p.allIds)) {
      for (const id of p.allIds) {
        if (records[String(id)]) return records[String(id)];
      }
    }
    const cleanPhone = (p.phone || '').replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone && cleanPhone.length === 10) {
      const match = Object.values(records).find(r => {
        const rPhone = (r.leadNumber || '').replace(/[^0-9]/g, '').slice(-10);
        return rPhone === cleanPhone;
      });
      if (match) return match;
    }
    return defaultId && defaultId !== 'p_demo_seed_1' ? records[defaultId] : null;
  }

  const pId = String(participantIdOrObj);
  return records[pId] || (defaultId && defaultId !== 'p_demo_seed_1' ? records[defaultId] : null);
}

export function getAuditLogs() {
  try {
    const raw = localStorage.getItem(AUDIT_LOGS_KEY);
    if (raw) {
      const logs = JSON.parse(raw);
      if (Array.isArray(logs)) {
        return logs.filter(l => l && l.targetId !== 'p_demo_seed_1' && !String(l.id).startsWith('log_seed_'));
      }
    }
  } catch (e) {
    console.error('Error loading audit logs:', e);
  }
  return [];
}

export function saveAuditLogs(logs) {
  try {
    const cleanLogs = Array.isArray(logs)
      ? logs.filter(l => l && l.targetId !== 'p_demo_seed_1' && !String(l.id).startsWith('log_seed_'))
      : [];
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(cleanLogs));
  } catch (e) {
    console.error('Error saving audit logs:', e);
  }
}

export function addAuditLog(entry) {
  const logs = getAuditLogs();
  const currentDev = getDeviceInfo();
  const device = entry.device || currentDev.deviceName;
  const deviceType = entry.deviceType || currentDev.deviceType;
  const location = entry.location || currentDev.location;
  const ip = entry.ip || currentDev.ip;

  const newEntry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    device,
    deviceType,
    location,
    ip,
    ...entry
  };
  if (!newEntry.device) newEntry.device = device;
  if (!newEntry.deviceType) newEntry.deviceType = deviceType;
  if (!newEntry.location) newEntry.location = location;
  if (!newEntry.ip) newEntry.ip = ip;

  logs.unshift(newEntry);
  saveAuditLogs(logs.slice(0, 500)); // retain latest 500 logs
  return newEntry;
}

/**
 * Full two-way sync with Neon PostgreSQL:
 * Pulls call logs, audit records, and verifications from Neon cloud,
 * merges them into local storage, and emits event to update UI.
 */
export async function syncWithNeonDatabase() {
  if (dbStatus.isSyncing) return;
  dbStatus.isSyncing = true;

  try {
    const [neonCalls, neonAudits, neonVerifications] = await Promise.all([
      fetchCallRecordsFromNeon(),
      fetchAuditLogsFromNeon(300),
      fetchPaymentVerificationsFromNeon()
    ]);

    // 1. Merge call records
    const localRecords = getCallRecords();
    const mergedRecords = { ...localRecords };

    Object.entries(neonCalls).forEach(([pId, neonRec]) => {
      if (pId === 'p_demo_seed_1') return; // Ignore any demo seed from cloud
      if (!mergedRecords[pId]) {
        mergedRecords[pId] = neonRec;
      } else {
        const existingHistory = mergedRecords[pId].history || [];
        const neonHistory = neonRec.history || [];
        const seenIds = new Set(existingHistory.map(h => h.id));

        neonHistory.forEach(h => {
          if (!seenIds.has(h.id)) {
            existingHistory.push(h);
            seenIds.add(h.id);
          }
        });

        existingHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        mergedRecords[pId].history = existingHistory;
        mergedRecords[pId].callCount = existingHistory.length;
        if (existingHistory[0]) {
          mergedRecords[pId].lastCalledAt = existingHistory[0].timestamp;
          mergedRecords[pId].lastStatus = existingHistory[0].status;
          mergedRecords[pId].lastRemark = existingHistory[0].remark;
          mergedRecords[pId].leadNumber = existingHistory[0].leadNumber || mergedRecords[pId].leadNumber;
        }
      }
    });

    saveCallRecords(mergedRecords);

    // 2. Merge audit logs
    const cleanNeonAudits = (neonAudits || []).filter(a => a && a.targetId !== 'p_demo_seed_1' && !String(a.id).startsWith('log_seed_'));
    if (cleanNeonAudits.length > 0) {
      const localAudits = getAuditLogs();
      const seenAuditIds = new Set(cleanNeonAudits.map(a => a.id));
      const combined = [...cleanNeonAudits];
      localAudits.forEach(a => {
        if (!seenAuditIds.has(a.id)) {
          combined.push(a);
        }
      });
      combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      saveAuditLogs(combined.slice(0, 500));
    }

    // 3. Merge payment verifications
    if (neonVerifications && Object.keys(neonVerifications).length > 0) {
      const localVerifications = getManualVerifications();
      const mergedVerifications = { ...localVerifications, ...neonVerifications };
      localStorage.setItem(MANUAL_VERIFICATIONS_KEY, JSON.stringify(mergedVerifications));
    }

    dbStatus.isConnected = true;
    dbStatus.lastSyncTime = new Date();
    dbStatus.error = null;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tf_neon_synced', { 
        detail: { timestamp: new Date().toISOString() } 
      }));
    }
  } catch (err) {
    console.error('Error syncing with Neon PostgreSQL:', err);
    dbStatus.error = err.message;
  } finally {
    dbStatus.isSyncing = false;
  }
}

/**
 * Log a new call with caller details, compulsory status, and remark
 */
export function logCallForParticipant({
  participant,
  callerUser,
  remark,
  leadNumber,
  status
}) {
  if (!participant || !participant.id) throw new Error('Invalid participant');
  if (!callerUser) throw new Error('Active user required to log call');
  if (!status) throw new Error('Call status is compulsory');

  const pId = String(participant.id);
  const records = getCallRecords();
  const existing = records[pId] || {
    participantId: pId,
    callCount: 0,
    history: []
  };

  const newCallNumber = (existing.callCount || 0) + 1;
  const nowIso = new Date().toISOString();
  const currentDev = getDeviceInfo();

  const callEntry = {
    id: 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    callNumber: newCallNumber,
    timestamp: nowIso,
    callerName: callerUser.name,
    callerRole: callerUser.role,
    callerTeam: callerUser.teamName || callerUser.team,
    status,
    remark: remark?.trim() || 'No remarks entered.',
    leadNumber: leadNumber?.trim() || existing.leadNumber || '',
    utrNumber: (participant.utrNumber || existing.utrNumber || '').trim(),
    paymentMode: participant.paymentMode || existing.paymentMode || 'UPI / QR',
    amountPaid: participant.amountPaid || existing.amountPaid || 199,
    device: currentDev.deviceName,
    deviceType: currentDev.deviceType,
    location: currentDev.location,
    ip: currentDev.ip
  };

  const prevStatus = existing.lastStatus || 'NONE';

  const updatedRecord = {
    participantId: pId,
    callCount: newCallNumber,
    lastCalledAt: nowIso,
    lastStatus: status,
    lastRemark: callEntry.remark,
    leadNumber: callEntry.leadNumber,
    utrNumber: callEntry.utrNumber,
    paymentMode: callEntry.paymentMode,
    amountPaid: callEntry.amountPaid,
    claimedAt: status === 'PAYMENT_CLAIMED' ? nowIso : existing.claimedAt,
    history: [callEntry, ...(existing.history || [])]
  };

  records[pId] = updatedRecord;

  // Mirror across all event registration IDs and uniqueKey if participant has multi-event registrations
  if (Array.isArray(participant.allIds)) {
    participant.allIds.forEach(id => {
      records[String(id)] = updatedRecord;
    });
  }
  if (participant.uniqueKey) {
    records[participant.uniqueKey] = updatedRecord;
  }

  saveCallRecords(records);

  // Add immutable Audit Log entry
  const auditEntry = addAuditLog({
    actorName: callerUser.name,
    actorRole: callerUser.role,
    actorTeam: callerUser.teamName || callerUser.team,
    action: 'LOG_CALL',
    targetId: pId,
    targetName: participant.name || 'Participant',
    eventName: participant.event_name || 'Event',
    prevStatus,
    nextStatus: status,
    device: currentDev.deviceName,
    deviceType: currentDev.deviceType,
    location: currentDev.location,
    ip: currentDev.ip,
    details: `Logged Call #${newCallNumber} via ${currentDev.deviceName} (📍 ${currentDev.location}). Status: ${CALL_STATUSES[status]?.label || status}. Remark: ${callEntry.remark}`
  });

  // Background Cloud Sync to Neon PostgreSQL
  writeCallLogToNeon({
    id: callEntry.id,
    participantId: pId,
    callNumber: newCallNumber,
    timestamp: nowIso,
    callerName: callerUser.name,
    callerRole: callerUser.role,
    callerTeam: callerUser.teamName || callerUser.team,
    status,
    remark: callEntry.remark,
    leadNumber: callEntry.leadNumber
  }).catch(e => console.error('Neon writeCallLog error:', e));

  writeAuditLogToNeon(auditEntry)
    .catch(e => console.error('Neon writeAuditLog error:', e));

  return updatedRecord;
}

/**
 * Verification Queue Engine
 * Evaluates payment claims vs Unstop gateway records and flags defaulters
 */
export function getPaymentVerificationQueue(participants = []) {
  const records = getCallRecords();
  const manualVerifications = getManualVerifications();
  const results = [];

  // Index participants by ID
  const pMap = {};
  participants.forEach(p => {
    pMap[String(p.id)] = p;
  });

  Object.entries(records).forEach(([pId, record]) => {
    if (record.lastStatus === 'PAYMENT_CLAIMED' || record.claimedAt) {
      const p = pMap[pId] || { id: pId, name: 'Participant ' + pId, event_name: 'TechFEST Event', amount: 0 };
      const isGatewayPaid = Boolean(p.is_paid || (Number(p.amount) > 0 && p.payment_id));
      const manualStatus = manualVerifications[pId];

      const claimedTime = new Date(record.claimedAt || record.lastCalledAt).getTime();
      const elapsedHours = (Date.now() - claimedTime) / (1000 * 60 * 60);

      let verificationState = 'PENDING_SYNC';
      let stateBadge = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      let stateLabel = 'Pending Unstop Sync';

      if (manualStatus === 'APPROVED' || isGatewayPaid) {
        verificationState = 'VERIFIED_PAID';
        stateBadge = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
        stateLabel = 'Verified Gateway Payment';
      } else if (manualStatus === 'REJECTED' || elapsedHours > 24) {
        // Flagged as Defaulter after 24h without unstop payment match
        verificationState = 'DEFAULTER';
        stateBadge = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
        stateLabel = '⚠️ Defaulter (Unpaid in Gateway >24h)';
      }

      results.push({
        participantId: pId,
        participant: p,
        record,
        elapsedHours: Math.round(elapsedHours),
        verificationState,
        stateBadge,
        stateLabel,
        isGatewayPaid,
        manualStatus,
        utrNumber: record.utrNumber || record.history?.[0]?.utrNumber || '',
        paymentMode: record.paymentMode || 'UPI / QR',
        amountPaid: record.amountPaid || 199,
        scheduledBatch: 'Saturday Verification Desk'
      });
    }
  });

  return results;
}

export function getManualVerifications() {
  try {
    const raw = localStorage.getItem(MANUAL_VERIFICATIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading manual verifications:', e);
  }
  return {};
}

export function setManualVerification(participantId, status, adminUser, reason = '') {
  const map = getManualVerifications();
  map[participantId] = status;
  try {
    localStorage.setItem(MANUAL_VERIFICATIONS_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('Error saving manual verification:', e);
  }

  const auditEntry = addAuditLog({
    actorName: adminUser.name,
    actorRole: adminUser.role,
    actorTeam: adminUser.teamName || adminUser.team,
    action: 'VERIFY_PAYMENT',
    targetId: participantId,
    targetName: `Participant #${participantId}`,
    eventName: 'TechFEST Payment Desk',
    prevStatus: 'PENDING_VERIFICATION',
    nextStatus: status,
    details: `Manual verification set to: ${status}. Reason/Txn: ${reason}`
  });

  // Background Cloud Sync to Neon PostgreSQL
  writePaymentVerificationToNeon(participantId, status, adminUser.name, reason)
    .catch(e => console.error('Neon writePaymentVerification error:', e));

  writeAuditLogToNeon(auditEntry)
    .catch(e => console.error('Neon writeAuditLog error:', e));
}
