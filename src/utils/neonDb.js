// src/utils/neonDb.js
// Neon PostgreSQL sync engine for TechFEST '26.
//
// The connection string comes from VITE_NEON_DATABASE_URL at build time and is
// therefore visible to anyone who opens the bundle. Never hardcode a value here:
// anything written in this file ships to the browser. Rotate the credential if the
// deployed site is ever exposed to people you would not trust with it.
import { neon } from '@neondatabase/serverless';

export const DEFAULT_NEON_DATABASE_URL = import.meta.env?.VITE_NEON_DATABASE_URL || '';

let sqlClient = null;

// call_logs grows without bound. Pulling the most recent N keeps the query fast;
// older rows stay in the database for audit but are not loaded into the browser.
const CALL_LOG_FETCH_LIMIT = 2000;

// A reconciled claim is only reconsidered after this long, so the desk sees an
// updated verdict even if a payment settles between runs.
const CLAIM_RECHECK_MINUTES = 30;

/**
 * The connection string comes from the build environment only. A previous
 * version allowed an admin to paste a URL into localStorage, which meant any
 * credential entered there shipped inside that browser profile and could be
 * read by any script on the page.
 */
export function getActiveDatabaseUrl() {
  return DEFAULT_NEON_DATABASE_URL;
}

export function getSqlClient() {
  const url = getActiveDatabaseUrl();
  if (!url || !url.trim().startsWith('postgres')) {
    return null;
  }
  if (!sqlClient) {
    try {
      sqlClient = neon(url.trim(), { disableWarningInBrowsers: true });
    } catch (e) {
      console.warn('Invalid Neon Database URL:', e.message);
      return null;
    }
  }
  return sqlClient;
}

// Reactive DB Connection State
export const dbStatus = {
  isConnected: false,
  isSyncing: false,
  lastSyncTime: null,
  error: null,
  pendingWritesCount: 0
};

const listeners = new Set();

export function subscribeDbStatus(listener) {
  listeners.add(listener);
  listener({ ...dbStatus });
  return () => listeners.delete(listener);
}

function notifyStatus() {
  const current = { ...dbStatus };
  listeners.forEach(fn => {
    // One misbehaving subscriber must not stop the others from updating.
    try { fn(current); } catch { /* ignore */ }
  });
}

/**
 * Verifies the build-time connection string works.
 */
export async function testNeonConnection() {
  const sql = getSqlClient();
  if (!sql) {
    return { success: false, error: 'No database URL is configured for this build.' };
  }
  try {
    await sql`SELECT 1 AS live_check`;
    return { success: true };
  } catch (err) {
    // Never surface the driver message: it can echo the host and role name
    return { success: false, error: 'Could not reach the database.' };
  }
}

/**
 * Reports whether cross-device sync is available in this build.
 */
export function isDatabaseConfigured() {
  return Boolean(DEFAULT_NEON_DATABASE_URL);
}

/**
 * Fetch and assemble all call records from Neon into the app's participant record map
 */
export async function fetchCallRecordsFromNeon() {
  const sql = getSqlClient();
  if (!sql) return {};

  try {
    const rows = await sql`
      SELECT id, participant_id, call_number, timestamp, caller_name, caller_role, caller_team, status, remark, lead_number
      FROM call_logs
      ORDER BY timestamp DESC
      LIMIT ${CALL_LOG_FETCH_LIMIT}
    `;

    dbStatus.isConnected = true;
    dbStatus.error = null;
    dbStatus.lastSyncTime = new Date().toISOString();
    notifyStatus();

    const recordMap = {};

    for (const row of rows) {
      const pId = String(row.participant_id);
      if (!recordMap[pId]) {
        recordMap[pId] = {
          participantId: pId,
          callCount: 0,
          lastCalledAt: row.timestamp,
          lastStatus: row.status,
          lastRemark: row.remark,
          leadNumber: row.lead_number || '',
          claimedAt: row.status === 'PAYMENT_CLAIMED' ? row.timestamp : null,
          history: []
        };
      }

      const rec = recordMap[pId];
      rec.callCount = Math.max(rec.callCount, row.call_number || 0);

      if (row.status === 'PAYMENT_CLAIMED' && !rec.claimedAt) {
        rec.claimedAt = row.timestamp;
      }

      rec.history.push({
        id: row.id,
        callNumber: row.call_number,
        timestamp: row.timestamp,
        callerName: row.caller_name || 'Staff Caller',
        callerRole: row.caller_role || 'caller',
        callerTeam: row.caller_team || 'Central Desk',
        status: row.status,
        remark: row.remark || '',
        leadNumber: row.lead_number || ''
      });
    }

    Object.values(recordMap).forEach(rec => {
      rec.history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      if (rec.history.length > 0) {
        rec.callCount = rec.history.length;
        rec.lastCalledAt = rec.history[0].timestamp;
        rec.lastStatus = rec.history[0].status;
        rec.lastRemark = rec.history[0].remark;
        rec.leadNumber = rec.history[0].leadNumber || rec.leadNumber;
      }
    });

    return recordMap;
  } catch (err) {
    console.warn('Neon fetchCallRecords note:', err.message);
    dbStatus.error = err.message;
    notifyStatus();
    return {};
  }
}

