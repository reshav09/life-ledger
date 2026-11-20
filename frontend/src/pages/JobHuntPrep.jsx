import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import JobHuntMockInterviewRunner from '../components/JobHuntMockInterviewRunner';

const PROCESS_TYPE_CONFIG = {
  psu_cbt_exam: {
    label: 'Govt / PSU Computer-Based Test (CBT) & Board Interview',
    shortLabel: 'Govt / PSU CBT',
    icon: '🏛️',
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.12)',
    border: 'rgba(167, 139, 250, 0.25)'
  },
  private_tech: {
    label: 'Private Tech Multi-Stage (OA, DSA, System Design, Fit)',
    shortLabel: 'Private Tech Multi-Stage',
    icon: '🏢',
    color: '#60a5fa',
    bg: 'rgba(96, 165, 250, 0.12)',
    border: 'rgba(96, 165, 250, 0.25)'
  },
  quant_hft: {
    label: 'Quantitative Trading & Low-Latency Systems',
    shortLabel: 'Quant Trading & Low Latency',
    icon: '⚡',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.12)',
    border: 'rgba(251, 191, 36, 0.25)'
  },
  hybrid_exam_interview: {
    label: 'Hybrid Screening Exam & Technical Panel',
    shortLabel: 'Hybrid Screening',
    icon: '⚖️',
    color: '#34d399',
    bg: 'rgba(52, 211, 153, 0.12)',
    border: 'rgba(52, 211, 153, 0.25)'
  }
};

const CONFIDENCE_CONFIG = {
  high: {
    label: 'High Confidence',
    badgeText: '✓ Verified Across >=2 Sources',
    color: '#34d399',
    bg: 'rgba(52, 211, 153, 0.12)'
  },
  based_on_notification: {
    label: 'Official Notification Verified',
    badgeText: '📜 Official Notification PDF',
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.12)'
  },
  medium: {
    label: 'Medium Confidence',
    badgeText: '⚡ Multi-Source Benchmarked',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.12)'
  },
  insufficient_data: {
    label: 'Insufficient Public Data',
    badgeText: '⚠️ Low Public Telemetry',
    color: '#9ca3af',
    bg: 'rgba(156, 163, 175, 0.12)'
  }
};

const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)' },
  medium: { label: 'Medium', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' },
  hard: { label: 'Hard', color: '#f87171', bg: 'rgba(248, 113, 113, 0.15)' }
};

function getCountryFlag(country) {
  if (!country) return '📍';
  const c = country.toLowerCase();
  if (c.includes('remote')) return '🌐';
  if (c.includes('india')) return '🇮🇳';
  if (c.includes('netherland')) return '🇳🇱';
  if (c.includes('germany')) return '🇩🇪';
  if (c.includes('france')) return '🇫🇷';
  if (c.includes('finland')) return '🇫🇮';
  if (c.includes('sweden')) return '🇸🇪';
  if (c.includes('switzerland')) return '🇨🇭';
  if (c.includes('united states') || c.includes('usa')) return '🇺🇸';
  if (c.includes('luxembourg')) return '🇱🇺';
  if (c.includes('poland')) return '🇵🇱';
  if (c.includes('ireland')) return '🇮🇪';
  if (c.includes('united kingdom') || c.includes('uk')) return '🇬🇧';
  if (c.includes('singapore')) return '🇸🇬';
  if (c.includes('israel')) return '🇮🇱';
  return '📍';
}

