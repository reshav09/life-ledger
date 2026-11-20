import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import JobHuntEvidencePanel from '../components/JobHuntEvidencePanel';
import JobHuntFollowupReminders from '../components/JobHuntFollowupReminders';
import { useDialog } from '../components/DialogProvider.jsx';

/**
 * Standard ATS Resume & Cover Letter Markdown Renderer.
 * Converts markdown into pure ATS-standard HTML:
 * - Proper clickable links with safe URLs (e.g. [LinkedIn](url) -> <a>)
 * - Renders **bold** and *italic* cleanly
 * - Formats horizontal divider lines (---) into standard divider borders
 * - Converts bullet lists (*, -, •) into standard <ul><li> items with clean typography
 * - Enforces single-column linear reading order for 100% ATS score (Workday, Greenhouse, Taleo, Lever)
 */
function renderAtsDocumentHtml(markdown, isCoverLetter = false) {
  if (!markdown) return '';

  const escape = (str) =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const formatInline = (text) => {
    let out = escape(text);
    // Markdown link: [Label](url) -> clean clickable anchor
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
      const cleanUrl = url.replace(/&amp;/g, '&');
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" style="color:#0284c7;text-decoration:underline;text-underline-offset:2px;font-weight:500;">${label}</a>`;
    });
    // Bold: **text** -> strong
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight:700;color:#0f172a;">$1</strong>');
    // Italic: *text* or _text_ -> em
    out = out.replace(/(?:^|[^*])\*([^*]+)\*(?:[^*]|$)/g, ' <em>$1</em> ');
    // Inline code: `code`
    out = out.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:11.5px;font-family:monospace;color:#0f172a;">$1</code>');
    return out;
  };

  const lines = String(markdown).split('\n');
  const htmlParts = [];
  let currentListItems = [];
  let lastHeadingLevel = 0;

  const flushList = () => {
    if (currentListItems.length > 0) {
      let listHtml = '<ul style="margin:4px 0 10px 0;padding-left:18px;list-style-type:disc;">';
      for (const item of currentListItems) {
        listHtml += `<li style="margin-bottom:4px;color:#1e293b;line-height:1.5;font-size:12.5px;font-family:'Arial',sans-serif;">${item.title}`;
        if (item.children.length > 0) {
          for (const child of item.children) {
            listHtml += `<div style="margin-top:2px;margin-bottom:3px;color:#475569;font-size:12px;line-height:1.45;">${child}</div>`;
          }
        }
        listHtml += '</li>';
      }
      listHtml += '</ul>';
      htmlParts.push(listHtml);
      currentListItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Horizontal rule: --- or ***
    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushList();
      htmlParts.push('<hr style="border:none;border-top:1.5px solid #0f172a;margin:10px 0 14px 0;opacity:0.85;"/>');
      continue;
    }

    // Bullet lists: *, -, •
    const bulletMatch = /^\s*([*\-•])\s+(.+)$/.exec(rawLine);
    if (bulletMatch) {
      currentListItems.push({
        title: formatInline(bulletMatch[2]),
        children: []
      });
      continue;
    }

    // Indented continuation line under the current bullet (e.g. publication details)
    const isIndented = /^\s{2,}\S/.test(rawLine);
    if (currentListItems.length > 0 && isIndented && trimmed) {
      currentListItems[currentListItems.length - 1].children.push(formatInline(trimmed));
      continue;
    }

    if (!trimmed) {
      continue;
    }

    flushList();

    // Heading 1: Candidate Name
    const h1Match = /^#\s+(.+)$/.exec(trimmed);
    if (h1Match) {
      lastHeadingLevel = 1;
      htmlParts.push(`<h1 style="font-family:'Georgia',serif;font-size:24px;font-weight:700;text-align:${isCoverLetter ? 'left' : 'center'};margin:0 0 6px 0;color:#0f172a;letter-spacing:0.01em;">${formatInline(h1Match[1])}</h1>`);
      continue;
    }

    // Heading 2: Major Section Heading (e.g. PROFESSIONAL SUMMARY, TECHNICAL SKILLS, EXPERIENCE, EDUCATION)
    const h2Match = /^##\s+(.+)$/.exec(trimmed);
    if (h2Match) {
      lastHeadingLevel = 2;
      htmlParts.push(`<h2 style="font-family:'Arial',sans-serif;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#0f172a;border-bottom:1.5px solid #0f172a;padding-bottom:3px;margin:18px 0 8px 0;">${formatInline(h2Match[1])}</h2>`);
      continue;
    }

    // Heading 3: Subheading (Job Title, Organization, Degree, Date)
    const h3Match = /^###\s+(.+)$/.exec(trimmed);
    if (h3Match) {
      lastHeadingLevel = 3;
      htmlParts.push(`<h3 style="font-family:'Arial',sans-serif;font-size:12.5px;font-weight:700;color:#1e293b;margin:12px 0 3px 0;">${formatInline(h3Match[1])}</h3>`);
      continue;
    }

    // Subtitle / Contact Line directly under H1 (phone, email, links separated by bullets)
    if (!isCoverLetter && lastHeadingLevel === 1 && (trimmed.includes('@') || trimmed.includes('•') || trimmed.includes('LinkedIn') || trimmed.includes('GitHub'))) {
      htmlParts.push(`<div style="text-align:center;font-size:12px;color:#475569;margin-bottom:6px;line-height:1.5;font-family:'Arial',sans-serif;">${formatInline(trimmed)}</div>`);
      continue;
    }

    // Technology stack subtitle under a project (*Technologies: ...*)
    if (/^\*?Technologies:\s*/i.test(trimmed)) {
      htmlParts.push(`<div style="font-size:11.5px;color:#475569;margin:1px 0 4px 0;font-style:italic;font-family:'Arial',sans-serif;">${formatInline(trimmed.replace(/^\*|\*$/g, ''))}</div>`);
      continue;
    }

    // Project description lines under H3: align with bullet for standard ATS layout
    if (lastHeadingLevel === 3) {
      htmlParts.push(`<div style="margin:3px 0 6px 0;padding-left:18px;position:relative;color:#1e293b;line-height:1.5;font-size:12.5px;font-family:'Arial',sans-serif;"><span style="position:absolute;left:4px;top:0;color:#0f172a;font-size:14px;line-height:1.2;">•</span>${formatInline(trimmed)}</div>`);
      continue;
    }

    // Standard body paragraphs
    htmlParts.push(`<p style="margin:5px 0 8px 0;color:#1e293b;line-height:1.55;font-size:12.5px;font-family:'Arial',sans-serif;">${formatInline(trimmed)}</p>`);
  }

  flushList();
  return htmlParts.join('\n');
}