/**
 * Fetch latest audit logs from Neon
 */
export async function fetchAuditLogsFromNeon(limit = 500) {
  const sql = getSqlClient();
  if (!sql) return [];

  try {
    const rows = await sql`
      SELECT id, timestamp, actor_name, actor_role, actor_team, action, target_id, target_name, event_name, prev_status, next_status, details
      FROM audit_logs
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;

    dbStatus.isConnected = true;
    dbStatus.error = null;
    notifyStatus();

    return rows.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      actorName: r.actor_name,
      actorRole: r.actor_role,
      actorTeam: r.actor_team,
      action: r.action,
      targetId: r.target_id,
      targetName: r.target_name,
      eventName: r.event_name,
      prevStatus: r.prev_status,
      nextStatus: r.next_status,
      details: r.details
    }));
  } catch (err) {
    return [];
  }
}

/**
 * Fetch manual payment verifications map
 */
export async function fetchPaymentVerificationsFromNeon() {
  const sql = getSqlClient();
  if (!sql) return {};

  try {
    const rows = await sql`
      SELECT participant_id, verification_state, verified_by, verified_by_name, notes, updated_at
      FROM payment_verifications
    `;

    const map = {};
    rows.forEach(r => {
      map[String(r.participant_id)] = r.verification_state;
    });
    return map;
  } catch (err) {
    return {};
  }
}

/**
 * Fetch custom domain head passwords
 */
/**
 * Fetches credential hashes. Prefers the hashed columns and falls back to the
 * legacy plaintext column so nothing is lost before the migration runs.
 */
export async function fetchCustomPasswordsFromNeon() {
  const sql = getSqlClient();
  if (!sql) return {};

  try {
    const rows = await sql`
      SELECT username, password, password_hash, salt, algo, must_change, updated_by, updated_at
      FROM custom_passwords
    `;

    const map = {};
    rows.forEach(r => {
      const key = String(r.username).toLowerCase();
      if (r.password_hash) {
        map[key] = {
          hash: r.password_hash,
          salt: r.salt || '',
          mustChange: r.must_change === true
        };
      } else if (r.password) {
        // Legacy plaintext row: auth.js converts this to a hash on arrival
        map[key] = r.password;
      }
    });
    return map;
  } catch (err) {
    console.warn('Neon fetchCustomPasswords error:', err.message);
    return {};
  }
}

/**
 * Async writers that write directly to Neon Cloud PostgreSQL
 */
export async function writeCallLogToNeon(entry) {
  const sql = getSqlClient();
  if (!sql) return false;

  // The browser connects directly with the owner credentials, so every
  // interpolated value must be a scalar the driver can serialise.
  try {
    await sql`
      INSERT INTO call_logs (
        id, participant_id, call_number, timestamp, caller_name, caller_role, caller_team, status, remark, lead_number
      ) VALUES (
        ${entry.id}, 
        ${entry.participantId}, 
        ${entry.callNumber}, 
        ${entry.timestamp || new Date().toISOString()}, 
        ${entry.callerName || 'Staff Caller'}, 
        ${entry.callerRole || 'caller'}, 
        ${entry.callerTeam || 'Central Desk'}, 
        ${entry.status}, 
        ${entry.remark || ''}, 
        ${entry.leadNumber || ''}
      )
      ON CONFLICT (id) DO NOTHING
    `;
    dbStatus.isConnected = true;
    dbStatus.error = null;
    notifyStatus();
    return true;
  } catch (err) {
    console.warn('Neon writeCallLog note:', err.message);
    dbStatus.error = err.message;
    notifyStatus();
    return false;
  }
}

export async function writeAuditLogToNeon(entry) {
  const sql = getSqlClient();
  if (!sql) return false;

  try {
    await sql`
      INSERT INTO audit_logs (
        id, timestamp, actor_name, actor_role, actor_team, action, target_id, target_name, event_name, prev_status, next_status, details
      ) VALUES (
        ${entry.id}, 
        ${entry.timestamp || new Date().toISOString()}, 
        ${entry.actorName}, 
        ${entry.actorRole || 'staff'}, 
        ${entry.actorTeam || 'Central Desk'}, 
        ${entry.action}, 
        ${entry.targetId || ''}, 
        ${entry.targetName || ''}, 
        ${entry.eventName || ''}, 
        ${entry.prevStatus || ''}, 
        ${entry.nextStatus || ''}, 
        ${entry.details || ''}
      )
      ON CONFLICT (id) DO NOTHING
    `;
    dbStatus.isConnected = true;
    dbStatus.error = null;
    notifyStatus();
    return true;
  } catch (err) {
    return false;
  }
}

export async function writePaymentVerificationToNeon(participantId, status, verifiedBy = '', notes = '') {
  const sql = getSqlClient();
  if (!sql) return false;

  try {
    await sql`
      INSERT INTO payment_verifications (
        participant_id, verification_state, verified_by, notes, updated_at
      ) VALUES (
        ${String(participantId)}, 
        ${status}, 
        ${verifiedBy}, 
        ${notes}, 
        NOW()
      )
      ON CONFLICT (participant_id) 
      DO UPDATE SET 
        verification_state = EXCLUDED.verification_state,
        verified_by = EXCLUDED.verified_by,
        notes = EXCLUDED.notes,
        updated_at = NOW()
    `;
    dbStatus.isConnected = true;
    dbStatus.error = null;
    notifyStatus();
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Stores a salted SHA-256 hash. The legacy plaintext column is nulled out so
 * a leaked database read no longer reveals a usable password.
 */
export async function writeCustomPasswordHashToNeon(username, hash, salt, mustChange = false, updatedBy = 'super_admin') {
  const sql = getSqlClient();
  if (!sql) return false;

  try {
    const clean = username.toLowerCase().trim();
    await sql`
      INSERT INTO custom_passwords (username, password, password_hash, salt, algo, must_change, updated_by, updated_at)
      VALUES (${clean}, NULL, ${hash}, ${salt}, 'SHA-256', ${mustChange}, ${updatedBy}, NOW())
      ON CONFLICT (username)
      DO UPDATE SET
        password = NULL,
        password_hash = EXCLUDED.password_hash,
        salt = EXCLUDED.salt,
        algo = 'SHA-256',
        must_change = EXCLUDED.must_change,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    `;
    dbStatus.isConnected = true;
    dbStatus.error = null;
    notifyStatus();
    return true;
  } catch (err) {
    console.warn('Neon writeCustomPasswordHash error:', err.message);
    return false;
  }
}

/**
 * Legacy plaintext writer. Retained only so the migration path can clear old
 * rows; new code should always use writeCustomPasswordHashToNeon.
 */
export async function writeCustomPasswordToNeon(username, password, updatedBy = 'super_admin') {
  const sql = getSqlClient();
  if (!sql) return false;

  try {
    const clean = username.toLowerCase().trim();
    await sql`
      INSERT INTO custom_passwords (username, password, updated_by, updated_at)
      VALUES (${clean}, ${password.trim()}, ${updatedBy}, NOW())
      ON CONFLICT (username)
      DO UPDATE SET 
        password = EXCLUDED.password,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    `;
    dbStatus.isConnected = true;
    dbStatus.error = null;
    notifyStatus();
    return true;
  } catch (err) {
    return false;
  }
}

export async function deleteCustomPasswordFromNeon(username) {
  const sql = getSqlClient();
  if (!sql) return false;

  try {
    const clean = username.toLowerCase().trim();
    await sql`
      DELETE FROM custom_passwords WHERE username = ${clean}
    `;
    dbStatus.isConnected = true;
    dbStatus.error = null;
    notifyStatus();
    return true;
  } catch (err) {
    return false;
  }
}

// ============================================================
// Runtime-managed panel users
// ============================================================

export async function fetchPanelUsersFromNeon() {
  const sql = getSqlClient();
  if (!sql) return [];

  try {
    const rows = await sql`
      SELECT username, display_name, role, domain_id, team_name, email, phone,
             is_active, can_verify_payments, created_by, created_at, notes
      FROM panel_users
      ORDER BY created_at ASC
    `;

    dbStatus.isConnected = true;
    dbStatus.error = null;
    notifyStatus();

    return rows.map(r => ({
      username: r.username,
      displayName: r.display_name,
      role: r.role,
      domainId: r.domain_id || 'ALL',
      teamName: r.team_name || 'Central Operations',
      email: r.email || '',
      phone: r.phone || '',
      isActive: r.is_active !== false,
      canVerifyPayments: r.can_verify_payments === true,
      createdBy: r.created_by || '',
      createdAt: r.created_at,
      notes: r.notes || ''
    }));
  } catch (err) {
    console.warn('Neon fetchPanelUsers error:', err.message);
    return [];
  }
}

export async function writePanelUserToNeon(user) {
  const sql = getSqlClient();
  if (!sql) return null;

  try {
    await sql`
      INSERT INTO panel_users (
        username, display_name, role, domain_id, team_name, email, phone,
        is_active, can_verify_payments, created_by, created_at, notes
      ) VALUES (
        ${user.username}, ${user.displayName}, ${user.role}, ${user.domainId || 'ALL'},
        ${user.teamName || 'Central Operations'}, ${user.email || ''}, ${user.phone || ''},
        ${user.isActive !== false}, ${Boolean(user.canVerifyPayments)},
        ${user.createdBy || ''}, ${user.createdAt || new Date().toISOString()}, ${user.notes || ''}
      )
      ON CONFLICT (username)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        role = EXCLUDED.role,
        domain_id = EXCLUDED.domain_id,
        team_name = EXCLUDED.team_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        is_active = EXCLUDED.is_active,
        can_verify_payments = EXCLUDED.can_verify_payments,
        notes = EXCLUDED.notes,
        updated_at = NOW()
    `;
    dbStatus.isConnected = true;
    dbStatus.error = null;
    notifyStatus();
    return user;
  } catch (err) {
    console.warn('Neon writePanelUser error:', err.message);
    return null;
  }
}

export async function setPanelUserActiveInNeon(username, isActive) {
  const sql = getSqlClient();
  if (!sql) return false;

  try {
    const clean = username.toLowerCase().trim();
    await sql`
      UPDATE panel_users SET is_active = ${Boolean(isActive)}, updated_at = NOW()
      WHERE username = ${clean}
    `;
    return true;
  } catch (err) {
    console.warn('Neon setPanelUserActive error:', err.message);
    return false;
  }
}

export async function deletePanelUserFromNeon(username) {
  const sql = getSqlClient();
  if (!sql) return false;

  try {
    const clean = username.toLowerCase().trim();
    await sql`
      DELETE FROM panel_users WHERE username = ${clean}
    `;
    return true;
  } catch (err) {
    console.warn('Neon deletePanelUser error:', err.message);
    return false;
  }
}

// ============================================================
// Payment claims (written by coordinators, reconciled by CI)
// ============================================================

export async function createPaymentClaimToNeon(claim) {
  const sql = getSqlClient();
  if (!sql) return false;

  try {
    await sql`
      INSERT INTO payment_claims (
        claim_id, participant_id, email, participant_name, claimed_by, claimed_by_name,
        claimed_at, state, claimed_amount, claimed_utr, remark
      ) VALUES (
        ${claim.claimId}, ${claim.participantId}, ${claim.email}, ${claim.participantName},
        ${claim.claimedBy}, ${claim.claimedByName}, ${claim.claimedAt},
        ${claim.state || 'PENDING_RECONCILE'}, ${claim.claimedAmount || 0},
        ${claim.claimedUtr || ''}, ${claim.remark || ''}
      )
      ON CONFLICT (claim_id)
      DO UPDATE SET
        state = EXCLUDED.state,
        remark = EXCLUDED.remark,
        claimed_amount = EXCLUDED.claimed_amount,
        claimed_utr = EXCLUDED.claimed_utr,
        last_checked_at = NOW()
    `;
    dbStatus.isConnected = true;
    dbStatus.error = null;
    notifyStatus();
    return true;
  } catch (err) {
    console.warn('Neon createPaymentClaim error:', err.message);
    return false;
  }
}

/**
 * Claims the dashboard needs to show: anything already reconciled (so the desk
 * can display the verdict and its evidence) plus claims CI has not looked at
 * yet. Never returns the full table.
 */
export async function fetchOpenPaymentClaimsFromNeon(limit = 500) {
  const sql = getSqlClient();
  if (!sql) return [];

  try {
    const rows = await sql`
      SELECT claim_id, participant_id, email, participant_name, claimed_by, claimed_by_name,
             claimed_at, state, claimed_amount, claimed_utr, remark, resolved_at,
             resolved_by, api_registration_id, api_utr, api_amount, api_status,
             last_checked_at, match_note
      FROM payment_claims
      WHERE state <> 'PENDING_RECONCILE'
         OR last_checked_at IS NULL
         OR last_checked_at < NOW() - INTERVAL '${CLAIM_RECHECK_MINUTES} minutes'
      ORDER BY claimed_at ASC
      LIMIT ${limit}
    `;
    dbStatus.isConnected = true;
    dbStatus.error = null;
    notifyStatus();
    return rows.map(r => ({
      claimId: r.claim_id,
      participantId: r.participant_id,
      email: r.email,
      participantName: r.participant_name,
      claimedBy: r.claimed_by,
      claimedByName: r.claimed_by_name,
      claimedAt: r.claimed_at,
      state: r.state,
      claimedAmount: r.claimed_amount,
      claimedUtr: r.claimed_utr,
      remark: r.remark,
      resolvedAt: r.resolved_at,
      resolvedBy: r.resolved_by,
      apiRegistrationId: r.api_registration_id,
      apiUtr: r.api_utr,
      apiAmount: r.api_amount,
      apiStatus: r.api_status,
      lastCheckedAt: r.last_checked_at,
      matchNote: r.match_note
    }));
  } catch (err) {
    console.warn('Neon fetchOpenPaymentClaims error:', err.message);
    return [];
  }
}

/**
 * Save / Upsert a device login session to Neon PostgreSQL
 */
export async function saveDeviceSessionToNeon(session) {
  const sql = getSqlClient();
  if (!sql || !session || !session.id) return false;

  try {
    await sql`
      INSERT INTO device_sessions (
        id, username, user_name, team_name, role, device_model, browser, os, device_type, ip, location, full_location, isp, login_time, last_active, is_active
      ) VALUES (
        ${session.id},
        ${session.username || 'unknown'},
        ${session.userName || session.username || 'User'},
        ${session.teamName || 'Central Operations'},
        ${session.role || 'domain_head'},
        ${session.deviceModel || 'Mobile / Device'},
        ${session.browser || 'Web Browser'},
        ${session.os || 'Android'},
        ${session.deviceType || 'mobile'},
        ${session.ip || '103.xx.xx.xx'},
        ${session.location || 'Sangrur, Punjab'},
        ${session.fullLocation || 'Sangrur, Punjab, India'},
        ${session.isp || 'Cellular / Wi-Fi'},
        ${session.loginTime ? new Date(session.loginTime) : new Date()},
        NOW(),
        TRUE
      )
      ON CONFLICT (id) DO UPDATE SET
        last_active = NOW(),
        is_active = TRUE,
        device_model = EXCLUDED.device_model,
        browser = EXCLUDED.browser,
        ip = EXCLUDED.ip,
        location = EXCLUDED.location
    `;
    dbStatus.isConnected = true;
    dbStatus.error = null;
    notifyStatus();
    return true;
  } catch (err) {
    console.warn('Could not sync device session to Neon:', err.message);
    return false;
  }
}

/**
 * Fetch all active device sessions from Neon PostgreSQL
 */
export async function fetchDeviceSessionsFromNeon() {
  const sql = getSqlClient();
  if (!sql) return [];

  try {
    const rows = await sql`
      SELECT 
        id, username, user_name as "userName", team_name as "teamName", 
        role, device_model as "deviceModel", browser, os, 
        device_type as "deviceType", ip, location, full_location as "fullLocation", 
        isp, login_time as "loginTime", last_active as "lastActive", is_active as "isActive"
      FROM device_sessions
      WHERE is_active = TRUE
      ORDER BY last_active DESC
      LIMIT 30
    `;
    dbStatus.isConnected = true;
    dbStatus.error = null;
    notifyStatus();
    return rows.map(r => ({
      ...r,
      loginTime: r.loginTime ? new Date(r.loginTime).toISOString() : new Date().toISOString()
    }));
  } catch (err) {
    console.warn('Could not fetch device sessions from Neon:', err.message);
    return [];
  }
}

/**
 * Terminate / deactivate a device session in Neon PostgreSQL
 */
export async function terminateDeviceSessionInNeon(sessionId) {
  const sql = getSqlClient();
  if (!sql || !sessionId) return false;

  try {
    await sql`
      UPDATE device_sessions 
      SET is_active = FALSE, last_active = NOW()
      WHERE id = ${sessionId}
    `;
    dbStatus.isConnected = true;
    dbStatus.error = null;
    notifyStatus();
    return true;
  } catch (err) {
    console.warn('Could not terminate device session in Neon:', err.message);
    return false;
  }
}

