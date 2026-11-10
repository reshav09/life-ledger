import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useTheme } from '../ThemeContext.jsx';
import BackupSection from '../components/BackupSection.jsx';

export default function JobHuntSettings() {
  const { theme, toggleTheme } = useTheme();

  // Settings state
  const [settings, setSettings] = useState({
    jobhunt_threshold_apply_now: '75',
    jobhunt_threshold_worth_applying: '55',
    jobhunt_threshold_investigate: '35',
    jobhunt_default_polling: 'weekly',
    jobhunt_stale_days: '45',
    jobhunt_default_stage: 'Applied',
    jobhunt_followup_days: '7',
    jobhunt_auto_poll_enabled: false
  });

  const [saved, setSaved] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [rescoreMsg, setRescoreMsg] = useState('');
  const [crawlerStatus, setCrawlerStatus] = useState(null);

  useEffect(() => {
    load();
    loadCrawlerStatus();
  }, []);

  async function loadCrawlerStatus() {
    try {
      const data = await api.get('/jobhunt/crawler/status');
      setCrawlerStatus(data);
    } catch {}
  }

  async function load() {
    try {
      const s = await api.get('/settings');
      setSettings((prev) => ({
        ...prev,
        jobhunt_threshold_apply_now: s.jobhunt_threshold_apply_now || '75',
        jobhunt_threshold_worth_applying: s.jobhunt_threshold_worth_applying || '55',
        jobhunt_threshold_investigate: s.jobhunt_threshold_investigate || '35',
        jobhunt_default_polling: s.jobhunt_default_polling || 'weekly',
        jobhunt_stale_days: s.jobhunt_stale_days || '45',
        jobhunt_default_stage: s.jobhunt_default_stage || 'Applied',
        jobhunt_followup_days: s.jobhunt_followup_days || '7',
        jobhunt_auto_poll_enabled: s.jobhunt_auto_poll_enabled === '1' || s.jobhunt_auto_poll_enabled === 'true' || s.jobhunt_auto_poll_enabled === true
      }));
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  async function saveSettings(e) {
    if (e) e.preventDefault();
    await api.post('/settings', {
      jobhunt_threshold_apply_now: Number(settings.jobhunt_threshold_apply_now) || 75,
      jobhunt_threshold_worth_applying: Number(settings.jobhunt_threshold_worth_applying) || 55,
      jobhunt_threshold_investigate: Number(settings.jobhunt_threshold_investigate) || 35,
      jobhunt_default_polling: settings.jobhunt_default_polling,
      jobhunt_stale_days: Number(settings.jobhunt_stale_days) || 45,
      jobhunt_default_stage: settings.jobhunt_default_stage,
      jobhunt_followup_days: Number(settings.jobhunt_followup_days) || 7,
      jobhunt_auto_poll_enabled: settings.jobhunt_auto_poll_enabled ? '1' : '0'
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    loadCrawlerStatus();
  }

  async function saveAndRescore() {
    setRescoring(true);
    setRescoreMsg('');
    try {
      await saveSettings();
      const res = await api.post('/jobhunt/opportunities/rescore-all', {});
      setRescoreMsg(`✓ Rescored ${res.rescored || 0} opportunities with new thresholds!`);
    } catch (err) {
      setRescoreMsg(`✕ Rescore failed: ${err.message}`);
    } finally {
      setRescoring(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Pipeline & Engine Preferences</div>
        <h1 className="page-title">Job Hunt Settings</h1>
        <p className="page-sub">
          Customize matching score cutoffs, crawler polling defaults, pipeline workflow stages, appearance, and full database backups.
        </p>
      </div>

      <div className="two-col" style={{ gridTemplateColumns: '1.08fr 1fr' }}>
        {/* Left column */}
        <div>
          {/* Appearance card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Appearance</div>
            <div className="theme-toggle-row">
              <span style={{ fontSize: 13.5 }}>{theme === 'dark' ? '🌙 Dark mode (Default)' : '☀️ Light mode'}</span>
              <button className={`theme-switch ${theme === 'dark' ? 'on' : ''}`} onClick={toggleTheme} aria-label="Toggle dark mode" />
            </div>
          </div>

          {/* Scoring Thresholds Card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Opportunity Scoring Thresholds</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
              Adjust the composite score thresholds (0-100) that decide whether an opportunity is highlighted as High Priority or recommended for you.
            </p>

            <form onSubmit={saveSettings}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
                <div className="field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ margin: 0 }}>🔥 &quot;Apply Now&quot; Cutoff Score</label>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#E05A3A' }}>
                      {settings.jobhunt_threshold_apply_now}/100
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    step="1"
                    value={settings.jobhunt_threshold_apply_now}
                    onChange={(e) => setSettings({ ...settings, jobhunt_threshold_apply_now: e.target.value })}
                  />
                  <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
                    Scores ≥ {settings.jobhunt_threshold_apply_now} receive the &quot;🔥 Apply Now&quot; top-priority badge.
                  </span>
                </div>

                <div className="field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ margin: 0 }}>⭐ &quot;Worth Applying&quot; Cutoff Score</label>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#C9852E' }}>
                      {settings.jobhunt_threshold_worth_applying}/100
                    </span>
                  </div>
                  <input
                    type="range"
                    min="35"
                    max="80"
                    step="1"
                    value={settings.jobhunt_threshold_worth_applying}
                    onChange={(e) => setSettings({ ...settings, jobhunt_threshold_worth_applying: e.target.value })}
                  />
                  <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
                    Scores between {settings.jobhunt_threshold_worth_applying} and {Number(settings.jobhunt_threshold_apply_now) - 1} are labeled &quot;⭐ Worth Applying&quot;.
                  </span>
                </div>

                <div className="field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ margin: 0 }}>👀 &quot;Investigate&quot; Minimum Score</label>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#5B7FBA' }}>
                      {settings.jobhunt_threshold_investigate}/100
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="60"
                    step="1"
                    value={settings.jobhunt_threshold_investigate}
                    onChange={(e) => setSettings({ ...settings, jobhunt_threshold_investigate: e.target.value })}
                  />
                  <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
                    Opportunities below {settings.jobhunt_threshold_investigate} are marked &quot;❌ Ignore / Low Priority&quot;.
                  </span>
                </div>
              </div>

              {/* Status preview banner */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 6,
                padding: 10,
                borderRadius: 'var(--radius)',
                background: 'var(--surface-muted)',
                marginBottom: 16,
                fontSize: 11.5,
                textAlign: 'center'
              }}>
                <div style={{ color: '#E05A3A', fontWeight: 600 }}>🔥 Apply Now<br/><span style={{ fontWeight: 400 }}>≥{settings.jobhunt_threshold_apply_now}</span></div>
                <div style={{ color: '#C9852E', fontWeight: 600 }}>⭐ Worth Apply<br/><span style={{ fontWeight: 400 }}>≥{settings.jobhunt_threshold_worth_applying}</span></div>
                <div style={{ color: '#5B7FBA', fontWeight: 600 }}>👀 Investigate<br/><span style={{ fontWeight: 400 }}>≥{settings.jobhunt_threshold_investigate}</span></div>
                <div style={{ color: '#6E7A8A', fontWeight: 600 }}>❌ Low Priority<br/><span style={{ fontWeight: 400 }}>&lt;{settings.jobhunt_threshold_investigate}</span></div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="submit" className="btn btn-primary">
                  Save Thresholds
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={saveAndRescore}
                  disabled={rescoring}
                  style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}
                >
                  {rescoring ? 'Rescoring…' : '⚡ Save & Rescore All Opportunities'}
                </button>
                {saved && <span style={{ color: 'var(--green)', fontSize: 13 }}>Saved ✓</span>}
              </div>
              {rescoreMsg && (
                <div style={{
                  marginTop: 10,
                  fontSize: 12.5,
                  color: rescoreMsg.startsWith('✓') ? 'var(--green)' : 'var(--rust)',
                  fontWeight: 500
                }}>
                  {rescoreMsg}
                </div>
              )}
            </form>
          </div>

          {/* Scoring Engine Breakdown Card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Scoring Engine Weights</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
              How the composite opportunity score is calculated across 8 key dimensions:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--hairline)' }}>
                <span><strong>1. Eligibility Match</strong> (Degree, branch, age, min experience)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>25%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--hairline)' }}>
                <span><strong>2. Profile & Keywords Fit</strong> (Skills, target roles, locations)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>20%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--hairline)' }}>
                <span><strong>3. Compensation Alignment</strong> (Pay scale, target CTC, benefits)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>15%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--hairline)' }}>
                <span><strong>4. Career Potential & Growth</strong> (Work scope, brand, trajectory)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>10%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--hairline)' }}>
                <span><strong>5. Organization Tier & Quality</strong> (Maharatna, Navratna, Lab tier)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>10%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--hairline)' }}>
                <span><strong>6. Deadline Urgency</strong> (Days remaining before cutoff)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>10%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--hairline)' }}>
                <span><strong>7. Competition Signal</strong> (Proxy estimate based on vacancy volume)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>5%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span><strong>8. Application Difficulty</strong> (Online vs physical dispatch / DD fees)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>5%</span>
              </div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px dashed var(--hairline)', fontSize: 12.5, color: 'var(--ink-soft)' }}>
              Target criteria and qualifications can be tuned in your <Link to="/profile" style={{ color: 'var(--accent)', fontWeight: 600 }}>Career Profile</Link>.
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Crawler & Ingestion Preferences Card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Crawler & Ingestion Preferences</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
              Configure defaults for organization scraping, circular polling, and lifecycle maintenance.
            </p>

            <form onSubmit={saveSettings}>
              <div className="form-grid" style={{ marginBottom: 14 }}>
                <div className="field">
                  <label>Default Polling Frequency</label>
                  <select
                    value={settings.jobhunt_default_polling}
                    onChange={(e) => setSettings({ ...settings, jobhunt_default_polling: e.target.value })}
                  >
                    <option value="daily">Daily (Fastest alerts)</option>
                    <option value="weekly">Weekly (Standard)</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div className="field">
                  <label>Stale Opportunity Threshold</label>
                  <select
                    value={settings.jobhunt_stale_days}
                    onChange={(e) => setSettings({ ...settings, jobhunt_stale_days: e.target.value })}
                  >
                    <option value="30">30 Days</option>
                    <option value="45">45 Days (Recommended)</option>
                    <option value="60">60 Days</option>
                    <option value="90">90 Days</option>
                  </select>
                </div>
              </div>

              <div className="form-grid" style={{ marginBottom: 14 }}>
                <div className="field">
                  <label>Default Application Stage</label>
                  <select
                    value={settings.jobhunt_default_stage}
                    onChange={(e) => setSettings({ ...settings, jobhunt_default_stage: e.target.value })}
                  >
                    <option value="Bookmarked">📌 Bookmarked</option>
                    <option value="Applied">📤 Applied</option>
                    <option value="Interview">🗣️ Interview</option>
                    <option value="Shortlisted">⭐ Shortlisted</option>
                  </select>
                </div>

                <div className="field">
                  <label>Follow-up Reminder (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={settings.jobhunt_followup_days}
                    onChange={(e) => setSettings({ ...settings, jobhunt_followup_days: e.target.value })}
                  />
                </div>
              </div>

              {/* Automated Background Crawler Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius)',
                background: 'var(--bg-secondary)',
                marginBottom: 14,
                border: '1px solid var(--hairline)'
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>Automated Background Web Poller</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                    Automatically crawls active organizations&apos; careers pages every 2 hours and notifies you of new opportunities.
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={settings.jobhunt_auto_poll_enabled}
                    onChange={(e) => setSettings({ ...settings, jobhunt_auto_poll_enabled: e.target.checked })}
                    style={{ width: 18, height: 18 }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {settings.jobhunt_auto_poll_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>

              {/* Crawler Status Summary if available */}
              {crawlerStatus && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  marginBottom: 14,
                  padding: '10px 12px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius)',
                  textAlign: 'center',
                  fontSize: 12
                }}>
                  <div>
                    <div style={{ color: 'var(--ink-faint)', fontSize: 11 }}>Active Orgs</div>
                    <strong style={{ fontSize: 14 }}>{crawlerStatus.total_orgs}</strong>
                  </div>
                  <div>
                    <div style={{ color: 'var(--ink-faint)', fontSize: 11 }}>Monitored URLs</div>
                    <strong style={{ fontSize: 14 }}>{crawlerStatus.monitored_orgs}</strong>
                  </div>
                  <div>
                    <div style={{ color: 'var(--ink-faint)', fontSize: 11 }}>Polled Orgs</div>
                    <strong style={{ fontSize: 14 }}>{crawlerStatus.polled_orgs}</strong>
                  </div>
                </div>
              )}

              {/* Deduplication status pill */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 'var(--radius)',
                background: 'rgba(74, 158, 110, 0.1)',
                border: '1px solid rgba(74, 158, 110, 0.25)',
                marginBottom: 14,
                fontSize: 12.5,
                color: 'var(--green)'
              }}>
                <span>🔒</span>
                <span>
                  <strong>SHA-256 Content Deduplication</strong> is active. Identical notification files and URLs are automatically skipped with 0 wasted AI calls.
                </span>
              </div>

              {/* AI Key Note */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 'var(--radius)',
                background: 'rgba(124, 58, 237, 0.08)',
                border: '1px solid rgba(124, 58, 237, 0.2)',
                marginBottom: 16,
                fontSize: 12.5,
                color: '#7c3aed'
              }}>
                <span>✨</span>
                <span>
                  <strong>AI Ingestion & PDF Parser</strong> uses your personal saved Gemini API key (<Link to="/ai" style={{ color: '#7c3aed', fontWeight: 600, textDecoration: 'underline' }}>AI Settings</Link>).
                </span>
              </div>

              <button type="submit" className="btn btn-primary">Save Pipeline Defaults</button>
              {saved && <span style={{ marginLeft: 10, color: 'var(--green)', fontSize: 13 }}>Saved ✓</span>}
            </form>
          </div>

          {/* Quick Links Card */}
          <div className="card">
            <div className="section-title">Job Hunt Workspace Navigation</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0, marginBottom: 12 }}>
              Quick shortcuts across your full career management pipeline:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { to: '/profile', icon: '👤', title: 'Career Profile', desc: 'Degrees, skills, target roles, expected CTC & resume' },
                { to: '/orgs', icon: '🏢', title: 'Organization Registry', desc: 'Tracked ministries, PSUs, research labs & careers URLs' },
                { to: '/opportunities', icon: '⚡', title: 'Opportunities Feed', desc: 'Scored notices, vacancies, eligibility & match breakdown' },
                { to: '/applications', icon: '📋', title: 'My Applications', desc: 'Active pipeline, interview stages & follow-up tracking' },
                { to: '/', icon: '🎯', title: 'Radar Dashboard', desc: 'Top high-priority matches, upcoming deadlines & pipeline analytics' },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    background: 'var(--paper-hover)',
                    border: '1px solid var(--hairline)',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.background = 'var(--surface-muted)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--hairline)';
                    e.currentTarget.style.background = 'var(--paper-hover)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{link.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{link.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{link.desc}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--ink-faint)', marginLeft: 8 }}>→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full-width Database Backups & Restore Section */}
      <BackupSection
        ledger="jobhunt"
        title="Database Backups & Restore"
        description="Automatic weekly backups capture all Job Hunt tables (profile, organizations, opportunities, and applications) along with your full Life Ledger database. You can trigger an instant backup or restore anytime."
      />
    </div>
  );
}
