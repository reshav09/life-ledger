import { useEffect, useState } from 'react';
import { api, todayISO } from '../api.js';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getToday() {
  const d = new Date();
  // JS getDay(): 0=Sun..6=Sat → convert to our 0=Mon..6=Sun
  return (d.getDay() + 6) % 7;
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function blockDuration(start, end) {
  let s = timeToMinutes(start), e = timeToMinutes(end);
  if (e <= s) e += 24 * 60; // crosses midnight
  return ((e - s) / 60).toFixed(1);
}

export default function RoutineToday() {
  const [template, setTemplate] = useState([]);
  const [activities, setActivities] = useState([]);
  const [logs, setLogs] = useState({});
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dayIndex = (() => {
    const d = new Date(date + 'T00:00:00');
    return (d.getDay() + 6) % 7;
  })();

  useEffect(() => { load(); }, [date]);

  // Re-fetch data when Quick Log saves without resetting date
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('quick-log-saved', handler);
    return () => window.removeEventListener('quick-log-saved', handler);
  }, [date]);

  async function load() {
    const [tmpl, acts, dayLogs] = await Promise.all([
      api.get('/routine/template'),
      api.get('/routine/activities'),
      api.get(`/routine/logs?date=${date}`)
    ]);
    setTemplate(tmpl[dayIndex] || []);
    setActivities(acts);
    // Build a map of activity_id -> hours from existing logs
    const logMap = {};
    acts.forEach((a) => { logMap[a.id] = { hours: '', notes: '' }; });
    dayLogs.forEach((l) => { logMap[l.activity_id] = { hours: String(l.hours), notes: l.notes || '' }; });
    setLogs(logMap);
    setSaved(false);
  }

  function updateLog(actId, field, value) {
    setLogs((prev) => ({ ...prev, [actId]: { ...prev[actId], [field]: value } }));
    setSaved(false);
  }

  async function saveLogs() {
    setSaving(true);
    const entries = Object.entries(logs)
      .filter(([, v]) => v.hours !== '' && Number(v.hours) > 0)
      .map(([activity_id, v]) => ({ activity_id: Number(activity_id), hours: Number(v.hours), notes: v.notes }));
    await api.post('/routine/logs', { log_date: date, entries });
    setSaving(false);
    setSaved(true);
  }

  const totalPlanned = template.reduce((s, b) => s + Number(blockDuration(b.start_time, b.end_time)), 0);
  const totalLogged = Object.values(logs).reduce((s, v) => s + (Number(v.hours) || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">How did you spend your day?</div>
        <h1 className="page-title">Today's Routine</h1>
        <p className="page-sub">Log your actual hours and see how they match your plan.</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--hairline)', background: 'var(--input-bg)', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 14 }} />
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-soft)' }}>
          {DAY_NAMES[dayIndex]}
        </span>
        <button onClick={() => setDate(todayISO())} className="btn btn-sm" style={{ marginLeft: 'auto' }}>Jump to today</button>
      </div>

      {/* Stat cards */}
      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-label">Hours Planned</div>
          <div className="stat-value">{totalPlanned.toFixed(1)}h</div>
          <div className="stat-note">{template.length} blocks scheduled</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Hours Logged</div>
          <div className={`stat-value ${totalLogged >= totalPlanned * 0.8 ? 'positive' : totalLogged > 0 ? '' : 'negative'}`}>
            {totalLogged.toFixed(1)}h
          </div>
          <div className="stat-note">{totalLogged >= totalPlanned ? '✓ On track' : `${(totalPlanned - totalLogged).toFixed(1)}h remaining`}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Sleep</div>
          <div className="stat-value">{logs[1]?.hours || '—'}h</div>
          <div className="stat-note">Target: 7h minimum</div>
        </div>
      </div>

      <div className="two-col">
        {/* Today's schedule from template */}
        <div>
          <div className="section-title">📋 Planned Schedule</div>
          {template.length === 0 ? (
            <div className="card empty-state">No blocks scheduled for {DAY_NAMES[dayIndex]}.</div>
          ) : (
            <div className="routine-timeline">
              {template.map((block) => (
                <div className="routine-timeline-block" key={block.id}
                  style={{ '--block-color': block.activity_color }}>
                  <div className="routine-timeline-time">
                    {block.start_time} – {block.end_time}
                    <span className="routine-timeline-duration">{blockDuration(block.start_time, block.end_time)}h</span>
                  </div>
                  <div className="routine-timeline-label">
                    <span>{block.activity_icon}</span> {block.activity_name}
                  </div>
                  {block.notes && <div className="routine-timeline-notes">{block.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick log form */}
        <div>
          <div className="section-title">✏️ Log Actual Hours</div>
          <div className="card">
            <div className="routine-log-grid">
              {activities.map((act) => (
                <div className="routine-log-row" key={act.id}>
                  <div className="routine-log-activity">
                    <span className="routine-log-icon">{act.icon}</span>
                    <span>{act.name}</span>
                  </div>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    max="24"
                    placeholder="0"
                    value={logs[act.id]?.hours || ''}
                    onChange={(e) => updateLog(act.id, 'hours', e.target.value)}
                    className="routine-log-input"
                  />
                  <span className="routine-log-unit">h</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <button onClick={saveLogs} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving}>
                {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Today\'s Log'}
              </button>
              {saved && <span style={{ color: 'var(--green)', fontSize: 13 }}>All changes saved</span>}
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-faint)' }}>
              Total: <strong>{totalLogged.toFixed(1)}h</strong> of 24h logged
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
