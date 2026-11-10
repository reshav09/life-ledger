import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatMoney } from '../api.js';
import { useTheme } from '../ThemeContext.jsx';
import { useDialog } from '../components/DialogProvider.jsx';
import BackupSection from '../components/BackupSection.jsx';

const emptyCatForm = { name: '', type: 'expense', icon: '💸', color: '#8B8578' };
const emptyReminderForm = { name: '', amount: '', category_id: '', due_day: '1', remind_days_before: '3' };

export default function SettingsPage() {
  const { confirm } = useDialog();
  const { theme, toggleTheme } = useTheme();

  // Money settings state
  const [settings, setSettings] = useState({
    reserve_cap: '0',
    currency_symbol: '₹',
    salary_day: '7',
    salary_weekend_shift: 'previous_business_day',
    pay_cycle_mode: 'salary'
  });
  const [reserveInput, setReserveInput] = useState('0');
  const [salaryDayInput, setSalaryDayInput] = useState('7');
  const [salaryWeekendShift, setSalaryWeekendShift] = useState('previous_business_day');
  const [payCycleMode, setPayCycleMode] = useState('salary');
  const [categories, setCategories] = useState([]);
  const [catForm, setCatForm] = useState(emptyCatForm);
  const [showCatForm, setShowCatForm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [salarySaved, setSalarySaved] = useState(false);

  const [reminders, setReminders] = useState([]);
  const [reminderForm, setReminderForm] = useState(emptyReminderForm);
  const [showReminderForm, setShowReminderForm] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [s, c, r] = await Promise.all([
        api.get('/settings'),
        api.get('/categories'),
        api.get('/reminders')
      ]);
      setSettings(s);
      setReserveInput(s.reserve_cap || '0');
      setSalaryDayInput(s.salary_day || '7');
      setSalaryWeekendShift(s.salary_weekend_shift || 'previous_business_day');
      setPayCycleMode(s.pay_cycle_mode || 'salary');
      setCategories(c);
      setReminders(r);
      if (c.length) {
        setReminderForm((f) => ({ ...f, category_id: c.find((cat) => cat.type === 'expense')?.id || '' }));
      }
    } catch (err) {
      console.error('Failed to load money settings:', err);
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
    setShowCatForm(false);
    load();
  }

  async function removeCategory(id) {
    const ok = await confirm('Remove this category? Only custom (non-default) categories can be removed.', { ledger: 'money', danger: true });
    if (!ok) return;
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
    const ok = await confirm('Remove this bill reminder?', { ledger: 'money', danger: true });
    if (!ok) return;
    await api.del(`/reminders/${id}`);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Your rules, enforced everywhere</div>
        <h1 className="page-title">Money Settings</h1>
        <p className="page-sub">Set the money you never want to touch, manage categories, bill reminders, appearance, and backups.</p>
      </div>

      <div className="two-col" style={{ gridTemplateColumns: '1.08fr 1fr' }}>
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

          {/* Reserve cap card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Reserve cap</div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 0 }}>
              This amount is subtracted from your total balance everywhere in the app — the Dashboard, the daily
              safe-spend number, and the Planner&apos;s affordability check. It&apos;s the money you&apos;ve decided not to touch,
              no matter what.
            </p>
            <form onSubmit={saveReserve}>
              <div className="field" style={{ maxWidth: 260, marginBottom: 14 }}>
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

          {/* Salary & Pay Cycle card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Salary & Pay Cycle</div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 0 }}>
              Tailor your daily &quot;Safe to spend&quot; budget around your actual salary arrival date instead of arbitrary calendar month boundaries.
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

        </div>

        {/* Right column */}
        <div>
          {/* Categories Management Card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">
              Categories Management
              <button className="btn btn-sm" onClick={() => setShowCatForm(!showCatForm)}>
                {showCatForm ? 'Cancel' : '+ Add category'}
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0, marginBottom: 12 }}>
              Default categories and custom labels used to organize your transactions, budgets, and spending charts.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: showCatForm ? 14 : 0 }}>
              {categories.map((c) => (
                <div key={c.id} className="badge" style={{ background: (c.color || '#ddd') + '22', color: c.color, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 9px' }}>
                  {c.icon} {c.name}
                  {!c.is_default && (
                    <button className="icon-btn" style={{ padding: '0 2px', marginLeft: 2 }} title="Delete custom category" onClick={() => removeCategory(c.id)}>✕</button>
                  )}
                </div>
              ))}
            </div>

            {showCatForm && (
              <form onSubmit={addCategory} style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--hairline)' }}>
                <div className="form-grid" style={{ marginBottom: 12 }}>
                  <div className="field">
                    <label>Category Name</label>
                    <input required placeholder="e.g. Gym, Streaming, Freelance" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Category Type</label>
                    <select value={catForm.type} onChange={(e) => setCatForm({ ...catForm, type: e.target.value })}>
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                  </div>
                </div>
                <div className="form-grid" style={{ marginBottom: 14 }}>
                  <div className="field">
                    <label>Icon (emoji)</label>
                    <input value={catForm.icon} onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Colour Tag</label>
                    <input type="color" value={catForm.color} onChange={(e) => setCatForm({ ...catForm, color: e.target.value })} style={{ width: '100%', height: 38 }} />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  Add category
                </button>
              </form>
            )}
          </div>

          {/* Bill reminders card */}
          <div className="card">
            <div className="section-title">
              Bill reminders
              <button className="btn btn-sm" onClick={() => setShowReminderForm(!showReminderForm)}>
                {showReminderForm ? 'Cancel' : '+ New reminder'}
              </button>
            </div>
            {reminders.length === 0 && !showReminderForm ? (
              <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                No reminders yet — add rent, electricity, or any recurring bill by its due day of the month.
              </div>
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
                <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }}>Save reminder</button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Full-width Database Backups & Restore Section */}
      <BackupSection
        ledger="money"
        title="Database Backups & Restore"
        description="A full backup runs automatically once a week and lands in the backups/ folder next to your docker-compose.yml on your laptop. You can also trigger one manually, or restore from any backup file."
      />
    </div>
  );
}
