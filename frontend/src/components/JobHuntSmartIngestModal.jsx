import React, { useState, useEffect, useRef } from 'react';

const REC_CONFIG = {
  strong_apply: { label: 'Strong Apply', color: 'var(--green)', bg: 'var(--green-soft)', icon: '🔥' },
  worth_applying: { label: 'Worth Applying', color: 'var(--brass)', bg: 'var(--brass-soft)', icon: '⭐' },
  stretch: { label: 'Stretch', color: '#7C3AED', bg: 'rgba(124,58,237,0.12)', icon: '⚡' },
  skip: { label: 'Low Match', color: 'var(--ink-faint)', bg: 'var(--hairline)', icon: '—' }
};

export default function JobHuntSmartIngestModal({ isOpen, onClose, onSaved }) {
  const [activeTab, setActiveTab] = useState('text'); // 'text' | 'url' | 'pdf'
  const [orgs, setOrgs] = useState([]);

  // Inputs
  const [rawText, setRawText] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [customOrgName, setCustomOrgName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState('');
  const [error, setError] = useState(null);

  // Review step
  const [extractedOpps, setExtractedOpps] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef(null);

  // Keyboard shortcut listener (ESC to close)
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape' && !isProcessing && !isSaving) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isProcessing, isSaving]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/jobhunt/orgs')
        .then(res => res.json())
        .then(data => setOrgs(Array.isArray(data) ? data : []))
        .catch(() => {});
      setError(null);
      setExtractedOpps(null);
      setIsProcessing(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleExtract = async () => {
    setError(null);
    setIsProcessing(true);
    setProcessStep('Connecting to AI Extractor (using your saved Gemini key)...');

    try {
      let endpoint = '';
      let bodyData = null;
      let isMultipart = false;

      const chosenOrg = orgs.find(o => String(o.id) === String(selectedOrgId));
      const orgName = chosenOrg ? chosenOrg.name : customOrgName;

      if (activeTab === 'text') {
        if (!rawText.trim()) {
          throw new Error('Please paste job description or recruitment text.');
        }
        endpoint = '/api/jobhunt/ingest/text';
        bodyData = JSON.stringify({
          text: rawText,
          org_id: selectedOrgId || null,
          org_name: orgName,
          source_url: sourceUrl
        });
      } else if (activeTab === 'url') {
        if (!targetUrl.trim()) {
          throw new Error('Please provide a valid careers page or PDF URL.');
        }
        endpoint = '/api/jobhunt/ingest/url';
        bodyData = JSON.stringify({
          url: targetUrl.trim(),
          org_id: selectedOrgId || null,
          org_name: orgName
        });
      } else if (activeTab === 'pdf') {
        if (!selectedFile) {
          throw new Error('Please select a recruitment notification PDF or document.');
        }
        endpoint = '/api/jobhunt/ingest/upload';
        const formData = new FormData();
        formData.append('file', selectedFile);
        if (selectedOrgId) formData.append('org_id', selectedOrgId);
        if (orgName) formData.append('org_name', orgName);
        if (sourceUrl) formData.append('source_url', sourceUrl);
        bodyData = formData;
        isMultipart = true;
      }

      setProcessStep('Extracting eligibility, pay scales, deadlines, and skills...');

      const headers = isMultipart ? {} : { 'Content-Type': 'application/json' };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: bodyData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Extraction failed');
      }

      if (!data.opportunities || data.opportunities.length === 0) {
        throw new Error('No structured opportunities could be extracted from this content.');
      }

      setExtractedOpps(data.opportunities);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
      setProcessStep('');
    }
  };

  const handleUpdateOppField = (index, field, value) => {
    setExtractedOpps(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveOpp = (index) => {
    setExtractedOpps(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : null;
    });
  };

  const handleConfirmSave = async () => {
    if (!extractedOpps || extractedOpps.length === 0) return;
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/jobhunt/ingest/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunities: extractedOpps })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save opportunities');

      if (onSaved) onSaved(data.saved);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="quick-dump-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing && !isSaving) onClose();
      }}
    >
      <div
        className="quick-dump-modal-card"
        style={{ maxWidth: extractedOpps ? 840 : 660 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="quick-dump-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>✨</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
                AI Smart Ingestion & Parser
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-soft)' }}>
                Extract structured, scoreable job postings using your saved Gemini AI key
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close modal"
            style={{ fontSize: 18, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="quick-dump-body" style={{ maxHeight: 'calc(90vh - 75px)' }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'var(--rust-soft)',
              color: 'var(--rust)',
              fontSize: 13,
              border: '1px solid var(--rust)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* State 1: Input & Extraction */}
          {!extractedOpps ? (
            <div>
              {/* Tab Switcher */}
              <div style={{
                display: 'inline-flex',
                background: 'var(--paper)',
                padding: 3,
                borderRadius: 8,
                border: '1px solid var(--hairline)',
                gap: 4,
                marginBottom: 16,
                flexWrap: 'wrap'
              }}>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'text' ? 'btn-primary' : ''}`}
                  style={activeTab === 'text' ? { border: 'none' } : { background: 'transparent', border: 'none', color: 'var(--ink-soft)' }}
                  onClick={() => setActiveTab('text')}
                >
                  📝 Paste Description
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'url' ? 'btn-primary' : ''}`}
                  style={activeTab === 'url' ? { border: 'none' } : { background: 'transparent', border: 'none', color: 'var(--ink-soft)' }}
                  onClick={() => setActiveTab('url')}
                >
                  🔗 Fetch from URL
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'pdf' ? 'btn-primary' : ''}`}
                  style={activeTab === 'pdf' ? { border: 'none' } : { background: 'transparent', border: 'none', color: 'var(--ink-soft)' }}
                  onClick={() => setActiveTab('pdf')}
                >
                  📄 Upload Notification PDF
                </button>
              </div>

              {/* Shared Org selector */}
              <div className="form-grid" style={{ gridTemplateColumns: selectedOrgId ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 14 }}>
                <div className="field">
                  <label>Hiring Organization (Optional)</label>
                  <select
                    value={selectedOrgId}
                    onChange={e => {
                      setSelectedOrgId(e.target.value);
                      if (e.target.value) setCustomOrgName('');
                    }}
                  >
                    <option value="">-- Let AI Detect Organization --</option>
                    {orgs.map(o => (
                      <option key={o.id} value={o.id}>{o.name} ({o.sector || 'Org'})</option>
                    ))}
                  </select>
                </div>

                {!selectedOrgId && (
                  <div className="field">
                    <label>Or Type New Org Name</label>
                    <input
                      type="text"
                      value={customOrgName}
                      onChange={e => setCustomOrgName(e.target.value)}
                      placeholder="e.g. C-DAC, ISRO, Google, Razorpay"
                    />
                  </div>
                )}
              </div>

              {/* Tab 1: Paste Text */}
              {activeTab === 'text' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="field">
                    <label>Job Description / Notification Text *</label>
                    <textarea
                      rows={8}
                      value={rawText}
                      onChange={e => setRawText(e.target.value)}
                      placeholder="Paste the full job description, qualifications, compensation details, or recruitment notification snippet here..."
                      style={{
                        width: '100%',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12.5,
                        lineHeight: 1.55,
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  <div className="field">
                    <label>Original Source URL (Optional)</label>
                    <input
                      type="url"
                      value={sourceUrl}
                      onChange={e => setSourceUrl(e.target.value)}
                      placeholder="https://company.com/careers/job-123"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Fetch from URL */}
              {activeTab === 'url' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="field">
                    <label>Careers Page / Job Posting / Notification URL *</label>
                    <input
                      type="url"
                      value={targetUrl}
                      onChange={e => setTargetUrl(e.target.value)}
                      placeholder="https://cdac.in/careers/adv-01-2026.html or PDF link"
                    />
                  </div>
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'var(--paper)',
                    border: '1px solid var(--hairline)',
                    fontSize: 12.5,
                    color: 'var(--ink-soft)',
                    lineHeight: 1.5
                  }}>
                    💡 <strong>Smart Web Ingestion:</strong> The crawler will fetch the webpage HTML (or linked PDF document), calculate SHA-256 content hashes to detect changes, and extract all advertised openings with your saved Gemini key.
                  </div>
                </div>
              )}

              {/* Tab 3: Upload PDF */}
              {activeTab === 'pdf' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div
                    className="ai-file-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ padding: '28px 20px', borderRadius: 10 }}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".pdf,.txt,.doc,.docx,image/*"
                      style={{ display: 'none' }}
                    />
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                      {selectedFile ? selectedFile.name : 'Click to select or drag & drop recruitment PDF'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                      {selectedFile
                        ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Ready for AI multimodal extraction`
                        : 'Supports Government & PSU notifications (ISRO, DRDO, C-DAC, BEL) and company JDs (up to 20MB)'}
                    </div>
                  </div>

                  <div className="field">
                    <label>Application / Notification Portal URL (Optional)</label>
                    <input
                      type="url"
                      value={sourceUrl}
                      onChange={e => setSourceUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              )}

              {/* Processing State */}
              {isProcessing && (
                <div style={{
                  marginTop: 14,
                  padding: '22px 16px',
                  textAlign: 'center',
                  background: 'var(--paper)',
                  borderRadius: 10,
                  border: '1px solid var(--hairline)'
                }}>
                  <div className="spinner-medium" />
                  <div style={{ fontWeight: 600, fontSize: 14, marginTop: 12, color: 'var(--ink)' }}>
                    Extracting Opportunity Intelligence...
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                    {processStep}
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 18,
                paddingTop: 16,
                borderTop: '1px solid var(--hairline)'
              }}>
                <button
                  type="button"
                  className="btn"
                  onClick={onClose}
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleExtract}
                  disabled={
                    isProcessing ||
                    (activeTab === 'text' && !rawText.trim()) ||
                    (activeTab === 'url' && !targetUrl.trim()) ||
                    (activeTab === 'pdf' && !selectedFile)
                  }
                >
                  {isProcessing ? 'Extracting...' : '✨ Extract with Gemini AI'}
                </button>
              </div>
            </div>
          ) : (
            /* State 2: Review & Edit Extracted Opportunities */
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                flexWrap: 'wrap',
                gap: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge green" style={{ fontSize: 12.5, padding: '4px 10px' }}>
                    ✅ Extracted {extractedOpps.length} {extractedOpps.length === 1 ? 'Opportunity' : 'Opportunities'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                    Review and adjust details before saving to Radar.
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setExtractedOpps(null)}
                  disabled={isSaving}
                >
                  ← Back to Input
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {extractedOpps.map((opp, idx) => {
                  const score = opp.preview_score?.opportunity_score ?? 60;
                  const rec = opp.preview_score?.recommendation || 'worth_applying';
                  const recCfg = REC_CONFIG[rec] || REC_CONFIG.worth_applying;
                  const elig = opp.preview_score?.eligibility_pct ?? 70;
                  const fit = opp.preview_score?.profile_match_pct ?? 50;

                  return (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--paper)',
                        border: '1px solid var(--hairline)',
                        borderRadius: 10,
                        padding: 16
                      }}
                    >
                      {/* Opp Card Header */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 14,
                        paddingBottom: 12,
                        borderBottom: '1px solid var(--hairline)',
                        flexWrap: 'wrap',
                        gap: 10
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{
                            background: recCfg.bg,
                            color: recCfg.color,
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            {recCfg.icon} {score}/100
                          </span>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
                              {opp.title || 'Untitled Opportunity'}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                              {opp.org_name || 'Organization'} · {opp.role_category} · {opp.job_type ? opp.job_type.toUpperCase() : 'OTHER'}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="badge" style={{ background: 'var(--paper-raised)', border: '1px solid var(--hairline)', color: 'var(--ink)' }} title="Eligibility based on your degrees">
                            Eligibility: {elig}%
                          </span>
                          <span className="badge" style={{ background: 'var(--paper-raised)', border: '1px solid var(--hairline)', color: 'var(--ink)' }} title="Skills & experience match">
                            Fit: {fit}%
                          </span>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleRemoveOpp(idx)}
                            title="Discard this opportunity"
                            style={{ color: 'var(--rust)', borderColor: 'var(--rust)', padding: '2px 8px', fontSize: 12 }}
                          >
                            🗑️ Discard
                          </button>
                        </div>
                      </div>

                      {/* Editable Fields Grid */}
                      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
                        <div className="field">
                          <label>Job Title</label>
                          <input
                            type="text"
                            value={opp.title}
                            onChange={e => handleUpdateOppField(idx, 'title', e.target.value)}
                          />
                        </div>

                        <div className="field">
                          <label>Organization</label>
                          <input
                            type="text"
                            value={opp.org_name}
                            onChange={e => handleUpdateOppField(idx, 'org_name', e.target.value)}
                          />
                        </div>

                        <div className="field">
                          <label>Required Degree(s)</label>
                          <input
                            type="text"
                            value={opp.required_degree}
                            onChange={e => handleUpdateOppField(idx, 'required_degree', e.target.value)}
                            placeholder="e.g. B.Tech / B.E. / MCA"
                          />
                        </div>

                        <div className="field">
                          <label>Required Branch(es)</label>
                          <input
                            type="text"
                            value={opp.required_branch}
                            onChange={e => handleUpdateOppField(idx, 'required_branch', e.target.value)}
                            placeholder="e.g. Computer Science, IT"
                          />
                        </div>

                        <div className="field">
                          <label>Min Experience (Years)</label>
                          <input
                            type="number"
                            step="0.5"
                            value={opp.min_experience_years ?? ''}
                            onChange={e => handleUpdateOppField(idx, 'min_experience_years', e.target.value ? Number(e.target.value) : null)}
                            placeholder="0 for freshers"
                          />
                        </div>

                        <div className="field">
                          <label>Max Age</label>
                          <input
                            type="number"
                            value={opp.max_age ?? ''}
                            onChange={e => handleUpdateOppField(idx, 'max_age', e.target.value ? Number(e.target.value) : null)}
                            placeholder="e.g. 30"
                          />
                        </div>

                        <div className="field">
                          <label>Annual CTC Min (₹)</label>
                          <input
                            type="number"
                            value={opp.ctc_min ?? ''}
                            onChange={e => handleUpdateOppField(idx, 'ctc_min', e.target.value ? Number(e.target.value) : null)}
                            placeholder="e.g. 1000000"
                          />
                        </div>

                        <div className="field">
                          <label>Annual CTC Max (₹)</label>
                          <input
                            type="number"
                            value={opp.ctc_max ?? ''}
                            onChange={e => handleUpdateOppField(idx, 'ctc_max', e.target.value ? Number(e.target.value) : null)}
                            placeholder="e.g. 1600000"
                          />
                        </div>

                        <div className="field">
                          <label>Pay Scale / Band</label>
                          <input
                            type="text"
                            value={opp.pay_scale || ''}
                            onChange={e => handleUpdateOppField(idx, 'pay_scale', e.target.value)}
                            placeholder="e.g. Level 10 (₹56,100)"
                          />
                        </div>

                        <div className="field">
                          <label>Application Deadline</label>
                          <input
                            type="date"
                            value={opp.application_deadline || ''}
                            onChange={e => handleUpdateOppField(idx, 'application_deadline', e.target.value)}
                          />
                        </div>

                        <div className="field">
                          <label>Location</label>
                          <input
                            type="text"
                            value={opp.location || ''}
                            onChange={e => handleUpdateOppField(idx, 'location', e.target.value)}
                            placeholder="e.g. Noida / Remote"
                          />
                        </div>

                        <div className="field">
                          <label>Application URL</label>
                          <input
                            type="url"
                            value={opp.apply_url || ''}
                            onChange={e => handleUpdateOppField(idx, 'apply_url', e.target.value)}
                            placeholder="https://..."
                          />
                        </div>
                      </div>

                      {/* Skills pills */}
                      {opp.required_skills && opp.required_skills.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <span style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Extracted Skills:{' '}
                          </span>
                          <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, marginLeft: 6 }}>
                            {opp.required_skills.map((sk, sidx) => (
                              <span key={sidx} className="badge" style={{ background: 'var(--paper-raised)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}>
                                {sk}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {opp.highlights && (
                        <div style={{ marginTop: 10, fontSize: 12, background: 'var(--paper-raised)', border: '1px solid var(--hairline)', padding: '8px 12px', borderRadius: 6, color: 'var(--ink-soft)' }}>
                          💡 <strong style={{ color: 'var(--ink)' }}>Highlights:</strong> {opp.highlights}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Confirm Save Actions */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 18,
                paddingTop: 16,
                borderTop: '1px solid var(--hairline)'
              }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setExtractedOpps(null)}
                  disabled={isSaving}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmSave}
                  disabled={isSaving || extractedOpps.length === 0}
                >
                  {isSaving ? 'Saving to Database...' : `⚡ Confirm & Add ${extractedOpps.length} to Opportunities`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
