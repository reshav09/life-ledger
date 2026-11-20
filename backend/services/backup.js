const fs = require('fs');
const path = require('path');
const pool = require('../db/db');

// Written to a bind-mounted folder so backups land directly on the host
// laptop's filesystem, not just inside the container.
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');

// Order matters for restore: tables with foreign keys come after the tables
// they reference. Delete happens in reverse order; insert happens in this order.
const TABLES = [
  // ── Money Ledger (original) ──
  'accounts', 'categories', 'transactions', 'salaries', 'budgets', 'wishlist', 'settings',
  'savings_goals', 'savings_contributions', 'loans', 'loan_payments',
  'templates', 'bill_reminders', 'budget_transfers',
  // ── Routine & Schedule Ledger ──
  'routine_activities', 'routine_templates', 'routine_logs', 'applications',
  // ── Diet & Health Ledger ──
  'health_profile', 'diet_goals', 'health_reports', 'health_measurements',
  'food_entries', 'water_intake_logs', 'gym_purchase_classifications',
  // ── AI Analyzer ──
  'ai_settings', 'ai_insights', 'ai_chat_messages',
  // ── Job Hunt Ledger ──
  'jobhunt_profile', 'jobhunt_organizations', 'jobhunt_opportunities', 'jobhunt_content_hashes',
  'jobhunt_interview_prep', 'jobhunt_question_bank', 'jobhunt_evidence_claims',
  'jobhunt_document_packages', 'jobhunt_document_reviews', 'jobhunt_application_events', 'jobhunt_mock_sessions',
  'jobhunt_generation_jobs', 'jobhunt_document_artifacts', 'jobhunt_followup_reminders', 'schema_migrations'
];

async function runBackup() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const data = {};
  for (const table of TABLES) {
    try {
      const [rows] = await pool.query(`SELECT * FROM ${table}`);
      data[table] = rows;
    } catch {
      // Table doesn't exist in standalone mode; safely skip
    }
  }
  const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(path.join(BACKUP_DIR, filename), JSON.stringify(data, null, 2));
  await pool.query(
    "INSERT INTO settings (`key`, `value`) VALUES ('last_auto_backup_at', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
    [new Date().toISOString()]
  );
  return filename;
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return { filename: f, size_bytes: stat.size, created_at: stat.mtime };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// Backup JSON round-trips dates as ISO strings (e.g. "2026-07-31T05:09:49.000Z").
// MySQL's DATETIME/DATE columns don't accept that format directly, so convert
// it to "YYYY-MM-DD HH:MM:SS" without shifting the actual moment in time.
function coerceValue(v) {
  if(v && v.type==='Buffer' && Array.isArray(v.data))return Buffer.from(v.data);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
    return v.replace('T', ' ').replace(/\.\d+Z?$/, '').replace(/Z$/, '');
  }
  return v;
}

// Explicit restore replaces only tables present in this backup; omitted ledgers are preserved.
// Wrapped in a real transaction so a failure partway through rolls back
// cleanly instead of leaving the database half-empty.
async function restoreBackup(data) {
  if(!data || typeof data!=='object' || Array.isArray(data))throw new Error('Invalid backup');
  const restoredTables=TABLES.filter(t=>Object.hasOwn(data,t));
  if(!restoredTables.length)throw new Error('Backup contains no recognized tables');
  for(const table of restoredTables){
    if(!Array.isArray(data[table]))throw new Error(`Invalid backup table: ${table}`);
    for(const row of data[table])if(!row || typeof row!=='object' || Object.keys(row).some(k=>!/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(k)))throw new Error(`Invalid backup row in ${table}`);
  }
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS=0');
    await conn.beginTransaction();
    for (const table of [...restoredTables].reverse()) {
      await conn.query(`DELETE FROM ${table}`);
    }
    for (const table of restoredTables) {
      const rows = data[table];
      for (const row of rows) {
        const cols = Object.keys(row);
        if (cols.length === 0) continue;
        const values = cols.map((c) => coerceValue(row[c]));
        const placeholders = cols.map(() => '?').join(',');
        const colList = cols.map((c) => `\`${c}\``).join(',');
        await conn.query(`INSERT INTO ${table} (${colList}) VALUES (${placeholders})`, values);
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.query('SET FOREIGN_KEY_CHECKS=1');
    conn.release();
  }
}

async function maybeRunAutoBackup() {
  try {
    const [[row]] = await pool.query("SELECT `value` FROM settings WHERE `key` = 'last_auto_backup_at'");
    const last = row?.value ? new Date(row.value) : null;
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    if (!last || Date.now() - last.getTime() >= weekMs) {
      const filename = await runBackup();
      console.log(`Automatic weekly backup completed: ${filename}`);
    }
  } catch (err) {
    console.error('Auto-backup check failed:', err.message);
  }
}

function scheduleAutoBackup() {
  maybeRunAutoBackup();
  setInterval(maybeRunAutoBackup, 60 * 60 * 1000); // re-check hourly, cheap no-op most of the time
}

module.exports = { runBackup, listBackups, restoreBackup, scheduleAutoBackup, BACKUP_DIR };
