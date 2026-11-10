import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useDialog } from '../components/DialogProvider.jsx';

export default function JobHuntApplicationWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { confirm } = useDialog();

  const oppIdParam = searchParams.get('oppId');
  const pkgIdParam = searchParams.get('pkgId');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [activeTab, setActiveTab] = useState('resume'); // 'resume' | 'cover_letter' | 'review' | 'timeline' | 'jd'
  
  const [packages, setPackages] = useState([]);
  const [activePkg, setActivePkg] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [selectedOppId, setSelectedOppId] = useState(oppIdParam || '');
  
  // Editable document state
  const [resumeMd, setResumeMd] = useState('');
  const [coverLetterMd, setCoverLetterMd] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // Events & follow-ups state
  const [events, setEvents] = useState([]);
  const [followupDraft, setFollowupDraft] = useState(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventType, setNewEventType] = useState('contacted');
  const [newEventNotes, setNewEventNotes] = useState('');

  useEffect(() => {
    loadInitial();
  }, [oppIdParam, pkgIdParam]);

  async function loadInitial() {
    setLoading(true);
    try {
      // 1. Fetch opportunities for switcher dropdown
      const opps = await api.get('/jobhunt/opportunities?is_archived=0&limit=100');
      setOpportunities(opps.items || opps || []);

      // 2. Fetch packages
      let pkgs = [];
      if (pkgIdParam) {
        const p = await api.get(`/jobhunt/documents/packages/${pkgIdParam}`);
        pkgs = [p];
        setActivePkg(p);
        setResumeMd(p.tailored_resume_markdown || '');
        setCoverLetterMd(p.tailored_cover_letter_markdown || '');
        if (p.opportunity_id) setSelectedOppId(String(p.opportunity_id));
        loadEvents(p.application_id);
      } else if (oppIdParam) {
        pkgs = await api.get(`/jobhunt/documents/packages?opportunity_id=${oppIdParam}`);
        if (pkgs.length > 0) {
          const detailed = await api.get(`/jobhunt/documents/packages/${pkgs[0].id}`);
          setActivePkg(detailed);
          setResumeMd(detailed.tailored_resume_markdown || '');
          setCoverLetterMd(detailed.tailored_cover_letter_markdown || '');
          loadEvents(detailed.application_id);
        } else {
          setActivePkg(null);
        }
      } else {
        pkgs = await api.get('/jobhunt/documents/packages');
        if (pkgs.length > 0) {
          const detailed = await api.get(`/jobhunt/documents/packages/${pkgs[0].id}`);
          setActivePkg(detailed);
          setResumeMd(detailed.tailored_resume_markdown || '');
          setCoverLetterMd(detailed.tailored_cover_letter_markdown || '');
          loadEvents(detailed.application_id);
        }
      }
      setPackages(pkgs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents(appId) {
    if (!appId) return;
    try {
      const evts = await api.get(`/jobhunt/documents/applications/${appId}/events`);
      setEvents(evts || []);
    } catch (err) {
      console.warn('Could not load events:', err);
    }
  }

  async function handleGenerate(oppId) {
    const targetId = oppId || selectedOppId;
    if (!targetId) {
      alert('Please select an opportunity to generate a tailored document package.');
      return;
    }
    setGenerating(true);
    try {
      const res = await api.post('/jobhunt/documents/generate', { opportunity_id: targetId });
      setToastMsg(`✓ Tailored package created for ${res.org_name}! Review score: ${res.review_score}/100`);
      setTimeout(() => setToastMsg(''), 6000);
      setSearchParams({ pkgId: res.package_id });
    } catch (err) {
      alert(`Generation failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSavePackage() {
    if (!activePkg) return;
    setSaving(true);
    try {
      await api.put(`/jobhunt/documents/packages/${activePkg.id}`, {
        tailored_resume_markdown: resumeMd,
        tailored_cover_letter_markdown: coverLetterMd
      });
      setToastMsg('✓ Changes saved to document package!');
      setTimeout(() => setToastMsg(''), 4000);
    } catch (err) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleReReview() {
    if (!activePkg) return;
    setReviewing(true);
    try {
      // Save changes first
      await api.put(`/jobhunt/documents/packages/${activePkg.id}`, {
        tailored_resume_markdown: resumeMd,
        tailored_cover_letter_markdown: coverLetterMd
      });
      const res = await api.post(`/jobhunt/documents/packages/${activePkg.id}/review`, {});
      const reloaded = await api.get(`/jobhunt/documents/packages/${activePkg.id}`);
      setActivePkg(reloaded);
      setToastMsg(`✓ Review complete! Factual Consistency Score: ${res.review.reviewScore}/100`);
      setTimeout(() => setToastMsg(''), 5000);
      setActiveTab('review');
    } catch (err) {
      alert(`Review failed: ${err.message}`);
    } finally {
      setReviewing(false);
    }
  }

  async function handleAddEvent(e) {
    e.preventDefault();
    if (!activePkg?.application_id) {
      alert('This package is not linked to an application record yet. Mark it as submitted or apply to link.');
      return;
    }
    if (!newEventTitle) return;
    try {
      await api.post(`/jobhunt/documents/applications/${activePkg.application_id}/events`, {
        event_type: newEventType,
        title: newEventTitle,
        notes: newEventNotes
      });
      setNewEventTitle('');
      setNewEventNotes('');
      loadEvents(activePkg.application_id);
    } catch (err) {
      alert(`Failed to add event: ${err.message}`);
    }
  }

  async function fetchFollowupDraft(type) {
    if (!activePkg?.application_id) return;
    try {
      const draft = await api.get(`/jobhunt/documents/applications/${activePkg.application_id}/followup-draft?type=${type}`);
      setFollowupDraft(draft);
    } catch (err) {
      alert(`Could not generate draft: ${err.message}`);
    }
  }

  function handlePrintAts(docType) {
    if (!activePkg) return;
    window.open(`/api/jobhunt/documents/packages/${activePkg.id}/render/${docType}`, '_blank');
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-eyebrow">Dossier Tailoring & Anti-Hallucination Engine</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Application Workspace</h1>
            <p className="page-sub">Draft, review, and export ATS-optimized resumes and cover letters strictly grounded in your confirmed profile facts.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link to="/profile" className="btn btn-sm" title="Manage master verified career profile">
              👤 Evidence Base
            </Link>
            <Link to="/applications" className="btn btn-sm" title="View application pipeline">
              📨 My Applications
            </Link>
          </div>
        </div>
      </div>

      {toastMsg && (
        <div className="card" style={{ background: 'var(--green-soft)', border: '1px solid var(--green)', color: 'var(--green)', padding: '10px 14px', marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
          {toastMsg}
        </div>
      )}

      {/* Target Opportunity Selector / Workspace Switcher */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>Target Opportunity:</span>
            <select
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--hairline)',
                background: 'var(--input-bg)',
                color: 'var(--ink)',
                fontSize: 13
              }}
              value={selectedOppId}
              onChange={(e) => {
                setSelectedOppId(e.target.value);
                setSearchParams({ oppId: e.target.value });
              }}
            >
              <option value="">-- Choose Opportunity from Radar --</option>
              {opportunities.map(o => (
                <option key={o.id} value={o.id}>
                  {o.org_name || 'Employer'} — {o.title} ({o.opportunity_score}/100)
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary btn-sm"
              disabled={generating || !selectedOppId}
              onClick={() => handleGenerate(selectedOppId)}
              title="Tailors resume and cover letter strictly to this opportunity's requirements"
            >
              {generating ? '⏳ Tailoring…' : '✨ Generate Tailored Package'}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading application workspace…</div>
      ) : !activePkg ? (
        <div className="card empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No Document Package Selected</div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', maxWidth: 460, margin: '0 auto 16px auto' }}>
            Select an opportunity above and click <strong>"Generate Tailored Package"</strong> to create a resume and cover letter customized for that exact job posting using confirmed facts.
          </p>
        </div>
      ) : (
        <>
          {/* Active Package Banner & Fact Check Status */}
          <div className="card" style={{ marginBottom: 16, padding: '14px 18px', borderLeft: activePkg.latest_review?.hallucination_risk === 'none' ? '4px solid var(--green)' : '4px solid var(--rust)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                    {activePkg.org_name} — {activePkg.role_title}
                  </h2>
                  <span className={`badge ${activePkg.status === 'submitted' ? 'green' : activePkg.status === 'approved' ? 'brass' : 'default'}`}>
                    v{activePkg.version} · {activePkg.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                  Created on {new Date(activePkg.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {activePkg.application_id && <span> • Linked to Application #{activePkg.application_id}</span>}
                </div>
              </div>

              {/* Fact Check Score Pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {activePkg.latest_review ? (
                  <div style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: activePkg.latest_review.hallucination_risk === 'none' ? 'var(--green-soft)' : 'var(--rust-soft)',
                    color: activePkg.latest_review.hallucination_risk === 'none' ? 'var(--green)' : 'var(--rust)',
                    border: `1px solid ${activePkg.latest_review.hallucination_risk === 'none' ? 'var(--green)' : 'var(--rust)'}`,
                    fontSize: 12.5,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <span>{activePkg.latest_review.hallucination_risk === 'none' ? '🛡️' : '⚠️'}</span>
                    <span>Fact Check Score: {activePkg.latest_review.review_score}/100</span>
                    <span style={{ fontSize: 11, fontWeight: 500 }}>({activePkg.latest_review.hallucination_risk} risk)</span>
                  </div>
                ) : null}

                <button className="btn btn-sm" disabled={reviewing} onClick={handleReReview} title="Audit draft line-by-line against verified profile claims">
                  {reviewing ? 'Audit…' : '🛡️ Fact Check'}
                </button>
                <button className="btn btn-primary btn-sm" disabled={saving} onClick={handleSavePackage}>
                  {saving ? 'Saving…' : '💾 Save Draft'}
                </button>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, borderBottom: '1px solid var(--hairline)', paddingBottom: 8, flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${activeTab === 'resume' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('resume')}
            >
              📄 Tailored Resume (CV)
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'cover_letter' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('cover_letter')}
            >
              ✉️ Cover Letter
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'review' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('review')}
            >
              🛡️ Anti-Hallucination Audit
              {activePkg.latest_review?.unsupported_claims?.length > 0 && (
                <span style={{ marginLeft: 6, background: 'var(--rust)', color: '#fff', padding: '1px 5px', borderRadius: 10, fontSize: 10.5 }}>
                  {activePkg.latest_review.unsupported_claims.length}
                </span>
              )}
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'timeline' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              📅 Events & Follow-ups
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'jd' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('jd')}
            >
              🎯 Target Job Description
            </button>
          </div>

          {/* Tab Content 1: Resume */}
          {activeTab === 'resume' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                  Live Markdown Editor & ATS Preview
                </span>
                <button className="btn btn-sm" onClick={() => handlePrintAts('resume')}>
                  🖨️ Open ATS Printable View ↗
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <textarea
                    value={resumeMd}
                    onChange={(e) => setResumeMd(e.target.value)}
                    rows={28}
                    style={{
                      width: '100%',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12.5,
                      lineHeight: 1.5,
                      padding: 14,
                      borderRadius: 8,
                      border: '1px solid var(--hairline)',
                      background: 'var(--input-bg)',
                      color: 'var(--ink)',
                      resize: 'vertical'
                    }}
                    placeholder="Resume markdown content..."
                  />
                </div>
                <div className="card" style={{ background: '#ffffff', color: '#111827', padding: 20, maxHeight: 680, overflowY: 'auto', border: '1px solid var(--hairline)' }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, borderBottom: '1px solid #e2e8f0', paddingBottom: 6, marginBottom: 14 }}>
                    Live Rendered Preview
                  </div>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.45, margin: 0 }}>
                    {resumeMd}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 2: Cover Letter */}
          {activeTab === 'cover_letter' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                  Tailored Cover Letter Editor
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      navigator.clipboard.writeText(coverLetterMd);
                      setToastMsg('✓ Cover letter copied to clipboard!');
                      setTimeout(() => setToastMsg(''), 3000);
                    }}
                  >
                    📋 Copy Text
                  </button>
                  <button className="btn btn-sm" onClick={() => handlePrintAts('cover_letter')}>
                    🖨️ Printable View ↗
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <textarea
                    value={coverLetterMd}
                    onChange={(e) => setCoverLetterMd(e.target.value)}
                    rows={24}
                    style={{
                      width: '100%',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12.5,
                      lineHeight: 1.5,
                      padding: 14,
                      borderRadius: 8,
                      border: '1px solid var(--hairline)',
                      background: 'var(--input-bg)',
                      color: 'var(--ink)',
                      resize: 'vertical'
                    }}
                    placeholder="Cover letter markdown content..."
                  />
                </div>
                <div className="card" style={{ background: '#ffffff', color: '#111827', padding: 20, maxHeight: 680, overflowY: 'auto', border: '1px solid var(--hairline)' }}>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                    {coverLetterMd}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 3: Anti-Hallucination Review */}
          {activeTab === 'review' && (
            <div className="card">
              <div className="section-title">🛡️ Fact Check & Evidence Audit</div>
              {activePkg.latest_review ? (
                <div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: 20 }}>
                    {activePkg.latest_review.critique_notes}
                  </div>

                  {activePkg.latest_review.unsupported_claims?.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--rust)', marginBottom: 8 }}>
                        ⚠️ Flagged Unverified Claims ({activePkg.latest_review.unsupported_claims.length}):
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {activePkg.latest_review.unsupported_claims.map((un, idx) => (
                          <div key={idx} style={{ background: 'var(--rust-soft)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--rust)', fontSize: 12.5 }}>
                            <div style={{ fontWeight: 600, color: 'var(--rust)' }}>"{un.text_snippet}"</div>
                            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 4 }}>{un.reason}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activePkg.latest_review.missing_requirements?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brass)', marginBottom: 8 }}>
                        ℹ️ Skill Gap Advisory:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {activePkg.latest_review.missing_requirements.map(req => (
                          <span key={req} className="jh-sector-pill" style={{ background: 'var(--brass-soft)', color: 'var(--brass)' }}>
                            {req}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state">No review generated yet. Click "Fact Check" above to audit this package.</div>
              )}
            </div>
          )}

          {/* Tab Content 4: Application Events & Follow-ups */}
          {activeTab === 'timeline' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16 }}>
              {/* Event Timeline */}
              <div className="card">
                <div className="section-title">📅 Application Event Timeline</div>
                {events.length === 0 ? (
                  <div className="empty-state">No events recorded for this application yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                    {events.map(ev => (
                      <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
                        <span style={{ fontSize: 16 }}>
                          {ev.event_type === 'submitted' ? '📨' : ev.event_type === 'interview' ? '🎙️' : ev.event_type === 'offer' ? '🎉' : ev.event_type === 'rejected' ? '❌' : '📌'}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{ev.title}</div>
                          {ev.notes && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{ev.notes}</div>}
                          <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>
                            {new Date(ev.event_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Event Form */}
                <form onSubmit={handleAddEvent} style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--hairline)' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>+ Log New Milestone Event</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginBottom: 8 }}>
                    <select
                      value={newEventType}
                      onChange={(e) => setNewEventType(e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--hairline)', background: 'var(--input-bg)', color: 'var(--ink)', fontSize: 12.5 }}
                    >
                      <option value="submitted">📨 Submitted</option>
                      <option value="contacted">📞 Recruiter Screen</option>
                      <option value="interview">🎙️ Technical Round</option>
                      <option value="offer">🎉 Offer Received</option>
                      <option value="followup_sent">✉️ Follow-up Sent</option>
                      <option value="rejected">❌ Rejection</option>
                    </select>
                    <input
                      required
                      placeholder="e.g. Completed Round 1 Technical with Engineering Manager"
                      value={newEventTitle}
                      onChange={(e) => setNewEventTitle(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--hairline)', background: 'var(--input-bg)', color: 'var(--ink)', fontSize: 12.5 }}
                    />
                  </div>
                  <input
                    placeholder="Optional notes or key talking points..."
                    value={newEventNotes}
                    onChange={(e) => setNewEventNotes(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--hairline)', background: 'var(--input-bg)', color: 'var(--ink)', fontSize: 12.5, marginBottom: 8 }}
                  />
                  <button type="submit" className="btn btn-sm btn-primary">
                    Log Event
                  </button>
                </form>
              </div>

              {/* Follow-up Draft Generator */}
              <div className="card">
                <div className="section-title">✉️ Follow-up Intelligence (M8)</div>
                <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '4px 0 12px 0' }}>
                  Generate context-aware follow-up notes grounded in your application history.
                </p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button className="btn btn-sm" onClick={() => fetchFollowupDraft('check_in')}>
                    📨 7-Day Check-in
                  </button>
                  <button className="btn btn-sm" onClick={() => fetchFollowupDraft('thank_you')}>
                    🤝 Post-Interview Thank You
                  </button>
                </div>

                {followupDraft && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
                      Subject: {followupDraft.subject}
                    </div>
                    <textarea
                      readOnly
                      rows={12}
                      value={followupDraft.body}
                      style={{
                        width: '100%',
                        fontSize: 12,
                        padding: 10,
                        borderRadius: 6,
                        border: '1px solid var(--hairline)',
                        background: 'var(--input-bg)',
                        color: 'var(--ink)',
                        lineHeight: 1.45,
                        marginBottom: 8
                      }}
                    />
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        navigator.clipboard.writeText(`Subject: ${followupDraft.subject}\n\n${followupDraft.body}`);
                        setToastMsg('✓ Email draft copied to clipboard!');
                        setTimeout(() => setToastMsg(''), 3000);
                      }}
                    >
                      📋 Copy Subject & Body
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab Content 5: Target JD */}
          {activeTab === 'jd' && (
            <div className="card">
              <div className="section-title">🎯 Target Job Description</div>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, background: 'var(--paper-hover)', padding: 16, borderRadius: 8, border: '1px solid var(--hairline)' }}>
                {activePkg.target_job_description || 'No job description text provided.'}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
