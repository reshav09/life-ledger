import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

const REC_CONFIG = {
  apply_now:      { icon: '🔥', label: 'Apply Now',      color: '#E05A3A', bg: 'rgba(224,90,58,0.12)' },
  worth_applying: { icon: '⭐', label: 'Worth Applying', color: '#C9852E', bg: 'rgba(201,133,46,0.12)' },
  investigate:    { icon: '👀', label: 'Investigate',     color: '#5B7FBA', bg: 'rgba(91,127,186,0.12)' },
  ignore:         { icon: '❌', label: 'Ignore',          color: '#6E7A8A', bg: 'rgba(110,122,138,0.12)' }
};

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

function parseSkills(skillsVal) {
  if (!skillsVal) return [];
  if (Array.isArray(skillsVal)) return skillsVal;
  try {
    const parsed = JSON.parse(skillsVal);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return skillsVal.split(',').map(s => s.trim()).filter(Boolean);
}

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

export default function JobHuntDetailDrawer({
  opp,
  onClose,
  onApply,
  onUnapply,
  onMarkStatus,
  onEdit,
  onArchive,
  applyingId
}) {
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!opp) return null;

  const rec = REC_CONFIG[opp.recommendation] || REC_CONFIG.ignore;
  const days = daysUntil(opp.application_deadline);
  const isApplied = opp.is_applied === 1 || (!!opp.application_status && opp.application_status !== 'planning');
  const skills = parseSkills(opp.required_skills);

  const applyLink = opp.apply_url || opp.source_url;
  const careersLink = opp.org_careers_url || opp.org_website;
  const primaryLink = applyLink || careersLink;
  const normApply = normalizeUrl(applyLink);
  const normCareers = normalizeUrl(careersLink);
  const hasSeparateCareers = normCareers && normCareers !== normApply;

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

  const visaLabel =
    opp.category_group === 'startup'
      ? '🚀 High-Growth Startup / Product Tech (High Base + ESOPs)'
      : opp.category_group === 'research_internship'
      ? '🔬 Fully Funded International Research Fellowship (Stipend + Housing + Airfare + Visa)'
      : opp.category_group === 'quant_hft'
      ? (opp.country === 'Netherlands' ? '🇳🇱 Netherlands Kennismigrant (High-Skill Migrant) Sponsored' : '⚡ Prop Trading / High-Frequency Systems')
      : opp.visa_sponsored === 1
      ? (opp.category_group === 'private_eu'
          ? '🇪🇺 EU Blue Card + Relocation Assistance'
          : opp.category_group === 'private_sg'
          ? '🇸🇬 Singapore Employment Pass (EP) Sponsored'
          : '✈️ Visa Sponsorship Confirmed')
      : opp.category_group === 'private_global'
      ? '🌐 100% Global Remote (Worldwide)'
      : '🇮🇳 Domestic / Work Authorization Required';

  return createPortal(
    <div className="jh-drawer-overlay" style={{ zIndex: 99999 }} onClick={onClose}>
      <div className="jh-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="jh-drawer-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600 }}>
                {opp.org_name || 'Organization'}
              </span>
              {opp.org_sector && (
                <span className="jh-sector-pill" style={{ fontSize: 10.5, padding: '1px 8px' }}>
                  {opp.org_sector}
                </span>
              )}
              {opp.country && (
                <span style={{ fontSize: 11, color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span>{getCountryFlag(opp.country)}</span>
                  <span>{opp.country}</span>
                </span>
              )}
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '2px 0 0 0', lineHeight: 1.3, color: 'var(--ink)' }}>
              {opp.title}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span className="jh-score-badge" style={{ fontSize: 13, padding: '3px 9px' }}>
              {opp.opportunity_score != null ? `${opp.opportunity_score}/100` : '—'}
            </span>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                color: 'var(--ink-soft)',
                fontSize: 16,
                padding: '4px 10px',
                lineHeight: 1,
                borderRadius: 8,
                cursor: 'pointer'
              }}
              onClick={onClose}
              title="Close drawer (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Action Header Banner */}
        <div style={{
          padding: '12px 22px',
          background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid var(--hairline)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="jh-rec-badge" style={{ background: rec.bg, color: rec.color }}>
              {rec.icon} {rec.label}
            </span>
            {opp.is_verified_active === 1 && (
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8, background: 'rgba(34, 197, 94, 0.12)', color: '#16a34a', fontWeight: 600 }}>
                ✓ Live Verified
              </span>
            )}
            {opp.requires_gate === 1 && (
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', fontWeight: 600 }}>
                ⚠️ Mandatory GATE
              </span>
            )}
          </div>

          {days != null ? (
            <div style={{ fontSize: 12, color: urgencyColor(days), fontWeight: 600 }}>
              {days < 0 ? '⏰ Deadline passed' : days === 0 ? '⚠️ Deadline TODAY' : `📅 ${days} day${days !== 1 ? 's' : ''} left`}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>⚡</span> <span>Rolling Requisition (Open)</span>
            </div>
          )}
        </div>

        {/* Drawer Body */}
        <div className="jh-drawer-body">
          {/* Disqualification warning if ignored */}
          {opp.recommendation === 'ignore' && (
            <div style={{
              fontSize: 12.5,
              color: '#dc2626',
              background: 'rgba(239, 68, 68, 0.08)',
              padding: '10px 14px',
              borderRadius: 8,
              fontWeight: 500,
              border: '1px solid rgba(239, 68, 68, 0.2)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8
            }}>
              <span>🚫</span>
              <div>
                <strong>Filtered / Below Threshold: </strong>
                {opp.requires_gate
                  ? 'Mandatory GATE qualification required (no GATE score on candidate profile).'
                  : opp.notes || 'Compensation or criteria falls below candidate preferences.'}
              </div>
            </div>
          )}

          {/* Source Reliability & Anti-Ghost Verification */}
          {(() => {
            let conf = null;
            if (opp.confidence_metadata) {
              try {
                conf = typeof opp.confidence_metadata === 'string' ? JSON.parse(opp.confidence_metadata) : opp.confidence_metadata;
              } catch {}
            }

            const isATS = opp.source_type === 'ats' || !!conf?.fields?.compensation?.is_verified || (conf?.overall_confidence === 'high');
            const isDeadLink = opp.is_active_link === 0;
            const isVerifiedLink = opp.is_active_link === 1;

            return (
              <div style={{
                background: isDeadLink ? 'rgba(239, 68, 68, 0.06)' : 'rgba(16, 185, 129, 0.05)',
                border: `1px solid ${isDeadLink ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.2)'}`,
                borderRadius: 10,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: isDeadLink ? '#ef4444' : 'var(--green)' }}>
                    <span>🛡️</span>
                    <span>Source Reliability & Verification</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {isDeadLink ? (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 600, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        ⚠️ Dead URL / Suspected Ghost Job
                      </span>
                    ) : isVerifiedLink ? (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--green)', fontWeight: 600, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        ✓ Link Reachable
                      </span>
                    ) : isATS ? (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--green)', fontWeight: 600, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        ⚡ ATS Feed Verified
                      </span>
                    ) : null}

                    <span style={{
                      fontSize: 10.5,
                      padding: '2px 7px',
                      borderRadius: 6,
                      background: conf?.overall_confidence === 'high' ? 'rgba(16, 185, 129, 0.15)' : conf?.overall_confidence === 'medium' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                      color: conf?.overall_confidence === 'high' ? 'var(--green)' : conf?.overall_confidence === 'medium' ? '#eab308' : 'var(--ink-faint)',
                      fontWeight: 600
                    }}>
                      Confidence: {(conf?.overall_confidence || (isATS ? 'high' : 'medium')).toUpperCase()}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span>
                    <strong>Extraction:</strong> {isATS ? 'Direct ATS API Feed' : conf?.is_llm_derived ? 'LLM Semantic Parser' : 'Regex / Portal Parser'}
                  </span>
                  {conf?.fields?.compensation && (
                    <span>
                      <strong>Comp:</strong> {conf.fields.compensation.is_verified ? '✓ Verified Official' : '~ Pattern Extracted'} ({conf.fields.compensation.confidence || 'med'})
                    </span>
                  )}
                  {opp.last_verified_at && (
                    <span style={{ color: 'var(--ink-faint)', marginLeft: 'auto', fontSize: 11 }}>
                      Verified: {new Date(opp.last_verified_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Key Metrics Grid */}
          <div className="jh-drawer-grid">
            <div className="jh-drawer-card">
              <div className="jh-drawer-label">💰 Package & Compensation</div>
              <div className="jh-drawer-val" style={{ color: 'var(--green)', fontWeight: 700, fontSize: 14 }}>
                {opp.compensation_display || opp.pay_scale || (opp.ctc_max ? `₹${(opp.ctc_max / 100000).toFixed(1)} LPA` : 'Competitive / Standard')}
              </div>
            </div>

            <div className="jh-drawer-card">
              <div className="jh-drawer-label">🌍 Region & Visa Sponsorship</div>
              <div className="jh-drawer-val" style={{ fontSize: 12.5 }}>
                {visaLabel}
              </div>
            </div>

            <div className="jh-drawer-card">
              <div className="jh-drawer-label">🎓 Degree & Branch</div>
              <div className="jh-drawer-val">
                {opp.required_degree || 'B.E / B.Tech / Any Engg'}
                {opp.required_branch ? ` (${opp.required_branch})` : ''}
              </div>
            </div>

            <div className="jh-drawer-card">
              <div className="jh-drawer-label">⏳ Min Experience Required</div>
              <div className="jh-drawer-val">
                {opp.min_experience_years != null ? `${opp.min_experience_years}+ years` : 'Fresher / Entry eligible'}
              </div>
            </div>

            <div className="jh-drawer-card">
              <div className="jh-drawer-label">📍 Office Location / Remote</div>
              <div className="jh-drawer-val">
                {opp.location || 'Not specified / Pan India'}
              </div>
            </div>

            <div className="jh-drawer-card">
              <div className="jh-drawer-label">📅 Date Posted & Recency</div>
              <div className="jh-drawer-val" style={{ fontSize: 12.5 }}>
                {opp.posted_date ? (
                  <>
                    <span>{opp.posted_date.slice(0, 10)}</span>
                    <span style={{ fontSize: 11, color: (daysAgo(opp.posted_date) <= 7) ? 'var(--green)' : 'var(--ink-soft)', marginLeft: 6, fontWeight: 600 }}>
                      ({daysAgo(opp.posted_date) <= 0 ? 'Today' : `${daysAgo(opp.posted_date)}d ago`} {daysAgo(opp.posted_date) <= 7 ? '⚡ Fresh' : ''})
                    </span>
                  </>
                ) : (
                  <span style={{ color: 'var(--ink-faint)' }}>Recently Verified</span>
                )}
              </div>
            </div>

            <div className="jh-drawer-card">
              <div className="jh-drawer-label">👥 Vacancies / Openings</div>
              <div className="jh-drawer-val">
                {opp.vacancies ? `${opp.vacancies} vacancies` : 'Standard recruitment'}
              </div>
            </div>
          </div>

          {/* Auto-Maintenance Lifecycle Policy */}
          <div style={{
            fontSize: 12,
            color: 'var(--ink-soft)',
            background: 'rgba(255,255,255,0.02)',
            padding: '9px 13px',
            borderRadius: 8,
            border: '1px solid var(--hairline)',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span>🛡️</span>
            <span>
              <strong>Auto-Lifecycle Policy:</strong> Private postings auto-archive at 15 days (rolling basis limit). Expired deadlines are permanently deleted to keep your opportunities list 100% active and fresh.
            </span>
          </div>

          {/* Strategic Candidate Prep Guidance (Profile Grounded) */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(59, 130, 246, 0.08))',
            border: '1px solid rgba(124, 58, 237, 0.25)',
            borderRadius: 10,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <span>🎯</span>
              <span>Candidate Prep Strategy & High-Yield Focus</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.55 }}>
              {opp.category_group === 'research_internship' ? (
                <span>
                  <strong>Fully Funded Research Fellowship Strategy:</strong> Focus on Statement of Purpose (SOP), research proposals, and academic alignment. Highlight your IEEE publication, novel algorithms, Plant Disease CNN research, and IIT Madras BS Data Science coursework. Emphasize proficiency in Python, PyTorch/TensorFlow, and distributed scientific computing. Reach out to prospective faculty advisors/PIs with concise cold emails linking your GitHub and research papers.
                </span>
              ) : opp.category_group === 'startup' ? (
                <span>
                  <strong>High-Growth Startup / Product Engineering Focus:</strong> Rapid execution, high ownership, REST/gRPC API architecture, clean microservices (Node/Go/Python/Java), and product intuition. Emphasize ability to ship production features fast with minimal guidance, debugging live systems, and your Cloud/DevOps & FinOps skills.
                </span>
              ) : opp.category_group === 'quant_hft' ? (
                <span>
                  <strong>High-Frequency Trading & Market Making Focus:</strong> Master modern C++ (C++17/20), cache alignment, lock-free queues, low-latency Linux networking (socket options, epoll), and algorithmic problem solving. Emphasize systems-level performance tuning.
                </span>
              ) : opp.category_group === 'private_sg' ? (
                <span>
                  <strong>Singapore Tech Giant Focus:</strong> Emphasize high-scale distributed systems, microservices in Go/Java, Kafka streaming, and multi-region fault tolerance. Highlight your hands-on FinOps/Cloud infrastructure experience. Full Singapore EP visa support provided.
                </span>
              ) : opp.category_group === 'private_eu' ? (
                <span>
                  <strong>European Privacy & Cloud Systems Focus:</strong> Focus on container orchestration, Kubernetes, CI/CD automation, and Linux internals. Tuta and Proton emphasize zero-knowledge architecture and privacy compliance. EU Blue Card sponsorship supported.
                </span>
              ) : opp.category_group === 'private_global' ? (
                <span>
                  <strong>Global Remote Platform Focus:</strong> Practice asynchronous communication, writing RFC design docs, building resilient cloud architectures (AWS/GCP), and containerized microservices. Highlight autonomous system ownership.
                </span>
              ) : opp.category_group === 'psu' ? (
                <span>
                  <strong>Public Sector CPSE Focus:</strong> Review core CSE fundamentals: Operating Systems, Computer Networks, DBMS, and Computer Organization. Be prepared for direct technical written tests and domain interviews.
                </span>
              ) : (
                <span>
                  <strong>Tier-1 Product Engineering Focus:</strong> Focus on LeetCode Medium/Hard (Trees, Dynamic Programming, Graphs), Low-Level Design (Concurrency, Object-Oriented patterns), and System Design (Kafka, Redis, sharding). Leverage your 1.5 yrs FinOps/Cloud/DevOps experience in Python/AWS/Kubernetes as a key differentiator.
                </span>
              )}
            </div>
          </div>

          {/* Role Details & Description */}
          {opp.raw_text && (
            <div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-faint)', fontWeight: 600, marginBottom: 6 }}>
                📄 Role Description & Scope
              </div>
              <div style={{
                fontSize: 13,
                color: 'var(--ink-soft)',
                lineHeight: 1.6,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--hairline)',
                borderRadius: 10,
                padding: '12px 14px',
                whiteSpace: 'pre-wrap'
              }}>
                {opp.raw_text}
              </div>
            </div>
          )}

          {/* Required Skills Chips */}
          {skills.length > 0 && (
            <div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-faint)', fontWeight: 600, marginBottom: 8 }}>
                🛠️ Required Skills & Tech Stack
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {skills.map((skill, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: 12,
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: 'rgba(53, 199, 144, 0.12)',
                      color: 'var(--green)',
                      fontWeight: 500,
                      border: '1px solid rgba(53, 199, 144, 0.25)'
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Score Breakdown */}
          <div>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-faint)', fontWeight: 600, marginBottom: 8 }}>
              📊 Multi-Criteria Score Breakdown
            </div>
            <div className="jh-score-bars" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
              {[
                { label: 'Eligibility', val: opp.eligibility_pct },
                { label: 'Profile Match', val: opp.profile_match_pct },
                { label: 'Compensation', val: opp.compensation_score },
                { label: 'Career Potential', val: opp.career_potential_score },
                { label: 'Competition Signal', val: opp.competition_signal },
                { label: 'Application Ease', val: opp.application_difficulty_score },
                { label: 'Org Prestige', val: opp.org_quality_score },
                { label: 'Urgency Score', val: opp.deadline_urgency_score }
              ].map((d) => (
                <div key={d.label} className="jh-score-bar-item">
                  <span className="jh-score-bar-label" style={{ width: 95 }}>{d.label}</span>
                  <div className="jh-score-bar-track">
                    <div className="jh-score-bar-fill" style={{ width: `${d.val || 0}%` }} />
                  </div>
                  <span className="jh-score-bar-val">{d.val ?? '—'}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)', fontStyle: 'italic', marginTop: 6 }}>
              * Weighted scoring evaluates profile skills, compensation threshold, visa viability, and urgency.
            </div>
          </div>

          {/* Notes */}
          {opp.notes && (
            <div>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-faint)', fontWeight: 600, marginBottom: 6 }}>
                📝 Notes & Selection Process
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5, background: 'rgba(255,255,255,0.015)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--hairline)' }}>
                {opp.notes}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="jh-drawer-footer">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {isApplied ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {opp.application_status === 'rejected' ? (
                  <span
                    className="badge rust"
                    style={{
                      padding: '6px 12px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                    title="Marked as Rejected in My Applications"
                  >
                    <span>❌</span> Rejected & Closed
                  </span>
                ) : (
                  <button
                    type="button"
                    className="jh-table-applied-badge jh-apply-track-btn-lg"
                    onClick={() => navigate('/applications')}
                    title="View in My Applications"
                  >
                    <span>✓</span> Applied ({opp.application_status || 'applied'}) ↗
                  </button>
                )}

                {opp.application_status !== 'rejected' && onMarkStatus && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ color: 'var(--rust)', borderColor: 'var(--hairline)' }}
                    onClick={() => onMarkStatus(opp, 'rejected')}
                    title="Received rejection email? Send to Rejected applications"
                  >
                    ✗ Mark Rejected
                  </button>
                )}

                {opp.application_status === 'rejected' && onMarkStatus && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ color: 'var(--brass)', borderColor: 'var(--hairline)' }}
                    onClick={() => onMarkStatus(opp, 'applied')}
                    title="Re-open back into active applied applications"
                  >
                    ↩ Re-Open to Applied
                  </button>
                )}

                {primaryLink && (
                  <a
                    href={primaryLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm"
                    style={{ color: 'var(--ink-soft)' }}
                  >
                    🔗 Portal ↗
                  </a>
                )}
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ color: 'var(--ink-faint)', fontSize: 11 }}
                  onClick={() => onUnapply(opp)}
                >
                  Untrack
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="jh-apply-track-btn jh-apply-track-btn-lg"
                disabled={applyingId === opp.id}
                onClick={() => onApply(opp)}
                title="1-Click Apply & Track into My Applications"
              >
                <span>{applyingId === opp.id ? '⏳' : '🚀'}</span>
                <span>{applyingId === opp.id ? 'Saving…' : 'Apply & Track ↗'}</span>
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
              style={{ background: 'rgba(217, 119, 87, 0.12)', color: 'var(--rust)', border: '1px solid rgba(217, 119, 87, 0.3)', fontWeight: 600 }}
              onClick={() => {
                navigate(`/workspace?oppId=${opp.id}`);
                onClose();
              }}
              title="Tailor ATS resume & factual cover letter for this role"
            >
              📄 Tailor CV & Letter ↗
            </button>
            <button
              type="button"
              className="btn btn-sm"
              style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.25)', fontWeight: 600 }}
              onClick={() => {
                navigate(`/prep?orgId=${opp.org_id || ''}&role=${encodeURIComponent(opp.title)}`);
                onClose();
              }}
              title="View Tailored Exam Pattern & Round-by-Round Preparation Roadmap"
            >
              🎯 Prep Roadmap ↗
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" className="btn btn-sm" onClick={() => { onEdit(opp); onClose(); }}>
              ✏️ Edit
            </button>
            <button type="button" className="btn btn-sm" onClick={() => { onArchive(opp.id, opp.title); onClose(); }}>
              📦 Archive
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
