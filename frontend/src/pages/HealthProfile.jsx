import { useEffect, useRef, useState } from 'react';
import { api, todayISO } from '../api.js';
import { useDialog } from '../components/DialogProvider.jsx';

const GOAL_TYPES = ['weight_gain', 'weight_loss', 'maintenance', 'muscle_gain', 'general_fitness', 'improved_nutrition', 'gym_prep', 'strength_training'];
const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const GYM_STATUSES = ['not_started', 'starting_soon', 'active'];

const emptyMeasurement = { measurement_type: 'weight', value: '', unit: 'kg', reference_range: '', measurement_date: todayISO(), notes: '' };

export default function HealthProfile() {
  const { confirm, alert } = useDialog();
  const [profile, setProfile] = useState(null);
  const [goals, setGoals] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [reports, setReports] = useState([]);
  const [goalForm, setGoalForm] = useState({ goal_type: 'maintenance', notes: '' });
  const [measurementForm, setMeasurementForm] = useState(emptyMeasurement);
  const [reportDate, setReportDate] = useState(todayISO());
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const [p, g, m, r] = await Promise.all([
      api.get('/health-profile/profile'),
      api.get('/health-profile/goals'),
      api.get('/health-profile/measurements'),
      api.get('/health-profile/reports')
    ]);
    setProfile(p);
    setGoals(g);
    setMeasurements(m);
    setReports(r);
  }

  async function saveProfile(e) {
    e.preventDefault();
    await api.put('/health-profile/profile', profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function setGoal(e) {
    e.preventDefault();
    await api.post('/health-profile/goals', goalForm);
    setGoalForm({ goal_type: 'maintenance', notes: '' });
    load();
  }

  async function addMeasurement(e) {
    e.preventDefault();
    await api.post('/health-profile/measurements', { ...measurementForm, source: 'user_entered' });
    setMeasurementForm(emptyMeasurement);
    load();
  }

  async function removeMeasurement(id) {
    if (!await confirm('Delete this measurement?', { ledger: 'health', danger: true })) return;
    await api.del(`/health-profile/measurements/${id}`);
    load();
  }

  async function uploadReport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('report_date', reportDate);
      await api.upload('/health-profile/reports', fd);
      load();
    } catch (err) {
      await alert(`Upload failed: ${err.message}`, { ledger: 'health' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function removeReport(id) {
    if (!await confirm('Delete this report? Any measurements logged from it stay in your history, just unlinked from the source file.', { ledger: 'health', danger: true })) return;
    await api.del(`/health-profile/reports/${id}`);
    load();
  }

  if (!profile) return <div className="empty-state">Loading…</div>;

  const currentGoal = goals[0];
  const weightHistory = measurements.filter((m) => m.measurement_type === 'weight');
  const otherMeasurements = measurements.filter((m) => m.measurement_type !== 'weight');

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">The basis for every calculation on this ledger</div>
        <h1 className="page-title">Health Profile</h1>
        <p className="page-sub">Nothing here is a diagnosis. Out-of-range values are flagged so you can discuss them with a professional — not interpreted for you.</p>
      </div>

      <div className="two-col">
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Basic information</div>
            <form onSubmit={saveProfile}>
              <div className="form-grid">
                <div className="field"><label>Height (cm)</label>
                  <input type="number" step="0.1" value={profile.height_cm || ''} onChange={(e) => setProfile({ ...profile, height_cm: e.target.value })} />
                </div>
                <div className="field"><label>Birth year</label>
                  <input type="number" value={profile.birth_year || ''} onChange={(e) => setProfile({ ...profile, birth_year: e.target.value })} />
                </div>
                <div className="field"><label>Sex</label>
                  <select value={profile.sex} onChange={(e) => setProfile({ ...profile, sex: e.target.value })}>
                    <option value="unspecified">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div className="field"><label>Activity level</label>
                  <select value={profile.activity_level} onChange={(e) => setProfile({ ...profile, activity_level: e.target.value })}>
                    {ACTIVITY_LEVELS.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className="field"><label>Gym status</label>
                  <select value={profile.gym_status} onChange={(e) => setProfile({ ...profile, gym_status: e.target.value })}>
                    {GYM_STATUSES.map((g) => <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className="field"><label>Training days</label>
                  <input placeholder="e.g. Mon, Wed, Fri" value={profile.training_days || ''} onChange={(e) => setProfile({ ...profile, training_days: e.target.value })} />
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Nutrition targets are recalculated automatically from your latest weight, this info, and your current goal — override any of them below if you'd rather set your own numbers.</p>
              <details style={{ marginBottom: 14 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--ink-soft)' }}>Manual target overrides (optional)</summary>
                <div className="form-grid" style={{ marginTop: 12 }}>
                  <div className="field"><label>Calories</label><input type="number" value={profile.calorie_target_override || ''} onChange={(e) => setProfile({ ...profile, calorie_target_override: e.target.value })} /></div>
                  <div className="field"><label>Protein (g)</label><input type="number" value={profile.protein_target_override || ''} onChange={(e) => setProfile({ ...profile, protein_target_override: e.target.value })} /></div>
                  <div className="field"><label>Carbs (g)</label><input type="number" value={profile.carb_target_override || ''} onChange={(e) => setProfile({ ...profile, carb_target_override: e.target.value })} /></div>
                  <div className="field"><label>Fat (g)</label><input type="number" value={profile.fat_target_override || ''} onChange={(e) => setProfile({ ...profile, fat_target_override: e.target.value })} /></div>
                  <div className="field"><label>Fiber (g)</label><input type="number" value={profile.fiber_target_override || ''} onChange={(e) => setProfile({ ...profile, fiber_target_override: e.target.value })} /></div>
                  <div className="field"><label>Water (ml)</label><input type="number" value={profile.water_target_ml_override || ''} onChange={(e) => setProfile({ ...profile, water_target_ml_override: e.target.value })} /></div>
                </div>
              </details>
              <button type="submit" className="btn btn-primary">Save profile</button>
              {saved && <span style={{ marginLeft: 10, color: 'var(--green)', fontSize: 13 }}>Saved ✓</span>}
            </form>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Goal</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
              Current: <strong>{currentGoal ? currentGoal.goal_type.replace(/_/g, ' ') : 'not set'}</strong>. Setting a new goal keeps the old one in history — recommendations always use the latest.
            </p>
            <form onSubmit={setGoal} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                <label>New goal</label>
                <select value={goalForm.goal_type} onChange={(e) => setGoalForm({ ...goalForm, goal_type: e.target.value })}>
                  {GOAL_TYPES.map((g) => <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-primary">Set as current goal</button>
            </form>
            {goals.length > 1 && (
              <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--ink-faint)' }}>
                History: {goals.slice(1).map((g) => g.goal_type.replace(/_/g, ' ')).join(' ← ')}
              </div>
            )}
          </div>

          <div className="card">
            <div className="section-title">Log a measurement</div>
            <form onSubmit={addMeasurement}>
              <div className="form-grid">
                <div className="field"><label>Type</label>
                  <input placeholder="e.g. weight, vitamin_d, testosterone" value={measurementForm.measurement_type} onChange={(e) => setMeasurementForm({ ...measurementForm, measurement_type: e.target.value })} />
                </div>
                <div className="field"><label>Value</label><input required type="number" step="0.001" value={measurementForm.value} onChange={(e) => setMeasurementForm({ ...measurementForm, value: e.target.value })} /></div>
                <div className="field"><label>Unit</label><input value={measurementForm.unit} onChange={(e) => setMeasurementForm({ ...measurementForm, unit: e.target.value })} /></div>
                <div className="field"><label>Reference range (optional)</label><input placeholder="e.g. 30-100" value={measurementForm.reference_range} onChange={(e) => setMeasurementForm({ ...measurementForm, reference_range: e.target.value })} /></div>
                <div className="field"><label>Date</label><input required type="date" value={measurementForm.measurement_date} onChange={(e) => setMeasurementForm({ ...measurementForm, measurement_date: e.target.value })} /></div>
              </div>
              <button type="submit" className="btn btn-primary">Log measurement</button>
            </form>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Health reports</div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 0 }}>Upload a report (PDF/JPG/PNG) to keep it on file. Extract the actual numbers into measurements above yourself, or ask the AI Analyzer to help once uploaded.</p>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Report date</label>
              <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={uploadReport} disabled={uploading} />
            {reports.length > 0 && (
              <div className="ledger" style={{ marginTop: 14 }}>
                {reports.map((r) => (
                  <div className="ledger-row" key={r.id}>
                    <div className="ledger-icon">📄</div>
                    <div className="ledger-desc">
                      <div className="ledger-title">{r.original_filename}</div>
                      <div className="ledger-meta">{r.report_date ? r.report_date.slice(0, 10) : 'no date'}</div>
                    </div>
                    <a className="icon-btn" href={`/api/health-profile/reports/${r.id}/file`} target="_blank" rel="noreferrer">View</a>
                    <button className="icon-btn" onClick={() => removeReport(r.id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Weight history</div>
            {weightHistory.length === 0 ? (
              <div className="empty-state">No weight logged yet.</div>
            ) : (
              <div className="ledger">
                {weightHistory.map((m) => (
                  <div className="ledger-row" key={m.id}>
                    <div className="ledger-desc">
                      <div className="ledger-title">{m.value} {m.unit}</div>
                      <div className="ledger-meta">{m.measurement_date.slice(0, 10)} · {m.source === 'health_report' ? 'From report' : 'You entered this'}</div>
                    </div>
                    <button className="icon-btn" onClick={() => removeMeasurement(m.id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="section-title">Other measurements</div>
            {otherMeasurements.length === 0 ? (
              <div className="empty-state">No other measurements logged yet.</div>
            ) : (
              <div className="ledger">
                {otherMeasurements.map((m) => (
                  <div className="ledger-row" key={m.id}>
                    <div className="ledger-desc">
                      <div className="ledger-title">{m.measurement_type.replace(/_/g, ' ')}: {m.value} {m.unit}</div>
                      <div className="ledger-meta">
                        {m.measurement_date.slice(0, 10)} · {m.source === 'health_report' ? 'From report' : 'You entered this'}
                        {m.reference_range && ` · ref ${m.reference_range}`}
                      </div>
                    </div>
                    <button className="icon-btn" onClick={() => removeMeasurement(m.id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