export default function JobHuntPrep() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState(null);

  // Search & Filters for organization selector
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all'); // all | psu | tech | eu | quant | global

  // Active Practice Tab inside main view
  const [activeTab, setActiveTab] = useState('stages');

  // Modal states
  const [showSourcesModal, setShowSourcesModal] = useState(false);
  const [showCustomResearchModal, setShowCustomResearchModal] = useState(false);
  const [researching, setResearching] = useState(false);

  // Custom research form
  const [orgList, setOrgList] = useState([]);
  const [customOrgName, setCustomOrgName] = useState('');
  const [customRoleTitle, setCustomRoleTitle] = useState('');
  const [customRoleCat, setCustomRoleCat] = useState('sde');

  // Candidate Company Notes
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSuccess, setNotesSuccess] = useState(false);

  // ── Question Bank State ──
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionStats, setQuestionStats] = useState({ grandTotal: 0, grandSolved: 0, breakdown: [] });
  const [questionSearch, setQuestionSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [expandedSolutions, setExpandedSolutions] = useState(new Set());
  const [activeNoteEditingId, setActiveNoteEditingId] = useState(null);
  const [tempQuestionNotes, setTempQuestionNotes] = useState('');
  const [savingQuestionNote, setSavingQuestionNote] = useState(false);

  // Load all plans once on initial mount
  const loadPlans = useCallback(async (selectOrgId = null) => {
    try {
      setLoading(true);
      const data = await api.get('/jobhunt/prep');
      setPlans(data);

      if (data.length > 0) {
        const targetOrg = selectOrgId || searchParams.get('orgId');
        if (targetOrg) {
          const match = data.find(p => String(p.org_id) === String(targetOrg) || String(p.id) === String(targetOrg) || p.org_name.toLowerCase().includes(String(targetOrg).toLowerCase()));
          if (match) {
            setSelectedPlanId(match.id);
            setNotesText(match.user_notes || '');
            return;
          }
        }
        if (!selectedPlanId) {
          setSelectedPlanId(data[0].id);
          setNotesText(data[0].user_notes || '');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load organizations for custom research autocomplete
  useEffect(() => {
    api.get('/jobhunt/orgs')
      .then(res => setOrgList(res.organizations || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // Synchronize selection if searchParams change externally
  useEffect(() => {
    const qOrgId = searchParams.get('orgId');
    if (qOrgId && plans.length > 0) {
      const match = plans.find(p => String(p.org_id) === String(qOrgId) || String(p.id) === String(qOrgId) || p.org_name.toLowerCase().includes(String(qOrgId).toLowerCase()));
      if (match && match.id !== selectedPlanId) {
        setSelectedPlanId(match.id);
      }
    }
  }, [searchParams, plans, selectedPlanId]);

  // Active selected plan
  const activePlan = useMemo(() => {
    return plans.find(p => p.id === selectedPlanId) || plans[0] || null;
  }, [plans, selectedPlanId]);

  useEffect(() => {
    if (activePlan) {
      setNotesText(activePlan.user_notes || '');
    }
  }, [activePlan]);

  // Category matching helper
  const isPlanInCat = useCallback((p, cat) => {
    if (cat === 'all') return true;
    const nameLower = (p.org_name || '').toLowerCase();
    if (cat === 'startup') {
      const startupKeys = [
        'razorpay', 'swiggy', 'zerodha', 'phonepe', 'groww', 'cred', 'meesho',
        'zepto', 'urban company', 'ather energy', 'porter', 'postman', 'browserstack'
      ];
      return startupKeys.some(k => nameLower.includes(k)) || p.org_category_group === 'startup';
    }
    if (cat === 'psu') {
      const psuKeys = ['bhel', 'bel', 'c-dac', 'cdac', 'ecil', 'coal india', 'bharat electronics', 'bharat heavy'];
      return p.process_type === 'psu_cbt_exam' || p.org_category_group === 'psu' || psuKeys.some(k => nameLower.includes(k));
    }
    if (cat === 'govt') {
      const govtKeys = ['nic', 'nielit', 'c-dot', 'cdot', 'drdo', 'isro', 'csir', 'map_it', 'mapit', 'national informatics'];
      return p.org_category_group === 'govt' || p.org_category_group === 'research_internship' || govtKeys.some(k => nameLower.includes(k));
    }
    if (cat === 'tech') {
      const techKeys = ['tata consultancy services', 'tcs', 'infosys', 'zoho', 'persistent systems', 'persistent', 'wipro', 'l&t', 'cognizant', 'jio'];
      return p.org_category_group === 'private_in' || techKeys.some(k => nameLower.includes(k)) || (p.process_type === 'private_tech');
    }
    if (cat === 'remote') {
      return (p.location || '').toLowerCase().includes('remote') || nameLower.includes('remote');
    }
    return true;
  }, []);

  // Filter plans list for dropdown / selector
  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      if (!isPlanInCat(p, categoryFilter)) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        return p.org_name.toLowerCase().includes(q) || p.role_title.toLowerCase().includes(q);
      }
      return true;
    });
  }, [plans, categoryFilter, searchFilter, isPlanInCat]);

  // Keep selectedPlanId synchronized with filteredPlans
  useEffect(() => {
    if (filteredPlans.length > 0 && selectedPlanId) {
      const exists = filteredPlans.some(p => p.id === selectedPlanId);
      if (!exists) {
        const first = filteredPlans[0];
        setSelectedPlanId(first.id);
        if (first.org_id) {
          setSearchParams({ orgId: first.org_id });
        }
      }
    }
  }, [filteredPlans, selectedPlanId, setSearchParams]);

  // Category switch handler that immediately focuses on the first plan in that category
  const handleSelectCategory = (catId) => {
    setCategoryFilter(catId);
    const catPlans = plans.filter(p => isPlanInCat(p, catId));
    if (catPlans.length > 0) {
      const currentExists = catPlans.some(p => p.id === selectedPlanId);
      if (!currentExists) {
        const first = catPlans[0];
        setSelectedPlanId(first.id);
        if (first.org_id) {
          setSearchParams({ orgId: first.org_id });
        }
      }
    }
  };

  // Determine Company Archetype
  const isPSU = activePlan?.process_type === 'psu_cbt_exam';
  const isQuant = activePlan?.process_type === 'quant_hft' || activePlan?.role_category === 'quant_data';

  // Contextual Dynamic Tabs (NO PSU tabs on Optiver or Private Tech!)
  const availableTabs = useMemo(() => {
    if (!activePlan) return [];

    if (isPSU) {
      return [
        { id: 'stages', label: '🏛️ CBT Blueprint & Stages', badge: `${activePlan.stages?.length || 0}` },
        { id: 'psu_cbt', label: '⚡ PSU / Govt PYQs', badge: 'MCQs' },
        { id: 'neetcode', label: '💻 Core CS Patterns', badge: 'NeetCode' },
        { id: 'mock_interview', label: '🎙️ Mock Sessions', badge: 'AI' },
        { id: 'notes', label: '📝 Prep Notes', badge: 'Journal' }
      ];
    }

    if (isQuant) {
      return [
        { id: 'stages', label: '⚡ Selection Stages', badge: `${activePlan.stages?.length || 0}` },
        { id: 'company_leetcode', label: `💻 ${activePlan.org_name} Coding`, badge: 'Real Qs' },
        { id: 'quant_systems', label: '⚡ Low-Latency C++', badge: 'Systems' },
        { id: 'neetcode', label: '🧠 NeetCode 150', badge: 'Core' },
        { id: 'mock_interview', label: '🎙️ Mock Sessions', badge: 'AI' },
        { id: 'notes', label: '📝 Prep Notes', badge: 'Journal' }
      ];
    }

    // Standard Private Tech, EU Visa Sponsors & Global MNCs
    return [
      { id: 'stages', label: '🏢 Hiring Stages', badge: `${activePlan.stages?.length || 0}` },
      { id: 'company_leetcode', label: `💻 ${activePlan.org_name} Questions`, badge: 'Real Qs' },
      { id: 'devops', label: '🐧 Cloud & Systems', badge: 'Hands-on' },
      { id: 'neetcode', label: '🧠 NeetCode 150', badge: 'Core' },
      { id: 'mock_interview', label: '🎙️ Mock Sessions', badge: 'AI' },
      { id: 'notes', label: '📝 Prep Notes', badge: 'Journal' }
    ];
  }, [activePlan, isPSU, isQuant]);

  // Ensure active tab is valid for current plan
  useEffect(() => {
    if (availableTabs.length > 0) {
      const tabExists = availableTabs.some(t => t.id === activeTab);
      if (!tabExists) {
        setActiveTab(availableTabs[0].id);
      }
    }
  }, [availableTabs, activeTab]);

  // Fetch Question Bank statistics
  const loadQuestionStats = useCallback(async () => {
    try {
      const stats = await api.get('/jobhunt/prep/questions/stats');
      setQuestionStats(stats);
    } catch (err) {
      console.warn('Failed to load question stats:', err.message);
    }
  }, []);

  useEffect(() => {
    loadQuestionStats();
  }, [loadQuestionStats]);

  // Fetch Questions for current tab & company
  const loadQuestions = useCallback(async () => {
    if (!activePlan) return;
    try {
      setLoadingQuestions(true);
      let categoryParam = 'all';
      let companyParam = 'all';

      if (activeTab === 'company_leetcode') {
        categoryParam = 'leetcode_company';
        companyParam = activePlan.org_name;
      } else if (activeTab === 'quant_systems') {
        categoryParam = 'quant_systems';
        companyParam = 'all';
      } else if (activeTab === 'devops') {
        categoryParam = 'devops_exercises';
      } else if (activeTab === 'neetcode') {
        categoryParam = 'neetcode_150';
      } else if (activeTab === 'psu_cbt') {
        categoryParam = 'psu_cs_cbt';
      } else {
        setQuestions([]);
        setLoadingQuestions(false);
        return;
      }

      let url = `/jobhunt/prep/questions?category=${categoryParam}&limit=100`;
      if (companyParam !== 'all') {
        url += `&company=${encodeURIComponent(companyParam)}`;
      }
      if (difficultyFilter !== 'all') {
        url += `&difficulty=${difficultyFilter}`;
      }
      if (topicFilter !== 'all') {
        url += `&topic=${encodeURIComponent(topicFilter)}`;
      }
      if (questionSearch.trim()) {
        url += `&search=${encodeURIComponent(questionSearch.trim())}`;
      }

      const rows = await api.get(url);
      setQuestions(rows || []);
    } catch (err) {
      console.warn('Failed to fetch questions:', err.message);
    } finally {
      setLoadingQuestions(false);
    }
  }, [activePlan, activeTab, difficultyFilter, topicFilter, questionSearch]);

  useEffect(() => {
    if (activeTab !== 'stages' && activeTab !== 'notes') {
      loadQuestions();
    }
  }, [activeTab, activePlan, difficultyFilter, topicFilter, loadQuestions]);

  // Toggle solved status
  const handleToggleQuestionSolved = async (qId, currentSolved) => {
    try {
      const targetState = !currentSolved;
      setQuestions(prev => prev.map(q => q.id === qId ? { ...q, is_solved: targetState ? 1 : 0 } : q));
      await api.put(`/jobhunt/prep/questions/${qId}/solve`, { isSolved: targetState });
      loadQuestionStats();
    } catch (err) {
      alert('Failed to update question status: ' + err.message);
      loadQuestions();
    }
  };

  // Toggle in-app solution accordion
  const handleToggleSolution = (qId) => {
    setExpandedSolutions(prev => {
      const next = new Set(prev);
      if (next.has(qId)) {
        next.delete(qId);
      } else {
        next.add(qId);
      }
      return next;
    });
  };

  // Save personal notes for a question
  const handleSaveQuestionNotes = async (qId) => {
    try {
      setSavingQuestionNote(true);
      await api.put(`/jobhunt/prep/questions/${qId}/notes`, { notes: tempQuestionNotes });
      setQuestions(prev => prev.map(q => q.id === qId ? { ...q, user_notes: tempQuestionNotes } : q));
      setActiveNoteEditingId(null);
    } catch (err) {
      alert('Failed to save notes: ' + err.message);
    } finally {
      setSavingQuestionNote(false);
    }
  };

  // Handle stage checklist toggle
  const handleToggleStage = async (stageNum) => {
    if (!activePlan) return;
    const currentProgress = activePlan.user_progress || {};
    const currentCompleted = new Set(currentProgress.completedStages || []);

    if (currentCompleted.has(stageNum)) {
      currentCompleted.delete(stageNum);
    } else {
      currentCompleted.add(stageNum);
    }

    const updatedProgress = {
      ...currentProgress,
      completedStages: Array.from(currentCompleted)
    };

    try {
      const updated = await api.put(`/jobhunt/prep/${activePlan.id}/progress`, { progress: updatedProgress });
      setPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
    } catch (err) {
      alert('Failed to update stage progress: ' + err.message);
    }
  };

  // Handle company debrief notes save
  const handleSaveNotes = async () => {
    if (!activePlan) return;
    try {
      setSavingNotes(true);
      const updated = await api.put(`/jobhunt/prep/${activePlan.id}/notes`, { notes: notesText });
      setPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
      setNotesSuccess(true);
      setTimeout(() => setNotesSuccess(false), 2500);
    } catch (err) {
      alert('Failed to save notes: ' + err.message);
    } finally {
      setSavingNotes(false);
    }
  };

  // Switch to next or previous organization
  const handleStepOrg = (delta) => {
    if (!filteredPlans || filteredPlans.length === 0) return;
    const currentIndex = filteredPlans.findIndex(p => p.id === activePlan?.id);
    let nextIndex = 0;
    if (currentIndex !== -1) {
      nextIndex = currentIndex + delta;
      if (nextIndex < 0) nextIndex = filteredPlans.length - 1;
      if (nextIndex >= filteredPlans.length) nextIndex = 0;
    } else {
      nextIndex = delta > 0 ? 0 : filteredPlans.length - 1;
    }
    const target = filteredPlans[nextIndex];
    if (target) {
      setSelectedPlanId(target.id);
      if (target.org_id) setSearchParams({ orgId: target.org_id });
    }
  };

  // Trigger on-demand research
  const handleRunResearch = async (e) => {
    e.preventDefault();
    if (!customOrgName.trim()) return;

    try {
      setResearching(true);
      const newPlan = await api.post('/jobhunt/prep/research', {
        orgName: customOrgName.trim(),
        roleTitle: customRoleTitle.trim() || 'Software Engineer / Cloud & Systems',
        roleCategory: customRoleCat
      });

      setShowCustomResearchModal(false);
      setCustomOrgName('');
      setCustomRoleTitle('');
      await loadPlans(newPlan.org_id || newPlan.org_name);
    } catch (err) {
      alert('Research failed: ' + err.message);
    } finally {
      setResearching(false);
    }
  };

  // Active plan metrics
  const procInfo = activePlan ? (PROCESS_TYPE_CONFIG[activePlan.process_type] || PROCESS_TYPE_CONFIG.private_tech) : PROCESS_TYPE_CONFIG.private_tech;
  const confInfo = activePlan ? (CONFIDENCE_CONFIG[activePlan.confidence] || CONFIDENCE_CONFIG.high) : CONFIDENCE_CONFIG.high;
  const completedStages = new Set(activePlan?.user_progress?.completedStages || []);
  const stagesCount = activePlan?.stages?.length || 0;
  const masteredCount = completedStages.size;
  const progressPct = stagesCount > 0 ? Math.round((masteredCount / stagesCount) * 100) : 0;

  // Extract unique topics for dropdown
  const availableTopics = useMemo(() => {
    const set = new Set();
    questions.forEach(q => { if (q.topic) set.add(q.topic); });
    return Array.from(set).sort();
  }, [questions]);

  if (loading && plans.length === 0) {
    return (
      <div className="page-container" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
          Loading Interview & Competitive Exam Prep Hub…
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6 }}>
          Indexed {plans.length || 248} Organizations across Startups, Remote, Big Tech, and EU Visa Sponsors
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: 1200, margin: '0 auto', padding: '24px 20px 60px', boxSizing: 'border-box' }}>
      {/* ── Top Header Bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              Interview & Exam Preparation Hub
            </h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 10px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
              background: 'rgba(52, 211, 153, 0.12)',
              color: '#34d399',
              border: '1px solid rgba(52, 211, 153, 0.25)'
            }}>
              ✓ {plans.length} Orgs Indexed
            </span>
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 4 }}>
            Tailored hiring patterns, CBT exam schemes, and direct question banks.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', background: 'var(--paper-raised)', padding: '8px 14px', borderRadius: 10, border: '1px solid var(--hairline)' }}>
            Practice Progress: <strong style={{ color: '#34d399', fontSize: 14 }}>{questionStats.grandSolved}</strong> / {questionStats.grandTotal} Solved
          </div>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 10,
              background: 'var(--paper-raised)',
              border: '1px solid var(--hairline)',
              color: 'var(--ink)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer'
            }}
            onClick={() => setShowCustomResearchModal(true)}
          >
            <span>🔍</span>
            <span>+ Research Any Org</span>
          </button>
        </div>
      </div>

      {/* ── Target Organization Command Bar ── */}
      <div style={{
        background: 'var(--paper-raised)',
        border: '1px solid var(--hairline)',
        borderRadius: 14,
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }}>
        {/* Category Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)', fontWeight: 700, marginRight: 2 }}>
              Sector:
            </span>
            {[
              { id: 'all', label: `All (${plans.length})` },
              { id: 'psu', label: `🏭 PSU (Public Sector) (${plans.filter(p => isPlanInCat(p, 'psu')).length})` },
              { id: 'govt', label: `🏛️ Govt & Research (${plans.filter(p => isPlanInCat(p, 'govt')).length})` },
              { id: 'startup', label: `🚀 Indian Startups (${plans.filter(p => isPlanInCat(p, 'startup')).length})` },
              { id: 'tech', label: `🇮🇳 Indian Tech (${plans.filter(p => isPlanInCat(p, 'tech')).length})` },
              { id: 'remote', label: `💻 Remote India (${plans.filter(p => isPlanInCat(p, 'remote')).length})` }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                className={`btn btn-sm ${categoryFilter === f.id ? 'active' : ''}`}
                style={{
                  fontSize: 12.5,
                  padding: '5px 12px',
                  borderRadius: 8,
                  border: categoryFilter === f.id ? '1px solid #8b5cf6' : '1px solid var(--hairline)',
                  background: categoryFilter === f.id ? 'rgba(139, 92, 246, 0.18)' : 'transparent',
                  color: categoryFilter === f.id ? '#c4b5fd' : 'var(--ink-soft)',
                  fontWeight: categoryFilter === f.id ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => handleSelectCategory(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
            Showing {filteredPlans.length} organization{filteredPlans.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Company Quick-Switcher Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Quick jump search */}
          <div style={{ position: 'relative', width: 240 }}>
            <input
              type="text"
              className="form-control"
              style={{
                width: '100%',
                fontSize: 13,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--hairline)',
                background: 'var(--input-bg)',
                color: 'var(--ink)'
              }}
              placeholder="🔍 Filter company name…"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
            />
          </div>

          {/* Stepper buttons */}
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => handleStepOrg(-1)}
            style={{ padding: '8px 14px', fontSize: 13, borderRadius: 8, border: '1px solid var(--hairline)' }}
            title="Previous organization"
          >
            ‹ Prev
          </button>

          {/* Master Organization Dropdown Selector */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <select
              style={{
                width: '100%',
                fontSize: 13.5,
                fontWeight: 600,
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid var(--hairline)',
                background: 'var(--input-bg)',
                color: 'var(--ink)',
                cursor: 'pointer'
              }}
              value={activePlan?.id || (filteredPlans[0]?.id || '')}
              onChange={e => {
                const targetId = Number(e.target.value);
                if (!targetId) return;
                setSelectedPlanId(targetId);
                const targetPlan = plans.find(p => p.id === targetId);
                if (targetPlan?.org_id) {
                  setSearchParams({ orgId: targetPlan.org_id });
                }
              }}
            >
              {filteredPlans.map(p => (
                <option key={p.id} value={p.id}>
                  {getCountryFlag(p.org_country)} {p.org_name} — {p.role_title} ({p.process_type === 'psu_cbt_exam' ? '🏛️ PSU / Govt CBT' : '🏢 Tech & Startups'})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn btn-sm"
            onClick={() => handleStepOrg(1)}
            style={{ padding: '8px 14px', fontSize: 13, borderRadius: 8, border: '1px solid var(--hairline)' }}
            title="Next organization"
          >
            Next ›
          </button>
        </div>
      </div>

      {/* ── Active Target Organization Hero Banner ── */}
      {activePlan ? (
        <div>
          <div style={{
            background: 'var(--paper-raised)',
            border: '1px solid var(--hairline)',
            borderRadius: 16,
            padding: '22px 26px',
            marginBottom: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                    {activePlan.org_name}
                  </h2>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    background: procInfo.bg,
                    color: procInfo.color,
                    border: `1px solid ${procInfo.border}`
                  }}>
                    <span>{procInfo.icon}</span>
                    <span>{procInfo.shortLabel}</span>
                  </span>

                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: confInfo.bg,
                    color: confInfo.color,
                    fontWeight: 600
                  }}>
                    <span>{confInfo.badgeText}</span>
                  </span>

                  {Boolean(activePlan.org_visa_sponsored || activePlan.visa_sponsored) && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: 'rgba(59, 130, 246, 0.12)',
                      color: '#60a5fa',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      fontWeight: 600
                    }}>
                      <span>
                        {(activePlan.org_country || '').toLowerCase().includes('remote')
                          ? '🌐 Worldwide Remote (EOR / Deel)'
                          : ['netherlands', 'germany', 'france', 'sweden', 'finland', 'poland', 'ireland', 'united kingdom', 'uk'].some(c => (activePlan.org_country || '').toLowerCase().includes(c))
                          ? '🇪🇺 Visa Sponsored & Relocation'
                          : '🇺🇸 US Visa / Transfer Support'}
                      </span>
                    </span>
                  )}

                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ fontSize: 12, color: 'var(--ink-soft)', padding: '4px 10px', borderRadius: 8, border: '1px solid var(--hairline)' }}
                    onClick={() => setShowSourcesModal(true)}
                  >
                    <span>🔍 Citations ({activePlan.sources?.length || 0})</span>
                  </button>
                </div>

                <div style={{ fontSize: 15, color: 'var(--ink)', marginTop: 8, fontWeight: 500 }}>
                  🎯 Target Profile: <strong style={{ color: '#c4b5fd' }}>{activePlan.role_title}</strong>
                </div>

                {activePlan.confidence_reason && (
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 8, lineHeight: 1.5 }}>
                    ℹ️ {activePlan.confidence_reason}
                  </div>
                )}
              </div>

              {/* Progress Summary Pill */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--hairline)',
                borderRadius: 12,
                padding: '12px 18px',
                textAlign: 'right',
                minWidth: 150
              }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)', fontWeight: 700 }}>
                  Readiness Score
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: progressPct === 100 ? '#34d399' : '#fbbf24', marginTop: 2 }}>
                  {progressPct}%
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                  {masteredCount} of {stagesCount} stages ready
                </div>
              </div>
            </div>
          </div>

          {/* ── Contextual Adaptive Tab Strip ── */}
          <div style={{
            display: 'flex',
            gap: 8,
            borderBottom: '1px solid var(--hairline)',
            marginBottom: 20,
            overflowX: 'auto',
            paddingBottom: 2
          }}>
            {availableTabs.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px 10px 0 0',
                  border: 'none',
                  borderBottom: activeTab === t.id ? '3px solid #8b5cf6' : '3px solid transparent',
                  background: activeTab === t.id ? 'rgba(139, 92, 246, 0.12)' : 'transparent',
                  color: activeTab === t.id ? '#ffffff' : 'var(--ink-soft)',
                  fontWeight: activeTab === t.id ? 700 : 500,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{t.label}</span>
                <span style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: activeTab === t.id ? '#8b5cf6' : 'rgba(255,255,255,0.06)',
                  color: activeTab === t.id ? '#FFF' : 'var(--ink-faint)',
                  fontWeight: 600
                }}>
                  {t.badge}
                </span>
              </button>
            ))}
          </div>

          {/* ── TAB 1: STAGES & EXAM BLUEPRINT ── */}
          {activeTab === 'stages' && (
            <div>
              {/* CBT Exam Scheme (RENDERED ONLY FOR PSU/GOVT EXAMS) */}
              {isPSU && activePlan.exam_pattern && (
                <div style={{
                  background: 'linear-gradient(180deg, rgba(167, 139, 250, 0.06) 0%, rgba(167, 139, 250, 0.01) 100%)',
                  border: '1px solid rgba(167, 139, 250, 0.25)',
                  borderRadius: 12,
                  padding: '16px 18px',
                  marginBottom: 20
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 18 }}>📜</span>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                      {activePlan.exam_pattern.exam_name || 'Official Examination Scheme & Pattern'}
                    </h3>
                  </div>

                  {/* Exam Key Metrics Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 14 }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--hairline)' }}>
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Mode</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{activePlan.exam_pattern.mode || 'CBT Exam'}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--hairline)' }}>
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Questions</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{activePlan.exam_pattern.total_questions || '100'} MCQs</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--hairline)' }}>
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Duration</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>⏱️ {activePlan.exam_pattern.total_time_mins || '120'} mins</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--hairline)' }}>
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Negative Marking</div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#f87171' }}>
                        {activePlan.exam_pattern.negative_marking_scheme || '1/3rd Negative'}
                      </div>
                    </div>
                  </div>

                  {/* Section Breakdown */}
                  {activePlan.exam_pattern.sections && activePlan.exam_pattern.sections.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-faint)', fontWeight: 600, marginBottom: 6 }}>
                        Sectional Blueprint
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {activePlan.exam_pattern.sections.map((sec, idx) => (
                          <div key={idx} style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--hairline)', borderRadius: 6, padding: '8px 12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{sec.section_name}</span>
                              <div style={{ display: 'flex', gap: 8, fontSize: 11.5, color: 'var(--ink-soft)' }}>
                                <span>📊 <strong>{sec.questions}</strong> Qs ({sec.marks} Marks)</span>
                                <span>⏱️ <strong>{sec.duration_mins}</strong> mins</span>
                              </div>
                            </div>
                            {sec.topics && sec.topics.length > 0 && (
                              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 4, lineHeight: 1.4 }}>
                                Topics: {sec.topics.join(' · ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activePlan.exam_pattern.qualifying_criteria && (
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 6, border: '1px dashed var(--hairline)' }}>
                      🎯 <strong>Cutoff / Merit:</strong> {activePlan.exam_pattern.qualifying_criteria}
                    </div>
                  )}
                </div>
              )}

              {/* Round-by-Round Stages */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
                    Round-by-Round Selection Process ({activePlan.stages?.length || 0})
                  </h3>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
                    Click checkbox to track your readiness
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {activePlan.stages?.map((stage, sIdx) => {
                    const isDone = completedStages.has(stage.stage_number);

                    return (
                      <div
                        key={sIdx}
                        style={{
                          background: 'var(--paper-raised)',
                          border: isDone ? '1.5px solid #34d399' : '1px solid var(--hairline)',
                          borderRadius: 14,
                          padding: '18px 22px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button
                              type="button"
                              onClick={() => handleToggleStage(stage.stage_number)}
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                border: isDone ? 'none' : '1.5px solid var(--hairline)',
                                background: isDone ? '#34d399' : 'transparent',
                                color: '#1B2430',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: 700
                              }}
                              title={isDone ? 'Mark Incomplete' : 'Mark Stage Ready'}
                            >
                              {isDone ? '✓' : ''}
                            </button>

                            <div>
                              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a78bfa', fontWeight: 700 }}>
                                Stage {stage.stage_number}
                              </span>
                              <h4 style={{ margin: '2px 0 0', fontSize: 16.5, fontWeight: 700, color: 'var(--ink)' }}>
                                {stage.name}
                              </h4>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            {stage.duration_mins && (
                              <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', color: 'var(--ink-soft)', border: '1px solid var(--hairline)' }}>
                                ⏱️ {stage.duration_mins} mins
                              </span>
                            )}
                            {stage.weightage_or_elimination && (
                              <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, background: 'rgba(239, 68, 68, 0.08)', color: '#f87171', fontWeight: 600 }}>
                                {stage.weightage_or_elimination}
                              </span>
                            )}
                          </div>
                        </div>

                        <p style={{ fontSize: 14, color: 'var(--ink)', margin: '12px 0', lineHeight: 1.6 }}>
                          {stage.description}
                        </p>

                        {stage.key_topics && stage.key_topics.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                            {stage.key_topics.map((top, tIdx) => (
                              <span
                                key={tIdx}
                                style={{
                                  fontSize: 12,
                                  padding: '3px 10px',
                                  borderRadius: 6,
                                  background: 'rgba(255,255,255,0.04)',
                                  border: '1px solid var(--hairline)',
                                  color: 'var(--ink)'
                                }}
                              >
                                {top}
                              </span>
                            ))}
                          </div>
                        )}

                        {stage.sample_questions && stage.sample_questions.length > 0 && (
                          <div style={{
                            background: 'var(--input-bg)',
                            border: '1px solid var(--hairline)',
                            borderRadius: 8,
                            padding: '12px 16px',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 13,
                            lineHeight: 1.6,
                            color: 'var(--ink)',
                            marginTop: 10
                          }}>
                            {stage.sample_questions.map((q, qIdx) => (
                              <div key={qIdx} style={{ padding: '3px 0' }}>
                                <span style={{ color: '#34d399', marginRight: 8 }}>▶</span>
                                {q}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Phased Roadmap Timeline */}
              {activePlan.prep_roadmap && activePlan.prep_roadmap.length > 0 && (
                <div style={{
                  background: 'var(--paper-raised)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 14,
                  padding: '20px 22px',
                  marginBottom: 24
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <span style={{ fontSize: 20 }}>🗺️</span>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                      Preparation Milestones & Phased Plan
                    </h3>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                    {activePlan.prep_roadmap.map((phase, pIdx) => (
                      <div key={pIdx} style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--hairline)', borderRadius: 10, padding: '14px 16px' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                          {phase.phase}
                        </div>
                        <div style={{ fontSize: 12.5, color: '#60a5fa', fontWeight: 600, marginTop: 4 }}>
                          {phase.focus}
                        </div>
                        {phase.tasks && (
                          <ul style={{ margin: '10px 0 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                            {phase.tasks.map((task, tIdx) => (
                              <li key={tIdx} style={{ marginBottom: 4 }}>{task}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── QUESTION PRACTICE TABS (CONTEXTUAL TO COMPANY ARCHETYPE) ── */}
          {(activeTab === 'company_leetcode' || activeTab === 'quant_systems' || activeTab === 'devops' || activeTab === 'neetcode' || activeTab === 'psu_cbt') && (
            <div>
              {/* Question Filter & Search Header */}
              <div style={{
                background: 'var(--paper-raised)',
                border: '1px solid var(--hairline)',
                borderRadius: 12,
                padding: '14px 18px',
                marginBottom: 18,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
                  <input
                    type="text"
                    className="form-control"
                    style={{
                      width: '100%',
                      fontSize: 13.5,
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--hairline)',
                      background: 'var(--input-bg)',
                      color: 'var(--ink)'
                    }}
                    placeholder="Search questions by keyword or topic…"
                    value={questionSearch}
                    onChange={e => setQuestionSearch(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Difficulty selector */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['all', 'easy', 'medium', 'hard'].map(d => (
                      <button
                        key={d}
                        type="button"
                        className="btn btn-sm"
                        style={{
                          fontSize: 12,
                          padding: '5px 10px',
                          borderRadius: 6,
                          border: difficultyFilter === d ? '1px solid #8b5cf6' : '1px solid var(--hairline)',
                          background: difficultyFilter === d ? 'rgba(139, 92, 246, 0.18)' : 'transparent',
                          color: difficultyFilter === d ? '#c4b5fd' : 'var(--ink-soft)',
                          textTransform: 'capitalize',
                          fontWeight: difficultyFilter === d ? 600 : 400
                        }}
                        onClick={() => setDifficultyFilter(d)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>

                  {/* Topic dropdown */}
                  {availableTopics.length > 0 && (
                    <select
                      className="form-control"
                      style={{ fontSize: 12.5, padding: '5px 10px', borderRadius: 6, height: 32, border: '1px solid var(--hairline)', background: 'var(--input-bg)', color: 'var(--ink)' }}
                      value={topicFilter}
                      onChange={e => setTopicFilter(e.target.value)}
                    >
                      <option value="all">All Topics</option>
                      {availableTopics.map(top => (
                        <option key={top} value={top}>{top}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Question Cards */}
              {loadingQuestions ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-soft)', fontSize: 14 }}>
                  Loading technical questions…
                </div>
              ) : questions.length === 0 ? (
                <div style={{
                  background: 'var(--paper-raised)',
                  border: '1px dashed var(--hairline)',
                  borderRadius: 14,
                  padding: '36px 20px',
                  textAlign: 'center',
                  color: 'var(--ink-soft)'
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>No questions match this filter.</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Try clearing the search query or changing difficulty.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {questions.map(q => {
                    const diff = DIFFICULTY_CONFIG[q.difficulty] || DIFFICULTY_CONFIG.medium;
                    const isSol = Boolean(q.is_solved);
                    const isExpanded = expandedSolutions.has(q.id);
                    const isEditingNote = activeNoteEditingId === q.id;

                    return (
                      <div
                        key={q.id}
                        style={{
                          background: 'var(--paper-raised)',
                          border: isSol ? '1.5px solid #34d399' : '1px solid var(--hairline)',
                          borderRadius: 14,
                          padding: '18px 22px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Header: Checkbox + Title + Metadata */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <input
                              type="checkbox"
                              checked={isSol}
                              onChange={() => handleToggleQuestionSolved(q.id, isSol)}
                              style={{ width: 19, height: 19, marginTop: 2, cursor: 'pointer', accentColor: '#34d399' }}
                              title={isSol ? 'Mark Unsolved' : 'Mark Solved'}
                            />

                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <h4 style={{
                                  margin: 0,
                                  fontSize: 16,
                                  fontWeight: 700,
                                  color: isSol ? 'var(--ink-soft)' : 'var(--ink)',
                                  textDecoration: isSol ? 'line-through' : 'none'
                                }}>
                                  {q.title}
                                </h4>

                                {q.company_tag && q.company_tag !== 'General' && (
                                  <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 6, background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', fontWeight: 600 }}>
                                    🏢 {q.company_tag}
                                  </span>
                                )}

                                <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 6, background: diff.bg, color: diff.color, fontWeight: 600 }}>
                                  {diff.label}
                                </span>

                                <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', color: 'var(--ink-soft)' }}>
                                  📁 {q.topic}
                                </span>

                                {q.frequency_pct && (
                                  <span style={{ fontSize: 11.5, color: '#34d399', fontWeight: 600 }}>
                                    🔥 {q.frequency_pct}% Freq
                                  </span>
                                )}
                              </div>

                              {/* Question Statement */}
                              <div style={{ fontSize: 14, color: 'var(--ink)', marginTop: 8, lineHeight: 1.65, whiteSpace: 'pre-line' }}>
                                {q.question_text}
                              </div>
                            </div>
                          </div>

                          {q.url && (
                            <a
                              href={q.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm"
                              style={{
                                fontSize: 12,
                                padding: '4px 10px',
                                borderRadius: 6,
                                color: '#60a5fa',
                                border: '1px solid rgba(96, 165, 250, 0.25)',
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              <span>Solve ↗</span>
                            </a>
                          )}
                        </div>

                        {/* Action Buttons: Solution & Notes */}
                        <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
                          {q.answer_text && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{
                                fontSize: 12,
                                padding: '4px 10px',
                                borderRadius: 6,
                                background: isExpanded ? 'rgba(139, 92, 246, 0.18)' : 'rgba(255,255,255,0.04)',
                                color: isExpanded ? '#c4b5fd' : 'var(--ink-soft)',
                                border: isExpanded ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid var(--hairline)'
                              }}
                              onClick={() => handleToggleSolution(q.id)}
                            >
                              {isExpanded ? '▲ Hide Solution' : '💡 View Optimal Solution & Complexity'}
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{
                              fontSize: 12,
                              padding: '4px 10px',
                              borderRadius: 6,
                              background: 'transparent',
                              color: 'var(--ink-soft)',
                              border: '1px solid var(--hairline)'
                            }}
                            onClick={() => {
                              if (isEditingNote) {
                                setActiveNoteEditingId(null);
                              } else {
                                setActiveNoteEditingId(q.id);
                                setTempQuestionNotes(q.user_notes || '');
                              }
                            }}
                          >
                            ✏️ {q.user_notes ? 'Edit Notes' : '+ Notes'}
                          </button>
                        </div>

                        {/* Expandable Solution Accordion */}
                        {isExpanded && q.answer_text && (
                          <div style={{
                            marginTop: 12,
                            background: 'var(--input-bg)',
                            border: '1px solid var(--hairline)',
                            borderRadius: 10,
                            padding: '16px 18px'
                          }}>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#34d399', fontWeight: 700, marginBottom: 8 }}>
                              ✓ Technical Solution & Complexity
                            </div>
                            <div style={{
                              fontSize: 13.5,
                              color: 'var(--ink)',
                              lineHeight: 1.6,
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'var(--font-mono)'
                            }}>
                              {q.answer_text}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 8, textAlign: 'right' }}>
                              Source: {q.source_repo}
                            </div>
                          </div>
                        )}

                        {/* Note Editor */}
                        {isEditingNote && (
                          <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--hairline)', borderRadius: 8, padding: 10 }}>
                            <textarea
                              style={{
                                width: '100%',
                                minHeight: 60,
                                padding: 8,
                                fontSize: 13,
                                borderRadius: 6,
                                border: '1px solid var(--hairline)',
                                background: 'var(--input-bg)',
                                color: 'var(--ink)',
                                fontFamily: 'inherit'
                              }}
                              placeholder="Record personal edge cases, complexity pitfalls, or code takeaways…"
                              value={tempQuestionNotes}
                              onChange={e => setTempQuestionNotes(e.target.value)}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{ fontSize: 12, padding: '3px 10px' }}
                                onClick={() => setActiveNoteEditingId(null)}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: 11, padding: '2px 8px' }}
                                disabled={savingQuestionNote}
                                onClick={() => handleSaveQuestionNotes(q.id)}
                              >
                                {savingQuestionNote ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Existing Saved Note Display */}
                        {!isEditingNote && q.user_notes && (
                          <div style={{ marginTop: 6, fontSize: 11, color: '#fbbf24', background: 'rgba(251, 191, 36, 0.08)', padding: '4px 8px', borderRadius: 4, border: '1px dashed rgba(251, 191, 36, 0.2)' }}>
                            📝 <strong>My Note:</strong> {q.user_notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: GROUNDED MOCK INTERVIEW RUNNER (M7) ── */}
          {activeTab === 'mock_interview' && (
            <JobHuntMockInterviewRunner
              plan={activePlan}
              orgName={activePlan.org_name}
              roleTitle={activePlan.role_title}
              opportunityId={activePlan.opportunity_id}
            />
          )}

          {/* ── TAB: CANDIDATE PREP JOURNAL ── */}
          {activeTab === 'notes' && (
            <div>
              <div style={{
                background: 'var(--paper-raised)',
                border: '1px solid var(--hairline)',
                borderRadius: 14,
                padding: '20px 24px',
                marginBottom: 24
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>📝</span>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                      Preparation Journal & Interview Debriefs — {activePlan.org_name}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {notesSuccess && (
                      <span style={{ fontSize: 12.5, color: '#34d399', fontWeight: 600 }}>
                        ✓ Saved!
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: 12.5, padding: '5px 12px', borderRadius: 6 }}
                      disabled={savingNotes}
                      onClick={handleSaveNotes}
                    >
                      {savingNotes ? 'Saving…' : 'Save Notes'}
                    </button>
                  </div>
                </div>

                <textarea
                  style={{
                    width: '100%',
                    minHeight: 140,
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--hairline)',
                    background: 'var(--input-bg)',
                    color: 'var(--ink)',
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                  placeholder="Record interview screening debriefs, system design decisions, formula traps, or revision checklists for this company…"
                  value={notesText}
                  onChange={e => setNotesText(e.target.value)}
                />
              </div>

              {/* Master Study Vault Repositories */}
              <div style={{
                background: 'var(--paper-raised)',
                border: '1px solid var(--hairline)',
                borderRadius: 14,
                padding: '20px 24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 20 }}>📚</span>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                    Curated Technical Repositories (Mapped for {activePlan.org_name})
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                  {(activePlan.curated_resources || []).map((res, idx) => (
                    <a
                      key={idx}
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        background: 'rgba(255,255,255,0.015)',
                        border: '1px solid var(--hairline)',
                        borderRadius: 10,
                        padding: '12px 16px',
                        textDecoration: 'none',
                        color: 'inherit',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: 13.5, color: '#60a5fa' }}>{res.name}</span>
                        <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>↗</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 4, lineHeight: 1.5 }}>
                        {res.description}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state" style={{ minHeight: '30vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          No preparation plan selected. Choose an organization from the selector above.
        </div>
      )}

      {/* ── Citations & Verification Evidence Modal ── */}
      {showSourcesModal && activePlan && (
        <div
          className="quick-dump-modal-backdrop"
          style={{ zIndex: 1200 }}
          onClick={() => setShowSourcesModal(false)}
        >
          <div
            className="quick-dump-modal-card"
            style={{
              maxWidth: 640,
              width: '100%',
              background: 'var(--paper-raised)',
              border: '1px solid var(--hairline)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
              borderRadius: 12
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="quick-dump-header" style={{ background: 'var(--paper)', borderBottom: '1px solid var(--hairline)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>📜</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                    Verified Sources & Evidence — {activePlan.org_name}
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                    Cross-verified recruitment intelligence and candidate experiences
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowSourcesModal(false)}
                style={{
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--ink-soft)',
                  fontSize: 18,
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <div className="quick-dump-body" style={{ maxHeight: '65vh', overflowY: 'auto', padding: '20px' }}>
              <div style={{
                fontSize: 12.5,
                color: 'var(--ink-soft)',
                lineHeight: 1.5,
                background: 'var(--paper)',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--hairline)',
                marginBottom: 12
              }}>
                ℹ️ <strong>Multi-Source Protocol:</strong> Process stages are cross-verified across official notifications, LeetCode Discuss tags, Glassdoor Europe/US reports, and developer debriefs.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activePlan.sources?.map((s, idx) => (
                  <div key={idx} style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, fontSize: 13, color: '#60a5fa', textDecoration: 'none' }}>
                        {s.title} ↗
                      </a>
                      <span style={{ fontSize: 10.5, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'var(--ink-soft)', textTransform: 'uppercase', fontWeight: 600 }}>
                        {s.platform || 'source'}
                      </span>
                    </div>
                    {s.agreement_note && (
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6, lineHeight: 1.4 }}>
                        🔍 <strong>Finding:</strong> {s.agreement_note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--hairline)', background: 'var(--paper)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowSourcesModal(false)}
                style={{ padding: '6px 16px', fontSize: 12.5 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Research Modal ── */}
      {showCustomResearchModal && (
        <div
          className="quick-dump-modal-backdrop"
          style={{ zIndex: 1200 }}
          onClick={() => !researching && setShowCustomResearchModal(false)}
        >
          <div
            className="quick-dump-modal-card"
            style={{
              maxWidth: 520,
              width: '100%',
              background: 'var(--paper-raised)',
              border: '1px solid var(--hairline)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
              borderRadius: 12
            }}
            onClick={e => e.stopPropagation()}
          >
            <form onSubmit={handleRunResearch}>
              <div className="quick-dump-header" style={{ background: 'var(--paper)', borderBottom: '1px solid var(--hairline)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🔍</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                      Research Any Organization
                    </h3>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                      Generate custom hiring stages, CBT scheme, and question bank
                    </div>
                  </div>
                </div>
                {!researching && (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setShowCustomResearchModal(false)}
                    style={{
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--ink-soft)',
                      fontSize: 18,
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="quick-dump-body" style={{ maxHeight: '65vh', overflowY: 'auto', padding: '20px' }}>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    list="org-suggestions"
                    required
                    disabled={researching}
                    className="form-control"
                    style={{ width: '100%', fontSize: 12.5 }}
                    placeholder="e.g. Stripe, Citadel, IOCL, NIC, PhonePe…"
                    value={customOrgName}
                    onChange={e => setCustomOrgName(e.target.value)}
                  />
                  <datalist id="org-suggestions">
                    {orgList.map(o => (
                      <option key={o.id} value={o.name} />
                    ))}
                  </datalist>
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                    Target Role / Profile
                  </label>
                  <input
                    type="text"
                    disabled={researching}
                    className="form-control"
                    style={{ width: '100%', fontSize: 12.5 }}
                    placeholder="e.g. Quantitative Developer, Software Engineer, Scientist B…"
                    value={customRoleTitle}
                    onChange={e => setCustomRoleTitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                    Discipline Archetype
                  </label>
                  <select
                    disabled={researching}
                    className="form-control"
                    style={{ width: '100%', fontSize: 12.5 }}
                    value={customRoleCat}
                    onChange={e => setCustomRoleCat(e.target.value)}
                  >
                    <option value="sde">Software Development Engineer (DSA, OOP, LLD)</option>
                    <option value="devops_cloud">Cloud, DevOps & SRE (Linux, K8s, Distributed Architecture)</option>
                    <option value="psu_engineer">PSU / Govt Scientist (CBT Exam & Board Interview)</option>
                    <option value="quant_data">Quantitative Systems (Low-Latency C++, Financial Math)</option>
                  </select>
                </div>

                {researching && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: 6, border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ animation: 'spin 1s linear infinite', fontSize: 18 }}>⏳</div>
                    <div style={{ fontSize: 12.5, color: '#60a5fa' }}>
                      Executing multi-query research across notifications and developer communities…
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--hairline)', background: 'var(--paper)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={researching}
                  onClick={() => setShowCustomResearchModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={researching || !customOrgName.trim()}
                >
                  {researching ? 'Researching…' : 'Generate Roadmap'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
