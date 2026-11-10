import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useNavigate } from 'react-router-dom';
import JobHuntSmartIngestModal from '../components/JobHuntSmartIngestModal.jsx';
import { useDialog } from '../components/DialogProvider.jsx';

const REC_CONFIG = {
  apply_now:      { icon: '🔥', label: 'Apply Now',      color: '#E05A3A', bg: 'rgba(224,90,58,0.12)' },
  worth_applying: { icon: '⭐', label: 'Worth Applying', color: '#C9852E', bg: 'rgba(201,133,46,0.12)' },
  investigate:    { icon: '👀', label: 'Investigate',     color: '#5B7FBA', bg: 'rgba(91,127,186,0.12)' },
  ignore:         { icon: '❌', label: 'Ignore',          color: '#6E7A8A', bg: 'rgba(110,122,138,0.12)' }
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
}

function urgencyColor(days) {
  if (days == null) return 'var(--ink-faint)';
  if (days < 0) return 'var(--ink-faint)';
  if (days <= 7) return '#E05A3A';
  if (days <= 14) return '#D97757';
  if (days <= 30) return '#C9852E';
  return 'var(--ink-soft)';
}

export default function JobHuntDashboard() {
  const navigate = useNavigate();
  const { confirm } = useDialog();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSmartIngest, setShowSmartIngest] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [pollMsg, setPollMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [applyingId, setApplyingId] = useState(null);

  useEffect(() => { load(); }, []);

  async function handleApply(opp) {
    const directUrl = opp.apply_url || opp.source_url || opp.org_careers_url || opp.org_website;
    setApplyingId(opp.id);
    try {
      const res = await api.post(`/jobhunt/opportunities/${opp.id}/apply`, {});
      if (directUrl) {
        window.open(directUrl, '_blank', 'noopener,noreferrer');
      }
      setData(prev => {
        if (!prev) return prev;
        const updateOpp = o => o.id === opp.id ? { ...o, is_applied: 1, application_status: 'applied', application_id: res.application_id } : o;
        return {
          ...prev,
          stats: { ...prev.stats, applied: (prev.stats?.applied || 0) + 1 },
          top_opportunities: (prev.top_opportunities || []).map(updateOpp),
          recent_opportunities: (prev.recent_opportunities || []).map(updateOpp)
        };
      });
      setToastMsg(`✓ Saved "${opp.title}" to My Applications as "Applied" & opened portal!`);
      setTimeout(() => setToastMsg(''), 6000);
    } catch (err) {
      alert(`Failed to save application: ${err.message}`);
    } finally {
      setApplyingId(null);
    }
  }

  async function handleMarkStatus(opp, status) {
    const isReject = status === 'rejected';
    const ok = await confirm(
      isReject ? `Mark "${opp.title}" as Rejected? It will move to your Rejected & Closed applications.` : `Update status for "${opp.title}" to ${status}?`,
      { ledger: 'money', danger: isReject, confirmLabel: isReject ? 'Mark Rejected' : 'Update' }
    );
    if (!ok) return;
    try {
      await api.post(`/jobhunt/opportunities/${opp.id}/mark-status`, { status });
      setData(prev => {
        if (!prev) return prev;
        const updateOpp = o => o.id === opp.id ? { ...o, application_status: status, is_applied: 1 } : o;
        return {
          ...prev,
          top_opportunities: (prev.top_opportunities || []).map(updateOpp),
          recent_opportunities: (prev.recent_opportunities || []).map(updateOpp)
        };
      });
      setToastMsg(`✓ Marked "${opp.title}" as ${status === 'rejected' ? 'Rejected' : status}`);
      setTimeout(() => setToastMsg(''), 5000);
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const d = await api.get('/jobhunt/opportunities/dashboard');
      setData(d);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function deleteOpp(id, title) {
    const name = title ? `"${title}"` : 'this opportunity';
    if (!await confirm(`Permanently delete ${name}? This cannot be undone.`, { ledger: 'money', danger: true })) return;
    await api.del(`/jobhunt/opportunities/${id}?permanent=true`);
    load();
  }

  async function archiveOpp(id, title) {
    const name = title ? `"${title}"` : 'this opportunity';
    if (!await confirm(`Archive ${name}? You can restore or view it anytime under Opportunities > Archived.`, { ledger: 'money' })) return;
    await api.del(`/jobhunt/opportunities/${id}`);
    load();
  }

  async function handlePollAll() {
    setIsPolling(true);
    setPollMsg('Initiating batch poll across active organizations…');
    try {
      await api.post('/jobhunt/crawler/poll-all', { limit: 20 });
      
      const pollTimer = setInterval(async () => {
        try {
          const status = await api.get('/jobhunt/crawler/status');
          const prog = status.crawl_progress;
          if (prog && prog.is_running) {
            setPollMsg(`🔄 Polling org ${prog.current_index}/${prog.total}: ${prog.current_org}… (${prog.new_opportunities_count} new jobs found)`);
          } else {
            clearInterval(pollTimer);
            setIsPolling(false);
            const count = prog?.new_opportunities_count || 0;
            const total = prog?.total || 0;
            setPollMsg(`✅ Batch poll complete! Checked ${total} organizations. Discovered ${count} new opportunities.`);
            load();
            setTimeout(() => setPollMsg(''), 8000);
          }
        } catch {
          clearInterval(pollTimer);
          setIsPolling(false);
        }
      }, 2000);
    } catch (err) {
      setPollMsg(`⚠️ Polling error: ${err.message}`);
      setIsPolling(false);
    }
  }

  if (loading) return <div className="empty-state" style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading radar…</div>;

  if (!data) return <div className="empty-state">Failed to load dashboard.</div>;

  const { stats, top_opportunities, recent_opportunities, sector_breakdown } = data;
  const hasOpps = stats.total > 0;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="page-eyebrow">Your personal opportunity radar</div>
          <h1 className="page-title">Job Hunt Radar</h1>
          <p className="page-sub">Discover, score, and track opportunities across government, PSU, defence, and private sectors.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-sm"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)'
            }}
            onClick={() => setShowSmartIngest(true)}
          >
            <span>✨</span> AI Ingest Job / PDF
          </button>
          <button
            className="btn btn-sm"
            disabled={isPolling}
            onClick={handlePollAll}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>⚡</span> {isPolling ? 'Polling Orgs…' : 'Poll Active Orgs'}
          </button>
        </div>
      </div>

      {pollMsg && (
        <div className="alert-banner alert-info" style={{ marginBottom: 16 }}>
          <span>{pollMsg}</span>
        </div>
      )}

      {toastMsg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          background: 'rgba(34, 197, 94, 0.12)',
          color: '#16a34a',
          border: '1px solid rgba(34, 197, 94, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          fontWeight: 500
        }}>
          <span>{toastMsg}</span>
          <button
            type="button"
            className="btn btn-sm"
            style={{ padding: '2px 8px', fontSize: 11, background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer' }}
            onClick={() => navigate('/applications')}
          >
            Go to Applications →
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-label">Discovered</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/opportunities?recommendation=apply_now')}>
          <div className="stat-label">🔥 Apply Now</div>
          <div className="stat-value" style={{ color: '#E05A3A' }}>{stats.apply_now}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/opportunities?recommendation=worth_applying')}>
          <div className="stat-label">⭐ Worth It</div>
          <div className="stat-value" style={{ color: '#C9852E' }}>{stats.worth_applying}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/opportunities?recommendation=investigate')}>
          <div className="stat-label">👀 Investigate</div>
          <div className="stat-value" style={{ color: '#5B7FBA' }}>{stats.investigate}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/applications')}>
          <div className="stat-label">📨 Applied</div>
          <div className="stat-value" style={{ color: '#16a34a' }}>{stats.applied || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">📅 Due 7d</div>
          <div className="stat-value" style={{ color: stats.deadlines_7d > 0 ? '#E05A3A' : 'var(--ink-faint)' }}>{stats.deadlines_7d}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">📅 Due 14d</div>
          <div className="stat-value" style={{ color: stats.deadlines_14d > 0 ? '#D97757' : 'var(--ink-faint)' }}>{stats.deadlines_14d}</div>
        </div>
      </div>

      {/* Category Hubs Quick Launcher */}
      {data?.category_counts && (
        <div style={{
          display: 'flex',
          gap: 8,
          marginTop: 14,
          marginBottom: 4,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          padding: '4px 0'
        }}>
          {[
            { id: '', label: 'All Opportunities', icon: '🌟', count: data.category_counts.all },
            { id: 'startup', label: 'Startups & Scaleups', icon: '🚀', count: data.category_counts.startup },
            { id: 'research_internship', label: 'Research Fellowships', icon: '🔬', count: data.category_counts.research_internship },
            { id: 'psu', label: 'PSUs', icon: '🏭', count: data.category_counts.psu },
            { id: 'govt', label: 'Govt & Strategic R&D', icon: '🏛️', count: data.category_counts.govt },
            { id: 'private_in', label: 'Indian Tech (≥20 LPA)', icon: '🇮🇳', count: data.category_counts.private_in },
            { id: 'quant_hft', label: 'Quant & HFT', icon: '⚡', count: data.category_counts.quant_hft },
            { id: 'private_eu', label: 'EU Visa (≥€100k)', icon: '🇪🇺', count: data.category_counts.private_eu },
            { id: 'private_sg', label: 'Singapore Visa (≥S$135k)', icon: '🇸🇬', count: data.category_counts.private_sg },
            { id: 'private_global', label: 'Global Remote', icon: '🌐', count: data.category_counts.private_global }
          ].map(cat => (
            <button
              key={cat.id}
              className="btn btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                padding: '5px 12px',
                background: 'var(--navy-raised)',
                border: '1px solid var(--hairline)',
                color: 'var(--ink-soft)',
                whiteSpace: 'nowrap'
              }}
              onClick={() => navigate(cat.id ? `/opportunities?category_group=${cat.id}` : '/opportunities')}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span className="jh-cat-count">{cat.count || 0}</span>
            </button>
          ))}
        </div>
      )}

      {!hasOpps ? (
        <div className="card empty-state" style={{ marginTop: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No opportunities discovered yet</div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
            Start by adding organizations to your registry, then add opportunities manually.
            The scoring engine will rank each one against your profile.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/orgs')}>+ Add Organizations</button>
            <button className="btn btn-sm" onClick={() => navigate('/opportunities')}>+ Add Opportunity</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
          {/* Top Opportunities */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Top Opportunities</span>
              <button className="btn btn-sm" onClick={() => navigate('/opportunities')}>View All →</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {top_opportunities.map(opp => {
                const rec = REC_CONFIG[opp.recommendation] || REC_CONFIG.ignore;
                const days = daysUntil(opp.application_deadline);
                return (
                  <div key={opp.id} className="jh-opp-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{opp.title}</div>
                        {opp.org_name && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>{opp.org_name}{opp.org_sector ? ` · ${opp.org_sector}` : ''}</div>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {opp.location && <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>📍 {opp.location}</span>}
                          {opp.pay_scale && <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>💰 {opp.pay_scale}</span>}
                          {opp.vacancies && <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>👥 {opp.vacancies} vacancies</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                        <span className="jh-rec-badge" style={{ background: rec.bg, color: rec.color }}>{rec.icon} {rec.label}</span>
                        <span className="jh-score-badge">{opp.opportunity_score}/100</span>
                      </div>
                    </div>
                    {days != null ? (
                      <div style={{ fontSize: 12, color: urgencyColor(days), marginTop: 8, fontWeight: 500 }}>
                        {days < 0 ? 'Deadline passed' : days === 0 ? '⚠️ Deadline TODAY' : `📅 ${days} day${days !== 1 ? 's' : ''} left`}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 8, fontWeight: 500 }}>
                        ⚡ Rolling / Open Requisition
                      </div>
                    )}
                    {/* Score breakdown mini-bars */}
                    <div className="jh-score-bars">
                      {[
                        { label: 'Eligibility', val: opp.eligibility_pct },
                        { label: 'Match', val: opp.profile_match_pct },
                        { label: 'Pay', val: opp.compensation_score },
                        { label: 'Quality', val: opp.org_quality_score },
                      ].map(d => (
                        <div key={d.label} className="jh-score-bar-item">
                          <span className="jh-score-bar-label">{d.label}</span>
                          <div className="jh-score-bar-track">
                            <div className="jh-score-bar-fill" style={{ width: `${d.val || 0}%` }} />
                          </div>
                          <span className="jh-score-bar-val">{d.val ?? '—'}</span>
                        </div>
                      ))}
                    </div>

                    {/* Pipeline / Delete Actions */}
                    <div className="app-pipeline-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--hairline)', flexWrap: 'wrap' }}>
                      {(() => {
                        const destination = opp.apply_url || opp.source_url || opp.org_careers_url || opp.org_website;
                        const isApplied = opp.is_applied === 1 || !!opp.application_status;

                        return (
                          <>
                            {opp.application_status === 'rejected' ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <span
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.12)',
                                    color: 'var(--rust)',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                    padding: '3px 8px',
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    borderRadius: 6,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}
                                  title="Application was marked as rejected in My Applications"
                                >
                                  <span>❌</span> Rejected
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{ fontSize: 11, color: 'var(--ink-soft)', padding: '2px 8px' }}
                                  onClick={() => navigate('/applications')}
                                  title="View in My Applications"
                                >
                                  View App ↗
                                </button>
                              </div>
                            ) : isApplied ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  className="jh-table-applied-badge"
                                  onClick={() => navigate('/applications')}
                                  title="View in My Applications"
                                >
                                  <span>✓</span> Applied ({opp.application_status || 'applied'}) ↗
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{ fontSize: 11, color: 'var(--rust)', borderColor: 'var(--hairline)', padding: '3px 8px' }}
                                  onClick={() => handleMarkStatus(opp, 'rejected')}
                                  title="Received a rejection email? Send to Rejected applications"
                                >
                                  ✗ Mark Rejected
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="jh-apply-track-btn"
                                disabled={applyingId === opp.id}
                                onClick={() => handleApply(opp)}
                                title={`Open portal & save to Applications: ${destination || 'Apply'}`}
                              >
                                <span>{applyingId === opp.id ? '⏳' : '🚀'}</span>
                                <span>{applyingId === opp.id ? 'Saving…' : 'Apply'}</span>
                              </button>
                            )}

                            {destination && (
                              <a
                                href={destination}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm"
                                style={{ color: 'var(--ink-soft)' }}
                                title="Open application portal"
                              >
                                🔗 Portal ↗
                              </a>
                            )}
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{ background: 'rgba(217, 119, 87, 0.1)', color: 'var(--rust)', borderColor: 'rgba(217, 119, 87, 0.3)', fontWeight: 600 }}
                              onClick={() => navigate(`/workspace?oppId=${opp.id}`)}
                              title="Tailor ATS resume & factual cover letter for this role"
                            >
                              📄 Tailor CV ↗
                            </button>
                          </>
                        );
                      })()}
                      <button type="button" className="btn btn-sm" onClick={() => archiveOpp(opp.id, opp.title)}>Archive</button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ color: 'var(--rust)', borderColor: 'var(--rust)' }}
                        onClick={() => deleteOpp(opp.id, opp.title)}
                        title="Delete opportunity"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sector breakdown */}
          {sector_breakdown.length > 0 && (
            <div className="card">
              <div className="section-title">By Sector</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {sector_breakdown.map(s => (
                  <span key={s.sector || 'unknown'} className="jh-sector-pill">
                    {s.sector || 'Uncategorized'} <strong>{s.cnt}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent discoveries */}
          {recent_opportunities.length > 0 && (
            <div className="card">
              <div className="section-title">Recently Added</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {recent_opportunities.map(opp => {
                  const rec = REC_CONFIG[opp.recommendation] || REC_CONFIG.ignore;
                  const dest = opp.apply_url || opp.source_url || opp.org_careers_url || opp.org_website;
                  return (
                    <div key={opp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
                      <div>
                        {dest ? (
                          <a
                            href={dest}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}
                            title={`Open: ${dest}`}
                          >
                            {opp.title} ↗
                          </a>
                        ) : (
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{opp.title}</div>
                        )}
                        {opp.org_name && <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{opp.org_name}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="jh-rec-badge" style={{ background: rec.bg, color: rec.color, fontSize: 11 }}>{rec.icon} {opp.opportunity_score}</span>
                        <button
                          type="button"
                          className="icon-btn"
                          style={{ color: 'var(--rust)', fontSize: 13, padding: '2px 4px' }}
                          onClick={() => deleteOpp(opp.id, opp.title)}
                          title="Delete opportunity"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <JobHuntSmartIngestModal
        isOpen={showSmartIngest}
        onClose={() => setShowSmartIngest(false)}
        onSaved={() => load()}
      />
    </div>
  );
}