export default function JobHuntApplicationWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { confirm } = useDialog();

  const oppIdParam = searchParams.get('oppId');
  const pkgIdParam = searchParams.get('pkgId');
  const appIdParam = searchParams.get('appId');
  const jobId = searchParams.get('jobId');

  const [job, setJob] = useState(null);
  const [customJD, setCustomJD] = useState('');
  const [useAI, setUseAI] = useState(false);
  const [showAdvancedDrafting, setShowAdvancedDrafting] = useState(false);
  const [versions, setVersions] = useState([]);
  const [evidenceRefresh, setEvidenceRefresh] = useState(0);
  const requestKey = useRef(null);

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
  }, [oppIdParam, pkgIdParam, appIdParam]);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const j = await api.get(`/jobhunt/documents/jobs/${jobId}`);
        if (cancelled) return;
        setJob(j);
        setGenerating(['queued', 'running'].includes(j.status));
        if (j.status === 'complete') {
          requestKey.current = null;
          setSearchParams({ pkgId: String(j.result_package_id) });
          setToastMsg('✓ Tailored package ready! Review the current version before approval.');
          setTimeout(() => setToastMsg(''), 5000);
        }
      } catch (e) {
        if (!cancelled) setToastMsg(e.message);
      }
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [jobId]);

  useEffect(() => {
    if (activePkg?.id) {
      api.get(`/jobhunt/documents/packages/${activePkg.id}/versions`)
        .then(setVersions)
        .catch(e => setToastMsg(e.message));
    }
  }, [activePkg?.id]);

  async function loadInitial() {
    setLoading(true);
    try {
      // 1. Fetch opportunities for switcher dropdown
      const opps = await api.get('/jobhunt/opportunities?is_archived=0&limit=1000');
      let items = opps.items || opps || [];
      if (oppIdParam && !items.find(o => String(o.id) === String(oppIdParam))) {
        try {
          const single = await api.get(`/jobhunt/opportunities/${oppIdParam}`);
          if (single?.id) items = [single, ...items];
        } catch {}
      }
      setOpportunities(items);

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
        setSelectedOppId(String(oppIdParam));
        pkgs = await api.get(`/jobhunt/documents/packages?opportunity_id=${oppIdParam}`);
        if (pkgs.length > 0) {
          const detailed = await api.get(`/jobhunt/documents/packages/${pkgs[0].id}`);
          setActivePkg(detailed);
          setResumeMd(detailed.tailored_resume_markdown || '');
          setCoverLetterMd(detailed.tailored_cover_letter_markdown || '');
          loadEvents(detailed.application_id);
        } else {
          // Generation is an explicit action through the durable queue.
          setActivePkg(null);
        }
      } else {
        pkgs = await api.get(`/jobhunt/documents/packages${appIdParam ? '?application_id=' + appIdParam : ''}`);
        if (pkgs.length > 0) {
          const detailed = await api.get(`/jobhunt/documents/packages/${pkgs[0].id}`);
          setActivePkg(detailed);
          setResumeMd(detailed.tailored_resume_markdown || '');
          setCoverLetterMd(detailed.tailored_cover_letter_markdown || '');
          if (detailed.opportunity_id) setSelectedOppId(String(detailed.opportunity_id));
          loadEvents(detailed.application_id);
        } else {
          setActivePkg(null);
        }
      }
      setPackages(pkgs);
    } catch (err) {
      console.error('Failed to load application workspace data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents(appId) {
    if (!appId) {
      setEvents([]);
      return;
    }
    try {
      const evts = await api.get(`/jobhunt/documents/applications/${appId}/events`);
      setEvents(evts || []);
    } catch (err) {
      console.warn('Failed to load events:', err);
    }
  }

  async function handleGenerate(oppId) {
    const targetId = oppId || selectedOppId;
    if (!targetId) {
      alert('Please select an opportunity to generate a tailored document package.');
      return;
    }
    setGenerating(true);
    setToastMsg('');
    try {
      if (!requestKey.current) requestKey.current = crypto.randomUUID();
      const res = await api.post('/jobhunt/documents/generate', {
        opportunity_id: targetId, custom_job_description: customJD || undefined,
        use_ai: useAI, request_key: requestKey.current
      });
      setJob(res);
      setSearchParams({ jobId: res.job_id });
    } catch (err) {
      setToastMsg(`Generation failed: ${err.message}`);
      setEvidenceRefresh(x => x + 1);
      requestKey.current = null;
    } finally {
      setGenerating(false);
    }
  }

  async function handleSavePackage() {
    if (!activePkg) return;
    setSaving(true);
    try {
      const saved = await api.put(`/jobhunt/documents/packages/${activePkg.id}`, {
        tailored_resume_markdown: resumeMd,
        tailored_cover_letter_markdown: coverLetterMd
      });
      setSearchParams({ pkgId: String(saved.package_id) });
      setToastMsg('✓ Changes saved to document package!');
      setTimeout(() => setToastMsg(''), 4000);
      loadInitial();
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
      const saved = await api.put(`/jobhunt/documents/packages/${activePkg.id}`, {
        tailored_resume_markdown: resumeMd,
        tailored_cover_letter_markdown: coverLetterMd
      });
      const res = await api.post(`/jobhunt/documents/packages/${saved.package_id}/review`, {});
      const reloaded = await api.get(`/jobhunt/documents/packages/${saved.package_id}`);
      setSearchParams({ pkgId: String(saved.package_id) });
      setActivePkg(reloaded);
      setToastMsg(`✓ Fact review complete! Consistency score: ${res.review.reviewScore}/100`);
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

  async function handlePrintAts(docType) {
    if (!activePkg) return;
    if (resumeMd !== activePkg.tailored_resume_markdown || coverLetterMd !== (activePkg.tailored_cover_letter_markdown || '')) {
      setToastMsg('Save your edits as a new version before exporting PDF.');
      return;
    }
    window.open(`/api/jobhunt/documents/packages/${activePkg.id}/pdf/${docType}`, '_blank', 'noopener');
  }

  async function changeStatus(action) {
    if (resumeMd !== activePkg.tailored_resume_markdown || coverLetterMd !== (activePkg.tailored_cover_letter_markdown || '')) {
      setToastMsg('Save and review your edited version first.');
      return;
    }
    if (!await confirm(
      action === 'submit'
        ? 'Have you submitted this exact version externally? Its binary PDFs will be permanently archived.'
        : 'Have you personally reviewed this exact version for accuracy against your confirmed facts?',
      {
        ledger: 'jobhunt',
        confirmLabel: action === 'submit' ? 'Record submission' : 'Approve version'
      }
    )) return;

    try {
      await api.post(`/jobhunt/documents/packages/${activePkg.id}/${action}`, { confirmed: true });
      await loadInitial();
      setToastMsg(action === 'submit' ? '✓ Submission recorded! Artifacts archived.' : '✓ Version approved!');
      setTimeout(() => setToastMsg(''), 4000);
    } catch (e) {
      setToastMsg(e.message);
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 18 }}>
        <div className="page-eyebrow">Application documents & evidence review</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Application Workspace</h1>
            <p className="page-sub">Draft, review, and export ATS-optimized resumes and cover letters strictly grounded in confirmed career facts.</p>
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
        <div
          className="card"
          style={{
            background: toastMsg.toLowerCase().includes('failed') || toastMsg.toLowerCase().includes('error')
              ? 'rgba(239, 68, 68, 0.15)'
              : 'var(--green-soft)',
            border: `1px solid ${
              toastMsg.toLowerCase().includes('failed') || toastMsg.toLowerCase().includes('error')
                ? 'var(--crimson)'
                : 'var(--green)'
            }`,
            color: toastMsg.toLowerCase().includes('failed') || toastMsg.toLowerCase().includes('error')
              ? 'var(--crimson)'
              : 'var(--green)',
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>{toastMsg}</span>
          <button
            onClick={() => setToastMsg('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: '0 4px'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Follow-up Reminders Banner (Only renders when follow-ups are due) */}
      <JobHuntFollowupReminders />

      {/* Career Evidence Accordion Strip (Default collapsed when all confirmed) */}
      <JobHuntEvidencePanel refreshKey={evidenceRefresh} />

      {/* Target Opportunity Selector & Drafter Bar */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 280 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
              Target Opportunity:
            </span>
            <select
              style={{
                flex: 1,
                padding: '7px 11px',
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

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-sm"
              onClick={() => setShowAdvancedDrafting(!showAdvancedDrafting)}
              style={{ color: showAdvancedDrafting ? 'var(--ink)' : 'var(--ink-soft)' }}
            >
              ⚙️ {showAdvancedDrafting ? 'Hide Options' : 'Drafting Options'}
            </button>
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

        {/* Collapsible Advanced Drafting Options (Clean and un-intrusive) */}
        {showAdvancedDrafting && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--hairline)' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6 }}>
              Custom / Full Job Description (Optional — override if posting is incomplete or truncated):
            </label>
            <textarea
              value={customJD}
              onChange={(e) => setCustomJD(e.target.value)}
              rows={4}
              placeholder="Paste full job description or requirements text here to tailor specifically against this criteria..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--hairline)',
                background: 'var(--input-bg)',
                color: 'var(--ink)',
                fontSize: 12.5,
                lineHeight: 1.45,
                fontFamily: 'inherit',
                marginBottom: 8
              }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useAI}
                onChange={(e) => setUseAI(e.target.checked)}
              />
              <span>Use configured AI provider to prioritize confirmed facts (sends posting & confirmed facts to model; standard API charges apply).</span>
            </label>
          </div>
        )}

        {/* Background Generation Status indicator */}
        {jobId && job && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              borderRadius: 6,
              background: 'var(--paper-hover)',
              border: '1px solid var(--hairline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12.5
            }}
            role="status"
          >
            <div>
              <strong>Generation status:</strong> {job.status}
              {job.error && <span style={{ color: 'var(--rust)', marginLeft: 8 }}>({job.error})</span>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {job.status === 'failed' && (
                <button className="btn btn-sm" onClick={async () => { await api.post(`/jobhunt/documents/jobs/${jobId}/retry`, {}); setGenerating(true); }}>
                  Retry
                </button>
              )}
              {['queued', 'running'].includes(job.status) && (
                <button className="btn btn-sm" onClick={() => api.post(`/jobhunt/documents/jobs/${jobId}/cancel`, {}).catch(e => setToastMsg(e.message))}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="empty-state">Loading application workspace…</div>
      ) : generating ? (
        <div className="card empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✨</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Generating Tailored Document Package...</div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', maxWidth: 460, margin: '0 auto 16px auto' }}>
            Synthesizing job requirements and tailoring resume & cover letter grounded strictly in confirmed career evidence.
          </p>
        </div>
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
          {/* Consolidated Active Package Header & Action Controls */}
          <div
            className="card"
            style={{
              marginBottom: 16,
              padding: '16px 20px',
              borderLeft: activePkg.status === 'submitted'
                ? '4px solid var(--green)'
                : activePkg.status === 'approved'
                ? '4px solid var(--brass)'
                : '4px solid var(--hairline)'
            }}
          >
            {/* Top Row: Title, Badges, Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                    {activePkg.org_name} — {activePkg.role_title}
                  </h2>
                  <span className="badge default" style={{ fontSize: 11 }}>
                    v{activePkg.version}
                  </span>
                  <span
                    className={`badge ${
                      activePkg.status === 'submitted'
                        ? 'green'
                        : activePkg.status === 'approved'
                        ? 'brass'
                        : 'default'
                    }`}
                    style={{ fontSize: 11 }}
                  >
                    {activePkg.status.toUpperCase()}
                  </span>

                  {activePkg.latest_review && (
                    <span
                      className={`badge ${activePkg.latest_review.hallucination_risk === 'none' ? 'green' : 'rust'}`}
                      style={{ fontSize: 11 }}
                    >
                      🛡️ Fact Check: {activePkg.latest_review.review_score}/100
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                  Created {new Date(activePkg.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {activePkg.submitted_at && <span> • Submitted on {new Date(activePkg.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                  {activePkg.application_id && <span> • Linked to Application #{activePkg.application_id}</span>}
                </div>
              </div>

              {/* Action Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Version switcher */}
                {versions.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Ver:</span>
                    <select
                      value={activePkg.id}
                      onChange={(e) => setSearchParams({ pkgId: e.target.value })}
                      style={{
                        padding: '5px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--hairline)',
                        background: 'var(--input-bg)',
                        color: 'var(--ink)',
                        fontSize: 12,
                        fontWeight: 600
                      }}
                    >
                      {versions.map(v => (
                        <option key={v.id} value={v.id}>
                          v{v.version} — {v.status}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Status transitions */}
                {activePkg.status !== 'submitted' && (
                  <button className="btn btn-sm" onClick={() => changeStatus('approve')} title="Approve this draft for submission">
                    ✓ Approve Version
                  </button>
                )}
                {activePkg.status === 'approved' && (
                  <button className="btn btn-primary btn-sm" onClick={() => changeStatus('submit')} title="Records that you submitted this package and archives immutable PDFs">
                    📨 Record Submission
                  </button>
                )}

                <button className="btn btn-sm" disabled={reviewing} onClick={handleReReview} title="Audit draft line-by-line against verified profile claims">
                  {reviewing ? 'Auditing…' : '🛡️ Fact Check'}
                </button>

                <button className="btn btn-primary btn-sm" disabled={saving} onClick={handleSavePackage}>
                  {saving ? 'Saving…' : '💾 Save Draft'}
                </button>
              </div>
            </div>

            {/* Sub-row: Immutability notice & Quick PDF download bar */}
            <div
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: '1px solid var(--hairline)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                {activePkg.status === 'submitted' ? (
                  <span>🔒 <strong>Sealed version:</strong> This package was submitted and permanently archived. Saving edits creates a new draft version (v{activePkg.version + 1}).</span>
                ) : (
                  <span>Draft in progress. Edit markdown below, verify fact check, and approve when ready.</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className="btn btn-sm" onClick={() => handlePrintAts('resume')} title="Download binary PDF generated strictly from confirmed facts">
                  ⬇️ Resume PDF
                </button>
                <button className="btn btn-sm" onClick={() => handlePrintAts('cover_letter')} title="Download binary PDF cover letter">
                  ⬇️ Cover Letter PDF
                </button>
                <a
                  href={`/api/jobhunt/documents/packages/${activePkg.id}/render/resume`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm"
                  style={{ textDecoration: 'none' }}
                  title="Open clean printable HTML"
                >
                  🖨️ ATS HTML ↗
                </a>
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
              🛡️ Evidence Consistency Audit
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'stretch' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <textarea
                    value={resumeMd}
                    onChange={(e) => setResumeMd(e.target.value)}
                    style={{
                      width: '100%',
                      height: 720,
                      minHeight: 720,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12.5,
                      lineHeight: 1.55,
                      padding: 18,
                      borderRadius: 10,
                      border: '1px solid var(--hairline)',
                      background: 'var(--input-bg)',
                      color: 'var(--ink)',
                      resize: 'none',
                      boxSizing: 'border-box'
                    }}
                    placeholder="Resume markdown content..."
                  />
                </div>
                <div
                  className="card"
                  style={{
                    width: '100%',
                    height: 720,
                    minHeight: 720,
                    overflowY: 'auto',
                    background: '#ffffff',
                    color: '#0f172a',
                    padding: '28px 32px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 10,
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.8)',
                    boxSizing: 'border-box'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid #e2e8f0',
                      paddingBottom: 8,
                      marginBottom: 16
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                        ATS Rendered Preview
                      </span>
                      <span style={{ fontSize: 10, background: '#dcfce7', color: '#15803d', fontWeight: 600, padding: '2px 7px', borderRadius: 999 }}>
                        ✓ 100% ATS Compliant
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      Single-Column • Linear Hierarchy
                    </span>
                  </div>

                  <div
                    style={{ color: '#0f172a' }}
                    dangerouslySetInnerHTML={{
                      __html: renderAtsDocumentHtml(resumeMd, false)
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 2: Cover Letter */}
          {activeTab === 'cover_letter' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                  Cover Letter Markdown & Preview
                </span>
                <button className="btn btn-sm" onClick={() => handlePrintAts('cover_letter')}>
                  🖨️ Open ATS Printable View ↗
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'stretch' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <textarea
                    value={coverLetterMd}
                    onChange={(e) => setCoverLetterMd(e.target.value)}
                    style={{
                      width: '100%',
                      height: 720,
                      minHeight: 720,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12.5,
                      lineHeight: 1.55,
                      padding: 18,
                      borderRadius: 10,
                      border: '1px solid var(--hairline)',
                      background: 'var(--input-bg)',
                      color: 'var(--ink)',
                      resize: 'none',
                      boxSizing: 'border-box'
                    }}
                    placeholder="Cover letter markdown content..."
                  />
                </div>
                <div
                  className="card"
                  style={{
                    width: '100%',
                    height: 720,
                    minHeight: 720,
                    overflowY: 'auto',
                    background: '#ffffff',
                    color: '#0f172a',
                    padding: '28px 32px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 10,
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.8)',
                    boxSizing: 'border-box'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid #e2e8f0',
                      paddingBottom: 8,
                      marginBottom: 16
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                        Cover Letter Preview
                      </span>
                      <span style={{ fontSize: 10, background: '#dcfce7', color: '#15803d', fontWeight: 600, padding: '2px 7px', borderRadius: 999 }}>
                        ✓ ATS Compliant
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      Clean Linear Layout
                    </span>
                  </div>

                  <div
                    style={{ color: '#0f172a' }}
                    dangerouslySetInnerHTML={{
                      __html: renderAtsDocumentHtml(coverLetterMd, true)
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab Content 3: Fact Check & Review */}
          {activeTab === 'review' && (
            <div className="card">
              <div className="section-title">🛡️ Fact Check & Evidence Consistency Audit</div>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '4px 0 16px 0' }}>
                Every sentence and metric in your drafted resume and cover letter is audited against your confirmed snapshot facts.
              </p>

              {activePkg.latest_review ? (
                <div>
                  {/* Score Summary */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
                    <div className="stat-card">
                      <div className="stat-label">Review Score</div>
                      <div className="stat-value" style={{ color: activePkg.latest_review.review_score >= 80 ? 'var(--green)' : 'var(--rust)' }}>
                        {activePkg.latest_review.review_score} / 100
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Hallucination Risk</div>
                      <div className="stat-value" style={{ color: activePkg.latest_review.hallucination_risk === 'none' ? 'var(--green)' : 'var(--rust)', textTransform: 'uppercase' }}>
                        {activePkg.latest_review.hallucination_risk}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Flagged Claims</div>
                      <div className="stat-value" style={{ color: activePkg.latest_review.unsupported_claims?.length > 0 ? 'var(--rust)' : 'var(--green)' }}>
                        {activePkg.latest_review.unsupported_claims?.length || 0}
                      </div>
                    </div>
                  </div>

                  {/* Unsupported Claims Warnings */}
                  {activePkg.latest_review.unsupported_claims?.length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--rust)', marginBottom: 8 }}>
                        ⚠️ Flagged Statements (Not in Confirmed Evidence Base)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {activePkg.latest_review.unsupported_claims.map((u, i) => (
                          <div key={i} style={{ padding: '10px 14px', borderRadius: 6, background: 'var(--rust-soft)', border: '1px solid var(--rust)', fontSize: 12.5 }}>
                            <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>"{u.text_snippet}"</div>
                            <div style={{ color: 'var(--rust)', fontSize: 11.5 }}>Reason: {u.reason}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missing JD Requirements */}
                  {activePkg.latest_review.missing_requirements?.length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
                        ℹ️ Job Requirements Absent from Profile
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {activePkg.latest_review.missing_requirements.map((m, i) => (
                          <span key={i} className="badge rust" style={{ fontSize: 12 }}>
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Critique Notes */}
                  {activePkg.latest_review.critique_notes && (
                    <div style={{ padding: 14, borderRadius: 8, background: 'var(--paper-hover)', border: '1px solid var(--hairline)', fontSize: 13, lineHeight: 1.5 }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Reviewer Notes:</div>
                      <div style={{ whiteSpace: 'pre-wrap', color: 'var(--ink-soft)' }}>{activePkg.latest_review.critique_notes}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state">No review generated yet. Click "Fact Check" to audit this document package.</div>
              )}
            </div>
          )}

          {/* Tab Content 4: Application Events & Timeline */}
          {activeTab === 'timeline' && (
            <div>
              {/* Event Logging Form */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="section-title">📅 Log Application Progress Event</div>
                <form onSubmit={handleAddEvent} style={{ marginTop: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 10, marginBottom: 8 }}>
                    <select
                      value={newEventType}
                      onChange={(e) => setNewEventType(e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--hairline)', background: 'var(--input-bg)', color: 'var(--ink)', fontSize: 12.5 }}
                    >
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

              {/* Events Timeline */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="section-title">📜 Application History</div>
                {events.length === 0 ? (
                  <div className="empty-state" style={{ padding: 16 }}>No events logged for this application yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                    {events.map((ev) => (
                      <div
                        key={ev.id}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 6,
                          background: 'var(--paper-hover)',
                          border: '1px solid var(--hairline)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="badge default" style={{ fontSize: 11 }}>
                              {ev.event_type}
                            </span>
                            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{ev.title}</span>
                          </div>
                          {ev.notes && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{ev.notes}</div>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                          {new Date(ev.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Follow-up Draft Generator */}
              <div className="card">
                <div className="section-title">✉️ Follow-up Intelligence</div>
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
                      rows={10}
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
