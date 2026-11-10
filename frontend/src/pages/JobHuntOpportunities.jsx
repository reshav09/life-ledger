import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useDialog } from '../components/DialogProvider.jsx';
import { useSearchParams, useNavigate } from 'react-router-dom';
import JobHuntSmartIngestModal from '../components/JobHuntSmartIngestModal.jsx';
import JobHuntDetailDrawer from '../components/JobHuntDetailDrawer.jsx';

const REC_CONFIG = {
  apply_now:      { icon: '🔥', label: 'Apply Now',      color: '#E05A3A', bg: 'rgba(224,90,58,0.12)' },
  worth_applying: { icon: '⭐', label: 'Worth Applying', color: '#C9852E', bg: 'rgba(201,133,46,0.12)' },
  investigate:    { icon: '👀', label: 'Investigate',     color: '#5B7FBA', bg: 'rgba(91,127,186,0.12)' },
  ignore:         { icon: '❌', label: 'Ignore',          color: '#6E7A8A', bg: 'rgba(110,122,138,0.12)' }
};

const CATEGORY_GROUPS = [
  { id: '', label: 'All Opportunities', icon: '🌟' },
  { id: 'startup', label: 'Startups & Scaleups', icon: '🚀' },
  { id: 'research_internship', label: 'Research Fellowships', icon: '🔬' },
  { id: 'psu', label: 'PSUs', icon: '🏭' },
  { id: 'govt', label: 'Govt & Strategic R&D', icon: '🏛️' },
  { id: 'private_in', label: 'Indian Private (≥ ₹20 LPA)', icon: '🇮🇳' },
  { id: 'quant_hft', label: 'Quant & HFT', icon: '⚡' },
  { id: 'private_eu', label: 'EU Visa (≥ €100k)', icon: '🇪🇺' },
  { id: 'private_sg', label: 'Singapore Visa (≥ S$135k)', icon: '🇸🇬' },
  { id: 'private_global', label: 'Global Remote ($100k+)', icon: '🌐' }
];

function getCountryFlag(country) {
  if (!country) return '📍';
  const c = country.toLowerCase();
  if (c.includes('india')) return '🇮🇳';
  if (c.includes('germany')) return '🇩🇪';
  if (c.includes('switzerland')) return '🇨🇭';
  if (c.includes('singapore')) return '🇸🇬';
  if (c.includes('netherland')) return '🇳🇱';
  if (c.includes('luxembourg')) return '🇱🇺';
  if (c.includes('poland')) return '🇵🇱';
  if (c.includes('united states') || c.includes('usa') || c.includes('us')) return '🇺🇸';
  if (c.includes('united kingdom') || c.includes('uk')) return '🇬🇧';
  if (c.includes('korea')) return '🇰🇷';
  if (c.includes('sweden')) return '🇸🇪';
  if (c.includes('ireland')) return '🇮🇪';
  return '📍';
}

const PSU_TIERS = [
  { value: '', label: 'All PSUs' },
  { value: 'Maharatna', label: 'Maharatna CPSE' },
  { value: 'Navratna', label: 'Navratna CPSE' },
  { value: 'Miniratna', label: 'Miniratna CPSE' },
  { value: 'Strategic', label: 'Govt Strategic & R&D' }
];

const JOB_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'govt', label: '🏛️ Government' },
  { value: 'psu', label: '🏭 PSU' },
  { value: 'defence', label: '🛡️ Defence' },
  { value: 'private', label: '💼 Private' },
  { value: 'research', label: '🔬 Research' },
  { value: 'contractual', label: '📋 Contractual' },
  { value: 'other', label: '📌 Other' }
];

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'job', label: '💼 Job' },
  { value: 'exam', label: '📝 Exam' },
  { value: 'internship', label: '🎓 Internship' },
  { value: 'fellowship', label: '🏆 Fellowship' },
  { value: 'project', label: '🔧 Project' },
  { value: 'other', label: '📌 Other' }
];

const SOURCE_TYPES = ['manual', 'careers_page', 'pdf', 'portal', 'employment_news', 'other'];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
}

function daysAgo(dateStr) {
  if (!dateStr) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.floor((now - d) / (1000 * 60 * 60 * 24));
}

function urgencyColor(days) {
  if (days == null) return 'var(--ink-faint)';
  if (days < 0) return 'var(--ink-faint)';
  if (days <= 7) return '#E05A3A';
  if (days <= 14) return '#D97757';
  if (days <= 30) return '#C9852E';
  return 'var(--green)';
}

function normalizeUrl(u) {
  if (!u) return '';
  return u.trim().replace(/\/+$/, '').toLowerCase();
}

const emptyForm = {
  org_id: '', title: '', source_url: '', source_type: 'manual',
  required_degree: '', required_branch: '', min_experience_years: '',
  max_age: '', min_age: '', required_skills: '',
  vacancies: '', location: '', pay_scale: '', ctc_min: '', ctc_max: '',
  application_deadline: '', posted_date: '', exam_date: '', apply_url: '',
  job_type: 'other', category: 'job', raw_text: '', notes: '',
  requires_gate: false,
  category_group: 'psu', country: 'India', region: 'India',
  visa_sponsored: false, currency: 'INR', compensation_display: ''
};

