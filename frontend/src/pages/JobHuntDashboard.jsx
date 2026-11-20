import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import JobHuntFollowupReminders from '../components/JobHuntFollowupReminders';
import JobHuntSmartIngestModal from '../components/JobHuntSmartIngestModal.jsx';
import JobHuntDetailDrawer from '../components/JobHuntDetailDrawer.jsx';
import StatCard from '../components/StatCard.jsx';
import SegmentedControl from '../components/ui/SegmentedControl.jsx';
import { useDialog } from '../components/DialogProvider.jsx';

const REC_CONFIG = {
  apply_now:      { icon: '🔥', label: 'Apply Now',      color: 'var(--rust)', bg: 'var(--rust-soft)' },
  worth_applying: { icon: '⭐', label: 'Worth Applying', color: 'var(--brass)', bg: 'var(--brass-soft)' },
  investigate:    { icon: '👀', label: 'Investigate',     color: '#5B7FBA', bg: 'rgba(91,127,186,0.12)' },
  ignore:         { icon: '❌', label: 'Ignore',          color: 'var(--ink-faint)', bg: 'var(--hairline)' }
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
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
  const [selectedOpp, setSelectedOpp] = useState(null);

  // Interactive Live Filter State
  const [activeRecFilter, setActiveRecFilter] = useState('all'); // 'all' | 'apply_now' | 'worth_applying' | 'investigate' | 'applied' | 'due_7d' | 'due_14d'
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('');
  const [activeSectorFilter, setActiveSectorFilter] = useState('');
  const [showAllSectors, setShowAllSectors] = useState(false);

  // Dynamic opportunities state loaded from server
  const [topOpps, setTopOpps] = useState([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [oppsLoading, setOppsLoading] = useState(false);
  const isFirstMount = useRef(true);

  async function load() {
    try {
      const res = await api.get('/jobhunt/opportunities/dashboard', {
        params: {
          filter: activeRecFilter,
          category_group: activeCategoryFilter,
          sector: activeSectorFilter,
          limit: 50
        }
      });
      setData(res);
      setTopOpps(res.top_opportunities || []);
      setTotalMatches(res.total_matches ?? res.top_opportunities?.length ?? 0);
    } catch (err) {
      console.error('Failed to load job hunt dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Fetch updated opportunities dynamically when any filter changes
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    let cancelled = false;
    async function fetchFilteredOpps() {
      setOppsLoading(true);
      try {
        const res = await api.get('/jobhunt/opportunities/top', {
          params: {
            filter: activeRecFilter,
            category_group: activeCategoryFilter,
            sector: activeSectorFilter,
            limit: 50
          }
        });
        if (!cancelled) {
          setTopOpps(res.opportunities || []);
          setTotalMatches(res.total_matches ?? res.opportunities?.length ?? 0);
        }
      } catch (err) {
        console.error('Failed to load top opportunities:', err);
      } finally {
        if (!cancelled) {
          setOppsLoading(false);
        }
      }
    }
    fetchFilteredOpps();
    return () => { cancelled = true; };
  }, [activeRecFilter, activeCategoryFilter, activeSectorFilter]);

  async function handlePollAll() {
    setIsPolling(true);
    setPollMsg('Connecting to active ATS endpoints and public feeds…');
    try {
      const res = await api.post('/jobhunt/opportunities/poll-active-orgs', {});
      setPollMsg(res.summary || 'Feed check complete.');
      await load();
      setTimeout(() => setPollMsg(''), 8000);
    } catch (err) {
      setPollMsg(`Poll failed: ${err.message}`);
      setTimeout(() => setPollMsg(''), 6000);
    } finally {
      setIsPolling(false);
    }
  }

  async function handleApply(opp) {
    setApplyingId(opp.id);
    try {
      const res = await api.post(`/jobhunt/opportunities/${opp.id}/apply`, {});
      if (res.apply_url) {
        window.open(res.apply_url, '_blank', 'noopener,noreferrer');
      }
      setToastMsg(`✓ Tracked application for ${opp.title} at ${res.org_name || 'Employer'}`);
      setTimeout(() => setToastMsg(''), 6000);
      await load();
    } catch (err) {
      alert(`Could not track application: ${err.message}`);
    } finally {
      setApplyingId(null);
    }
  }

  async function handleMarkStatus(opp, status) {
    if (!await confirm(`Mark application for "${opp.title}" as ${status.toUpperCase()}?`, {
      ledger: 'jobhunt',
      confirmLabel: `Mark ${status}`
    })) return;

    try {
      await api.post(`/jobhunt/opportunities/${opp.id}/status`, { status });
      setToastMsg(`✓ Application updated to: ${status}`);
      setTimeout(() => setToastMsg(''), 4000);
      await load();
    } catch (err) {
      alert(`Could not update status: ${err.message}`);
    }
  }

  async function archiveOpp(id, title) {
    if (!await confirm(`Archive "${title}"? It will be hidden from the active radar.`, {
      ledger: 'jobhunt',
      confirmLabel: 'Archive'
    })) return;

    try {
      await api.post(`/jobhunt/opportunities/${id}/archive`);
      await load();
    } catch (err) {
      alert(`Archive failed: ${err.message}`);
    }
  }

  async function deleteOpp(id, title) {
    if (!await confirm(`Permanently delete "${title}"?`, {
      ledger: 'jobhunt',
      confirmLabel: 'Delete'
    })) return;

    try {
      await api.delete(`/jobhunt/opportunities/${id}`);
      await load();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  }

  if (loading) return <div className="empty-state" style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading radar…</div>;
  if (!data) return <div className="empty-state">Failed to load dashboard.</div>;

  const { stats, top_opportunities, recent_opportunities, sector_breakdown } = data;
  const hasOpps = stats.total > 0;

  // Sort sectors by frequency descending (plain array sort, no hook violation)
  const sortedSectors = [...(sector_breakdown || [])].sort((a, b) => (b.cnt || 0) - (a.cnt || 0));
  const visibleSectors = showAllSectors ? sortedSectors : sortedSectors.slice(0, 10);

  const displayOpps = topOpps;

  const categoryOptions = [
    { value: '', label: 'All Targets (> ₹5 LPA)' },
    { value: 'psu', label: 'PSUs (Public Sector)', icon: '🏭' },
    { value: 'govt', label: 'Govt & e-Governance', icon: '🏛️' },
    { value: 'research_internship', label: 'Research & Labs', icon: '🔬' },
    { value: 'startup', label: 'Indian Tech Startups', icon: '🚀' },
    { value: 'private_in', label: 'Indian Tech & Services', icon: '🇮🇳' },
    { value: 'private_global', label: 'Remote / Hybrid India', icon: '💻' }
  ];

  return (
    <div>
      {/* Follow-up Reminders (Renders only when items are overdue) */}
      <JobHuntFollowupReminders />

      {/* Modern Editorial Page Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="page-eyebrow">Opportunity Radar & Ingestion Hub</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Job Hunt Radar</h1>
            <p className="page-sub">Algorithmic scoring against verified candidate profile claims across tech, research, and public sectors.</p>
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
                gap: 6
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
              <span>⚡</span> {isPolling ? 'Polling…' : 'Poll Active Orgs'}
            </button>
          </div>
        </div>
      </div>

      {pollMsg && (
        <div className="card" style={{ padding: '10px 14px', marginBottom: 16, background: 'var(--paper-hover)', fontSize: 13 }}>
          {pollMsg}
        </div>
      )}

      {toastMsg && (
        <div className="card" style={{ padding: '10px 14px', marginBottom: 16, background: 'var(--green-soft)', border: '1px solid var(--green)', color: 'var(--green)', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{toastMsg}</span>
          <button className="btn btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => navigate('/applications')}>
            Go to Applications →
          </button>
        </div>
      )}

      {/* Interactive KPI Cards (Click to live-filter the view below) */}
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', marginBottom: 16 }}>
        <StatCard
          label="Discovered"
          value={stats.total}
          active={activeRecFilter === 'all'}
          onClick={() => setActiveRecFilter('all')}
        />
        <StatCard
          label="Apply Now"
          value={stats.apply_now}
          icon="🔥"
          color="var(--rust)"
          active={activeRecFilter === 'apply_now'}
          onClick={() => setActiveRecFilter(activeRecFilter === 'apply_now' ? 'all' : 'apply_now')}
        />
        <StatCard
          label="Worth It"
          value={stats.worth_applying}
          icon="⭐"
          color="var(--brass)"
          active={activeRecFilter === 'worth_applying'}
          onClick={() => setActiveRecFilter(activeRecFilter === 'worth_applying' ? 'all' : 'worth_applying')}
        />
        <StatCard
          label="Investigate"
          value={stats.investigate}
          icon="👀"
          color="#5B7FBA"
          active={activeRecFilter === 'investigate'}
          onClick={() => setActiveRecFilter(activeRecFilter === 'investigate' ? 'all' : 'investigate')}
        />
        <StatCard
          label="Applied"
          value={stats.applied || 0}
          icon="📨"
          color="var(--green)"
          active={activeRecFilter === 'applied'}
          onClick={() => setActiveRecFilter(activeRecFilter === 'applied' ? 'all' : 'applied')}
        />
        <StatCard
          label="Due 7d"
          value={stats.deadlines_7d}
          icon="📅"
          color={stats.deadlines_7d > 0 ? 'var(--rust)' : 'var(--ink-faint)'}
          active={activeRecFilter === 'due_7d'}
          onClick={() => setActiveRecFilter(activeRecFilter === 'due_7d' ? 'all' : 'due_7d')}
        />
        <StatCard
          label="Due 14d"
          value={stats.deadlines_14d}
          icon="📅"
          color={stats.deadlines_14d > 0 ? 'var(--brass)' : 'var(--ink-faint)'}
          active={activeRecFilter === 'due_14d'}
          onClick={() => setActiveRecFilter(activeRecFilter === 'due_14d' ? 'all' : 'due_14d')}
        />
      </div>

      {/* Segmented Category Filter Toolbar */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <SegmentedControl
          options={categoryOptions}
          value={activeCategoryFilter}
          onChange={setActiveCategoryFilter}
        />
        {(activeRecFilter !== 'all' || activeCategoryFilter || activeSectorFilter) && (
          <button
            className="btn btn-sm"
            onClick={() => {
              setActiveRecFilter('all');
              setActiveCategoryFilter('');
              setActiveSectorFilter('');
            }}
            style={{ fontSize: 11.5 }}
          >
            ✕ Reset Filter ({
              activeRecFilter === 'apply_now' ? 'Apply Now' :
              activeRecFilter === 'worth_applying' ? 'Worth It' :
              activeRecFilter === 'investigate' ? 'Investigate' :
              activeRecFilter === 'applied' ? 'Applied' :
              activeRecFilter === 'due_7d' ? 'Due ≤ 7 Days' :
              activeRecFilter === 'due_14d' ? 'Due ≤ 14 Days' :
              activeCategoryFilter ? (categoryOptions.find(c => c.value === activeCategoryFilter)?.label || activeCategoryFilter) :
              activeSectorFilter ? activeSectorFilter : 'Custom'
            })
          </button>
        )}
      </div>

      {!hasOpps ? (
        <div className="card empty-state" style={{ marginTop: 24, textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No opportunities discovered yet</div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', maxWidth: 420, margin: '0 auto 16px auto', lineHeight: 1.5 }}>
            Add target organizations or poll active feeds to trigger the heuristic scoring engine against your profile.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/orgs')}>+ Manage Organizations</button>
            <button className="btn btn-sm" onClick={() => navigate('/opportunities')}>+ Add Opportunity</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Main Top Opportunities Ledger */}
          <div id="top-opportunities-section" className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                  Top Ranked Opportunities
                </h3>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                  {totalMatches > displayOpps.length
                    ? `Showing ${displayOpps.length} of ${totalMatches} matches`
                    : `Showing ${displayOpps.length} ${displayOpps.length === 1 ? 'match' : 'matches'}`}
                  {activeRecFilter !== 'all' ? ` filtered by ${
                    activeRecFilter === 'due_7d' ? 'Due in ≤ 7 days' :
                    activeRecFilter === 'due_14d' ? 'Due in ≤ 14 days' :
                    activeRecFilter === 'worth_applying' ? 'Worth It' :
                    activeRecFilter === 'apply_now' ? 'Apply Now' :
                    activeRecFilter === 'applied' ? 'Applied' :
                    activeRecFilter === 'investigate' ? 'Investigate' :
                    activeRecFilter.replace('_', ' ')
                  }` : ''}
                  {activeCategoryFilter ? ` • ${categoryOptions.find(c => c.value === activeCategoryFilter)?.label || activeCategoryFilter}` : ''}
                  {activeSectorFilter ? ` • Sector: ${activeSectorFilter}` : ''}
                </span>
              </div>
              <button
                className="btn btn-sm"
                onClick={() => {
                  if (activeRecFilter === 'applied') {
                    navigate('/applications');
                  } else if (activeRecFilter === 'due_7d') {
                    navigate('/opportunities?deadline=7');
                  } else if (activeRecFilter === 'due_14d') {
                    navigate('/opportunities?deadline=14');
                  } else if (activeRecFilter !== 'all') {
                    navigate(`/opportunities?recommendation=${activeRecFilter}${activeCategoryFilter ? `&category_group=${activeCategoryFilter}` : ''}`);
                  } else if (activeCategoryFilter) {
                    navigate(`/opportunities?category_group=${activeCategoryFilter}`);
                  } else if (activeSectorFilter) {
                    navigate(`/opportunities?sector=${encodeURIComponent(activeSectorFilter)}`);
                  } else {
                    navigate('/opportunities');
                  }
                }}
              >
                {activeRecFilter === 'applied'
                  ? `View Applications (${stats.applied || totalMatches}) →`
                  : `View Full Registry (${totalMatches > 0 ? totalMatches : stats.total}) →`}
              </button>
            </div>

            {oppsLoading && displayOpps.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13 }}>
                Loading opportunities…
              </div>
            ) : displayOpps.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>
                No opportunities match the current filter selection. Click "Reset Filter" to view all.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: oppsLoading ? 0.6 : 1, transition: 'opacity 0.15s ease' }}>
                {displayOpps.map((opp) => {
                  const rec = REC_CONFIG[opp.recommendation] || REC_CONFIG.ignore;
                  const days = daysUntil(opp.application_deadline);
                  const destination = opp.apply_url || opp.source_url || opp.org_careers_url || opp.org_website;
                  const isApplied = opp.is_applied === 1 || (!!opp.application_status && opp.application_status !== 'planning');

                  return (
                    <div
                      key={opp.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 8,
                        background: 'var(--paper-hover)',
                        border: '1px solid var(--hairline)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 14,
                        flexWrap: 'wrap',
                        transition: 'background 0.15s ease, border-color 0.15s ease'
                      }}
                    >
                      {/* Left: Role Info */}
                      <div style={{ flex: 1, minWidth: 260 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span
                            onClick={() => setSelectedOpp(opp)}
                            style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', cursor: 'pointer', textDecoration: 'none' }}
                            title="Inspect job requirements and match scores"
                          >
                            {opp.title}
                          </span>
                          <span className={`score-pill ${opp.opportunity_score >= 80 ? 'high' : opp.opportunity_score >= 60 ? 'medium' : 'low'}`}>
                            {opp.opportunity_score}/100 · {rec.icon} {rec.label}
                          </span>
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3 }}>
                          <strong>{opp.org_name || 'Employer'}</strong>
                          {opp.location && <span> • 📍 {opp.location}</span>}
                          {opp.compensation_display && <span> • 💰 {opp.compensation_display}</span>}
                          {days != null ? (
                            <span style={{ color: days <= 7 ? 'var(--rust)' : 'var(--ink-faint)', fontWeight: 600, marginLeft: 6 }}>
                              • {days < 0 ? 'Deadline passed' : `📅 ${days}d left`}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--ink-faint)', marginLeft: 6 }}>
                              • ⚡ Rolling Requisition
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Quick Action Buttons */}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        {opp.application_status === 'rejected' ? (
                          <span className="badge rust" style={{ fontSize: 11 }}>
                            ❌ Rejected
                          </span>
                        ) : isApplied ? (
                          <span className="badge green" style={{ fontSize: 11 }}>
                            ✓ Applied
                          </span>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={applyingId === opp.id}
                            onClick={() => handleApply(opp)}
                            style={{ fontSize: 12, padding: '5px 12px' }}
                          >
                            {applyingId === opp.id ? 'Saving…' : '🚀 Apply'}
                          </button>
                        )}

                        <button
                          className="btn btn-sm"
                          onClick={() => setSelectedOpp(opp)}
                          title="View complete job breakdown and analysis"
                          style={{ fontSize: 12, padding: '5px 10px' }}
                        >
                          🔍 Inspect
                        </button>

                        <button
                          className="btn btn-sm"
                          onClick={() => navigate(`/workspace?oppId=${opp.id}`)}
                          title="Tailor ATS resume & cover letter"
                          style={{ fontSize: 12, padding: '5px 10px' }}
                        >
                          📄 Workspace
                        </button>

                        {destination && (
                          <a
                            href={destination}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm"
                            style={{ fontSize: 12, padding: '5px 9px', color: 'var(--ink-soft)', textDecoration: 'none' }}
                            title="Open external application portal"
                          >
                            ↗
                          </a>
                        )}

                        <button
                          className="icon-btn"
                          onClick={() => archiveOpp(opp.id, opp.title)}
                          title="Archive opportunity"
                          style={{ fontSize: 14 }}
                        >
                          📦
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Grid: Sector Breakdown & Recently Discovered */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'stretch' }}>
            {/* Sector Breakdown */}
            {sortedSectors.length > 0 && (
              <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)' }}>
                      Distribution by Sector <span style={{ fontWeight: 400, opacity: 0.7 }}>({sortedSectors.length})</span>
                    </div>
                    {sortedSectors.length > 10 && (
                      <button
                        className="btn btn-sm"
                        onClick={() => setShowAllSectors(!showAllSectors)}
                        style={{
                          fontSize: 11,
                          padding: '2px 9px',
                          borderRadius: 'var(--radius-pill)',
                          background: 'var(--card-hover)',
                          border: '1px solid var(--hairline)',
                          cursor: 'pointer'
                        }}
                      >
                        {showAllSectors ? 'Show Top 10 ▴' : `View All (${sortedSectors.length}) ▾`}
                      </button>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                      maxHeight: showAllSectors ? 280 : 'none',
                      overflowY: showAllSectors ? 'auto' : 'visible',
                      paddingRight: showAllSectors ? 4 : 0,
                      alignContent: 'flex-start'
                    }}
                  >
                    {visibleSectors.map(s => {
                      const isSelected = activeSectorFilter === s.sector;
                      return (
                        <button
                          key={s.sector || 'unknown'}
                          className="btn btn-sm"
                          style={{
                            fontSize: 11.5,
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-pill)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            background: isSelected ? 'rgba(74, 222, 128, 0.18)' : 'var(--card-hover)',
                            border: isSelected ? '1px solid var(--green)' : '1px solid var(--hairline)',
                            color: isSelected ? 'var(--green)' : 'inherit',
                            transition: 'all 0.15s ease'
                          }}
                          onClick={() => {
                            const next = isSelected ? '' : s.sector;
                            setActiveSectorFilter(next);
                            const el = document.getElementById('top-opportunities-section');
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          title={`Filter radar by ${s.sector || 'General Tech'}`}
                        >
                          <span>{s.sector || 'General Tech'}</span>
                          <strong
                            style={{
                              color: isSelected ? 'var(--green)' : 'var(--green)',
                              background: 'rgba(74, 222, 128, 0.12)',
                              padding: '1px 6px',
                              borderRadius: 8,
                              fontSize: 10.5
                            }}
                          >
                            {s.cnt}
                          </strong>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Recently Added */}
            {recent_opportunities && recent_opportunities.length > 0 && (
              <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)' }}>
                    Recently Added
                  </div>
                  <button
                    className="btn btn-sm"
                    onClick={() => navigate('/opportunities')}
                    style={{
                      fontSize: 11,
                      padding: '2px 9px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--card-hover)',
                      border: '1px solid var(--hairline)',
                      cursor: 'pointer'
                    }}
                  >
                    All Radar →
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recent_opportunities.slice(0, 8).map(opp => (
                    <div
                      key={opp.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 0',
                        borderBottom: '1px solid var(--hairline)',
                        fontSize: 12.5
                      }}
                    >
                      <div
                        onClick={() => setSelectedOpp(opp)}
                        style={{
                          cursor: 'pointer',
                          fontWeight: 600,
                          color: 'var(--ink)',
                          maxWidth: '72%',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                        title={`${opp.title} (${opp.org_name})`}
                      >
                        {opp.title} <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>• {opp.org_name}</span>
                      </div>
                      <span className={`score-pill ${opp.opportunity_score >= 80 ? 'high' : opp.opportunity_score >= 60 ? 'medium' : 'low'}`} style={{ fontSize: 10.5 }}>
                        {opp.opportunity_score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slide-over Inspection Drawer for Deep Opportunities */}
      {selectedOpp && (
        <JobHuntDetailDrawer
          opp={selectedOpp}
          onClose={() => setSelectedOpp(null)}
          onApply={() => handleApply(selectedOpp)}
          onArchive={() => { archiveOpp(selectedOpp.id, selectedOpp.title); setSelectedOpp(null); }}
          onDelete={() => { deleteOpp(selectedOpp.id, selectedOpp.title); setSelectedOpp(null); }}
          onMarkStatus={(status) => { handleMarkStatus(selectedOpp, status); setSelectedOpp(null); }}
        />
      )}

      {/* Smart Ingestion Modal */}
      <JobHuntSmartIngestModal
        isOpen={showSmartIngest}
        onClose={() => setShowSmartIngest(false)}
        onSaved={() => load()}
      />
    </div>
  );
}
