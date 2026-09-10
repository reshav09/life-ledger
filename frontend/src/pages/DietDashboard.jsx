import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, todayISO } from '../api.js';
import FormattedAIContent from '../components/FormattedAIContent.jsx';
import WaterTrackerModal from '../components/WaterTrackerModal.jsx';
import { useDialog } from '../components/DialogProvider.jsx';

const MEAL_ICONS = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍪',
  drink: '🥤',
  supplement: '💊',
  other: '🍽️'
};

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'drink', 'supplement', 'other'];

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateLabel(dateStr) {
  const today = todayISO();
  if (dateStr === today) return 'Today';
  if (dateStr === shiftDate(today, -1)) return 'Yesterday';
  if (dateStr === shiftDate(today, 1)) return 'Tomorrow';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmt1(n) {
  return Number(n || 0).toFixed(1);
}

function pct(consumed, target) {
  if (!target) return 0;
  return Math.min(Math.round((consumed / target) * 100), 100);
}

function toNumOrNull(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

function NutrientBar({ label, consumed, target, unit, color }) {
  const percent = pct(consumed, target);
  const isOver = consumed > target;
  return (
    <div className="nutrient-bar-wrap">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="stat-label" style={{ margin: 0 }}>{label}</span>
        <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: isOver ? 'var(--rust)' : 'var(--ink)' }}>
          {fmt1(consumed)} / {target} {unit}
        </span>
      </div>
      <div className="progress-track">
        <div
          className={`progress-fill ${isOver ? 'over' : ''}`}
          style={{ width: `${percent}%`, background: isOver ? 'var(--rust)' : color || 'var(--green)', transition: 'width 0.6s ease' }}
        />
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>
        {isOver ? `${fmt1(consumed - target)} ${unit} over` : `${fmt1(target - consumed)} ${unit} remaining`}
      </div>
    </div>
  );
}