export default function JobHuntOpportunities() {
  const navigate = useNavigate();
  const { confirm } = useDialog();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showSmartIngest, setShowSmartIngest] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [applyingId, setApplyingId] = useState(null);
  const [includeIgnored, setIncludeIgnored] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState('0'); // '0' = Active, '1' = Archived
  const [activeCategoryGroup, setActiveCategoryGroup] = useState('');
  const [psuTier, setPsuTier] = useState('');
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [viewMode, setViewMode] = useState('dense'); // 'dense' | 'cards'
  const [categoryCounts, setCategoryCounts] = useState({
    all: 0, psu: 0, govt: 0, private_in: 0, quant_hft: 0, private_eu: 0, private_sg: 0, private_global: 0
  });
  const [recFilter, setRecFilter] = useState(searchParams.get('recommendation') || '');
  const [countryFilter, setCountryFilter] = useState('');
  const [availableCountries, setAvailableCountries] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [postedWithin, setPostedWithin] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('score');
  const [lastVisitTimestamp] = useState(() => {
    const saved = localStorage.getItem('jh_opps_last_visit');
    return saved ? new Date(saved).getTime() : Date.now() - 48 * 3600 * 1000;
  });

  useEffect(() => {
    // Record visit timestamp after 6 seconds on page
    const timer = setTimeout(() => {
      localStorage.setItem('jh_opps_last_visit', new Date().toISOString());
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  function isNewOpportunity(opp) {
    if (!opp) return false;
    const oppDate = opp.discovered_at || opp.created_at || opp.posted_date;
    if (!oppDate) return false;
    const t = new Date(oppDate).getTime();
    return !isNaN(t) && t > lastVisitTimestamp;
  }

  useEffect(() => { load(); loadOrgs(); }, []);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('is_archived', archiveFilter);
    if (includeIgnored) params.set('include_ignored', 'true');
    if (activeCategoryGroup) params.set('category_group', activeCategoryGroup);
    if (countryFilter) params.set('country', countryFilter);
    if (recFilter) params.set('recommendation', recFilter);
    if (typeFilter) params.set('job_type', typeFilter);
    if (catFilter) params.set('category', catFilter);
    if (postedWithin) params.set('posted_within', postedWithin);
    if (search) params.set('q', search);
    if (sort === 'deadline') params.set('sort', 'deadline');
    else if (sort === 'newest') params.set('sort', 'newest');
    else if (sort === 'posted') params.set('sort', 'posted');

    try {
      const [oppsData, dashData] = await Promise.all([
        api.get(`/jobhunt/opportunities?${params.toString()}`),
        api.get('/jobhunt/opportunities/dashboard')
      ]);
      setItems(oppsData);
      if (dashData?.category_counts) {
        setCategoryCounts(dashData.category_counts);
      }
      if (dashData?.countries) {
        setAvailableCountries(dashData.countries);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(opp) {
    const directUrl = opp.apply_url || opp.source_url || opp.org_careers_url || opp.org_website;
    setApplyingId(opp.id);
    try {
      const res = await api.post(`/jobhunt/opportunities/${opp.id}/apply`, {});
      if (directUrl) {
        window.open(directUrl, '_blank', 'noopener,noreferrer');
      }
      const updatedItem = {
        ...opp,
        is_applied: 1,
        application_status: 'applied',
        application_id: res.application_id
      };
      setItems(prev => prev.map(item => item.id === opp.id ? updatedItem : item));
      setSelectedOpp(prev => prev && prev.id === opp.id ? updatedItem : prev);
      setToastMsg(`✓ Saved "${opp.title}" to My Applications as "Applied" & opened portal!`);
      setTimeout(() => setToastMsg(''), 6000);
    } catch (err) {
      alert(`Failed to save application: ${err.message}`);
    } finally {
      setApplyingId(null);
    }
  }

  async function handleUnapply(opp) {
    if (!await confirm(`Remove "${opp.title}" from your tracked applications?`, { ledger: 'money' })) return;
    try {
      await api.post(`/jobhunt/opportunities/${opp.id}/unapply`, { delete_application: true });
      const updatedItem = {
        ...opp,
        is_applied: 0,
        application_status: null,
        application_id: null
      };
      setItems(prev => prev.map(item => item.id === opp.id ? updatedItem : item));
      setSelectedOpp(prev => prev && prev.id === opp.id ? updatedItem : prev);
      setToastMsg(`Removed "${opp.title}" from Applications.`);
      setTimeout(() => setToastMsg(''), 4000);
    } catch (err) {
      alert(`Failed to untrack: ${err.message}`);
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
      const updatedItem = {
        ...opp,
        is_applied: 1,
        application_status: status
      };
      setItems(prev => prev.map(item => item.id === opp.id ? updatedItem : item));
      setSelectedOpp(prev => prev && prev.id === opp.id ? updatedItem : prev);
      setToastMsg(`✓ Marked "${opp.title}" as ${status === 'rejected' ? 'Rejected' : status}`);
      setTimeout(() => setToastMsg(''), 5000);
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  }

  async function runLiveVerification() {
    setVerifying(true);
    setVerifyMsg('');
    try {
      const res = await api.post('/jobhunt/opportunities/verify-all', { auto_archive: true });
      setVerifyMsg(`✓ Verified ${res.total_checked} opportunities: ${res.active_count} confirmed live & active, ${res.archived_count} auto-archived.`);
      load();
    } catch (err) {
      setVerifyMsg(`✕ Verification failed: ${err.message}`);
    } finally {
      setVerifying(false);
      setTimeout(() => setVerifyMsg(''), 7000);
    }
  }

  async function loadOrgs() {
    const data = await api.get('/jobhunt/orgs');
    setOrgs(data);
  }

  // Reload when filters change
  useEffect(() => { load(); }, [archiveFilter, activeCategoryGroup, countryFilter, recFilter, typeFilter, catFilter, sort, includeIgnored, postedWithin]);

  async function submit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      org_id: form.org_id ? Number(form.org_id) : null,
      min_experience_years: form.min_experience_years !== '' ? Number(form.min_experience_years) : null,
      max_age: form.max_age !== '' ? Number(form.max_age) : null,
      min_age: form.min_age !== '' ? Number(form.min_age) : null,
      vacancies: form.vacancies !== '' ? Number(form.vacancies) : null,
      ctc_min: form.ctc_min !== '' ? Number(form.ctc_min) : null,
      ctc_max: form.ctc_max !== '' ? Number(form.ctc_max) : null,
      application_deadline: form.application_deadline || null,
      posted_date: form.posted_date || null,
      exam_date: form.exam_date || null,
      required_skills: form.required_skills,
      requires_gate: form.requires_gate ? 1 : 0,
      visa_sponsored: form.visa_sponsored ? 1 : 0
    };
    if (editingId) {
      await api.put(`/jobhunt/opportunities/${editingId}`, payload);
    } else {
      await api.post('/jobhunt/opportunities', payload);
    }
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    load();
  }

  function startEdit(opp) {
    setForm({
      org_id: opp.org_id || '', title: opp.title, source_url: opp.source_url || '',
      source_type: opp.source_type || 'manual',
      required_degree: opp.required_degree || '', required_branch: opp.required_branch || '',
      min_experience_years: opp.min_experience_years != null ? opp.min_experience_years : '',
      max_age: opp.max_age != null ? opp.max_age : '',
      min_age: opp.min_age != null ? opp.min_age : '',
      required_skills: opp.required_skills || '',
      vacancies: opp.vacancies != null ? opp.vacancies : '',
      location: opp.location || '', pay_scale: opp.pay_scale || '',
      ctc_min: opp.ctc_min != null ? opp.ctc_min : '',
      ctc_max: opp.ctc_max != null ? opp.ctc_max : '',
      application_deadline: opp.application_deadline ? opp.application_deadline.slice(0, 10) : '',
      posted_date: opp.posted_date ? opp.posted_date.slice(0, 10) : '',
      exam_date: opp.exam_date ? opp.exam_date.slice(0, 10) : '',
      apply_url: opp.apply_url || '',
      job_type: opp.job_type || 'other', category: opp.category || 'job',
      raw_text: opp.raw_text || '', notes: opp.notes || '',
      requires_gate: opp.requires_gate === 1 || opp.requires_gate === true,
      category_group: opp.category_group || 'psu',
      country: opp.country || 'India',
      region: opp.region || 'India',
      visa_sponsored: opp.visa_sponsored === 1 || opp.visa_sponsored === true,
      currency: opp.currency || 'INR',
      compensation_display: opp.compensation_display || ''
    });
    setEditingId(opp.id);
    setShowForm(true);
  }

  async function deleteOpp(id, title) {
    const name = title ? `"${title}"` : 'this opportunity';
    if (!await confirm(`Permanently delete ${name}? This cannot be undone.`, { ledger: 'money', danger: true })) return;
    await api.del(`/jobhunt/opportunities/${id}?permanent=true`);
    load();
  }

  async function archiveOpp(id, title) {
    const name = title ? `"${title}"` : 'this opportunity';
    if (!await confirm(`Archive ${name}? You can restore or view it anytime under the Archived tab.`, { ledger: 'money' })) return;
    await api.del(`/jobhunt/opportunities/${id}`);
    load();
  }

  async function restoreOpp(id) {
    await api.post(`/jobhunt/opportunities/${id}/restore`, {});
    load();
  }

  async function doSearch() { load(); }

  function clearAllFilters() {
    setRecFilter('');
    setCountryFilter('');
    setTypeFilter('');
    setCatFilter('');
    setPostedWithin('');
    setSearch('');
    setSort('score');
    setPsuTier('');
    setIncludeIgnored(false);
  }

  const hasActiveFilters = Boolean(recFilter || countryFilter || typeFilter || catFilter || postedWithin || search || psuTier || sort !== 'score' || includeIgnored);

  // Client-side PSU tier filtering when 'psu' category is active
  const displayedItems = items.filter(opp => {
    if (activeCategoryGroup === 'psu' && psuTier) {
      const matchSector = opp.org_sector?.toLowerCase().includes(psuTier.toLowerCase());
      const matchScale = opp.pay_scale?.toLowerCase().includes(psuTier.toLowerCase());
      const matchText = opp.raw_text?.toLowerCase().includes(psuTier.toLowerCase());
      return matchSector || matchScale || matchText;
    }
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Scored against your profile · Domestic & Global</div>
        <h1 className="page-title">Opportunities Explorer</h1>
        <p className="page-sub">
          Ranked opportunities categorized across Indian PSUs, Govt R&D, Domestic Tech (≥20 LPA) & Visa-Sponsored International roles (≥$100k+).
        </p>
      </div>

      {/* Category Hub Tab Bar */}
      {(() => {
        const unreadCounts = items.reduce((acc, opp) => {
          if (isNewOpportunity(opp)) {
            const g = opp.category_group || 'other';
            acc[g] = (acc[g] || 0) + 1;
            acc.all = (acc.all || 0) + 1;
          }
          return acc;
        }, {});

        return (
          <div
            className="jh-category-tabs"
            style={{ marginBottom: 14 }}
            onWheel={(e) => {
              if (e.deltaY !== 0) {
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
          >
            {CATEGORY_GROUPS.map((cg) => {
              const isActive = activeCategoryGroup === cg.id;
              const count = cg.id === ''
                ? (categoryCounts.all || items.length)
                : (categoryCounts[cg.id] || 0);
              const unread = cg.id === '' ? (unreadCounts.all || 0) : (unreadCounts[cg.id] || 0);

              return (
                <button
                  key={cg.id}
                  type="button"
                  className={`jh-cat-tab ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setActiveCategoryGroup(cg.id);
                    setPsuTier('');
                  }}
                >
                  <span>{cg.icon}</span>
                  <span>{cg.label}</span>
                  <span className="jh-cat-count">
                    {count}
                    {unread > 0 && (
                      <span style={{
                        marginLeft: 6,
                        padding: '1px 5px',
                        borderRadius: 8,
                        background: 'rgba(52, 211, 153, 0.25)',
                        color: '#34d399',
                        fontSize: 9.5,
                        fontWeight: 700
                      }}>
                        ⚡ {unread} NEW
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Optional PSU Sub-Chips */}
      {activeCategoryGroup === 'psu' && (
        <div className="jh-sub-chips" style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 11.5, color: 'var(--ink-faint)', fontWeight: 600, textTransform: 'uppercase', marginRight: 4 }}>
            PSU Classification:
          </span>
          {PSU_TIERS.map((tier) => (
            <button
              key={tier.value}
              type="button"
              className={`jh-sub-chip ${psuTier === tier.value ? 'active' : ''}`}
              onClick={() => setPsuTier(tier.value)}
            >
              {tier.label}
            </button>
          ))}
        </div>
      )}

      {/* Verification status banner */}
      {verifyMsg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          marginBottom: 14,
          fontSize: 13,
          background: verifyMsg.startsWith('✓') ? 'rgba(46, 125, 50, 0.12)' : 'rgba(211, 47, 47, 0.12)',
          color: verifyMsg.startsWith('✓') ? '#2e7d32' : '#d32f2f',
          border: `1px solid ${verifyMsg.startsWith('✓') ? 'rgba(46, 125, 50, 0.3)' : 'rgba(211, 47, 47, 0.3)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span>{verifyMsg.startsWith('✓') ? '🛡️' : '⚠️'}</span>
          <span>{verifyMsg}</span>
        </div>
      )}

      {/* Action / Apply toast banner */}
      {toastMsg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          marginBottom: 14,
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

      {/* Unified Opportunities Toolbar (Sorted & Decluttered) */}
      <div className="jh-toolbar">
        {/* Row 1: Search, View Controls & Primary Actions */}
        <div className="jh-toolbar-row-top">
          <div className="jh-toolbar-group-left">
            {/* Integrated Search Box */}
            <div className="jh-search-box">
              <span className="jh-search-box-icon">🔍</span>
              <input
                type="text"
                placeholder="Search role, skills, company…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
              />
              {search && (
                <button
                  type="button"
                  className="jh-search-box-clear"
                  onClick={() => { setSearch(''); setTimeout(load, 0); }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* View Mode Switcher */}
            <div className="jh-segmented-control">
              <button
                type="button"
                className={`jh-segmented-btn ${viewMode === 'dense' ? 'active' : ''}`}
                onClick={() => setViewMode('dense')}
                title="Compact high-density table view"
              >
                ⚡ Compact
              </button>
              <button
                type="button"
                className={`jh-segmented-btn ${viewMode === 'cards' ? 'active' : ''}`}
                onClick={() => setViewMode('cards')}
                title="Expanded cards view"
              >
                📋 Cards
              </button>
            </div>

            {/* Status Switcher: Active vs Archived */}
            <div className="jh-segmented-control">
              <button
                type="button"
                className={`jh-segmented-btn ${archiveFilter === '0' ? 'active' : ''}`}
                onClick={() => setArchiveFilter('0')}
              >
                🎯 Active ({archiveFilter === '0' ? displayedItems.length : 'Active'})
              </button>
              <button
                type="button"
                className={`jh-segmented-btn ${archiveFilter === '1' ? 'active' : ''}`}
                onClick={() => setArchiveFilter('1')}
              >
                📦 Archived {archiveFilter === '1' ? `(${displayedItems.length})` : ''}
              </button>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="jh-toolbar-group-right">
            <button
              type="button"
              className="btn btn-sm"
              disabled={verifying}
              style={{
                borderColor: 'var(--green)',
                color: 'var(--green)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
              onClick={runLiveVerification}
              title="Perform live verification on eligibility, deadlines, and active career URLs"
            >
              <span>{verifying ? '⏳' : '🛡️'}</span> {verifying ? 'Verifying…' : 'Verify Status'}
            </button>
            <button
              type="button"
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
              <span>✨</span> AI Ingest
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(!showForm); }}
            >
              {showForm ? '✕ Close' : '+ Manual Add'}
            </button>
          </div>
        </div>

        {/* Row 2: Secondary Dropdown Filters Strip */}
        <div className="jh-toolbar-row-bottom">
          <select
            className="jh-filter-select"
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
            title="Filter by country / jurisdiction"
          >
            <option value="">🌍 All Countries</option>
            {availableCountries.map(c => (
              <option key={c} value={c}>
                {getCountryFlag(c)} {c}
              </option>
            ))}
          </select>

          <select
            className="jh-filter-select"
            value={recFilter}
            onChange={e => setRecFilter(e.target.value)}
            title="Filter by recommendation status"
          >
            <option value="">All Recommendations</option>
            <option value="apply_now">🔥 Apply Now</option>
            <option value="worth_applying">⭐ Worth Applying</option>
            <option value="investigate">👀 Investigate</option>
            <option value="ignore">❌ Ignore</option>
          </select>

          <select
            className="jh-filter-select"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            title="Filter by job/exam type"
          >
            {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          <select
            className="jh-filter-select"
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            title="Filter by category/sector"
          >
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>

          <select
            className="jh-filter-select"
            value={postedWithin}
            onChange={e => setPostedWithin(e.target.value)}
            title="Filter by posting date"
          >
            <option value="">📅 All Posting Dates</option>
            <option value="7">⚡ Fresh (&lt; 7d / Last Week)</option>
            <option value="15">⏱️ ≤ 15d (Rolling Window)</option>
            <option value="20">🏛️ ≤ 20d (Govt Window)</option>
          </select>

          <select
            className="jh-filter-select"
            value={sort}
            onChange={e => setSort(e.target.value)}
            title="Sort opportunities"
          >
            <option value="score">Sort: Score ↓</option>
            <option value="posted">Sort: Recently Posted ⚡</option>
            <option value="deadline">Sort: Deadline ↑</option>
            <option value="newest">Sort: Newest</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn-sm"
              style={{ padding: '3px 8px', fontSize: 11, background: 'transparent', color: 'var(--ink-soft)', border: '1px dashed var(--hairline)' }}
              onClick={clearAllFilters}
              title="Reset all search and dropdown filters"
            >
              Reset Filters ✕
            </button>
          )}

          <button
            type="button"
            className={`jh-filter-toggle ${includeIgnored ? 'active' : ''}`}
            style={{ marginLeft: 'auto' }}
            onClick={() => setIncludeIgnored(!includeIgnored)}
            title={includeIgnored ? "Currently showing filtered & GATE-ineligible roles (click to hide)" : "Include roles filtered out by score or requiring GATE"}
          >
            <span className="jh-filter-toggle-switch" aria-hidden="true" />
            <span>Show Filtered / GATE Ineligible</span>
          </button>
        </div>
      </div>

      {/* Manual Add / Edit Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title">{editingId ? 'Edit Opportunity' : 'Add New Opportunity'}</div>
          <form onSubmit={submit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Position / Title *</label>
                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Scientist-B (Computer Science), Senior Backend Engineer" />
              </div>
              <div className="field">
                <label>Organization</label>
                <select value={form.org_id} onChange={e => setForm({ ...form, org_id: e.target.value })}>
                  <option value="">None / Unknown</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}{o.short_name ? ` (${o.short_name})` : ''}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Category Group</label>
                <select value={form.category_group} onChange={e => setForm({ ...form, category_group: e.target.value })}>
                  <option value="startup">🚀 High-Growth Startup / Scaleup</option>
                  <option value="research_internship">🔬 Fully Funded Research Fellowship / Internship</option>
                  <option value="psu">🏭 PSU</option>
                  <option value="govt">🏛️ Government & Strategic R&D</option>
                  <option value="private_in">🇮🇳 Indian Private (≥ ₹20 LPA)</option>
                  <option value="quant_hft">⚡ Quant & HFT Fund</option>
                  <option value="private_eu">🇪🇺 EU Countries (Visa Sponsored · ≥ €100k)</option>
                  <option value="private_sg">🇸🇬 Singapore (Visa Sponsored · ≥ S$135k)</option>
                  <option value="private_global">🌐 Global Remote ($100k+)</option>
                </select>
              </div>
              <div className="field">
                <label>Country</label>
                <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}
                  placeholder="e.g. India, Netherlands, Germany, Singapore" />
              </div>
              <div className="field">
                <label>Compensation Display</label>
                <input value={form.compensation_display} onChange={e => setForm({ ...form, compensation_display: e.target.value })}
                  placeholder="e.g. ₹28 - ₹36 LPA, €105k - €130k / yr, Level 10: ₹56,100" />
              </div>
              <div className="field">
                <label>Currency</label>
                <input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                  placeholder="INR, EUR, USD, SGD" />
              </div>
              <div className="field">
                <label>CTC Min (numeric)</label>
                <input type="number" step="0.5" value={form.ctc_min}
                  onChange={e => setForm({ ...form, ctc_min: e.target.value })} placeholder="e.g. 2500000 or 100000" />
              </div>
              <div className="field">
                <label>CTC Max (numeric)</label>
                <input type="number" step="0.5" value={form.ctc_max}
                  onChange={e => setForm({ ...form, ctc_max: e.target.value })} placeholder="e.g. 3500000 or 130000" />
              </div>
              <div className="field">
                <label>Required Degree</label>
                <input value={form.required_degree} onChange={e => setForm({ ...form, required_degree: e.target.value })}
                  placeholder="e.g. B.E/B.Tech, M.Tech" />
              </div>
              <div className="field">
                <label>Required Branch</label>
                <input value={form.required_branch} onChange={e => setForm({ ...form, required_branch: e.target.value })}
                  placeholder="e.g. CS/IT, Software Engineering" />
              </div>
              <div className="field">
                <label>Min Experience (years)</label>
                <input type="number" step="0.5" min="0" value={form.min_experience_years}
                  onChange={e => setForm({ ...form, min_experience_years: e.target.value })} />
              </div>
              <div className="field">
                <label>Max Age</label>
                <input type="number" min="18" value={form.max_age}
                  onChange={e => setForm({ ...form, max_age: e.target.value })} />
              </div>
              <div className="field">
                <label>Location</label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Amsterdam, Berlin, Singapore, Bangalore, Remote" />
              </div>
              <div className="field">
                <label>Vacancies</label>
                <input type="number" min="0" value={form.vacancies}
                  onChange={e => setForm({ ...form, vacancies: e.target.value })} />
              </div>
              <div className="field">
                <label>Posted Date</label>
                <input type="date" value={form.posted_date}
                  onChange={e => setForm({ ...form, posted_date: e.target.value })} />
              </div>
              <div className="field">
                <label>Application Deadline</label>
                <input type="date" value={form.application_deadline}
                  onChange={e => setForm({ ...form, application_deadline: e.target.value })} />
              </div>
              <div className="field">
                <label>Apply URL</label>
                <input value={form.apply_url} onChange={e => setForm({ ...form, apply_url: e.target.value })}
                  placeholder="https://..." />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Required Skills (comma separated)</label>
                <input value={form.required_skills} onChange={e => setForm({ ...form, required_skills: e.target.value })}
                  placeholder="e.g. Python, Docker, Kubernetes, AWS, Go, Distributed Systems" />
              </div>
              <div className="field" style={{ display: 'flex', gap: 20, gridColumn: '1 / -1', background: 'var(--paper-subtle, rgba(0,0,0,0.02))', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--hairline)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={form.visa_sponsored}
                    onChange={e => setForm({ ...form, visa_sponsored: e.target.checked })}
                  />
                  <span>✈️ Visa Sponsorship Provided / Relocation Assistance</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={form.requires_gate}
                    onChange={e => setForm({ ...form, requires_gate: e.target.checked })}
                  />
                  <span>Mandatory GATE Score Required</span>
                </label>
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Job Description / Notes</label>
                <textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Responsibilities, qualification requirements, benefits…"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--hairline)', background: 'var(--input-bg)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: editingId ? 'space-between' : 'flex-end', alignItems: 'center', marginTop: 16 }}>
              {editingId && (
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ color: 'var(--rust)', borderColor: 'var(--rust)' }}
                  onClick={() => {
                    deleteOpp(editingId, form.title);
                    setShowForm(false);
                  }}
                >
                  🗑️ Delete Opportunity
                </button>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-sm" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm btn-primary">
                  {editingId ? 'Save & Re-score' : 'Add & Score'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Main Opportunities View */}
      {loading ? (
        <div className="empty-state">
          <div className="spinner-medium" style={{ marginBottom: 12 }}></div>
          <div>Loading opportunities…</div>
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="card empty-state">
          {archiveFilter === '1'
            ? 'No archived opportunities.'
            : (activeCategoryGroup || recFilter || typeFilter || catFilter || search
              ? 'No opportunities match these filters.'
              : 'No opportunities yet. Add one manually or use AI Smart Ingest.')}
        </div>
      ) : viewMode === 'dense' ? (
        /* ⚡ Compact Dense Rows (Table View) — Default, Zero Infinite Scrolling */
        <div className="jh-dense-table-wrapper">
          <table className="jh-dense-table">
            <thead>
              <tr>
                <th>Company & Role</th>
                <th>Region</th>
                <th>Package / Scale</th>
                <th>Score</th>
                <th>Posted</th>
                <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((opp) => {
                const rec = REC_CONFIG[opp.recommendation] || REC_CONFIG.ignore;
                const days = daysUntil(opp.application_deadline);
                const isApplied = opp.is_applied === 1 || !!opp.application_status;

                const regionEmoji =
                  opp.category_group === 'startup' ? '🚀' :
                  opp.category_group === 'research_internship' ? '🔬' :
                  opp.category_group === 'quant_hft' ? '⚡' :
                  opp.category_group === 'private_eu' ? '🇪🇺' :
                  opp.category_group === 'private_sg' ? '🇸🇬' :
                  opp.category_group === 'private_in' ? '🇮🇳' :
                  opp.category_group === 'private_global' ? '🌐' :
                  opp.category_group === 'psu' ? '🏭' :
                  opp.category_group === 'govt' ? '🏛️' : '📍';

                const visaPillLabel =
                  opp.category_group === 'startup'
                    ? 'Startup'
                    : opp.category_group === 'research_internship'
                    ? 'Fellowship'
                    : opp.category_group === 'quant_hft'
                    ? (opp.country === 'Netherlands' ? 'NL Quant' : 'Quant / Prop')
                    : opp.visa_sponsored === 1
                    ? (opp.category_group === 'private_eu' ? 'EU Visa' : opp.category_group === 'private_sg' ? 'SG Visa' : 'Visa Sp.')
                    : opp.category_group === 'private_global' ? 'Remote' : 'India';

                return (
                  <tr
                    key={opp.id}
                    className="jh-dense-row"
                    onClick={() => setSelectedOpp(opp)}
                    title="Click to inspect full JD & eligibility without leaving page"
                  >
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{opp.title}</span>
                        {isNewOpportunity(opp) && (
                          <span style={{
                            padding: '1px 6px',
                            borderRadius: 8,
                            background: 'rgba(52, 211, 153, 0.25)',
                            color: '#34d399',
                            fontSize: 10,
                            fontWeight: 700
                          }}>
                            ⚡ NEW
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600 }}>{opp.org_name || 'Organization'}</span>
                        {opp.org_sector && <span>· {opp.org_sector}</span>}
                        {opp.is_active_link === 0 ? (
                          <span style={{ color: '#ef4444', fontSize: 10.5, fontWeight: 600, background: 'rgba(239, 68, 68, 0.1)', padding: '1px 5px', borderRadius: 4 }}>
                            ⚠️ Dead Link / Ghost Job
                          </span>
                        ) : opp.is_verified_active === 1 ? (
                          <span style={{ color: '#16a34a', fontSize: 10.5, fontWeight: 600 }}>✓ Verified</span>
                        ) : null}
                        {opp.requires_gate === 1 && (
                          <span style={{ color: '#dc2626', fontSize: 10.5, fontWeight: 600 }}>⚠️ GATE</span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                        <span className="jh-visa-pill">
                          <span>{regionEmoji}</span> {visaPillLabel}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span>{getCountryFlag(opp.country)}</span>
                          <span>{opp.country || 'India'}</span>
                        </span>
                      </div>
                    </td>

                    <td>
                      {(() => {
                        const conf = opp.confidence_metadata || {};
                        const isVerifiedComp = conf.compensation === 'high' || (opp.source_type && opp.source_type.includes('api'));
                        const isEstimatedComp = conf.compensation === 'low' || (!opp.ctc_max && !opp.compensation_display);
                        const compText = opp.compensation_display || opp.pay_scale || (opp.ctc_max ? `₹${(opp.ctc_max / 100000).toFixed(1)} LPA` : 'Competitive');

                        if (isVerifiedComp) {
                          return (
                            <span className="jh-ctc-tag" style={{ border: '1px solid rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.08)', color: 'var(--green)' }} title="Official ATS verified compensation">
                              ✓ {compText}
                            </span>
                          );
                        }
                        if (isEstimatedComp) {
                          return (
                            <span className="jh-ctc-tag" style={{ border: '1px dashed var(--ink-faint)', opacity: 0.85, color: 'var(--ink-muted)' }} title="Estimated compensation range — pending disclosure">
                              ~ {compText}
                            </span>
                          );
                        }
                        return <span className="jh-ctc-tag">{compText}</span>;
                      })()}
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="jh-rec-badge" style={{ background: rec.bg, color: rec.color, fontSize: 11, padding: '2px 8px' }}>
                          {rec.icon} {rec.label}
                        </span>
                        <span className="jh-score-badge" style={{ fontSize: 11.5, padding: '2px 6px' }}>
                          {opp.opportunity_score != null ? opp.opportunity_score : '—'}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {opp.posted_date ? (
                          <span style={{ fontSize: 11, color: (daysAgo(opp.posted_date) <= 7) ? 'var(--green)' : 'var(--ink-soft)', fontWeight: 600 }}>
                            {daysAgo(opp.posted_date) <= 0 ? '⚡ Today' : `⚡ ${daysAgo(opp.posted_date)}d ago`}
                          </span>
                        ) : (
                          <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>Recent</span>
                        )}
                        {days != null ? (
                          <span style={{ fontSize: 11, color: urgencyColor(days), fontWeight: 500 }}>
                            {days < 0 ? 'Passed' : days === 0 ? 'Today' : `${days}d left`}
                          </span>
                        ) : (
                          <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>Open</span>
                        )}
                      </div>
                    </td>

                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div className="jh-table-actions" onClick={(e) => e.stopPropagation()}>
                        {opp.application_status === 'rejected' ? (
                          <span
                            className="badge rust"
                            style={{ padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}
                            onClick={() => navigate('/applications')}
                            title="Application rejected — click to view in My Applications"
                          >
                            ❌ Rejected
                          </span>
                        ) : isApplied ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <button
                              type="button"
                              className="jh-table-applied-badge"
                              onClick={() => navigate('/applications')}
                              title="View in My Applications"
                            >
                              <span>✓</span> Applied
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              style={{ color: 'var(--rust)', fontSize: 11, padding: '2px 4px' }}
                              onClick={() => handleMarkStatus(opp, 'rejected')}
                              title="Mark as Rejected"
                            >
                              ✗
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="jh-table-apply-btn"
                            disabled={applyingId === opp.id}
                            onClick={() => handleApply(opp)}
                            title="1-Click Apply & Track into My Applications"
                          >
                            <span>{applyingId === opp.id ? '⏳' : '🚀'}</span>
                            <span>{applyingId === opp.id ? 'Saving…' : 'Apply'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="jh-table-view-btn"
                          style={{ color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.3)' }}
                          onClick={() => navigate(`/prep?orgId=${opp.org_id || ''}&role=${encodeURIComponent(opp.title)}`)}
                          title="View Exam Pattern & Preparation Roadmap"
                        >
                          <span>🎯 Prep</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* 📋 Expanded Cards View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {displayedItems.map((opp) => {
            const rec = REC_CONFIG[opp.recommendation] || REC_CONFIG.ignore;
            const days = daysUntil(opp.application_deadline);
            const applyLink = opp.apply_url || opp.source_url;
            const careersLink = opp.org_careers_url || opp.org_website;
            const primaryLink = applyLink || careersLink;
            const normApply = normalizeUrl(applyLink);
            const normCareers = normalizeUrl(careersLink);
            const hasSeparateCareers = normCareers && normCareers !== normApply;
            const isApplied = opp.is_applied === 1 || !!opp.application_status;

            return (
              <div key={opp.id} className="jh-opp-card" onClick={() => setSelectedOpp(opp)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span>{opp.title}</span>
                      {isNewOpportunity(opp) && (
                        <span style={{
                          padding: '1px 6px',
                          borderRadius: 8,
                          background: 'rgba(52, 211, 153, 0.25)',
                          color: '#34d399',
                          fontSize: 10,
                          fontWeight: 700
                        }}>
                          ⚡ NEW
                        </span>
                      )}
                    </div>
                    {opp.org_name && (
                      <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                        {opp.org_name}{opp.org_sector ? ` · ${opp.org_sector}` : ''}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span>{getCountryFlag(opp.country)}</span>
                        <span>{opp.country || 'India'}</span>
                        {opp.location && <span>· {opp.location}</span>}
                      </span>
                      {(() => {
                        const conf = opp.confidence_metadata || {};
                        const isVerifiedComp = conf.compensation === 'high' || (opp.source_type && opp.source_type.includes('api'));
                        const isEstimatedComp = conf.compensation === 'low' || (!opp.ctc_max && !opp.compensation_display);
                        const compText = opp.compensation_display || opp.pay_scale || (opp.ctc_max ? `₹${(opp.ctc_max / 100000).toFixed(1)} LPA` : null);

                        if (!compText) return null;
                        if (isVerifiedComp) {
                          return (
                            <span className="jh-ctc-tag" style={{ fontSize: 11, border: '1px solid rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.08)', color: 'var(--green)' }} title="Official ATS verified compensation">
                              ✓ {compText}
                            </span>
                          );
                        }
                        if (isEstimatedComp) {
                          return (
                            <span className="jh-ctc-tag" style={{ fontSize: 11, border: '1px dashed var(--ink-faint)', opacity: 0.85, color: 'var(--ink-muted)' }} title="Estimated compensation range">
                              ~ {compText}
                            </span>
                          );
                        }
                        return (
                          <span className="jh-ctc-tag" style={{ fontSize: 11 }}>
                            💰 {compText}
                          </span>
                        );
                      })()}
                      {opp.visa_sponsored === 1 && (
                        <span className="jh-visa-pill" style={{ fontSize: 10.5 }}>
                          ✈️ Visa Sponsored
                        </span>
                      )}
                      {opp.is_active_link === 0 ? (
                        <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', fontWeight: 600 }}>
                          ⚠️ Dead Link / Ghost Job
                        </span>
                      ) : opp.is_verified_active === 1 ? (
                        <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 10, background: 'rgba(34, 197, 94, 0.12)', color: '#16a34a', fontWeight: 600 }}>
                          ✓ Live Verified
                        </span>
                      ) : null}
                      {opp.posted_date && (
                        <span style={{
                          fontSize: 10.5,
                          padding: '2px 7px',
                          borderRadius: 10,
                          background: (daysAgo(opp.posted_date) <= 7) ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255,255,255,0.06)',
                          color: (daysAgo(opp.posted_date) <= 7) ? '#16a34a' : 'var(--ink-soft)',
                          fontWeight: 600
                        }}>
                          ⚡ Posted {daysAgo(opp.posted_date) <= 0 ? 'today' : `${daysAgo(opp.posted_date)}d ago`}
                        </span>
                      )}
                      {opp.requires_gate === 1 && (
                        <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', fontWeight: 600 }}>
                          ⚠️ Requires GATE
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <span className="jh-rec-badge" style={{ background: rec.bg, color: rec.color }}>{rec.icon} {rec.label}</span>
                    <span className="jh-score-badge">{opp.opportunity_score != null ? `${opp.opportunity_score}/100` : '—'}</span>
                  </div>
                </div>

                {days != null ? (
                  <div style={{ fontSize: 12, color: urgencyColor(days), marginTop: 8, fontWeight: 500 }}>
                    {days < 0 ? '⏰ Deadline passed' : days === 0 ? '⚠️ Deadline TODAY' : `📅 ${days} day${days !== 1 ? 's' : ''} left`}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 8, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>⚡</span> <span>Rolling / Open Requisition</span>
                  </div>
                )}

                {/* Score breakdown bars */}
                <div className="jh-score-bars">
                  {[
                    { label: 'Eligibility', val: opp.eligibility_pct },
                    { label: 'Profile Match', val: opp.profile_match_pct },
                    { label: 'Compensation', val: opp.compensation_score },
                    { label: 'Career', val: opp.career_potential_score },
                    { label: 'Competition*', val: opp.competition_signal },
                    { label: 'Difficulty', val: opp.application_difficulty_score },
                    { label: 'Org Quality', val: opp.org_quality_score },
                    { label: 'Urgency', val: opp.deadline_urgency_score },
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

                <div className="app-pipeline-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--hairline)', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                  {opp.application_status === 'rejected' ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span
                        className="badge rust"
                        style={{ padding: '4px 10px', fontSize: 11.5, fontWeight: 600 }}
                        title="Application marked as Rejected in My Applications"
                      >
                        ❌ Rejected
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ fontSize: 11, color: 'var(--ink-soft)' }}
                        onClick={(e) => { e.stopPropagation(); navigate('/applications'); }}
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
                        onClick={(e) => { e.stopPropagation(); navigate('/applications'); }}
                        title="View in My Applications"
                      >
                        <span>✓</span> Applied ({opp.application_status || 'applied'}) ↗
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ fontSize: 11, color: 'var(--rust)', borderColor: 'var(--hairline)' }}
                        onClick={(e) => { e.stopPropagation(); handleMarkStatus(opp, 'rejected'); }}
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
                      onClick={(e) => { e.stopPropagation(); handleApply(opp); }}
                      title="1-Click Apply & Track into My Applications"
                    >
                      <span>{applyingId === opp.id ? '⏳' : '🚀'}</span>
                      <span>{applyingId === opp.id ? 'Saving…' : 'Apply'}</span>
                    </button>
                  )}

                  {hasSeparateCareers && (
                    <a
                      href={careersLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm"
                      style={{ color: 'var(--ink-soft)' }}
                    >
                      🏢 Careers Portal ↗
                    </a>
                  )}

                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.25)', fontWeight: 600 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/prep?orgId=${opp.org_id || ''}&role=${encodeURIComponent(opp.title)}`);
                    }}
                    title="View Tailored Exam Pattern & Round-by-Round Preparation Roadmap"
                  >
                    🎯 Prep ↗
                  </button>
                  <button type="button" className="btn btn-sm" onClick={(e) => { e.stopPropagation(); startEdit(opp); }}>
                    ✏️ Edit
                  </button>
                  {archiveFilter === '0' ? (
                    <button type="button" className="btn btn-sm" onClick={(e) => { e.stopPropagation(); archiveOpp(opp.id, opp.title); }}>
                      📦 Archive
                    </button>
                  ) : (
                    <button type="button" className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); restoreOpp(opp.id); }}>
                      ↩️ Restore
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Zero-Redirect Slide-Over Detail Drawer */}
      <JobHuntDetailDrawer
        opp={selectedOpp}
        onClose={() => setSelectedOpp(null)}
        onApply={handleApply}
        onUnapply={handleUnapply}
        onMarkStatus={handleMarkStatus}
        onEdit={startEdit}
        onArchive={archiveOpp}
        applyingId={applyingId}
      />

      <JobHuntSmartIngestModal
        isOpen={showSmartIngest}
        onClose={() => setShowSmartIngest(false)}
        onSaved={() => load()}
      />
    </div>
  );
}
