import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useDialog } from './DialogProvider';

export default function JobHuntEvidencePanel({ refreshKey = 0 }) {
  const [claims, setClaims] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const { confirm } = useDialog();

  async function load() {
    try {
      const rows = await api.get('/jobhunt/documents/evidence/claims');
      setClaims(rows || []);
      const unverified = (rows || []).filter(c => !c.is_verified);
      // Auto-open only if there are unverified claims awaiting review
      if (unverified.length > 0) setIsOpen(true);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  async function sync() {
    setBusy(true);
    setError('');
    try {
      await api.post('/jobhunt/documents/evidence/sync', {});
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const pending = claims.filter(c => !c.is_verified);

  async function approve() {
    if (!await confirm('I have read the facts displayed here and confirm they accurately describe my experience, dates, qualifications, and results.', {
      ledger: 'jobhunt',
      confirmLabel: 'Confirm facts'
    })) return;

    setBusy(true);
    try {
      await api.post('/jobhunt/documents/evidence/confirm', { ids: pending.map(c => c.id) });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const categories = ['all', ...Array.from(new Set(claims.map(c => c.category)))];
  const filteredClaims = activeCategory === 'all' ? claims : claims.filter(c => c.category === activeCategory);

  return (
    <div
      className="card"
      style={{
        marginBottom: 16,
        padding: '12px 18px',
        border: '1px solid var(--hairline)',
        background: 'var(--paper-raised)',
        borderRadius: 8
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>🛡️</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
            Career Evidence Base
          </span>
          {pending.length > 0 ? (
            <span className="badge rust" style={{ fontSize: 11 }}>
              ⚠️ {pending.length} awaiting confirmation
            </span>
          ) : (
            <span className="badge green" style={{ fontSize: 11 }}>
              ✓ All {claims.length} facts confirmed
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn btn-sm"
            disabled={busy}
            onClick={sync}
            title="Extract and synchronize atomic claims from master profile"
            style={{ fontSize: 12, padding: '5px 10px' }}
          >
            {busy ? 'Syncing…' : '🔄 Sync Profile Facts'}
          </button>

          {pending.length > 0 && (
            <button
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={approve}
              style={{ fontSize: 12, padding: '5px 12px' }}
            >
              ✓ Confirm Facts ({pending.length})
            </button>
          )}

          <button
            className="btn btn-sm"
            onClick={() => setIsOpen(!isOpen)}
            style={{ fontSize: 12, padding: '5px 10px', color: 'var(--ink-soft)' }}
          >
            {isOpen ? '▲ Hide Facts' : `▼ View Facts (${claims.length})`}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--rust)', fontSize: 12.5, marginTop: 8 }} role="alert">
          {error}
        </div>
      )}

      {/* Expanded Accordion Body */}
      {isOpen && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--hairline)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-soft)' }}>
              Atomic facts indexed from your profile. Resumes and cover letters are strictly audited against this ground truth.
            </p>
            <Link to="/profile" className="btn btn-sm" style={{ fontSize: 11.5, padding: '4px 10px' }}>
              ✏️ Edit in Profile
            </Link>
          </div>

          {/* Category Filter Chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`btn btn-sm ${activeCategory === cat ? 'btn-primary' : ''}`}
                style={{
                  fontSize: 11,
                  padding: '3px 9px',
                  borderRadius: 14,
                  textTransform: 'capitalize'
                }}
              >
                {cat.replace('_', ' ')} ({cat === 'all' ? claims.length : claims.filter(c => c.category === cat).length})
              </button>
            ))}
          </div>

          {/* Scrollable Claims List */}
          <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
            {filteredClaims.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', padding: 12, textAlign: 'center' }}>
                No facts indexed for this category. Click "Sync Profile Facts" to index from your profile.
              </div>
            ) : (
              filteredClaims.map(c => (
                <div
                  key={c.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'var(--paper-hover)',
                    border: '1px solid var(--hairline)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`badge ${c.is_verified ? 'green' : 'rust'}`} style={{ fontSize: 10.5, padding: '1px 6px' }}>
                        {c.is_verified ? '✓ Confirmed' : '⚠️ Unconfirmed'}
                      </span>
                      <strong style={{ fontSize: 12.5, color: 'var(--ink)' }}>{c.source_title}</strong>
                    </div>
                    <span style={{ fontSize: 10.5, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
                      {c.category.replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.4 }}>
                    {c.claim_text}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
