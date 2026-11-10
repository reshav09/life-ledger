import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useDialog } from './DialogProvider.jsx';

function formatBackupDate(dateStr) {
  if (!dateStr) return 'Unknown date';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const datePart = d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const timePart = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  return `${datePart} · ${timePart}`;
}

function formatBytes(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackupSection({ ledger = 'settings', title = 'Backups & Restore', description = null }) {
  const { confirm } = useDialog();
  const [backups, setBackups] = useState([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const b = await api.get('/backup/list');
      setBackups(Array.isArray(b) ? b : []);
    } catch (err) {
      console.error('Failed to load backups:', err);
    }
  }

  async function runBackupNow() {
    setBackupBusy(true);
    setBackupMsg('');
    try {
      const res = await api.post('/backup/run', {});
      setBackupMsg(`✓ Backup saved: ${res.filename}`);
      load();
    } catch (err) {
      setBackupMsg(`✕ Backup failed: ${err.message}`);
    } finally {
      setBackupBusy(false);
    }
  }

  async function restoreFromFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ok = await confirm(
      'This will REPLACE all current data — every account, transaction, routine log, health record, opportunity, application, and setting — with the contents of this backup file. This cannot be undone. Continue?',
      { ledger, danger: true }
    );
    if (!ok) {
      e.target.value = '';
      return;
    }

    setBackupBusy(true);
    setBackupMsg('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await api.post('/backup/restore', data);
      setBackupMsg('✓ Restore complete. Reloading application…');
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setBackupMsg(`✕ Restore failed: ${err.message}`);
    } finally {
      setBackupBusy(false);
      e.target.value = '';
    }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <div>
          <div className="section-title" style={{ marginBottom: 4 }}>{title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10.5,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '2px 7px',
              borderRadius: 4,
              background: 'rgba(74, 158, 110, 0.12)',
              color: 'var(--green)',
              border: '1px solid rgba(74, 158, 110, 0.25)'
            }}>
              Automated Weekly
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
              Local Snapshot • SQLite
            </span>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={runBackupNow}
          disabled={backupBusy}
          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <span>{backupBusy ? '⏳' : '💾'}</span>
          <span>{backupBusy ? 'Creating…' : 'Backup Now'}</span>
        </button>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '0 0 14px 0', lineHeight: 1.5 }}>
        {description || 'Full database backups include all ledgers (Money, Routine, Diet & Health, and Job Hunt). Backups are stored locally on your host machine.'}
      </p>

      {backupMsg && (
        <div style={{
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: 12.5,
          fontWeight: 500,
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: backupMsg.startsWith('✓') ? 'rgba(74, 158, 110, 0.1)' : 'rgba(227, 122, 93, 0.1)',
          border: `1px solid ${backupMsg.startsWith('✓') ? 'rgba(74, 158, 110, 0.25)' : 'rgba(227, 122, 93, 0.25)'}`,
          color: backupMsg.startsWith('✓') ? 'var(--green)' : 'var(--rust)',
        }}>
          {backupMsg}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 20,
        alignItems: 'start'
      }}>
        {/* Left column: Recent Snapshots */}
        <div>
          {backups.length > 0 ? (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--ink-faint)',
                marginBottom: 8
              }}>
                <span>Recent Snapshots ({backups.length})</span>
                <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'none', color: 'var(--ink-faint)' }}>
                  {backups.length > 5 ? 'Showing latest 5' : 'All available'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {backups.slice(0, 5).map((b) => (
                  <div
                    key={b.filename}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: '7px',
                      background: 'var(--paper-hover)',
                      border: '1px solid var(--hairline)',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span style={{ fontSize: 14, opacity: 0.8, flexShrink: 0 }}>📦</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)' }}>
                          {formatBackupDate(b.created_at)}
                        </div>
                        <div style={{
                          fontSize: 10.5,
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--ink-faint)',
                          marginTop: 1,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '180px'
                        }}>
                          {b.filename}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'var(--surface-muted, rgba(0,0,0,0.04))',
                        border: '1px solid var(--hairline)',
                        color: 'var(--ink-soft)'
                      }}>
                        {formatBytes(b.size_bytes)}
                      </span>
                      <a
                        href={`/api/backup/download/${b.filename}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm"
                        style={{
                          textDecoration: 'none',
                          padding: '4px 9px',
                          fontSize: 11.5,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        title="Download JSON Snapshot"
                      >
                        <span>⬇️</span>
                        <span>Download</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              padding: '24px 16px',
              borderRadius: '7px',
              textAlign: 'center',
              background: 'var(--paper-hover)',
              border: '1px dashed var(--hairline)',
              fontSize: 12.5,
              color: 'var(--ink-soft)'
            }}>
              No local snapshots found yet. Click <strong>Backup Now</strong> above to create your first backup.
            </div>
          )}
        </div>

        {/* Right column: Safety Restore Container */}
        <div style={{
          padding: '14px 16px',
          borderRadius: '8px',
          border: '1px solid rgba(227, 122, 93, 0.25)',
          background: 'rgba(227, 122, 93, 0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 14 }}>⚠️</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--rust)' }}>
              Restore Database
            </span>
            <span style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 4,
              background: 'var(--rust-soft)',
              color: 'var(--rust)',
              fontWeight: 600
            }}>
              Destructive
            </span>
          </div>

          <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '0 0 12px 0', lineHeight: 1.45 }}>
            Upload a previously downloaded JSON snapshot to overwrite current database records across all ledgers. A confirmation prompt will appear before any data is replaced.
          </p>

          {/* Hidden Native File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={restoreFromFile}
            disabled={backupBusy}
            style={{ display: 'none' }}
          />

          {/* Custom Styled Upload Action */}
          <button
            type="button"
            className="btn"
            onClick={() => !backupBusy && fileInputRef.current?.click()}
            disabled={backupBusy}
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '9px 14px',
              borderRadius: '7px',
              fontSize: '12.5px',
              fontWeight: 600,
              border: '1px dashed rgba(227, 122, 93, 0.4)',
              background: 'var(--input-bg)',
              color: 'var(--ink)'
            }}
          >
            <span>📥</span>
            <span>{backupBusy ? 'Restoring Snapshot…' : 'Select Backup JSON to Restore'}</span>
          </button>

          <div style={{
            marginTop: 10,
            fontSize: 11,
            color: 'var(--ink-faint)',
            display: 'flex',
            alignItems: 'center',
            gap: 5
          }}>
            <span>🛡️</span>
            <span>All database records and JSON snapshots remain 100% local on this machine.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
