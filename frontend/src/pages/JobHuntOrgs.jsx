import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useDialog } from '../components/DialogProvider.jsx';

const ORG_CATEGORY_GROUPS = [
  { id: '', label: 'All Organizations', icon: '🌟' },
  { id: 'startup', label: 'Startups & Scaleups', icon: '🚀' },
  { id: 'research_internship', label: 'Research Fellowships', icon: '🔬' },
  { id: 'psu', label: 'PSUs', icon: '🏭' },
  { id: 'govt', label: 'Govt & Strategic R&D', icon: '🏛️' },
  { id: 'private_in', label: 'Indian Tech', icon: '🇮🇳' },
  { id: 'quant_hft', label: 'Quant & HFT', icon: '⚡' },
  { id: 'private_eu', label: 'EU Visa Providing', icon: '🇪🇺' },
  { id: 'private_sg', label: 'Singapore Visa Providing', icon: '🇸🇬' },
  { id: 'private_global', label: 'Global Remote', icon: '🌐' }
];

const SECTOR_CATEGORIES = [
  'All',
  'Oil & Gas',
  'Power & Energy',
  'Defence & Aerospace',
  'Space & Science',
  'IT & Cloud',
  'Banking & Finance',
  'Mining & Metals',
  'Railways & Infra'
];

const TIER_FILTERS = [
  'All Tiers',
  'Maharatna CPSE',
  'Navratna CPSE',
  'Miniratna CPSE',
  'Govt Strategic & R&D',
  'Regulators & Banking'
];

const ORG_TYPES = [
  'Maharatna CPSE', 'Navratna CPSE', 'Miniratna CPSE',
  'Govt Strategic & R&D', 'Autonomous Body', 'Statutory / Regulatory Body',
  'Private Tech', 'Private Global / EU', 'Private Singapore', 'Other'
];

const emptyForm = {
  name: '', short_name: '', sector: '', org_type: '', parent_org_id: '',
  careers_url: '', notification_url: '', pdf_page_url: '', website: '',
  notes: '', quality_score: '', poll_frequency_days: 7,
  category_group: 'psu', country: 'India', region: 'India',
  visa_sponsored: false, currency: 'INR', min_ctc_threshold: '',
  ats_type: 'custom_scrape', ats_id: ''
};

