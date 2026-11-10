import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useTheme } from '../ThemeContext.jsx';
import { useDialog } from '../components/DialogProvider.jsx';
import BackupSection from '../components/BackupSection.jsx';

const emptyActForm = { name: '', icon: '📌', color: '#5B7FBA', default_hours: '1.0' };

export default function RoutineSettings() {
  const { confirm } = useDialog();
  const { theme, toggleTheme } = useTheme();

  const [activities, setActivities] = useState([]);
  const [actForm, setActForm] = useState(emptyActForm);
  const [actSaved, setActSaved] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const acts = await api.get('/routine/activities');
      setActivities(acts);
    } catch (err) {
      console.error('Failed to load routine activities:', err);
    }
  }

  async function addActivity(e) {
    e.preventDefault();
    await api.post('/routine/activities', {
      ...actForm,
      default_hours: Number(actForm.default_hours) || 1
    });
    setActForm(emptyActForm);
    setActSaved(true);
    setTimeout(() => setActSaved(false), 2000);
    load();
  }

  async function removeActivity(id, name) {
    const ok = await confirm(
      `Deactivate routine activity "${name}"? It will no longer appear in your active tracker list.`,
      { ledger: 'routine' }
    );
    if (!ok) return;
    await api.del(`/routine/activities/${id}`);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Customize your schedule & system</div>
        <h1 className="page-title">Routine Settings</h1>
        <p className="page-sub">Manage your trackable activities, customize appearance, and handle database backups.</p>
      </div>

      {/* Top 2-column balanced section */}
      <div className="two-col" style={{ gridTemplateColumns: '1.08fr 1fr', marginBottom: 20 }}>
        {/* Left column */}
        <div>
          {/* Appearance card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Appearance</div>
            <div className="theme-toggle-row">
              <span style={{ fontSize: 13.5 }}>{theme === 'dark' ? '🌙 Dark mode (Default)' : '☀️ Light mode'}</span>
              <button className={`theme-switch ${theme === 'dark' ? 'on' : ''}`} onClick={toggleTheme} aria-label="Toggle dark mode" />
            </div>
          </div>

          {/* Trackable Activities Card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Trackable Routine Activities</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
              These are the activities available in your daily log and weekly schedule planner.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activities.map((a) => (
                <div key={a.id} className="routine-log-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
                  <div className="routine-log-activity">
                    <span className="routine-log-icon">{a.icon}</span>
                    <span style={{ fontWeight: 600 }}>{a.name}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginLeft: 6 }}>({a.default_hours}h default)</span>
                  </div>
                  <button className="icon-btn" onClick={() => removeActivity(a.id, a.name)}>Deactivate</button>
                </div>
              ))}
            </div>
          </div>

          {/* Routine Navigation Links */}
          <div className="card">
            <div className="section-title">Routine Workspace Navigation</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0, marginBottom: 10 }}>
              Quick shortcuts across your routine system:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { to: '/', icon: '📅', title: 'Today', desc: 'Daily timeline' },
                { to: '/routine', icon: '⏱️', title: 'Template', desc: 'Mon–Sun planner' },
                { to: '/timelog', icon: '📝', title: 'Time Log', desc: 'Focus analytics' },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: '7px',
                    background: 'var(--paper-hover)',
                    border: '1px solid var(--hairline)',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.background = 'var(--surface-muted)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--hairline)';
                    e.currentTarget.style.background = 'var(--paper-hover)';
                  }}
                >
                  <span style={{ fontSize: 16 }}>{link.icon}</span>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{link.title}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>{link.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Add Activity Card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Add New Activity</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
              Create a custom activity block to track in your schedule and daily logs.
            </p>
            <form onSubmit={addActivity}>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Activity Name</label>
                <input required placeholder="e.g. Swimming, LeetCode, Reading" value={actForm.name} onChange={(e) => setActForm({ ...actForm, name: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="field">
                  <label>Icon (emoji)</label>
                  <input value={actForm.icon} onChange={(e) => setActForm({ ...actForm, icon: e.target.value })} />
                </div>
                <div className="field">
                  <label>Badge Color</label>
                  <input type="color" value={actForm.color} onChange={(e) => setActForm({ ...actForm, color: e.target.value })} style={{ width: '100%', height: 38 }} />
                </div>
              </div>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>Default Duration (hours)</label>
                <input type="number" step="0.5" min="0.1" value={actForm.default_hours} onChange={(e) => setActForm({ ...actForm, default_hours: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Add Activity
              </button>
              {actSaved && <div style={{ color: 'var(--green)', fontSize: 13, marginTop: 8, textAlign: 'center' }}>Activity added! ✓</div>}
            </form>
          </div>

          {/* Productivity & Time-Blocking Principles Card */}
          <div className="card">
            <div className="section-title">Time-Blocking Principles</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0, marginBottom: 10 }}>
              How your routine ledger optimizes focus blocks and recovery intervals:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--hairline)' }}>
                <span><strong>Deep Work Blocks</strong> (DSA, System Design, Study)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>90 min</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--hairline)' }}>
                <span><strong>Physical Training</strong> (Gym &amp; Running)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>60-90 min</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--hairline)' }}>
                <span><strong>Recovery &amp; Sleep Target</strong> (Fixed circadian anchor)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>7.0 hrs</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span><strong>Buffer &amp; Transition Windows</strong> (Commute &amp; Meals)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>30-60 min</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width Database Backups & Restore Section */}
      <BackupSection
        ledger="routine"
        title="Database Backups & Restore"
        description="Automatic backups run weekly and capture your complete routine schedules, activities, and daily historical logs. You can also manually export or restore anytime."
      />
    </div>
  );
}
