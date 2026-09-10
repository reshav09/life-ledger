import { useEffect, useState, useRef } from 'react';
import { api, todayISO } from '../api.js';
import WaterTrackerModal from '../components/WaterTrackerModal.jsx';
import { useDialog } from '../components/DialogProvider.jsx';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'drink', 'supplement', 'other'];
const MEAL_ICONS = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍪', drink: '🥤', supplement: '💊', other: '🍽️' };

const QUICK_PRESETS = [
  { label: '2 Boiled Eggs', meal_type: 'breakfast', description: '2 whole boiled eggs', calories: '140', protein_g: '12', carbs_g: '1.2', fat_g: '10', fiber_g: '0' },
  { label: 'Whey Scoop', meal_type: 'supplement', description: '1 scoop whey protein (30g)', calories: '120', protein_g: '24', carbs_g: '2', fat_g: '1.5', fiber_g: '0' },
  { label: 'Paneer 100g', meal_type: 'lunch', description: '100g raw / cooked paneer', calories: '265', protein_g: '18', carbs_g: '3', fat_g: '20', fiber_g: '0' },
  { label: 'Chicken Breast 150g', meal_type: 'lunch', description: '150g grilled chicken breast', calories: '240', protein_g: '46', carbs_g: '0', fat_g: '5', fiber_g: '0' },
  { label: '2 Roti + Dal', meal_type: 'dinner', description: '2 whole wheat rotis with 1 bowl dal', calories: '320', protein_g: '12', carbs_g: '52', fat_g: '6', fiber_g: '7' },
  { label: 'Rice Bowl + Dal', meal_type: 'lunch', description: '1 bowl steamed rice with dal', calories: '380', protein_g: '11', carbs_g: '68', fat_g: '5', fiber_g: '5' },
  { label: 'Oats & Banana', meal_type: 'breakfast', description: 'Oatmeal with milk & sliced banana', calories: '350', protein_g: '13', carbs_g: '60', fat_g: '6', fiber_g: '6' },
  { label: 'Almonds (30g)', meal_type: 'snack', description: 'Handful raw almonds (approx. 20-25)', calories: '175', protein_g: '6', carbs_g: '6', fat_g: '15', fiber_g: '3.5' },
];

const emptyForm = { meal_type: 'breakfast', description: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '', serving_note: '' };

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

function fmt1(n) { return Number(n || 0).toFixed(1); }

