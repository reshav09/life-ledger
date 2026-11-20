import { useState, useEffect } from 'react';
import { api } from '../api';

const SESSION_MODES = [
  { id: 'behavioral_star', label: 'Behavioral & STAR', icon: '🌟', desc: 'Practice using your selected profile or application snapshot' },
  { id: 'technical', label: 'Technical & Domain', icon: '⚡', desc: 'Target role technical deep dive based on job requirements' },
  { id: 'project_deepdive', label: 'Project Architecture', icon: '🔬', desc: 'Deconstruct design trade-offs, concurrency & failure modes of your stack' },
  { id: 'system_design', label: 'System Design', icon: '🏗️', desc: 'Scalable distributed systems tailored to target employer domain' }
];

export default function JobHuntMockInterviewRunner({ plan, orgName, roleTitle, opportunityId, applicationId }) {
  const [sessions, setSessions] = useState([]);
  const [packages,setPackages]=useState([]);
  const [packageId,setPackageId]=useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [sessionType, setSessionType] = useState('behavioral_star');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const targetOrg = orgName || plan?.org_name || 'Target Company';
  const targetRole = roleTitle || plan?.role_title || 'Software Engineer';

  // Load past sessions
  useEffect(() => {
    loadSessions();
  }, [opportunityId, applicationId]);

  async function loadSessions() {
    try {
      const params=new URLSearchParams();
      if(opportunityId)params.set('opportunityId',opportunityId);
      if(applicationId)params.set('applicationId',applicationId);
      const res=await api.get(`/jobhunt/prep/mock?${params}`);
      const pkgs=await api.get(`/jobhunt/documents/packages${opportunityId?'?opportunity_id='+opportunityId:''}`);
      setPackages(pkgs);
      setSessions(res || []);
    } catch (err) {
      console.warn('Failed to load past mock sessions:', err);
    }
  }

  async function startNewSession() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/jobhunt/prep/mock/start', {
        opportunityId: opportunityId || null,
        applicationId: applicationId || null,
        sessionType, packageId:packageId || null,targetRole,targetCompany:targetOrg
      });
      setActiveSession(res);
      setCurrentQuestionIdx(0);
      setUserAnswer('');
      loadSessions();
    } catch (err) {
      setError(err.message || 'Failed to start mock session');
    } finally {
      setLoading(false);
    }
  }

  async function loadExistingSession(sessionId) {
    setLoading(true);
    try {
      const res = await api.get(`/jobhunt/prep/mock/${sessionId}`);
      setActiveSession(res);
      const qIdx = res.current_question_index || 0;
      setCurrentQuestionIdx(qIdx);
      setUserAnswer(res.questions?.[qIdx]?.userAnswer || '');
    } catch (err) {
      setError(err.message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitAnswer() {
    if (!activeSession || !userAnswer.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/jobhunt/prep/mock/${activeSession.id}/answer`, {
        questionIndex: currentQuestionIdx,
        answer: userAnswer
      });

      // Update question in activeSession
      setActiveSession(prev => {
        if (!prev) return prev;
        const updatedQuestions = [...prev.questions];
        updatedQuestions[currentQuestionIdx] = {
          ...updatedQuestions[currentQuestionIdx],
          userAnswer: userAnswer,
          feedback: res.evaluation
        };
        return {
          ...prev,
          questions: updatedQuestions,
          overall_score: res.overall_score
        };
      });

      if (res.nextIndex !== currentQuestionIdx && !res.isComplete) {
        // Can optionally auto-advance, but let user see feedback first
      }
    } catch (err) {
      alert(`Failed to submit answer: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  const currentQ = activeSession?.questions?.[currentQuestionIdx];
  const answeredCount = activeSession?.questions?.filter(q => q.userAnswer && q.userAnswer.trim()).length || 0;
  const totalQuestions = activeSession?.questions?.length || 5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header & Mode Switcher */}
      <div style={{
        background: 'var(--paper-raised)',
        border: '1px solid var(--hairline)',
        borderRadius: 12,
        padding: '18px 22px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>🎙️</span>
              <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: 'var(--ink)' }}>
                Role-Specific Grounded Mock Interview
              </h3>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-soft)' }}>
              Practicing for <strong style={{ color: 'var(--ink)' }}>{targetRole}</strong> at <strong style={{ color: 'var(--ink)' }}>{targetOrg}</strong>.
              All behavioral prompts trace to confirmed evidence from your profile; technical prompts align with employer stack.
            </p>
          </div>

          {!activeSession ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading}
              onClick={startNewSession}
              style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span>{loading ? '⏳' : '⚡'}</span>
              <span>{loading ? 'Generating Grounded Questions…' : 'Start Mock Session'}</span>
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="badge" style={{ background: 'rgba(52, 211, 153, 0.12)', color: '#34d399', fontWeight: 600 }}>
                Progress: {answeredCount} / {totalQuestions}
              </span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => { setActiveSession(null); loadSessions(); }}
              >
                Exit / Switch Mode
              </button>
            </div>
          )}
        </div>

        {/* Mode Selector (When no active session) */}
        {!activeSession && (
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-faint)', display: 'block', marginBottom: 10 }}>
              Select Interview Archetype
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {SESSION_MODES.map(mode => {
                const isSelected = sessionType === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setSessionType(mode.id)}
                    style={{
                      textAlign: 'left',
                      background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--paper)',
                      border: isSelected ? '1.5px solid #3b82f6' : '1px solid var(--hairline)',
                      borderRadius: 8,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16 }}>{mode.icon}</span>
                      <strong style={{ fontSize: 13, color: isSelected ? '#3b82f6' : 'var(--ink)' }}>{mode.label}</strong>
                    </div>
                    <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-soft)', lineHeight: 1.35 }}>
                      {mode.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Active Session Question Runner */}
      {activeSession && currentQ && (
        <div style={{
          background: 'var(--paper)',
          border: '1px solid var(--hairline)',
          borderRadius: 12,
          padding: '20px 24px'
        }}>
          {/* Question Breadcrumb / Stepper */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--hairline)', paddingBottom: 14, marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {activeSession.questions.map((q, idx) => {
                const isCurrent = idx === currentQuestionIdx;
                const hasAnswer = !!q.userAnswer;
                const score = q.feedback?.score;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setCurrentQuestionIdx(idx);
                      setUserAnswer(activeSession.questions[idx]?.userAnswer || '');
                    }}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      border: isCurrent ? '2px solid #3b82f6' : '1px solid var(--hairline)',
                      background: isCurrent ? 'rgba(59, 130, 246, 0.15)' : hasAnswer ? 'rgba(52, 211, 153, 0.15)' : 'var(--paper-raised)',
                      color: isCurrent ? '#3b82f6' : hasAnswer ? '#10b981' : 'var(--ink-faint)',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title={`Question ${idx + 1}${score ? ` · Score: ${score}/100` : ''}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge" style={{ background: 'rgba(217, 119, 87, 0.12)', color: 'var(--rust)', fontSize: 11.5 }}>
                {currentQ.category}
              </span>
              {currentQ.groundedEvidence && (
                <span className="badge" style={{ background: 'rgba(52, 211, 153, 0.12)', color: '#16a34a', fontSize: 11.5 }} title="Verified Profile Evidence Grounding">
                  🛡️ {currentQ.groundedEvidence.slice(0, 40)}…
                </span>
              )}
            </div>
          </div>

          {/* Question Prompt */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Question {currentQuestionIdx + 1} of {totalQuestions}
            </div>
            <h4 style={{ margin: 0, fontSize: 17, lineHeight: 1.45, color: 'var(--ink)' }}>
              {currentQ.question}
            </h4>
          </div>

          {/* STAR Guidance Accordion Box */}
          {currentQ.starGuidance && (
            <div style={{
              background: 'var(--paper-raised)',
              border: '1px solid var(--hairline)',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 20
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🎯</span> Recommended Response Blueprint (STAR Methodology)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, fontSize: 12, color: 'var(--ink)' }}>
                <div><strong style={{ color: 'var(--brass)' }}>S - Situation:</strong> {currentQ.starGuidance.situation}</div>
                <div><strong style={{ color: 'var(--brass)' }}>T - Task:</strong> {currentQ.starGuidance.task}</div>
                <div><strong style={{ color: 'var(--brass)' }}>A - Action:</strong> {currentQ.starGuidance.action}</div>
                <div><strong style={{ color: 'var(--brass)' }}>R - Result:</strong> {currentQ.starGuidance.result}</div>
              </div>
            </div>
          )}

          {/* User Answer Textarea */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
              Your Structured Answer
            </label>
            <textarea
              rows={7}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Outline your situation, describe your personal actions with metrics, and conclude with the business/technical impact..."
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: 13.5,
                lineHeight: 1.55,
                borderRadius: 8,
                border: '1px solid var(--hairline)',
                background: 'var(--paper-raised)',
                color: 'var(--ink)',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Actions & Feedback */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting || !userAnswer.trim()}
                onClick={handleSubmitAnswer}
                style={{ fontWeight: 600 }}
              >
                {submitting ? 'Auditing & Grading…' : currentQ.userAnswer ? 'Re-Submit & Re-Grade' : 'Submit for Instant Feedback'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {currentQuestionIdx > 0 && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    const prev = currentQuestionIdx - 1;
                    setCurrentQuestionIdx(prev);
                    setUserAnswer(activeSession.questions[prev]?.userAnswer || '');
                  }}
                >
                  ← Previous
                </button>
              )}
              {currentQuestionIdx < totalQuestions - 1 && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    const next = currentQuestionIdx + 1;
                    setCurrentQuestionIdx(next);
                    setUserAnswer(activeSession.questions[next]?.userAnswer || '');
                  }}
                >
                  Next Question →
                </button>
              )}
            </div>
          </div>

          {/* Instant Evaluation Card */}
          {currentQ.feedback && (
            <div style={{
              marginTop: 20,
              padding: '16px 20px',
              borderRadius: 10,
              background: currentQ.feedback.score >= 80 ? 'rgba(52, 211, 153, 0.08)' : currentQ.feedback.score >= 60 ? 'rgba(251, 191, 36, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${currentQ.feedback.score >= 80 ? 'rgba(52, 211, 153, 0.25)' : currentQ.feedback.score >= 60 ? 'rgba(251, 191, 36, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{currentQ.feedback.score >= 80 ? '🏆' : currentQ.feedback.score >= 60 ? '⚡' : '💡'}</span>
                  <strong style={{ fontSize: 14.5, color: 'var(--ink)' }}>
                    Evaluation Verdict: {currentQ.feedback.verdict}
                  </strong>
                </div>
                <span className="badge" style={{
                  fontSize: 13,
                  fontWeight: 700,
                  background: currentQ.feedback.score >= 80 ? '#10b981' : currentQ.feedback.score >= 60 ? '#f59e0b' : '#ef4444',
                  color: '#FFF'
                }}>
                  {currentQ.feedback.score} / 100
                </span>
              </div>

              <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
                {currentQ.feedback.feedback}
              </p>

              {currentQ.feedback.suggestions?.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--hairline)' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 4 }}>
                    Actionable Improvement Advice
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                    {currentQ.feedback.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Past Sessions Archive */}
      {!activeSession && <label>Use application version <select value={packageId} onChange={e=>setPackageId(e.target.value)}><option value="">Current confirmed profile</option>{packages.map(p=><option key={p.id} value={p.id}>{p.org_name} — {p.role_title} v{p.version} ({p.status})</option>)}</select></label>}
      {sessions.length > 0 && !activeSession && (
        <div style={{
          background: 'var(--paper)',
          border: '1px solid var(--hairline)',
          borderRadius: 12,
          padding: '16px 20px'
        }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
            Recent Mock Interview Sessions
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sessions.map(s => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: 'var(--paper-raised)',
                  borderRadius: 8,
                  border: '1px solid var(--hairline)'
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {s.stage_name} · {s.role_title}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2 }}>
                    {s.org_name} · {new Date(s.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {s.overall_score != null ? (
                    <span className="badge" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#10b981', fontWeight: 700 }}>
                      Score: {s.overall_score}/100
                    </span>
                  ) : (
                    <span className="badge" style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#f59e0b' }}>
                      In Progress
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => loadExistingSession(s.id)}
                  >
                    Resume ↗
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

