import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

const TYPE_CONFIG = {
  job:        { icon: '💼', label: 'Job' },
  internship: { icon: '🔬', label: 'Internship' },
  fellowship: { icon: '🎓', label: 'Fellowship' },
  grant:      { icon: '💰', label: 'Grant' },
  exam:       { icon: '📝', label: 'Exam' },
  other:      { icon: '📌', label: 'Other' }
};

const FILTER_ITEMS = [
  { key: 'all',        label: 'All' },
  { key: 'job',        label: 'Jobs' },
  { key: 'internship', label: 'Internships' },
  { key: 'fellowship', label: 'Fellowships' },
  { key: 'exam',       label: 'Exams' },
  { key: 'other',      label: 'Other' }
];

const emptyForm = { name: '', role: '', type: 'job', status: 'planning', deadline: '', url: '', notes: '', priority: 'medium' };

export default function Applications() {
  const { confirm } = useDialog();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [viewTab, setViewTab] = useState('active'); // 'active' | 'rejected' | 'all'
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

  async function handleQuickReject(item) {
    const ok = await confirm(`Mark application for "${item.name}" as Rejected? It will move to your Rejected & Closed applications.`, {
      ledger: 'jobhunt',
      confirmLabel: 'Mark Rejected',
      danger: true
    });
    if (!ok) return;
    await api.put(`/applications/${item.id}`, {
      ...item,
      deadline: item.deadline ? item.deadline.slice(0, 10) : null,
      status: 'rejected'
    });
    load();
  }

  const filtered = filter === 'all' ? items : items.filter((i) => i.type === filter);

  // Group by status for a pipeline view
  const byStatus = {};
  STATUS_ORDER.forEach((s) => { byStatus[s] = []; });
  filtered.forEach((item) => { if (byStatus[item.status]) byStatus[item.status].push(item); });

  const stats = {
    total: items.length,
    active: items.filter((i) => ['planning', 'applied'].includes(i.status)).length,
    interviews: items.filter((i) => i.status === 'interview').length,
    offers: items.filter((i) => ['offer', 'cleared'].includes(i.status)).length,
    rejected: items.filter((i) => i.status === 'rejected').length
  };

  const displayedStatuses = viewTab === 'active'
    ? ['planning', 'applied', 'interview', 'offer', 'cleared']
    : viewTab === 'rejected'
    ? ['rejected']
    : STATUS_ORDER;

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Stay on top of your applications</div>
        <h1 className="page-title">Applications</h1>
        <p className="page-sub">Track companies you want to apply to, active interview loops, and archived rejections.</p>
      </div>

      {/* Stats with 1-click filter links */}
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setViewTab('all')} title="Show all application stages">
          <div className="stat-label">Total</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setViewTab('active')} title="Show active applications">
          <div className="stat-label">In Progress</div>
          <div className="stat-value positive">{stats.active}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setViewTab('active')} title="Show active interviews">
          <div className="stat-label">Interviews</div>
          <div className="stat-value" style={{ color: '#5B7FBA' }}>{stats.interviews}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setViewTab('active')} title="Show offers">
          <div className="stat-label">Offers</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>{stats.offers}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer', borderLeft: '3px solid var(--rust)' }} onClick={() => setViewTab('rejected')} title="Click to view Rejected & Closed applications">
          <div className="stat-label" style={{ color: 'var(--rust)' }}>Rejected / Closed</div>
          <div className="stat-value" style={{ color: 'var(--rust)' }}>{stats.rejected}</div>
        </div>
      </div>

      {/* View Portion Tabs + Type Filters + Add Button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: '1px solid var(--hairline)'
      }}>
        <div style={{ display: 'inline-flex', background: 'var(--paper-raised)', padding: 3, borderRadius: 8, border: '1px solid var(--hairline)' }}>
          <button
            type="button"
            className={`btn btn-sm ${viewTab === 'active' ? 'btn-primary' : ''}`}
            style={{ border: 'none', borderRadius: 6, fontSize: 13 }}
            onClick={() => setViewTab('active')}
          >
            🎯 Active Pipeline ({stats.active + stats.interviews + stats.offers})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewTab === 'rejected' ? 'btn-primary' : ''}`}
            style={{
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              color: viewTab === 'rejected' ? '#fff' : 'var(--rust)',
              background: viewTab === 'rejected' ? 'var(--rust)' : 'transparent'
            }}
            onClick={() => setViewTab('rejected')}
          >
            ❌ Rejected & Closed ({stats.rejected})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewTab === 'all' ? 'btn-primary' : ''}`}
            style={{ border: 'none', borderRadius: 6, fontSize: 13 }}
            onClick={() => setViewTab('all')}
          >
            📑 All Stages ({stats.total})
          </button>
        </div>

        {/* Filters + Add button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {FILTER_ITEMS.map((f) => (
            <button key={f.key} className={`btn btn-sm ${filter === f.key ? 'btn-primary' : ''}`}
              style={{ padding: '3px 10px', fontSize: 12 }}
              onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
          <button className="btn btn-primary btn-sm"
            onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(!showForm); }}>
            {showForm ? '✕ Close' : '+ Add'}
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title">{editingId ? 'Edit Application' : 'Add New Application'}</div>
          <form onSubmit={submit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>Company / Program / Exam Name</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. D. E. Shaw Research, Google, GATE 2026" />
              </div>
              <div className="field">
                <label>Role / Focus Area</label>
                <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="e.g. Summer Research Intern, SDE-1, CS" />
              </div>
              <div className="field">
                <label>Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="job">💼 Job</option>
                  <option value="internship">🔬 Internship</option>
                  <option value="fellowship">🎓 Fellowship</option>
                  <option value="grant">💰 Grant</option>
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
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">No applications found{filter !== 'all' ? ` for "${filter}"` : ''}. Hit "+ Add" above to track your first one.</div>
      ) : viewTab === 'rejected' ? (
        /* Dedicated Rejected & Closed Portion */
        <div className="card" style={{ marginTop: 8, borderLeft: '4px solid var(--rust)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>❌</span>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--rust)' }}>
                  Rejected & Closed Applications ({byStatus.rejected.length})
                </h2>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '6px 0 0 0' }}>
                Companies, startups, and fellowships that didn't work out. Kept safe here with your interview notes, feedback, and 1-click re-open if you re-apply.
              </p>
            </div>
            <button className="btn btn-sm" onClick={() => setViewTab('active')}>
              ← Back to Active Pipeline
            </button>
          </div>

          {byStatus.rejected.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              No rejected applications recorded yet. When a company or fellowship rejects, clicking "✗ Mark Rejected" on any applied application will safely move it here.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {byStatus.rejected.map((item) => (
                <div className="app-pipeline-card" key={item.id} style={{ margin: 0, border: '1px solid var(--hairline)', background: 'var(--paper-hover)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {(TYPE_CONFIG[item.type] || TYPE_CONFIG.other).icon} {item.name}
                        {item.type && item.type !== 'job' && (
                          <span style={{
                            fontSize: 10.5,
                            fontWeight: 500,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: 'var(--paper-raised)',
                            border: '1px solid var(--hairline)',
                            color: 'var(--ink-soft)',
                            marginLeft: 6,
                            textTransform: 'capitalize'
                          }}>
                            {item.type}
                          </span>
                        )}
                      </div>
                      {item.role && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>{item.role}</div>}
                      {item.opportunity_id && (
                        <Link
                          to={`/opportunities?q=${encodeURIComponent(item.name)}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 10.5,
                            color: '#7c3aed',
                            background: 'rgba(124, 58, 237, 0.08)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            marginTop: 4,
                            textDecoration: 'none',
                            fontWeight: 500
                          }}
                          title="View opportunity details in Job Hunt Radar"
                        >
                          🎯 Radar Match ↗
                        </Link>
                      )}
                    </div>
                    <span className="badge rust" style={{ fontSize: 11, padding: '2px 8px' }}>
                      ❌ Rejected
                    </span>
                  </div>

                  {item.deadline && (
                    <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 6 }}>
                      📅 Applied/Deadline: {new Date(item.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                  {item.notes && (
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6, lineHeight: 1.4, background: 'var(--paper-raised)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--hairline)' }}>
                      📝 {item.notes}
                    </div>
                  )}
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: 'var(--green)', marginTop: 6, display: 'inline-block' }}>
                      🔗 Portal / Source link
                    </a>
                  )}

                  <div className="app-pipeline-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                    <button
                      className="btn btn-sm"
                      style={{ color: 'var(--brass)', borderColor: 'var(--hairline)', fontSize: 12 }}
                      onClick={() => quickStatus(item.id, 'applied')}
                      title="Reopen and move this application back into Applied pipeline"
                    >
                      ↩ Re-Open to Applied
                    </button>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Link
                        to={`/workspace?appId=${item.id}${item.opportunity_id ? `&oppId=${item.opportunity_id}` : ''}`}
                        className="btn btn-sm"
                        style={{ fontSize: 11, background: 'rgba(217, 119, 87, 0.08)', color: 'var(--rust)', borderColor: 'rgba(217, 119, 87, 0.25)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        title="Open Dossier Application Workspace"
                      >
                        📄 Workspace ↗
                      </Link>
                      <button className="icon-btn" onClick={() => startEdit(item)} title="Edit application details or notes">Edit</button>
                      <button className="icon-btn" onClick={() => remove(item.id)} title="Delete record permanently">Del</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Active Stages or All Pipeline */
        <>
          <div className="app-pipeline">
            {displayedStatuses.map((status) => {
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
                            {(TYPE_CONFIG[item.type] || TYPE_CONFIG.other).icon} {item.name}
                            {item.type && item.type !== 'job' && (
                              <span style={{
                                fontSize: 10.5,
                                fontWeight: 500,
                                padding: '1px 6px',
                                borderRadius: 4,
                                background: 'var(--paper-raised)',
                                border: '1px solid var(--hairline)',
                                color: 'var(--ink-soft)',
                                marginLeft: 6,
                                textTransform: 'capitalize'
                              }}>
                                {item.type}
                              </span>
                            )}
                          </div>
                          {item.role && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>{item.role}</div>}
                          {item.opportunity_id && (
                            <Link
                              to={`/opportunities?q=${encodeURIComponent(item.name)}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 10.5,
                                color: '#7c3aed',
                                background: 'rgba(124, 58, 237, 0.08)',
                                padding: '2px 6px',
                                borderRadius: 4,
                                marginTop: 4,
                                textDecoration: 'none',
                                fontWeight: 500
                              }}
                              title="View opportunity details in Job Hunt Radar"
                            >
                              🎯 Radar Match ↗
                            </Link>
                          )}
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
                      <div className="app-pipeline-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {status === 'planning' && (
                            <>
                              <button className="icon-btn" style={{ color: 'var(--brass)', fontWeight: 600 }} onClick={() => quickStatus(item.id, 'applied')} title="Mark as submitted/applied">
                                📨 Mark Applied
                              </button>
                              <button className="icon-btn" style={{ color: 'var(--ink-faint)' }} onClick={() => handleQuickReject(item)} title="Pass / drop without applying">
                                ✗ Pass
                              </button>
                            </>
                          )}
                          {status === 'applied' && (
                            <>
                              <button className="icon-btn" style={{ color: '#5B7FBA', fontWeight: 600 }} onClick={() => quickStatus(item.id, 'interview')} title="Advance to Interview round">
                                🎙️ Interview
                              </button>
                              <button className="icon-btn" style={{ color: 'var(--rust)', fontWeight: 600 }} onClick={() => handleQuickReject(item)} title="Send to Rejected applications">
                                ✗ Mark Rejected
                              </button>
                            </>
                          )}
                          {status === 'interview' && (
                            <>
                              <button className="icon-btn" style={{ color: 'var(--green)', fontWeight: 600 }} onClick={() => quickStatus(item.id, 'offer')} title="Received job offer">
                                🎉 Offer
                              </button>
                              <button className="icon-btn" style={{ color: 'var(--rust)', fontWeight: 600 }} onClick={() => handleQuickReject(item)} title="Rejected after interview rounds">
                                ✗ Rejected
                              </button>
                            </>
                          )}
                          {status === 'offer' && (
                            <>
                              <button className="icon-btn" style={{ color: 'var(--green)', fontWeight: 600 }} onClick={() => quickStatus(item.id, 'cleared')} title="Accepted offer & joined">
                                ✅ Accept / Joined
                              </button>
                              <button className="icon-btn" style={{ color: 'var(--rust)' }} onClick={() => handleQuickReject(item)} title="Declined offer">
                                Decline
                              </button>
                            </>
                          )}
                          {status === 'rejected' && (
                            <button className="icon-btn" style={{ color: 'var(--brass)', fontWeight: 600 }} onClick={() => quickStatus(item.id, 'applied')} title="Restore back to Applied">
                              ↩ Re-Open to Applied
                            </button>
                          )}
                          {status === 'cleared' && (
                            <button className="icon-btn" style={{ color: 'var(--ink-soft)' }} onClick={() => quickStatus(item.id, 'applied')}>
                              ↩ Move to Applied
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
                          <Link
                            to={`/workspace?appId=${item.id}${item.opportunity_id ? `&oppId=${item.opportunity_id}` : ''}`}
                            className="btn btn-sm"
                            style={{ fontSize: 11, background: 'rgba(217, 119, 87, 0.08)', color: 'var(--rust)', borderColor: 'rgba(217, 119, 87, 0.25)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            title="Open Dossier Application Workspace"
                          >
                            📄 Workspace ↗
                          </Link>
                          <button className="icon-btn" onClick={() => startEdit(item)}>Edit</button>
                          <button className="icon-btn" onClick={() => remove(item.id)}>Del</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Quick footer portal link to Rejected Portion if viewing active pipeline */}
          {viewTab === 'active' && stats.rejected > 0 && (
            <div
              style={{
                marginTop: 20,
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid var(--hairline)',
                background: 'var(--paper-raised)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'border-color 0.15s'
              }}
              onClick={() => setViewTab('rejected')}
              title="Click to view all rejected and closed applications"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>❌</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                    Rejected & Closed Applications ({stats.rejected})
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                    {stats.rejected} application{stats.rejected > 1 ? 's' : ''} stored in your closed log. Click to review or reopen.
                  </div>
                </div>
              </div>
              <button className="btn btn-sm" style={{ color: 'var(--rust)', borderColor: 'var(--hairline)' }}>
                View Rejection Log ({stats.rejected}) →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
