import { useEffect, useRef, useState } from 'react';
import { api, formatMoney } from '../api.js';
import { useTheme } from '../ThemeContext.jsx';
import { useAppMode } from '../AppContext.jsx';
import { useDialog } from '../components/DialogProvider.jsx';

const emptyCatForm = { name: '', type: 'expense', icon: '💸', color: '#8B8578' };
const emptyReminderForm = { name: '', amount: '', category_id: '', due_day: '1', remind_days_before: '3' };
const emptyActForm = { name: '', icon: '📌', color: '#5B7FBA', default_hours: '1.0' };

export default function SettingsPage() {
  const { confirm } = useDialog();
  const { theme, toggleTheme } = useTheme();
  const { mode } = useAppMode();
  const isRoutineMode = mode === 'routine';

  // Money settings state
  const [settings, setSettings] = useState({ reserve_cap: '0', currency_symbol: '₹', salary_day: '7', salary_weekend_shift: 'previous_business_day', pay_cycle_mode: 'salary' });
  const [reserveInput, setReserveInput] = useState('0');
  const [salaryDayInput, setSalaryDayInput] = useState('7');
  const [salaryWeekendShift, setSalaryWeekendShift] = useState('previous_business_day');
  const [payCycleMode, setPayCycleMode] = useState('salary');
  const [categories, setCategories] = useState([]);
  const [catForm, setCatForm] = useState(emptyCatForm);
  const [saved, setSaved] = useState(false);
  const [salarySaved, setSalarySaved] = useState(false);

  const [reminders, setReminders] = useState([]);
  const [reminderForm, setReminderForm] = useState(emptyReminderForm);
  const [showReminderForm, setShowReminderForm] = useState(false);

  // Routine settings state
  const [activities, setActivities] = useState([]);
  const [actForm, setActForm] = useState(emptyActForm);
  const [actSaved, setActSaved] = useState(false);

  // Backup state
  const [backups, setBackups] = useState([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => { load(); }, [mode]);

  async function load() {
    if (isRoutineMode) {
      const [acts, b] = await Promise.all([
        api.get('/routine/activities'),
        api.get('/backup/list')
      ]);
      setActivities(acts);
      setBackups(b);
    } else {
      const [s, c, r, b] = await Promise.all([
        api.get('/settings'),
        api.get('/categories'),
        api.get('/reminders'),
        api.get('/backup/list')
      ]);
      setSettings(s);
      setReserveInput(s.reserve_cap || '0');
      setSalaryDayInput(s.salary_day || '7');
      setSalaryWeekendShift(s.salary_weekend_shift || 'previous_business_day');
      setPayCycleMode(s.pay_cycle_mode || 'salary');
      setCategories(c);
      setReminders(r);
      setBackups(b);
      if (c.length) setReminderForm((f) => ({ ...f, category_id: c.find((cat) => cat.type === 'expense')?.id || '' }));
    }
  }

  // --- Money actions ---
  async function saveReserve(e) {
    e.preventDefault();
    await api.post('/settings', { reserve_cap: Number(reserveInput) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load();
  }

  async function saveSalaryCycle(e) {
    e.preventDefault();
    await api.post('/settings', {
      salary_day: Number(salaryDayInput) || 7,
      salary_weekend_shift: salaryWeekendShift,
      pay_cycle_mode: payCycleMode
    });
    setSalarySaved(true);
    setTimeout(() => setSalarySaved(false), 2000);
    load();
  }

  async function addCategory(e) {
    e.preventDefault();
    await api.post('/categories', catForm);
    setCatForm(emptyCatForm);
    load();
  }

  async function removeCategory(id) {
    if (!await confirm('Remove this category? Only custom (non-default) categories can be removed.', { ledger: 'settings', danger: true })) return;
    await api.del(`/categories/${id}`);
    load();
  }

  async function addReminder(e) {
    e.preventDefault();
    await api.post('/reminders', {
      ...reminderForm,
      amount: reminderForm.amount ? Number(reminderForm.amount) : null,
      due_day: Number(reminderForm.due_day),
      remind_days_before: Number(reminderForm.remind_days_before)
    });
    setReminderForm({ ...emptyReminderForm, category_id: categories.find((c) => c.type === 'expense')?.id || '' });
    setShowReminderForm(false);
    load();
  }

  async function removeReminder(id) {
    if (!await confirm('Remove this bill reminder?', { ledger: 'settings', danger: true })) return;
    await api.del(`/reminders/${id}`);
    load();
  }

  // --- Routine actions ---
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
    if (!await confirm(`Deactivate routine activity "${name}"? It will no longer appear in your active tracker list.`, { ledger: 'settings' })) return;
    await api.del(`/routine/activities/${id}`);
    load();
  }

  // --- Backup actions ---
  async function runBackupNow() {
    setBackupBusy(true);
    setBackupMsg('');
    try {
      const res = await api.post('/backup/run', {});
      setBackupMsg(`Backup saved: ${res.filename}`);
      const b = await api.get('/backup/list');
      setBackups(b);
    } catch (err) {
      setBackupMsg(`Backup failed: ${err.message}`);
    } finally {
      setBackupBusy(false);
    }
  }

  async function restoreFromFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!await confirm('This will REPLACE all current data — every account, transaction, routine log, application, and setting — with the contents of this backup file. This cannot be undone. Continue?', { ledger: 'settings', danger: true })) {
      e.target.value = '';
      return;
    }
    setBackupBusy(true);
    setBackupMsg('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await api.post('/backup/restore', data);
      setBackupMsg('Restore complete. Reloading…');
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setBackupMsg(`Restore failed: ${err.message}`);
    } finally {
      setBackupBusy(false);
      e.target.value = '';
    }
  }

  if (isRoutineMode) {
    return (
      <div>
        <div className="page-header">
          <div className="page-eyebrow">Customize your schedule & system</div>
          <h1 className="page-title">Routine Settings</h1>
          <p className="page-sub">Manage your trackable activities, customize appearance, and handle data backups.</p>
        </div>

        <div className="two-col">
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="section-title">Appearance</div>
              <div className="theme-toggle-row">
                <span style={{ fontSize: 13.5 }}>{theme === 'dark' ? '🌙 Dark mode (Default)' : '☀️ Light mode'}</span>
                <button className={`theme-switch ${theme === 'dark' ? 'on' : ''}`} onClick={toggleTheme} aria-label="Toggle dark mode" />
              </div>
            </div>

            <div className="card">
              <div className="section-title">Trackable Routine Activities</div>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
                These are the activities available in your daily log and weekly schedule planner.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activities.map((a) => (
                  <div key={a.id} className="routine-log-row" style={{ padding: '8px 0' }}>
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
          </div>

          <div>
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
                {actSaved && <div style={{ color: 'var(--green)', fontSize: 13, marginTop: 8, textAlign: 'center' }}>Activity added!</div>}
              </form>
            </div>

            <div className="card">
              <div className="section-title">Backups & Restore</div>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
                Automatic backups run weekly. You can also manually export or restore your application data anytime.
              </p>
              <button className="btn btn-primary" onClick={runBackupNow} disabled={backupBusy} style={{ marginBottom: 14 }}>
                {backupBusy ? 'Working…' : '💾 Backup now'}
              </button>
              {backupMsg && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 14 }}>{backupMsg}</div>}

              {backups.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-soft)', marginBottom: 8 }}>Recent backups</div>
                  {backups.slice(0, 5).map((b) => (
                    <div key={b.filename} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid var(--hairline)' }}>
                      <span>{new Date(b.created_at).toLocaleString('en-IN')}</span>
                      <a href={`/api/backup/download/${b.filename}`} target="_blank" rel="noreferrer">Download</a>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ paddingTop: 14, borderTop: '1px dashed var(--hairline)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--rust)', marginBottom: 8 }}>Restore backup</div>
                <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 0 }}>
                  Uploading a backup file replaces current data with the backup contents.
                </p>
                <input ref={fileInputRef} type="file" accept="application/json" onChange={restoreFromFile} disabled={backupBusy} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default: Money mode settings
  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Your rules, enforced everywhere</div>
        <h1 className="page-title">Money Settings</h1>
        <p className="page-sub">Set the money you never want to touch, manage categories, bill reminders, appearance, and backups.</p>
      </div>

      <div className="two-col">
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Reserve cap</div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 0 }}>
              This amount is subtracted from your total balance everywhere in the app — the Dashboard, the daily
              safe-spend number, and the Planner's affordability check. It's the money you've decided not to touch,
              no matter what.
            </p>
            <form onSubmit={saveReserve}>
              <div className="field" style={{ maxWidth: 240, marginBottom: 14 }}>
                <label>Reserve amount (₹)</label>
                <input type="number" step="0.01" value={reserveInput} onChange={(e) => setReserveInput(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary">Save reserve cap</button>
              {saved && <span style={{ marginLeft: 10, color: 'var(--green)', fontSize: 13 }}>Saved ✓</span>}
            </form>
            <div style={{ marginTop: 14, fontSize: 13, color: 'var(--ink-soft)' }}>
              Current reserve: <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatMoney(settings.reserve_cap)}</strong>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Salary & Pay Cycle</div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 0 }}>
              Tailor your daily "Safe to spend" budget around your actual salary arrival date instead of arbitrary calendar month boundaries.
            </p>
            <form onSubmit={saveSalaryCycle}>
              <div className="form-grid" style={{ marginBottom: 14 }}>
                <div className="field">
                  <label>Calculation Mode</label>
                  <select value={payCycleMode} onChange={(e) => setPayCycleMode(e.target.value)}>
                    <option value="salary">Salary Pay Cycle (Recommended)</option>
                    <option value="calendar">Calendar Month (1st to 31st)</option>
                  </select>
                </div>
                <div className="field">
                  <label>Salary Credit Day</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={salaryDayInput}
                    onChange={(e) => setSalaryDayInput(e.target.value)}
                    disabled={payCycleMode === 'calendar'}
                  />
                </div>
              </div>

              {payCycleMode === 'salary' && (
                <div className="field" style={{ marginBottom: 14 }}>
                  <label>Weekend & Holiday Rule</label>
                  <select value={salaryWeekendShift} onChange={(e) => setSalaryWeekendShift(e.target.value)}>
                    <option value="previous_business_day">Shift to Friday before (if 7th is Sat/Sun)</option>
                    <option value="exact_day">Exact day (no weekend shift)</option>
                  </select>
                </div>
              )}

              <button type="submit" className="btn btn-primary">Save pay cycle</button>
              {salarySaved && <span style={{ marginLeft: 10, color: 'var(--green)', fontSize: 13 }}>Saved ✓</span>}
            </form>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Appearance</div>
            <div className="theme-toggle-row">
              <span style={{ fontSize: 13.5 }}>{theme === 'dark' ? '🌙 Dark mode (Default)' : '☀️ Light mode'}</span>
              <button className={`theme-switch ${theme === 'dark' ? 'on' : ''}`} onClick={toggleTheme} aria-label="Toggle dark mode" />
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">
              Bill reminders
              <button className="btn btn-sm" onClick={() => setShowReminderForm(!showReminderForm)}>{showReminderForm ? 'Cancel' : '+ New reminder'}</button>
            </div>
            {reminders.length === 0 && !showReminderForm ? (
              <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>No reminders yet — add rent, electricity, or any recurring bill by its due day of the month.</div>
            ) : (
              reminders.map((r) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--hairline)', fontSize: 13.5 }}>
                  <span>
                    {r.category_icon || '💳'} {r.name}{r.amount ? ` — ${formatMoney(r.amount)}` : ''}
                    <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}> · due day {r.due_day} · next {r.next_due_date} ({r.days_until}d)</span>
                  </span>
                  <button className="icon-btn" onClick={() => removeReminder(r.id)}>Remove</button>
                </div>
              ))
            )}
            {showReminderForm && (
              <form onSubmit={addReminder} style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--hairline)' }}>
                <div className="form-grid">
                  <div className="field">
                    <label>Bill name</label>
                    <input required placeholder="e.g. Electricity Bill" value={reminderForm.name} onChange={(e) => setReminderForm({ ...reminderForm, name: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Amount (optional, ₹)</label>
                    <input type="number" step="0.01" value={reminderForm.amount} onChange={(e) => setReminderForm({ ...reminderForm, amount: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Due day of month</label>
                    <input required type="number" min="1" max="31" value={reminderForm.due_day} onChange={(e) => setReminderForm({ ...reminderForm, due_day: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Remind days before</label>
                    <input required type="number" min="0" max="30" value={reminderForm.remind_days_before} onChange={(e) => setReminderForm({ ...reminderForm, remind_days_before: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Category (optional)</label>
                    <select value={reminderForm.category_id} onChange={(e) => setReminderForm({ ...reminderForm, category_id: e.target.value })}>
                      <option value="">None</option>
                      {categories.filter((c) => c.type === 'expense').map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary">Save reminder</button>
              </form>
            )}
          </div>

          <div className="card">
            <div className="section-title">All categories</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {categories.map((c) => (
                <div key={c.id} className="badge" style={{ background: (c.color || '#ddd') + '22', color: c.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {c.icon} {c.name}
                  {!c.is_default && (
                    <button className="icon-btn" style={{ padding: '0 2px' }} onClick={() => removeCategory(c.id)}>✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Add a category</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
              The defaults cover food, rent, bills, travel, and more — add your own for anything specific to you.
            </p>
            <form onSubmit={addCategory}>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Name</label>
                <input required placeholder="e.g. Gym Membership" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
              </div>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Type</label>
                <select value={catForm.type} onChange={(e) => setCatForm({ ...catForm, type: e.target.value })}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Icon (emoji)</label>
                <input value={catForm.icon} onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })} />
              </div>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>Colour</label>
                <input type="color" value={catForm.color} onChange={(e) => setCatForm({ ...catForm, color: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Add category</button>
            </form>
          </div>

          <div className="card">
            <div className="section-title">Backups</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
              A full backup runs automatically once a week and lands in the <code>backups/</code> folder next to your
              <code> docker-compose.yml</code> on your laptop. You can also trigger one manually, or restore from any backup file.
            </p>
            <button className="btn btn-primary" onClick={runBackupNow} disabled={backupBusy} style={{ marginBottom: 14 }}>
              {backupBusy ? 'Working…' : '💾 Backup now'}
            </button>
            {backupMsg && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 14 }}>{backupMsg}</div>}

            {backups.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-soft)', marginBottom: 8 }}>Recent backups</div>
                {backups.slice(0, 5).map((b) => (
                  <div key={b.filename} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid var(--hairline)' }}>
                    <span>{new Date(b.created_at).toLocaleString('en-IN')}</span>
                    <a href={`/api/backup/download/${b.filename}`} target="_blank" rel="noreferrer">Download</a>
                  </div>
                ))}
              </div>
            )}

            <div style={{ paddingTop: 14, borderTop: '1px dashed var(--hairline)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--rust)', marginBottom: 8 }}>Restore (destructive)</div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 0 }}>
                Uploading a backup file replaces everything currently in the app with that backup's contents.
              </p>
              <input ref={fileInputRef} type="file" accept="application/json" onChange={restoreFromFile} disabled={backupBusy} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
