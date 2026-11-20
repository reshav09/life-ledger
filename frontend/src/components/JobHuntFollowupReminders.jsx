import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function JobHuntFollowupReminders() {
  const [data, setData] = useState({ items: [] });
  const [error, setError] = useState('');

  async function load() {
    try {
      const res = await api.get('/jobhunt/documents/reminders');
      setData(res || { items: [] });
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  async function update(id, body) {
    try {
      await api.post(`/jobhunt/documents/reminders/${id}`, body);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  // Do not render an empty card if there are no reminders due
  if (!data?.items || data.items.length === 0) {
    return null;
  }

  return (
    <div
      className="card"
      style={{
        marginBottom: 16,
        padding: '14px 18px',
        borderLeft: '4px solid var(--brass)',
        background: 'var(--paper-raised)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🔔</span>
          <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>
            Follow-ups Due ({data.items.length})
          </h3>
          <span className="badge brass" style={{ fontSize: 11 }}>
            {data.days || 7}+ days without recorded contact
          </span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
          Nothing is sent automatically. Use drafts to reach out manually.
        </span>
      </div>

      {error && (
        <div style={{ color: 'var(--rust)', fontSize: 12.5, marginBottom: 8 }} role="alert">
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.items.map((a) => (
          <div
            key={a.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              borderRadius: 6,
              background: 'var(--paper-hover)',
              border: '1px solid var(--hairline)',
              flexWrap: 'wrap',
              gap: 8
            }}
          >
            <div>
              <Link
                to={`/workspace?appId=${a.id}`}
                style={{ fontWeight: 600, color: 'var(--ink)', textDecoration: 'none', fontSize: 13.5 }}
              >
                {a.name} — <span style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{a.role}</span>
              </Link>
              {a.applied_at && (
                <span style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginLeft: 8 }}>
                  Applied {new Date(a.applied_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Link
                to={`/workspace?appId=${a.id}`}
                className="btn btn-sm"
                style={{ fontSize: 11.5, padding: '4px 10px' }}
              >
                ✉️ Open Draft
              </Link>
              <button
                className="btn btn-sm"
                style={{ fontSize: 11.5, padding: '4px 10px' }}
                onClick={() => update(a.id, { snoozeDays: 7 })}
              >
                Snooze 7d
              </button>
              <button
                className="btn btn-sm"
                style={{ fontSize: 11.5, padding: '4px 10px' }}
                onClick={() => update(a.id, { dismiss: true })}
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
