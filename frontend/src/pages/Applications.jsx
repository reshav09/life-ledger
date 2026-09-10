import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useDialog } from '../components/DialogProvider.jsx';

const STATUS_ORDER = ['planning', 'applied', 'interview', 'offer', 'cleared', 'rejected'];
const STATUS_LABELS = {
  planning: '📋 Planning', applied: '📨 Applied', interview: '🎙️ Interview',
  offer: '🎉 Offer', cleared: '✅ Cleared', rejected: '❌ Rejected'
};
const STATUS_COLORS = {
  planning: 'var(--ink-faint)', applied: 'var(--brass)', interview: '#5B7FBA',
  offer: 'var(--green)', cleared: 'var(--green)', rejected: 'var(--rust)'
};

const emptyForm = { name: '', role: '', type: 'job', status: 'planning', deadline: '', url: '', notes: '', priority: 'medium' };

export default function Applications() {
  const { confirm } = useDialog();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const data = await api.get('/applications');
    setItems(data);
    setLoading(false);
  }

  async function submit(e) {
    e.preventDefault();
    if (editingId) {
      await api.put(`/applications/${editingId}`, form);
    } else {
      await api.post('/applications', form);
    }
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    load();
  }

  function startEdit(item) {
    setForm({
      name: item.name, role: item.role, type: item.type, status: item.status,
      deadline: item.deadline ? item.deadline.slice(0, 10) : '',
      url: item.url || '', notes: item.notes || '', priority: item.priority
    });
    setEditingId(item.id);
    setShowForm(true);
  }

  async function remove(id) {
    if (!await confirm('Remove this application?', { ledger: 'money', danger: true })) return;
    await api.del(`/applications/${id}`);
    load();
  }

  async function quickStatus(id, status) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    await api.put(`/applications/${id}`, { ...item, deadline: item.deadline ? item.deadline.slice(0, 10) : null, status });
    load();
  }

  const filtered = filter === 'all' ? items : items.filter((i) => i.type === filter);

  // Group by status for a pipeline view
  const byStatus = {};
  STATUS_ORDER.forEach((s) => { byStatus[s] = []; });
  filtered.forEach((item) => { if (byStatus[item.status]) byStatus[item.status].push(item); });

  const stats = {
    total: items.length,
    active: items.filter((i) => !['rejected', 'cleared', 'offer'].includes(i.status)).length,
    interviews: items.filter((i) => i.status === 'interview').length
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Stay on top of your applications</div>
        <h1 className="page-title">Applications</h1>
        <p className="page-sub">Track companies you want to apply to and competitive exams you're preparing for.</p>
      </div>

      {/* Stats */}
      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-label">Total</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active</div>
          <div className="stat-value positive">{stats.active}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Interviews</div>
          <div className="stat-value" style={{ color: '#5B7FBA' }}>{stats.interviews}</div>
        </div>
      </div>

      {/* Filters + Add button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', 'job', 'exam', 'other'].map((f) => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : ''}`}
            onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
          </button>
        ))}
        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}
          onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(!showForm); }}>
          {showForm ? '✕ Close' : '+ Add'}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title">{editingId ? 'Edit Application' : 'Add New Application'}</div>
          <form onSubmit={submit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>Company / Exam Name</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Google, GATE 2026" />
              </div>
              <div className="field">
                <label>Role / Subject</label>
                <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="e.g. SDE-1, CS" />
              </div>
              <div className="field">
                <label>Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="job">💼 Job</option>
                  <option value="exam">📝 Exam</option>
                  <option value="other">📌 Other</option>
                </select>
              </div>
              <div className="field">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Priority</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="high">🔴 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🟢 Low</option>
                </select>
              </div>
              <div className="field">
                <label>Deadline</label>
                <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>URL</label>
                <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://careers.google.com/..." />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Notes</label>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Referral from..., prep areas, etc." style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--hairline)', background: 'var(--input-bg)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}>
              {editingId ? 'Save Changes' : 'Add Application'}
            </button>
          </form>
        </div>
      )}

      {/* Pipeline view */}
      {loading ? <div className="empty-state">Loading…</div> : filtered.length === 0 ? (
        <div className="card empty-state">No applications yet. Hit "+ Add" above to track your first one.</div>
      ) : (
        <div className="app-pipeline">
          {STATUS_ORDER.map((status) => {
            const group = byStatus[status];
            if (group.length === 0) return null;
            return (
              <div key={status} className="app-pipeline-col">
                <div className="app-pipeline-header" style={{ borderColor: STATUS_COLORS[status] }}>
                  {STATUS_LABELS[status]}
                  <span className="app-pipeline-count">{group.length}</span>
                </div>
                {group.map((item) => (
                  <div className="app-pipeline-card" key={item.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {item.type === 'job' ? '💼' : item.type === 'exam' ? '📝' : '📌'} {item.name}
                        </div>
                        {item.role && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>{item.role}</div>}
                      </div>
                      <span className={`badge ${item.priority === 'high' ? 'rust' : item.priority === 'medium' ? 'brass' : 'green'}`}>
                        {item.priority}
                      </span>
                    </div>
                    {item.deadline && (
                      <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 6 }}>
                        📅 {new Date(item.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                    {item.notes && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4, lineHeight: 1.4 }}>{item.notes}</div>}
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, color: 'var(--green)', marginTop: 4, display: 'inline-block' }}>
                        🔗 Open link
                      </a>
                    )}
                    <div className="app-pipeline-actions">
                      {/* Quick status buttons */}
                      {status !== 'interview' && status !== 'offer' && status !== 'cleared' && (
                        <button className="icon-btn" onClick={() => quickStatus(item.id, 
                          status === 'planning' ? 'applied' : status === 'applied' ? 'interview' : status)}>
                          Move →
                        </button>
                      )}
                      {status === 'interview' && (
                        <>
                          <button className="icon-btn" style={{ color: 'var(--green)' }} onClick={() => quickStatus(item.id, 'offer')}>✓ Offer</button>
                          <button className="icon-btn" style={{ color: 'var(--rust)' }} onClick={() => quickStatus(item.id, 'rejected')}>✗ Rejected</button>
                        </>
                      )}
                      <button className="icon-btn" onClick={() => startEdit(item)}>Edit</button>
                      <button className="icon-btn" onClick={() => remove(item.id)}>Del</button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
