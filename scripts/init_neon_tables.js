import { neon } from '@neondatabase/serverless';

// Read the connection string from the environment. Never commit a credential:
// this script runs from GitHub Actions (secret) or a local shell export.
const databaseUrl = process.env.NEON_DATABASE_URL || process.env.VITE_NEON_DATABASE_URL || '';

if (!databaseUrl) {
  console.error('Missing NEON_DATABASE_URL. Export it before running this script.');
  process.exit(1);
}

async function initTables() {
  const sql = neon(databaseUrl);

  console.log('Creating/verifying tables in Neon PostgreSQL...');

  await sql`
    CREATE TABLE IF NOT EXISTS call_logs (
      id TEXT PRIMARY KEY,
      participant_id TEXT NOT NULL,
      call_number INT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      caller_name TEXT,
      caller_role TEXT,
      caller_team TEXT,
      status TEXT NOT NULL,
      remark TEXT,
      lead_number TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('OK call_logs');

  await sql`CREATE INDEX IF NOT EXISTS idx_call_logs_participant ON call_logs(participant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_call_logs_timestamp ON call_logs(timestamp DESC)`;
  console.log('OK call_logs indexes');

  await sql`
    CREATE TABLE IF NOT EXISTS payment_verifications (
      participant_id TEXT PRIMARY KEY,
      verification_state TEXT NOT NULL,
      verified_by TEXT,
      verified_by_name TEXT,
      notes TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('OK payment_verifications');

  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actor_name TEXT NOT NULL,
      actor_role TEXT,
      actor_team TEXT,
      action TEXT NOT NULL,
      target_id TEXT,
      target_name TEXT,
      event_name TEXT,
      prev_status TEXT,
      next_status TEXT,
      details TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC)`;
  console.log('OK audit_logs');

  // ---- Hashed credential storage ----
  await sql`
    CREATE TABLE IF NOT EXISTS custom_passwords (
      username TEXT PRIMARY KEY,
      password TEXT,
      password_hash TEXT,
      salt TEXT,
      algo TEXT,
      must_change BOOLEAN DEFAULT FALSE,
      updated_by TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('OK custom_passwords (hashed columns added)');

  // ---- Device sessions (referenced by the app but never created) ----
  await sql`
    CREATE TABLE IF NOT EXISTS device_sessions (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      user_name TEXT,
      team_name TEXT,
      role TEXT,
      device_model TEXT,
      browser TEXT,
      os TEXT,
      device_type TEXT,
      ip TEXT,
      location TEXT,
      full_location TEXT,
      isp TEXT,
      login_time TIMESTAMPTZ DEFAULT NOW(),
      last_active TIMESTAMPTZ DEFAULT NOW(),
      is_active BOOLEAN DEFAULT TRUE
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_device_sessions_active ON device_sessions(is_active)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_device_sessions_username ON device_sessions(username)`;
  console.log('OK device_sessions');

  // ---- Runtime-managed panel users ----
  await sql`
    CREATE TABLE IF NOT EXISTS panel_users (
      username TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      domain_id TEXT DEFAULT 'ALL',
      team_name TEXT,
      email TEXT,
      phone TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      can_verify_payments BOOLEAN DEFAULT FALSE,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      notes TEXT
    )
  `;
  console.log('OK panel_users');

  // ---- Payment claims: raised in the panel, reconciled by CI ----
  await sql`
    CREATE TABLE IF NOT EXISTS payment_claims (
      claim_id TEXT PRIMARY KEY,
      participant_id TEXT NOT NULL,
      email TEXT,
      participant_name TEXT,
      claimed_by TEXT NOT NULL,
      claimed_by_name TEXT,
      claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      state TEXT NOT NULL DEFAULT 'PENDING_RECONCILE',
      claimed_amount NUMERIC(10,2) DEFAULT 0,
      claimed_utr TEXT,
      remark TEXT,
      resolved_at TIMESTAMPTZ,
      resolved_by TEXT,
      api_registration_id TEXT,
      api_utr TEXT,
      api_amount NUMERIC(10,2),
      api_status TEXT,
      last_checked_at TIMESTAMPTZ,
      match_note TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_payment_claims_state ON payment_claims(state)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_payment_claims_email ON payment_claims(LOWER(email))`;
  console.log('OK payment_claims');

  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name;
  `;
  console.log('\nPublic tables present:');
  tables.forEach(t => console.log('  ->', t.table_name));
  console.log('\nMigration complete.');
}

initTables().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});