export default function DietDashboard() {
  const { confirm, alert } = useDialog();
  const [date, setDate] = useState(todayISO());
  const [summary, setSummary] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [insight, setInsight] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [waterModalOpen, setWaterModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({
    meal_type: 'other',
    description: '',
    calories: '',
    protein_g: '',
    carbs_g: '',
    fat_g: '',
    fiber_g: '',
    serving_note: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    load();
  }, [date]);

  // Re-fetch data when Quick Log saves without resetting date
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('quick-log-saved', handler);
    return () => window.removeEventListener('quick-log-saved', handler);
  }, [date]);

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [s, sched] = await Promise.all([
        api.get(`/diet/dashboard/summary?date=${date}`).catch(() => null),
        api.get(`/routine/today?date=${date}`).catch(() => [])
      ]);
      setSummary(s);
      setSchedule(sched || []);
    } catch (err) {
      console.error('Failed to load dashboard summary:', err);
    } finally {
      setLoading(false);
    }
  }

  function showFeedback(msg) {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  }

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const [daily, sugg] = await Promise.all([
        api.post('/ai/insights/generate', { kind: 'daily_analysis', date }),
        api.post('/ai/insights/generate', { kind: 'suggestion', date })
      ]);
      setInsight(daily);
      setSuggestions(sugg);
    } catch (e) {
      setInsight({ content: `Could not analyze right now: ${e.message}` });
    } finally {
      setAnalyzing(false);
    }
  }

  function openEditModal(item) {
    setEditingItem(item);
    setEditForm({
      meal_type: item.meal_type || 'other',
      description: item.description || '',
      calories: item.calories != null ? String(item.calories) : '',
      protein_g: item.protein_g != null ? String(item.protein_g) : '',
      carbs_g: item.carbs_g != null ? String(item.carbs_g) : '',
      fat_g: item.fat_g != null ? String(item.fat_g) : '',
      fiber_g: item.fiber_g != null ? String(item.fiber_g) : '',
      serving_note: item.serving_note || ''
    });
    setErrorMsg(null);
  }

  function closeEditModal() {
    setEditingItem(null);
    setErrorMsg(null);
  }

  async function saveEditedFood(e) {
    e.preventDefault();
    if (!editingItem) return;
    if (!editForm.description.trim()) {
      setErrorMsg('Meal description is required.');
      return;
    }

    setSavingEdit(true);
    setErrorMsg(null);
    try {
      await api.put(`/diet/food/${editingItem.id}`, {
        meal_type: editForm.meal_type || 'other',
        description: editForm.description.trim(),
        calories: toNumOrNull(editForm.calories),
        protein_g: toNumOrNull(editForm.protein_g),
        carbs_g: toNumOrNull(editForm.carbs_g),
        fat_g: toNumOrNull(editForm.fat_g),
        fiber_g: toNumOrNull(editForm.fiber_g),
        serving_note: (editForm.serving_note || '').trim(),
        data_source: editingItem.data_source || 'user_confirmed',
        entry_date: date
      });
      showFeedback('✨ Meal updated successfully!');
      closeEditModal();
      await load();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update food entry.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteFood(id) {
    if (!await confirm('Delete this food entry?', { ledger: 'food', danger: true })) return;
    try {
      await api.del(`/diet/food/${id}`);
      showFeedback('Entry deleted.');
      load();
    } catch (err) {
      await alert(`Failed to delete: ${err.message}`, { ledger: 'food' });
    }
  }

  if (loading && !summary) return <div className="empty-state">Loading your dashboard…</div>;
  if (!summary) return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Food, fitness &amp; health intelligence</div>
        <h1 className="page-title">Diet &amp; Health</h1>
      </div>
      <div className="card">
        <div className="empty-state">
          <div style={{ fontSize: 32, marginBottom: 10 }}>🥗</div>
          <div>Welcome to Diet &amp; Health! Set up your <Link to="/health" style={{ color: 'var(--green)' }}>Health Profile</Link> first, then start logging meals.</div>
        </div>
      </div>
    </div>
  );

  const t = summary.today_totals || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
  const targets = summary.targets;
  const goalLabel = summary.current_goal ? summary.current_goal.goal_type.replace(/_/g, ' ') : 'Not set';
  const entries = summary.today_entries || [];

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Food, fitness &amp; health intelligence</div>
        <h1 className="page-title">Diet &amp; Health</h1>
        <p className="page-sub">A decision-support view of your daily eating, weight, routine, and targets across any date.</p>
      </div>

      {/* ---- Date Navigator ---- */}
      <div className="date-navigator" style={{ marginBottom: 20 }}>
        <button className="btn btn-sm date-nav-btn" onClick={() => setDate(shiftDate(date, -1))} title="Previous day">
          ← Prev Day
        </button>
        <div className="date-nav-center">
          <span className="date-nav-label" style={{ fontWeight: 700 }}>{formatDateLabel(date)}</span>
          <input type="date" className="date-nav-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button className="btn btn-sm date-nav-btn" onClick={() => setDate(shiftDate(date, 1))} title="Next day">
          Next Day →
        </button>
        {date !== todayISO() && (
          <button className="btn btn-sm btn-primary" onClick={() => setDate(todayISO())} style={{ marginLeft: 6, padding: '4px 12px' }}>
            Today
          </button>
        )}
      </div>

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--green-soft)', color: 'var(--green)', fontSize: 13.5, fontWeight: 600, marginBottom: 16 }}>
          {feedbackMsg}
        </div>
      )}

      {/* ---- Top Stats ---- */}
      <div className="card-grid">
        <div className="stat-card stat-card-accent" style={{ '--accent': 'var(--green)' }}>
          <div className="stat-label">Current weight</div>
          <div className="stat-value">{summary.current_weight != null ? `${fmt1(summary.current_weight)} kg` : '—'}</div>
          <div className="stat-note">{summary.current_weight == null ? <Link to="/health" style={{ color: 'var(--green)', textDecoration: 'none' }}>Log weight →</Link> : 'Most recent value'}</div>
        </div>
        <div className="stat-card stat-card-accent" style={{ '--accent': 'var(--brass)' }}>
          <div className="stat-label">Current goal</div>
          <div className="stat-value" style={{ fontSize: 18, textTransform: 'capitalize' }}>{goalLabel}</div>
          <div className="stat-note">{!summary.current_goal && <Link to="/health" style={{ color: 'var(--brass)', textDecoration: 'none' }}>Set a goal →</Link>}</div>
        </div>
        <div className="stat-card stat-card-accent" style={{ '--accent': '#5B7FBA' }}>
          <div className="stat-label">Weekly avg protein</div>
          <div className="stat-value">{summary.weekly_average ? `${summary.weekly_average.avg_protein_g}g` : '—'}</div>
          <div className="stat-note">{summary.weekly_average ? `${summary.weekly_average.days_logged} day(s) logged` : 'Log meals to see 7-day average'}</div>
        </div>
      </div>

      {/* ---- Quick Actions ---- */}
      <div style={{ display: 'flex', gap: 10, margin: '20px 0', flexWrap: 'wrap' }}>
        <Link to="/food" className="btn btn-primary" style={{ textDecoration: 'none' }}>🍽️ Log Food</Link>
        <button type="button" className="btn" onClick={() => setWaterModalOpen(true)}>💧 Water</button>
        <Link to="/health" className="btn" style={{ textDecoration: 'none' }}>⚖️ Log weight</Link>
        <Link to="/ai" className="btn" style={{ textDecoration: 'none' }}>🤖 AI Chat</Link>
      </div>

      {/* ---- Nutrition Bars ---- */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title">
          Nutrition for {formatDateLabel(date)}
        </div>
        {!targets.ok ? (
          <div className="empty-state">
            Missing profile data for targets: {targets.missing.join(', ')}.<br/>
            <Link to="/health" style={{ color: 'var(--green)' }}>Fill these in on the Health Profile page →</Link>
          </div>
        ) : (
          <div className="card-grid" style={{ marginBottom: 0 }}>
            <NutrientBar label="Calories" consumed={t.calories} target={targets.targets.calorie_target} unit="kcal" color="var(--green)" />
            <NutrientBar label="Protein" consumed={t.protein_g} target={targets.targets.protein_target} unit="g" color="#5B7FBA" />
            <NutrientBar label="Carbs" consumed={t.carbs_g} target={targets.targets.carb_target} unit="g" color="var(--brass)" />
            <NutrientBar label="Fat" consumed={t.fat_g} target={targets.targets.fat_target} unit="g" color="#D97757" />
            <NutrientBar label="Fiber" consumed={t.fiber_g} target={targets.targets.fiber_target} unit="g" color="#7A6FB0" />
            <NutrientBar label="Water" consumed={summary.water_ml / 1000} target={(targets.targets.water_target_ml || 2500) / 1000} unit="L" color="#4FA97A" />
          </div>
        )}
      </div>

      {/* ---- Logged Meals ---- */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title">
          🍽️ Meals Logged ({entries.length})
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-faint)', marginLeft: 8 }}>
            {formatDateLabel(date)}
          </span>
        </div>

        {entries.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            <span style={{ fontSize: 24, display: 'block', marginBottom: 6 }}>🥗</span>
            No meals logged for {formatDateLabel(date).toLowerCase()}.
            <div style={{ marginTop: 10 }}>
              <Link to="/food" className="btn btn-sm btn-primary" style={{ textDecoration: 'none' }}>
                + Log Food
              </Link>
            </div>
          </div>
        ) : (
          <div className="ledger">
            {entries.map((item) => (
              <div className="ledger-row" key={item.id} style={{ alignItems: 'center' }}>
                <div className="ledger-icon">{MEAL_ICONS[item.meal_type] || '🍽️'}</div>
                <div className="ledger-desc">
                  <div className="ledger-title">
                    <span style={{ textTransform: 'capitalize', fontWeight: 600, color: 'var(--ink-soft)', marginRight: 6, fontSize: 12 }}>
                      [{item.meal_type}]
                    </span>
                    <strong>{item.description}</strong>
                    {item.serving_note && (
                      <span style={{ fontSize: 12, color: 'var(--ink-faint)', marginLeft: 6 }}>({item.serving_note})</span>
                    )}
                    {item.data_source === 'ai_estimated' && (
                      <span className="badge brass" style={{ marginLeft: 8, fontSize: 10.5 }}>AI estimate</span>
                    )}
                  </div>
                  <div className="ledger-meta" style={{ marginTop: 2 }}>
                    <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
                      {item.calories != null ? `${item.calories} kcal` : 'no cals'}
                    </span>
                    {' · '}
                    <span style={{ color: 'var(--green)', fontWeight: 600 }}>P {item.protein_g != null ? `${item.protein_g}g` : '–'}</span>
                    {' · '}C {item.carbs_g != null ? `${item.carbs_g}g` : '–'}
                    {' · '}F {item.fat_g != null ? `${item.fat_g}g` : '–'}
                    {item.fiber_g != null && ` · Fiber ${item.fiber_g}g`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button type="button" className="btn btn-sm" onClick={() => openEditModal(item)}
                    style={{ padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    title="Edit meal">
                    ✏️ Edit
                  </button>
                  <button type="button" className="icon-btn" onClick={() => deleteFood(item.id)} title="Delete" style={{ fontSize: 13, color: 'var(--rust)' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Two Columns: Schedule & AI + Goals ---- */}
      <div className="two-col">
        <div>
          {schedule.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="section-title">Schedule ({formatDateLabel(date)})</div>
              <div className="ledger">
                {schedule.slice(0, 8).map((s, i) => (
                  <div className="ledger-row" key={i}>
                    <div className="ledger-icon">{s.icon || '📌'}</div>
                    <div className="ledger-desc">
                      <div className="ledger-title">{s.activity_name}</div>
                      <div className="ledger-meta">{s.start_time} – {s.end_time}{s.notes ? ` · ${s.notes}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
              {schedule.length > 8 && <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 6 }}>+ {schedule.length - 8} more…</div>}
            </div>
          )}

          <div className="card">
            <div className="section-title">
              AI Analysis
              <button className="btn btn-sm btn-primary" onClick={runAnalysis} disabled={analyzing}>
                {analyzing ? 'Analyzing…' : `✨ Analyze ${formatDateLabel(date)}`}
              </button>
            </div>
            {analyzing && (
              <div style={{ padding: '16px 0' }}>
                <div className="ai-typing-box" style={{ width: '100%' }}>
                  <span style={{ fontSize: 14 }}>🤖</span>
                  <span>Synthesizing {formatDateLabel(date)} nutrition, routine &amp; finance context</span>
                  <div className="ai-typing-dots">
                    <span className="ai-typing-dot" />
                    <span className="ai-typing-dot" />
                    <span className="ai-typing-dot" />
                  </div>
                </div>
              </div>
            )}
            {!analyzing && !insight && (
              <div className="empty-state">Click "Analyze {formatDateLabel(date)}" for a breakdown against your targets.</div>
            )}
            {!analyzing && insight && (
              <>
                <div style={{ marginTop: 6, marginBottom: 12 }}>
                  <FormattedAIContent content={insight.content} />
                </div>
                {insight.source && (
                  <div className="badge" style={{ background: insight.source === 'ai' ? 'var(--green-soft)' : 'var(--brass-soft)', color: insight.source === 'ai' ? 'var(--green)' : 'var(--brass)' }}>
                    {insight.source === 'ai' ? `AI-generated (${insight.provider_used})` : 'Rule-based analysis'}
                  </div>
                )}
                {suggestions && suggestions.content && (
                  <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px dashed var(--hairline)' }}>
                    <div className="stat-label" style={{ marginBottom: 10 }}>Actionable Suggestions</div>
                    <FormattedAIContent content={suggestions.content} />
                  </div>
                )}
              </>
            )}
            <div style={{ marginTop: 16 }}>
              <Link to="/ai" className="btn btn-sm">Open full AI Analyzer →</Link>
            </div>
          </div>
        </div>

        <div>
          {summary.current_weight != null && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="section-title">Weight</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{fmt1(summary.current_weight)}</span>
                <span style={{ color: 'var(--ink-soft)' }}>kg</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 4 }}>
                View full history on <Link to="/health" style={{ color: 'var(--green)' }}>Health Profile</Link>
              </div>
            </div>
          )}

          {summary.weekly_average && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="section-title">This Week</div>
              <div style={{ fontSize: 13.5 }}>
                <div style={{ marginBottom: 6 }}>
                  <span className="stat-label" style={{ margin: 0 }}>Avg. calories</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{summary.weekly_average.avg_calories} kcal/day</div>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <span className="stat-label" style={{ margin: 0 }}>Avg. protein</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{summary.weekly_average.avg_protein_g}g/day</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                  Based on {summary.weekly_average.days_logged} day(s) logged in the last 7 days
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="section-title">Goal</div>
            <div style={{ fontSize: 16, fontWeight: 600, textTransform: 'capitalize', marginBottom: 6 }}>{goalLabel}</div>
            <Link to="/health" className="btn btn-sm" style={{ textDecoration: 'none' }}>Change goal</Link>
          </div>
        </div>
      </div>

      {/* ---- Water Tracker Modal ---- */}
      <WaterTrackerModal
        isOpen={waterModalOpen}
        onClose={() => setWaterModalOpen(false)}
        date={date}
        waterMl={summary.water_ml || 0}
        waterLogs={summary.water_logs || []}
        targetMl={targets?.targets?.water_target_ml || 2500}
        onUpdated={load}
      />

      {/* ---- Edit Food Modal ---- */}
      {editingItem && (
        <div className="quick-dump-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) closeEditModal(); }}>
          <div className="quick-dump-modal-card" style={{ maxWidth: 540 }}>
            <div className="quick-dump-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>✏️</span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Edit Meal Entry</h3>
              </div>
              <button type="button" onClick={closeEditModal} style={{ background: 'transparent', border: 'none', color: 'var(--ink-soft)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={saveEditedFood} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {errorMsg && (
                <div style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--rust-soft)', color: 'var(--rust)', fontSize: 12.5 }}>⚠️ {errorMsg}</div>
              )}
              <div>
                <label className="stat-label" style={{ marginBottom: 6, display: 'block' }}>Meal Type</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {MEAL_TYPES.map((mt) => (
                    <button type="button" key={mt} className="badge"
                      onClick={() => setEditForm({ ...editForm, meal_type: mt })}
                      style={{
                        background: editForm.meal_type === mt ? 'var(--green)' : 'var(--green-soft)',
                        color: editForm.meal_type === mt ? '#fff' : 'var(--green)',
                        border: 'none', cursor: 'pointer', textTransform: 'capitalize', padding: '4px 10px', fontSize: 11.5
                      }}>
                      {MEAL_ICONS[mt]} {mt}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Food Description *</label>
                <input required placeholder="e.g. 2 eggs and toast" value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div className="form-grid" style={{ marginBottom: 0 }}>
                {[['Calories (kcal)', 'calories'], ['Protein (g)', 'protein_g'], ['Carbs (g)', 'carbs_g'], ['Fat (g)', 'fat_g'], ['Fiber (g)', 'fiber_g']].map(([lbl, key]) => (
                  <div className="field" key={key}>
                    <label>{lbl}</label>
                    <input type="number" step="any" min="0" placeholder={key === 'calories' ? 'kcal' : 'g'}
                      value={editForm[key]} onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })} />
                  </div>
                ))}
                <div className="field">
                  <label>Serving Note</label>
                  <input placeholder="optional" value={editForm.serving_note}
                    onChange={(e) => setEditForm({ ...editForm, serving_note: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn" onClick={closeEditModal} disabled={savingEdit}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? 'Saving…' : '✓ Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