function toNumOrNull(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

export default function FoodLog() {
  const { confirm } = useDialog();
  const [date, setDate] = useState(todayISO());
  const [entries, setEntries] = useState([]);
  const [waterData, setWaterData] = useState({ logs: [], total_ml: 0 });
  const [waterModalOpen, setWaterModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [estimateNote, setEstimateNote] = useState('');
  const [isAiEstimated, setIsAiEstimated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const photoInputRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => { load(); }, [date]);

  // Re-fetch data when Quick Log saves without resetting date
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('quick-log-saved', handler);
    return () => window.removeEventListener('quick-log-saved', handler);
  }, [date]);

  async function load() {
    setLoading(true);
    try {
      const [rows, waterRes] = await Promise.all([
        api.get(`/diet/food?date=${date}`).catch(() => []),
        api.get(`/diet/water?date=${date}`).catch(() => ({ logs: [], total_ml: 0 }))
      ]);
      setEntries(rows || []);
      setWaterData(waterRes || { logs: [], total_ml: 0 });
    } catch (err) {
      console.error('Failed to load food/water entries:', err);
    } finally {
      setLoading(false);
    }
  }

  function showSuccess(msg) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  function applyPreset(preset) {
    setForm({
      meal_type: preset.meal_type,
      description: preset.description,
      calories: preset.calories,
      protein_g: preset.protein_g,
      carbs_g: preset.carbs_g,
      fat_g: preset.fat_g,
      fiber_g: preset.fiber_g,
      serving_note: preset.serving_note || ''
    });
    setEstimateNote(`Preset loaded: ${preset.label}`);
    setIsAiEstimated(false);
    setErrorMsg(null);
  }

  function startEdit(item) {
    setEditId(item.id);
    setForm({
      meal_type: item.meal_type || 'other',
      description: item.description || '',
      calories: item.calories != null ? String(item.calories) : '',
      protein_g: item.protein_g != null ? String(item.protein_g) : '',
      carbs_g: item.carbs_g != null ? String(item.carbs_g) : '',
      fat_g: item.fat_g != null ? String(item.fat_g) : '',
      fiber_g: item.fiber_g != null ? String(item.fiber_g) : '',
      serving_note: item.serving_note || ''
    });
    setIsAiEstimated(item.data_source === 'ai_estimated');
    setEstimateNote('');
    setErrorMsg(null);
    if (formRef.current) formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEdit() {
    setEditId(null);
    setForm(emptyForm);
    setIsAiEstimated(false);
    setEstimateNote('');
    setErrorMsg(null);
  }

  async function estimateNutrition() {
    if (!form.description.trim()) {
      setErrorMsg('Enter a meal description first, e.g. "2 rotis and paneer bhurji"');
      return;
    }
    setEstimating(true);
    setErrorMsg(null);
    try {
      const res = await api.post('/ai/estimate-food', { description: form.description });
      if (res && res.reply && !res.unavailable) {
        // The AI returns raw JSON text — parse it
        let macros;
        try {
          const cleaned = res.reply.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
          macros = JSON.parse(cleaned);
        } catch (parseErr) {
          setErrorMsg('AI returned an unexpected format. You can enter values manually.');
          return;
        }
        setForm((prev) => ({
          ...prev,
          calories: macros.calories != null ? String(macros.calories) : prev.calories,
          protein_g: macros.protein_g != null ? String(macros.protein_g) : prev.protein_g,
          carbs_g: macros.carbs_g != null ? String(macros.carbs_g) : prev.carbs_g,
          fat_g: macros.fat_g != null ? String(macros.fat_g) : prev.fat_g,
          fiber_g: macros.fiber_g != null ? String(macros.fiber_g) : prev.fiber_g,
        }));
        setIsAiEstimated(true);
        setEstimateNote(`AI estimated via ${res.provider_used || 'AI'}. Review and adjust if needed.`);
        showSuccess('✨ Nutrition estimated! Review and save.');
      } else if (res && res.unavailable) {
        setErrorMsg('No AI provider configured. Go to Settings to set one up, or enter values manually.');
      }
    } catch (err) {
      setErrorMsg(`AI estimate failed: ${err.message}. You can enter values manually.`);
    } finally {
      setEstimating(false);
    }
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEstimating(true);
    setErrorMsg(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1];
        try {
          const res = await api.post('/ai/diet/photo', { photo_base64: base64Data, mime_type: file.type || 'image/jpeg' });
          if (res && res.description) {
            setForm((prev) => ({
              ...prev,
              description: res.description,
              calories: res.macros?.calories != null ? String(res.macros.calories) : '',
              protein_g: res.macros?.protein_g != null ? String(res.macros.protein_g) : '',
              carbs_g: res.macros?.carbs_g != null ? String(res.macros.carbs_g) : '',
              fat_g: res.macros?.fat_g != null ? String(res.macros.fat_g) : '',
              fiber_g: res.macros?.fiber_g != null ? String(res.macros.fiber_g) : '',
              serving_note: res.serving_note || ''
            }));
            setIsAiEstimated(true);
            setEstimateNote(`Photo recognized: ${res.description}. Review & save.`);
            showSuccess('📸 Photo analyzed!');
          }
        } catch (err) {
          setErrorMsg(`Photo analysis failed: ${err.message}`);
        } finally {
          setEstimating(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setErrorMsg(`Failed to read file: ${err.message}`);
      setEstimating(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.description.trim()) {
      setErrorMsg('Description is required.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload = {
        meal_type: form.meal_type,
        description: form.description.trim(),
        calories: toNumOrNull(form.calories),
        protein_g: toNumOrNull(form.protein_g),
        carbs_g: toNumOrNull(form.carbs_g),
        fat_g: toNumOrNull(form.fat_g),
        fiber_g: toNumOrNull(form.fiber_g),
        serving_note: form.serving_note.trim(),
        data_source: isAiEstimated ? 'ai_estimated' : 'user_confirmed',
        entry_date: date
      };
      if (editId) {
        await api.put(`/diet/food/${editId}`, payload);
        showSuccess('✨ Entry updated successfully!');
        cancelEdit();
      } else {
        await api.post('/diet/food', payload);
        showSuccess('✨ Meal logged!');
        setForm(emptyForm);
        setIsAiEstimated(false);
        setEstimateNote('');
      }
      load();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save entry.');
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(id) {
    if (!await confirm('Delete this entry?', { ledger: 'food', danger: true })) return;
    try {
      await api.del(`/diet/food/${id}`);
      if (editId === id) cancelEdit();
      showSuccess('Entry deleted.');
      load();
    } catch (err) {
      setErrorMsg(`Failed to delete: ${err.message}`);
    }
  }

  // Compute totals
  const totals = entries.reduce(
    (acc, r) => ({
      calories: acc.calories + Number(r.calories || 0),
      protein_g: acc.protein_g + Number(r.protein_g || 0),
      carbs_g: acc.carbs_g + Number(r.carbs_g || 0),
      fat_g: acc.fat_g + Number(r.fat_g || 0),
      fiber_g: acc.fiber_g + Number(r.fiber_g || 0)
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
  );

  const groupedByMeal = MEAL_TYPES.map((mt) => ({ mt, items: entries.filter((e) => e.meal_type === mt) }));

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">What did you eat today?</div>
        <h1 className="page-title">Food Log</h1>
        <p className="page-sub">Describe meals in plain words, get AI estimates, or pick a preset.</p>
      </div>

      {/* ---- Date Navigator ---- */}
      <div className="date-navigator">
        <button className="btn btn-sm date-nav-btn" onClick={() => setDate(shiftDate(date, -1))} title="Previous day">← Prev</button>
        <div className="date-nav-center">
          <span className="date-nav-label">{formatDateLabel(date)}</span>
          <input type="date" className="date-nav-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button className="btn btn-sm date-nav-btn" onClick={() => setDate(shiftDate(date, 1))} title="Next day">Next →</button>
        {date !== todayISO() && (
          <button className="btn btn-sm btn-primary" onClick={() => setDate(todayISO())} style={{ marginLeft: 4 }}>Today</button>
        )}
      </div>

      {/* ---- Notifications ---- */}
      {errorMsg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--rust-soft)', color: 'var(--rust)', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>⚠️ {errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} style={{ background: 'transparent', border: 'none', color: 'var(--rust)', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}
      {successMsg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--green-soft)', color: 'var(--green)', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
          ✨ {successMsg}
        </div>
      )}

      {/* ---- Daily Totals (same card-grid style as everywhere else) ---- */}
      <div className="card-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card compact">
          <div className="stat-label">Calories</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{fmt1(totals.calories)} kcal</div>
        </div>
        <div className="stat-card compact">
          <div className="stat-label">Protein</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--green)' }}>{fmt1(totals.protein_g)}g</div>
        </div>
        <div className="stat-card compact">
          <div className="stat-label">Carbs</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{fmt1(totals.carbs_g)}g</div>
        </div>
        <div className="stat-card compact">
          <div className="stat-label">Fat</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{fmt1(totals.fat_g)}g</div>
        </div>
        <div className="stat-card compact">
          <div className="stat-label">Fiber</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{fmt1(totals.fiber_g)}g</div>
        </div>
        <div className="stat-card compact">
          <div className="stat-label">💧 Water</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{waterData.total_ml || 0} ml</div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setWaterModalOpen(true)}
            style={{ marginTop: 4, fontSize: 11, padding: '2px 8px' }}
          >
            Manage
          </button>
        </div>
      </div>

      {/* ---- Add / Edit Entry Form ---- */}
      <div className="card" ref={formRef} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="section-title" style={{ margin: 0 }}>
            {editId ? '✏️ Edit Meal Entry' : '🍽️ Add an Entry'}
          </div>
          {editId && (
            <button type="button" className="btn btn-sm" onClick={cancelEdit}>✕ Cancel edit</button>
          )}
        </div>

        {/* Quick Presets */}
        {!editId && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              ⚡ 1-Tap Common Presets:
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {QUICK_PRESETS.map((p) => (
                <button type="button" key={p.label} className="badge" onClick={() => applyPreset(p)}
                  style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', cursor: 'pointer', padding: '4px 10px', fontSize: 12, color: 'var(--ink)' }}
                  title={`${p.description} (${p.calories} kcal, ${p.protein_g}g P)`}>
                  {MEAL_ICONS[p.meal_type] || '🍽️'} {p.label} <span style={{ color: 'var(--green)', marginLeft: 3 }}>({p.protein_g}g P)</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Meal Type */}
          <div style={{ marginBottom: 12 }}>
            <label className="stat-label" style={{ marginBottom: 6, display: 'block' }}>Meal type</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {MEAL_TYPES.map((mt) => (
                <button type="button" key={mt} className="badge"
                  onClick={() => setForm({ ...form, meal_type: mt })}
                  style={{
                    background: form.meal_type === mt ? 'var(--green)' : 'var(--green-soft)',
                    color: form.meal_type === mt ? '#fff' : 'var(--green)',
                    border: 'none', cursor: 'pointer', textTransform: 'capitalize', padding: '5px 12px', fontSize: 12
                  }}>
                  {MEAL_ICONS[mt]} {mt}
                </button>
              ))}
            </div>
          </div>

          {/* Description + AI */}
          <div className="field">
            <label>Meal description *</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <input required placeholder="e.g. 2 eggs, 1 slice toast, butter"
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ flex: 1 }} />
              <button type="button" className="btn btn-sm" onClick={estimateNutrition}
                disabled={estimating || !form.description.trim()} style={{ whiteSpace: 'nowrap' }}>
                {estimating ? 'Estimating…' : '✨ AI Estimate'}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => photoInputRef.current?.click()}
                disabled={estimating} style={{ whiteSpace: 'nowrap' }}>📸 Photo</button>
              <input type="file" accept="image/*" ref={photoInputRef} style={{ display: 'none' }} onChange={handlePhotoUpload} />
            </div>
            {estimateNote && (
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4, fontStyle: 'italic' }}>ℹ️ {estimateNote}</div>
            )}
          </div>

          {/* Macros */}
          <div className="form-grid" style={{ marginBottom: 12 }}>
            {[['Calories (kcal)', 'calories', 'kcal'], ['Protein (g)', 'protein_g', 'g'], ['Carbs (g)', 'carbs_g', 'g'], ['Fat (g)', 'fat_g', 'g'], ['Fiber (g)', 'fiber_g', 'g']].map(([lbl, key, ph]) => (
              <div className="field" key={key}>
                <label>{lbl}</label>
                <input type="number" step="any" min="0" placeholder={ph}
                  value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
            <div className="field">
              <label>Serving note</label>
              <input placeholder="optional (e.g. 1 bowl)" value={form.serving_note}
                onChange={(e) => setForm({ ...form, serving_note: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (editId ? 'Updating…' : 'Saving…') : (editId ? 'Save changes' : 'Save entry')}
            </button>
            {editId && <button type="button" className="btn" onClick={cancelEdit} disabled={saving}>Cancel</button>}
            {isAiEstimated && <span style={{ fontSize: 11.5, color: 'var(--brass)' }}>⭐ Marked as AI estimate</span>}
          </div>
        </form>
      </div>

      {/* ---- Grouped Entries List ---- */}
      {loading ? (
        <div className="empty-state">Loading meals…</div>
      ) : (
        groupedByMeal.filter((g) => g.items.length > 0).map((g) => (
          <div key={g.mt} style={{ marginBottom: 20 }}>
            <div className="section-title" style={{ textTransform: 'capitalize', fontSize: 15 }}>
              {MEAL_ICONS[g.mt]} {g.mt}
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-faint)', marginLeft: 8 }}>
                {g.items.length} item{g.items.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="ledger">
              {g.items.map((item) => (
                <div className="ledger-row" key={item.id}
                  style={{
                    borderLeft: editId === item.id ? '3px solid var(--green)' : undefined,
                    background: editId === item.id ? 'var(--paper-hover)' : undefined
                  }}>
                  <div className="ledger-icon">{MEAL_ICONS[item.meal_type] || '🍽️'}</div>
                  <div className="ledger-desc">
                    <div className="ledger-title">
                      {item.description}
                      {item.serving_note && <span style={{ fontSize: 12, color: 'var(--ink-faint)', marginLeft: 6 }}>({item.serving_note})</span>}
                      {item.data_source === 'ai_estimated' && <span className="badge brass" style={{ marginLeft: 8, fontSize: 10.5 }}>AI estimate</span>}
                    </div>
                    <div className="ledger-meta">
                      {item.calories != null ? `${item.calories} kcal` : 'no calories logged'} · P {item.protein_g != null ? `${item.protein_g}g` : '–'} · C {item.carbs_g != null ? `${item.carbs_g}g` : '–'} · F {item.fat_g != null ? `${item.fat_g}g` : '–'}{item.fiber_g != null ? ` · Fiber ${item.fiber_g}g` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <button type="button" className="btn btn-sm" onClick={() => startEdit(item)} title="Edit"
                      style={{ padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      ✏️ Edit
                    </button>
                    <button type="button" className="icon-btn" onClick={() => removeEntry(item.id)} title="Delete"
                      style={{ fontSize: 13, color: 'var(--rust)' }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {!loading && entries.length === 0 && (
        <div className="card empty-state">
          <div style={{ fontSize: 32, marginBottom: 8 }}>🍽️</div>
          Nothing logged for {formatDateLabel(date).toLowerCase()}. Use the form or 1-tap presets above!
        </div>
      )}

      {/* Water Tracker Modal */}
      <WaterTrackerModal
        isOpen={waterModalOpen}
        onClose={() => setWaterModalOpen(false)}
        date={date}
        waterMl={waterData.total_ml || 0}
        waterLogs={waterData.logs || []}
        targetMl={2500}
        onUpdated={load}
      />
    </div>
  );
}