export default function JobHuntOrgs() {
  const { confirm } = useDialog();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryGroup, setCategoryGroup] = useState('');
  const [filter, setFilter] = useState('All');
  const [tierFilter, setTierFilter] = useState('All Tiers');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [pollingOrgId, setPollingOrgId] = useState(null);
  const [isPollingAll, setIsPollingAll] = useState(false);
  const [pollBanner, setPollBanner] = useState('');

  // Source Health Modal state
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [healthFilter, setHealthFilter] = useState('all');
  const [healthSearch, setHealthSearch] = useState('');
  const [pollingSourceId, setPollingSourceId] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const data = await api.get('/jobhunt/orgs');
    setOrgs(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function openHealthModal() {
    setShowHealthModal(true);
    setLoadingHealth(true);
    try {
      const res = await api.get('/jobhunt/crawler/source-health');
      setHealthData(res);
    } catch (err) {
      console.error('Failed to load source health:', err);
    } finally {
      setLoadingHealth(false);
    }
  }

  async function handleHealthPoll(orgId, orgName) {
    setPollingSourceId(orgId);
    try {
      await api.post(`/jobhunt/crawler/poll/${orgId}`);
      const res = await api.get('/jobhunt/crawler/source-health');
      setHealthData(res);
      load();
    } catch (err) {
      console.error('Health poll failed:', err);
    } finally {
      setPollingSourceId(null);
    }
  }

  async function submit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      parent_org_id: form.parent_org_id ? Number(form.parent_org_id) : null,
      quality_score: form.quality_score !== '' ? Number(form.quality_score) : null,
      poll_frequency_days: Number(form.poll_frequency_days) || 7,
      category_group: form.category_group || 'psu',
      country: form.country || 'India',
      region: form.region || 'India',
      visa_sponsored: form.visa_sponsored ? 1 : 0,
      currency: form.currency || 'INR',
      min_ctc_threshold: form.min_ctc_threshold !== '' ? Number(form.min_ctc_threshold) : null,
      ats_type: form.ats_type || 'custom_scrape',
      ats_id: form.ats_id ? form.ats_id.trim() : null
    };
    if (editingId) {
      await api.put(`/jobhunt/orgs/${editingId}`, payload);
    } else {
      await api.post('/jobhunt/orgs', payload);
    }
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    load();
  }

  function startEdit(org) {
    setForm({
      name: org.name, short_name: org.short_name || '', sector: org.sector || '',
      org_type: org.org_type || '', parent_org_id: org.parent_org_id || '',
      careers_url: org.careers_url || '', notification_url: org.notification_url || '',
      pdf_page_url: org.pdf_page_url || '', website: org.website || '',
      notes: org.notes || '', quality_score: org.quality_score != null ? org.quality_score : '',
      poll_frequency_days: org.poll_frequency_days || 7,
      category_group: org.category_group || 'psu',
      country: org.country || 'India',
      region: org.region || 'India',
      visa_sponsored: org.visa_sponsored === 1 || org.visa_sponsored === true,
      currency: org.currency || 'INR',
      min_ctc_threshold: org.min_ctc_threshold != null ? org.min_ctc_threshold : '',
      ats_type: org.ats_type || 'custom_scrape',
      ats_id: org.ats_id || ''
    });
    setEditingId(org.id);
    setShowForm(true);
  }

  async function archive(id) {
    if (!await confirm('Archive this organization?', { ledger: 'money', danger: true })) return;
    await api.del(`/jobhunt/orgs/${id}`);
    load();
  }

  async function handlePollSingle(orgId, orgName) {
    setPollingOrgId(orgId);
    setPollBanner(`Checking ${orgName} for updates...`);
    try {
      const res = await api.post(`/jobhunt/crawler/poll/${orgId}`);
      if (res.result?.changed) {
        setPollBanner(`🔥 New updates found for ${orgName}! Added ${res.result.new_opportunities_count || 0} opportunities.`);
      } else if (res.result?.status === 'unchanged') {
        setPollBanner(`✅ ${orgName} verified: No changes detected (content hash identical).`);
      } else if (res.result?.skipped) {
        setPollBanner(`ℹ️ ${orgName}: ${res.result.reason}`);
      } else if (res.result?.error) {
        setPollBanner(`⚠️ ${orgName}: ${res.result.error}`);
      }
      load();
      setTimeout(() => setPollBanner(''), 7000);
    } catch (err) {
      setPollBanner(`⚠️ Poll failed: ${err.message}`);
    } finally {
      setPollingOrgId(null);
    }
  }

  async function handlePollAllActive() {
    setIsPollingAll(true);
    setPollBanner('Initiating batch poll across active organizations…');
    try {
      await api.post('/jobhunt/crawler/poll-all', { limit: 20 });

      const pollTimer = setInterval(async () => {
        try {
          const status = await api.get('/jobhunt/crawler/status');
          const prog = status.crawl_progress;
          if (prog && prog.is_running) {
            setPollBanner(`🔄 Polling org ${prog.current_index}/${prog.total}: ${prog.current_org}… (${prog.new_opportunities_count} new opportunities found)`);
          } else {
            clearInterval(pollTimer);
            setIsPollingAll(false);
            const count = prog?.new_opportunities_count || 0;
            const total = prog?.total || 0;
            setPollBanner(`✅ Batch poll complete! Checked ${total} organizations. Discovered ${count} new opportunities.`);
            load();
            setTimeout(() => setPollBanner(''), 8000);
          }
        } catch {
          clearInterval(pollTimer);
          setIsPollingAll(false);
        }
      }, 2000);
    } catch (err) {
      setPollBanner(`⚠️ Batch poll error: ${err.message}`);
      setIsPollingAll(false);
    }
  }

  const filtered = orgs.filter(o => {
    if (categoryGroup) {
      const oppCats = (o.opportunity_categories || '').split(',').map(s => s.trim());
      const hasCatOpp = oppCats.includes(categoryGroup);
      const isEuVisaSponsor = categoryGroup === 'private_eu' && (o.category_group === 'private_eu' || o.visa_sponsored === 1 || hasCatOpp);
      const isIndianTech = categoryGroup === 'private_in' && (o.category_group === 'private_in' || hasCatOpp);
      const isStartup = categoryGroup === 'startup' && (o.category_group === 'startup' || hasCatOpp);
      const isResearch = categoryGroup === 'research_internship' && (o.category_group === 'research_internship' || hasCatOpp);
      const isQuant = categoryGroup === 'quant_hft' && (o.category_group === 'quant_hft' || hasCatOpp);
      if (o.category_group !== categoryGroup && !hasCatOpp && !isEuVisaSponsor && !isIndianTech && !isStartup && !isResearch && !isQuant) return false;
    }
    if (filter !== 'All' && o.sector !== filter) return false;
    if (tierFilter !== 'All Tiers') {
      const matchOrgType = o.org_type?.toLowerCase().includes(tierFilter.toLowerCase());
      const matchSector = o.sector?.toLowerCase().includes(tierFilter.toLowerCase());
      const matchNotes = o.notes?.toLowerCase().includes(tierFilter.toLowerCase());
      if (!matchOrgType && !matchSector && !matchNotes) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const match = o.name.toLowerCase().includes(q) ||
        (o.short_name && o.short_name.toLowerCase().includes(q)) ||
        (o.notes && o.notes.toLowerCase().includes(q)) ||
        (o.sector && o.sector.toLowerCase().includes(q)) ||
        (o.country && o.country.toLowerCase().includes(q)) ||
        (o.opportunity_countries && o.opportunity_countries.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const parentOrgs = filtered.filter(o => !o.parent_org_id);
  const childMap = {};
  filtered.filter(o => o.parent_org_id).forEach(o => {
    if (!childMap[o.parent_org_id]) childMap[o.parent_org_id] = [];
    childMap[o.parent_org_id].push(o);
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="page-eyebrow">Recruitment Sources & Career Portals</div>
          <h1 className="page-title">
            Organization Registry
            <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink-faint)', marginLeft: 10 }}>
              ({filtered.length} of {orgs.length} Targets)
            </span>
          </h1>
          <p className="page-sub" style={{ maxWidth: 780 }}>
            Central repository of Indian PSUs, Govt R&D labs, Premier Indian Tech, and Visa-providing international companies (EU, Singapore, Global Remote).
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-sm"
            onClick={openHealthModal}
            style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: 'rgba(16, 185, 129, 0.35)', color: 'var(--green)' }}
            title="Telemetry dashboard across 48 ATS connectors and HTML scrapers"
          >
            <span>📡</span> Source Health
          </button>
          <button
            className="btn btn-sm"
            disabled={isPollingAll}
            onClick={handlePollAllActive}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>⚡</span> {isPollingAll ? 'Polling All…' : 'Poll All Active'}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(!showForm); }}
          >
            {showForm ? '✕ Close' : '+ Add Org'}
          </button>
        </div>
      </div>

      {pollBanner && (
        <div className="alert-banner alert-info" style={{ marginBottom: 16 }}>
          <span>{pollBanner}</span>
        </div>
      )}

      {/* Category Group Tabs */}
      <div
        className="jh-category-tabs"
        style={{ marginBottom: 14 }}
        onWheel={(e) => {
          if (e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
      >
        {ORG_CATEGORY_GROUPS.map(cg => {
          const isActive = categoryGroup === cg.id;
          const count = cg.id === ''
            ? orgs.length
            : orgs.filter(o => o.category_group === cg.id).length;
          return (
            <button
              key={cg.id}
              type="button"
              className={`jh-cat-tab ${isActive ? 'active' : ''}`}
              onClick={() => setCategoryGroup(cg.id)}
            >
              <span>{cg.icon}</span>
              <span>{cg.label}</span>
              <span className="jh-cat-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div style={{
        padding: '12px 14px',
        borderRadius: '10px',
        background: 'var(--paper-raised)',
        border: '1px solid var(--hairline)',
        marginBottom: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}>
        {/* Sector Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)', marginRight: 4 }}>
            Sector:
          </span>
          {SECTOR_CATEGORIES.map(s => (
            <button
              key={s}
              className={`btn btn-sm ${filter === s ? 'btn-primary' : ''}`}
              onClick={() => setFilter(s)}
              style={{ fontSize: 12, padding: '3px 10px' }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Tier Pills & Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)', marginRight: 4 }}>
              Tier:
            </span>
            {TIER_FILTERS.map(t => (
              <button
                key={t}
                className={`btn btn-sm ${tierFilter === t ? 'btn-primary' : ''}`}
                onClick={() => setTierFilter(t)}
                style={{ fontSize: 11.5, padding: '3px 8px' }}
              >
                {t}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <input
              type="text"
              placeholder="Search by name, country, short code…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid var(--hairline)',
                background: 'var(--input-bg)',
                color: 'var(--ink)',
                fontSize: 12.5,
                width: 240
              }}
            />
            {(categoryGroup || filter !== 'All' || tierFilter !== 'All Tiers' || search) && (
              <button
                className="btn btn-sm"
                onClick={() => { setCategoryGroup(''); setFilter('All'); setTierFilter('All Tiers'); setSearch(''); }}
                style={{ fontSize: 11, padding: '4px 8px' }}
                title="Reset all filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title">{editingId ? 'Edit Organization' : 'Add Organization'}</div>
          <form onSubmit={submit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>Organization Name *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Booking.com, Google India, ISRO" />
              </div>
              <div className="field">
                <label>Short Name / Code</label>
                <input value={form.short_name} onChange={e => setForm({ ...form, short_name: e.target.value })}
                  placeholder="e.g. BCOM, GOOG, ISRO" />
              </div>
              <div className="field">
                <label>Category Group</label>
                <select value={form.category_group} onChange={e => setForm({ ...form, category_group: e.target.value })}>
                  <option value="startup">🚀 High-Growth Startup / Scaleup</option>
                  <option value="research_internship">🔬 Research Institute / University Lab</option>
                  <option value="psu">🏭 PSU</option>
                  <option value="govt">🏛️ Govt & Strategic R&D</option>
                  <option value="private_in">🇮🇳 Indian Tech</option>
                  <option value="quant_hft">⚡ Quant & HFT Fund</option>
                  <option value="private_eu">🇪🇺 EU Countries (Visa Sponsored)</option>
                  <option value="private_sg">🇸🇬 Singapore (Visa Sponsored)</option>
                  <option value="private_global">🌐 Global Remote</option>
                </select>
              </div>
              <div className="field">
                <label>Country</label>
                <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}
                  placeholder="e.g. India, Netherlands, Germany, Singapore" />
              </div>
              <div className="field">
                <label>Sector</label>
                <input value={form.sector} onChange={e => setForm({ ...form, sector: e.target.value })}
                  placeholder="e.g. Travel Tech, Fintech, Aerospace, Cloud" />
              </div>
              <div className="field">
                <label>Org Classification / Tier</label>
                <select value={form.org_type} onChange={e => setForm({ ...form, org_type: e.target.value })}>
                  <option value="">Select…</option>
                  {ORG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Parent Organization</label>
                <select value={form.parent_org_id} onChange={e => setForm({ ...form, parent_org_id: e.target.value })}>
                  <option value="">None (top-level)</option>
                  {orgs.filter(o => o.id !== editingId).map(o => (
                    <option key={o.id} value={o.id}>{o.name}{o.short_name ? ` (${o.short_name})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Quality / Prestige Score (0-100)</label>
                <input type="number" min={0} max={100} value={form.quality_score}
                  onChange={e => setForm({ ...form, quality_score: e.target.value })}
                  placeholder="Subjective quality score" />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Careers Portal URL</label>
                <input value={form.careers_url} onChange={e => setForm({ ...form, careers_url: e.target.value })}
                  placeholder="https://..." />
              </div>
              <div className="field">
                <label>Notification Page URL</label>
                <input value={form.notification_url} onChange={e => setForm({ ...form, notification_url: e.target.value })}
                  placeholder="Notifications / PDF board URL" />
              </div>
              <div className="field">
                <label>Website URL</label>
                <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
                  placeholder="https://..." />
              </div>
              <div className="field">
                <label>ATS Direct API Connector</label>
                <select value={form.ats_type} onChange={e => setForm({ ...form, ats_type: e.target.value })}>
                  <option value="custom_scrape">None / Cheerio HTML Scraper</option>
                  <option value="greenhouse">🌿 Greenhouse (boards-api)</option>
                  <option value="lever">⚡ Lever (api.lever.co)</option>
                  <option value="ashby">🚀 Ashby (api.ashbyhq.com)</option>
                  <option value="smartrecruiters">⚙️ SmartRecruiters (api.smartrecruiters.com)</option>
                  <option value="workday">💼 Workday CXS (REST JSON API)</option>
                </select>
              </div>
              <div className="field">
                <label>ATS Board ID / Slug</label>
                <input value={form.ats_id} onChange={e => setForm({ ...form, ats_id: e.target.value })}
                  placeholder="e.g. coinbase, stripe, notion" />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1', background: 'var(--paper-subtle, rgba(0,0,0,0.02))', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--hairline)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={form.visa_sponsored}
                    onChange={e => setForm({ ...form, visa_sponsored: e.target.checked })}
                  />
                  <span>✈️ Confirmed Visa Sponsorship / Relocation Assistance</span>
                </label>
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Notes (e.g. Package benchmark, visa details)</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Key things to remember about this org…"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--hairline)', background: 'var(--input-bg)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}>
              {editingId ? 'Save Changes' : 'Add Organization'}
            </button>
          </form>
        </div>
      )}

      {/* Org list */}
      {loading ? <div className="empty-state">Loading…</div> : filtered.length === 0 ? (
        <div className="card empty-state">
          No organizations match these filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {parentOrgs.map(org => (
            <div key={org.id}>
              <OrgCard
                org={org}
                onEdit={() => startEdit(org)}
                onArchive={() => archive(org.id)}
                onPoll={() => handlePollSingle(org.id, org.name)}
                isPolling={pollingOrgId === org.id}
              />
              {childMap[org.id] && childMap[org.id].length > 0 && (
                <div style={{ marginLeft: 28, borderLeft: '2px solid var(--hairline)', paddingLeft: 16 }}>
                  {childMap[org.id].map(child => (
                    <OrgCard
                      key={child.id}
                      org={child}
                      onEdit={() => startEdit(child)}
                      onArchive={() => archive(child.id)}
                      onPoll={() => handlePollSingle(child.id, child.name)}
                      isPolling={pollingOrgId === child.id}
                      isChild
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
          {/* Orphaned children whose parent doesn't match filter */}
          {filtered.filter(o => o.parent_org_id && !parentOrgs.some(p => p.id === o.parent_org_id) && !Object.values(childMap).flat().some(c => c.id === o.id)).map(org => (
            <OrgCard
              key={org.id}
              org={org}
              onEdit={() => startEdit(org)}
              onArchive={() => archive(org.id)}
              onPoll={() => handlePollSingle(org.id, org.name)}
              isPolling={pollingOrgId === org.id}
            />
          ))}
        </div>
      )}

      {/* Source Health & Telemetry Drawer */}
      <SourceHealthDrawer
        isOpen={showHealthModal}
        onClose={() => setShowHealthModal(false)}
        healthData={healthData}
        loading={loadingHealth}
        onPoll={handleHealthPoll}
        pollingId={pollingSourceId}
      />
    </div>
  );
}

function OrgCard({ org, onEdit, onArchive, onPoll, isPolling, isChild }) {
  const navigate = useNavigate();
  const hasUrl = Boolean(org.careers_url || org.notification_url || (org.ats_type && org.ats_type !== 'custom_scrape'));
  const lastPolledDate = org.last_checked_at ? new Date(org.last_checked_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

  const regionEmoji =
    org.category_group === 'startup' ? '🚀' :
    org.category_group === 'research_internship' ? '🔬' :
    org.category_group === 'quant_hft' ? '⚡' :
    org.category_group === 'private_eu' ? '🇪🇺' :
    org.category_group === 'private_sg' ? '🇸🇬' :
    org.category_group === 'private_in' ? '🇮🇳' :
    org.category_group === 'private_global' ? '🌐' :
    org.category_group === 'psu' ? '🏭' :
    org.category_group === 'govt' ? '🏛️' : '📍';

  return (
    <div className="jh-org-card" style={{ marginBottom: isChild ? 8 : 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {org.name}
            {org.short_name && <span style={{ fontWeight: 400, color: 'var(--ink-faint)', fontSize: 12.5 }}>({org.short_name})</span>}
            {lastPolledDate && (
              <span className="badge badge-outline" style={{ fontSize: 11, padding: '2px 6px' }} title="Last crawler poll">
                Polled: {lastPolledDate}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {org.country && (
              <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {regionEmoji} {org.country}
              </span>
            )}
            {org.ats_type && org.ats_type !== 'custom_scrape' && (
              <span style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--green)', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600 }} title={`Direct API Connector (${org.ats_type})`}>
                ⚡ ATS: {org.ats_type.toUpperCase()}
              </span>
            )}
            {org.last_crawl_status === 'success' && (
              <span style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--green)', fontWeight: 500 }}>
                ✓ {org.last_jobs_found || 0} roles
              </span>
            )}
            {org.last_crawl_status && org.last_crawl_status.startsWith('error') && (
              <span style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 4, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 500 }} title={org.last_crawl_status}>
                ⚠️ Crawl Error
              </span>
            )}
            {org.visa_sponsored === 1 && (
              <span className="jh-visa-pill" style={{ fontSize: 10.5 }}>
                ✈️ Visa Providing
              </span>
            )}
            {org.active_opps_count > 0 && (
              <span style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 4, background: 'rgba(59, 130, 246, 0.12)', color: 'var(--blue)', border: '1px solid rgba(59, 130, 246, 0.25)', fontWeight: 600 }}>
                🎯 {org.active_opps_count} Active Role{org.active_opps_count !== 1 ? 's' : ''}
              </span>
            )}
            {org.opportunity_countries && (
              <span style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 4, background: 'var(--hairline)', color: 'var(--ink-soft)' }} title="Countries with active opportunities">
                🌍 {org.opportunity_countries.split(',').join(', ')}
              </span>
            )}
            {org.sector && <span className="jh-sector-pill">{org.sector}</span>}
            {org.org_type && <span className="jh-type-pill">{org.org_type}</span>}
            {org.quality_score != null && (
              <span className="jh-score-badge" style={{ fontSize: 11 }}>⭐ {org.quality_score}/100</span>
            )}
            {org.child_count > 0 && (
              <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>📂 {org.child_count} sub-org{org.child_count !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {hasUrl && (
            <button
              className="btn btn-sm"
              disabled={isPolling}
              onClick={onPoll}
              style={{ fontSize: 11.5, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
              title="Poll careers page now"
            >
              <span>⚡</span> {isPolling ? 'Checking…' : 'Poll'}
            </button>
          )}
          <button
            className="icon-btn"
            style={{ color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.3)' }}
            onClick={() => navigate(`/prep?orgId=${org.id}`)}
            title="View Exam Pattern & Preparation Roadmap for this Organization"
          >
            🎯 Prep ↗
          </button>
          <button className="icon-btn" onClick={onEdit}>Edit</button>
          <button className="icon-btn" onClick={onArchive}>Archive</button>
        </div>
      </div>
      {(org.careers_url || org.website || org.notification_url) && (
        <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {org.careers_url ? (
            <a
              href={org.careers_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}
              title={`Careers Portal: ${org.careers_url}`}
            >
              🔗 Careers Page ↗
            </a>
          ) : org.website ? (
            <a
              href={org.website}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}
              title={`Portal / Website: ${org.website}`}
            >
              🔗 Portal / Website ↗
            </a>
          ) : null}
          {org.notification_url && (
            <a
              href={org.notification_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: 'var(--accent)' }}
              title={`Notifications: ${org.notification_url}`}
            >
              📋 Notifications ↗
            </a>
          )}
          {org.website && org.careers_url && org.website !== org.careers_url && (
            <a
              href={org.website}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: 'var(--ink-faint)' }}
              title={`Official Website: ${org.website}`}
            >
              🌐 Website ↗
            </a>
          )}
        </div>
      )}
      {org.notes && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6, lineHeight: 1.4 }}>{org.notes}</div>}
    </div>
  );
}

function SourceHealthDrawer({ isOpen, onClose, healthData, loading, onPoll, pollingId }) {
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const summary = healthData?.summary || {
    total_orgs: 0,
    ats_connected_count: 0,
    healthy_count: 0,
    warning_count: 0,
    total_jobs_tracked: 0
  };

  const orgs = healthData?.organizations || [];

  const filteredOrgs = orgs.filter(o => {
    if (filterType === 'ats' && (!o.ats_type || o.ats_type === 'custom_scrape')) return false;
    if (filterType === 'healthy' && o.last_crawl_status !== 'success') return false;
    if (filterType === 'warning' && (!o.last_crawl_status || !o.last_crawl_status.startsWith('error'))) return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match = o.name?.toLowerCase().includes(q) ||
        (o.short_name && o.short_name.toLowerCase().includes(q)) ||
        (o.ats_type && o.ats_type.toLowerCase().includes(q)) ||
        (o.ats_id && o.ats_id.toLowerCase().includes(q)) ||
        (o.sector && o.sector.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="jh-drawer-overlay" onClick={onClose}>
      <div className="jh-drawer" style={{ maxWidth: 880 }} onClick={e => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="jh-drawer-header">
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--green)', marginBottom: 2 }}>
              📡 Crawler Operations & Telemetry
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
              Source Health & Reliability Panel
            </h2>
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '4px 0 0 0' }}>
              Real-time monitoring across direct ATS unauthenticated JSON APIs and HTML scrapers.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              color: 'var(--ink-soft)',
              fontSize: 16,
              padding: '4px 10px',
              borderRadius: 8,
              cursor: 'pointer'
            }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Drawer Body */}
        <div className="jh-drawer-body">
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div className="jh-drawer-card">
              <div className="jh-drawer-label">Total Sources</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>{summary.total_orgs}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>Across all sectors & tiers</div>
            </div>

            <div className="jh-drawer-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)' }}>
              <div className="jh-drawer-label" style={{ color: 'var(--green)' }}>⚡ Direct ATS Connected</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>{summary.ats_connected_count}</div>
              <div style={{ fontSize: 11, color: 'var(--green)', opacity: 0.8, marginTop: 2 }}>100% JSON API Reliability</div>
            </div>

            <div className="jh-drawer-card">
              <div className="jh-drawer-label">✓ Active Healthy Crawls</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{summary.healthy_count}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>Successfully indexed</div>
            </div>

            <div className="jh-drawer-card">
              <div className="jh-drawer-label">Active Roles Indexed</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{summary.total_jobs_tracked}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>Across crawled targets</div>
            </div>
          </div>

          {/* Platform Distribution Tags */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--hairline)',
            borderRadius: 8,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            fontSize: 12
          }}>
            <span style={{ fontWeight: 600, color: 'var(--ink-soft)' }}>Supported Platforms:</span>
            <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(16, 185, 129, 0.12)', color: 'var(--green)', fontWeight: 500 }}>
              🌿 Greenhouse (boards-api)
            </span>
            <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(14, 165, 233, 0.12)', color: '#0ea5e9', fontWeight: 500 }}>
              ⚙️ SmartRecruiters
            </span>
            <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', fontWeight: 500 }}>
              🚀 Ashby
            </span>
            <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(249, 115, 22, 0.12)', color: '#f97316', fontWeight: 500 }}>
              ⚡ Lever
            </span>
            <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', fontWeight: 500 }}>
              💼 Workday CXS (REST JSON)
            </span>
            <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(255, 255, 255, 0.05)', color: 'var(--ink-faint)', fontWeight: 500 }}>
              🌐 Cheerio HTML / Static / PSU
            </span>
          </div>

          {/* Filter Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: `All (${orgs.length})` },
                { id: 'ats', label: `⚡ Direct ATS (${summary.ats_connected_count})` },
                { id: 'healthy', label: `✓ Healthy (${summary.healthy_count})` },
                { id: 'warning', label: `⚠️ Errors (${summary.warning_count})` }
              ].map(t => (
                <button
                  key={t.id}
                  className={`btn btn-sm ${filterType === t.id ? 'btn-primary' : ''}`}
                  onClick={() => setFilterType(t.id)}
                  style={{ fontSize: 11.5, padding: '3px 9px' }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Search source by company, connector, slug…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--hairline)',
                background: 'var(--input-bg)',
                color: 'var(--ink)',
                fontSize: 12,
                width: 250
              }}
            />
          </div>

          {/* Sources Table */}
          {loading ? (
            <div className="empty-state">Loading source telemetry…</div>
          ) : filteredOrgs.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>No sources match the selected criteria.</div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--hairline)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: 'var(--navy-raised)', borderBottom: '1px solid var(--hairline)', textAlign: 'left', color: 'var(--ink-faint)' }}>
                    <th style={{ padding: '10px 12px' }}>Organization</th>
                    <th style={{ padding: '10px 12px' }}>Connector</th>
                    <th style={{ padding: '10px 12px' }}>Last Pull</th>
                    <th style={{ padding: '10px 12px' }}>Jobs</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrgs.map(o => {
                    const isATS = o.ats_type && o.ats_type !== 'custom_scrape';
                    const isPollingThis = pollingId === o.id;

                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{o.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                            {o.country || 'India'} &bull; {o.sector || 'Tech'}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {isATS ? (
                            <div>
                              <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--green)', fontWeight: 600 }}>
                                ⚡ {o.ats_type.toUpperCase()}
                              </span>
                              {o.ats_id && (
                                <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 2, fontFamily: 'monospace' }}>
                                  slug: {o.ats_id}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                              Cheerio HTML
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--ink-soft)' }}>
                          {o.last_successful_pull
                            ? new Date(o.last_successful_pull).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : o.last_checked_at
                            ? new Date(o.last_checked_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                            : 'Never'}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: (o.last_jobs_found > 0) ? 'var(--green)' : 'var(--ink-faint)' }}>
                          {o.last_jobs_found || 0}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {o.last_crawl_status === 'success' ? (
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: 'rgba(16, 185, 129, 0.12)', color: 'var(--green)', fontWeight: 600 }}>
                              ✓ Healthy
                            </span>
                          ) : o.last_crawl_status && o.last_crawl_status.startsWith('error') ? (
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', fontWeight: 600 }} title={o.last_crawl_status}>
                              ⚠️ Error
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                              Pending
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            className="btn btn-sm"
                            disabled={isPollingThis}
                            onClick={() => onPoll(o.id, o.name)}
                            style={{ fontSize: 11, padding: '3px 8px' }}
                          >
                            {isPollingThis ? '⏳' : '⚡ Poll'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="jh-drawer-footer" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

