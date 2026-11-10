import { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import { useDialog } from '../components/DialogProvider.jsx';

const SECTOR_OPTIONS = ['Cloud', 'FinOps', 'DevOps', 'IT', 'Defence', 'Research', 'PSU', 'Energy', 'Banking', 'Space', 'Telecom', 'Railways', 'Infrastructure'];
const JOB_TYPE_OPTIONS = [
  { id: 'private', label: '💼 Private' },
  { id: 'psu', label: '🏭 PSU' },
  { id: 'govt', label: '🏛️ Government' },
  { id: 'defence', label: '🛡️ Defence' },
  { id: 'research', label: '🔬 Research' },
  { id: 'contractual', label: '📋 Contractual' }
];

function parseJsonArray(str) {
  if (!str) return [];
  if (Array.isArray(str)) return str;
  try {
    const val = JSON.parse(str);
    return Array.isArray(val) ? val : [];
  } catch {
    return [];
  }
}

export default function JobHuntProfile() {
  const { confirm, alert: showDialogAlert } = useDialog();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [rescoreMsg, setRescoreMsg] = useState('');

  // Tag inputs
  const [skillInput, setSkillInput] = useState('');
  const [certInput, setCertInput] = useState('');
  const [locInput, setLocInput] = useState('');

  // Add form toggles & states
  const [showAddEdu, setShowAddEdu] = useState(false);
  const [eduForm, setEduForm] = useState({ institution: '', degree: '', branch: '', cgpa: '', period: '', location: '', status: 'In Progress' });
  const [editingEduIndex, setEditingEduIndex] = useState(null);

  const [showAddExp, setShowAddExp] = useState(false);
  const [expForm, setExpForm] = useState({ company: '', role: '', location: '', period: '', highlightsText: '' });
  const [editingExpIndex, setEditingExpIndex] = useState(null);

  const [showAddProj, setShowAddProj] = useState(false);
  const [projForm, setProjForm] = useState({ title: '', tech_stack: '', link: '', description: '' });
  const [editingProjIndex, setEditingProjIndex] = useState(null);

  const [showAddPub, setShowAddPub] = useState(false);
  const [pubForm, setPubForm] = useState({ title: '', authors: '', venue: '', year: '', description: '' });
  const [editingPubIndex, setEditingPubIndex] = useState(null);

  const [showAddAch, setShowAddAch] = useState(false);
  const [achForm, setAchForm] = useState({ title: '', organization: '', year: '', description: '' });
  const [editingAchIndex, setEditingAchIndex] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/jobhunt/profile');
      setProfile({
        ...data,
        education: parseJsonArray(data.education),
        experience: parseJsonArray(data.experience),
        projects: parseJsonArray(data.projects),
        publications: parseJsonArray(data.publications),
        achievements: parseJsonArray(data.achievements),
        skills: parseJsonArray(data.skills),
        certifications: parseJsonArray(data.certifications),
        pref_locations: parseJsonArray(data.pref_locations),
        pref_job_types: parseJsonArray(data.pref_job_types),
        pref_sectors: parseJsonArray(data.pref_sectors)
      });
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
    setLoading(false);
  }

  const update = useCallback((key, val) => {
    setProfile(p => ({ ...p, [key]: val }));
    setSaved(false);
  }, []);

  async function save(customProfile = null) {
    // Guard against synthetic click events if called directly from event handlers
    const isEvent = customProfile && (customProfile.nativeEvent || customProfile.target || typeof customProfile.preventDefault === 'function');
    const p = (customProfile && !isEvent) ? customProfile : profile;
    if (!p) return;
    setSaving(true);
    try {
      const payload = {
        ...p,
        education: typeof p.education === 'string' ? p.education : JSON.stringify(p.education || []),
        experience: typeof p.experience === 'string' ? p.experience : JSON.stringify(p.experience || []),
        projects: typeof p.projects === 'string' ? p.projects : JSON.stringify(p.projects || []),
        publications: typeof p.publications === 'string' ? p.publications : JSON.stringify(p.publications || []),
        achievements: typeof p.achievements === 'string' ? p.achievements : JSON.stringify(p.achievements || []),
        skills: typeof p.skills === 'string' ? p.skills : JSON.stringify(p.skills || []),
        certifications: typeof p.certifications === 'string' ? p.certifications : JSON.stringify(p.certifications || []),
        pref_locations: typeof p.pref_locations === 'string' ? p.pref_locations : JSON.stringify(p.pref_locations || []),
        pref_job_types: typeof p.pref_job_types === 'string' ? p.pref_job_types : JSON.stringify(p.pref_job_types || []),
        pref_sectors: typeof p.pref_sectors === 'string' ? p.pref_sectors : JSON.stringify(p.pref_sectors || [])
      };
      const updated = await api.put('/jobhunt/profile', payload);
      setProfile({
        ...updated,
        education: parseJsonArray(updated.education),
        experience: parseJsonArray(updated.experience),
        projects: parseJsonArray(updated.projects),
        publications: parseJsonArray(updated.publications),
        achievements: parseJsonArray(updated.achievements),
        skills: parseJsonArray(updated.skills),
        certifications: parseJsonArray(updated.certifications),
        pref_locations: parseJsonArray(updated.pref_locations),
        pref_job_types: parseJsonArray(updated.pref_job_types),
        pref_sectors: parseJsonArray(updated.pref_sectors)
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      return updated;
    } catch (err) {
      console.error('Save failed:', err);
      showDialogAlert('Save failed: ' + err.message, { ledger: 'jobhunt' });
    } finally {
      setSaving(false);
    }
  }

  const updateAndSave = useCallback((key, val) => {
    setProfile(prev => {
      const next = { ...prev, [key]: val };
      save(next);
      return next;
    });
  }, [profile]);

  async function rescoreAll() {
    setRescoring(true);
    setRescoreMsg('');
    try {
      await save();
      const result = await api.post('/jobhunt/opportunities/rescore-all', {});
      setRescoreMsg(`✓ Rescored ${result.rescored || 0} opportunities against your updated profile!`);
    } catch (err) {
      setRescoreMsg(`✕ Rescore failed: ${err.message}`);
    } finally {
      setRescoring(false);
    }
  }

  // Tag list helpers
  function addTag(list, key, inputVal, setInputVal) {
    const val = inputVal.trim();
    if (!val || (list || []).includes(val)) return;
    updateAndSave(key, [...(list || []), val]);
    setInputVal('');
  }

  function removeTag(list, key, idx) {
    updateAndSave(key, (list || []).filter((_, i) => i !== idx));
  }

  // ── Education CRUD ──
  function saveEdu(e) {
    e.preventDefault();
    if (!eduForm.institution || !eduForm.degree) return;
    const list = [...(profile.education || [])];
    if (editingEduIndex !== null) {
      list[editingEduIndex] = eduForm;
    } else {
      list.push(eduForm);
    }
    updateAndSave('education', list);
    setEduForm({ institution: '', degree: '', branch: '', cgpa: '', period: '', location: '', status: 'In Progress' });
    setEditingEduIndex(null);
    setShowAddEdu(false);
  }

  async function removeEdu(idx) {
    const ok = await confirm('Remove this education entry?', { ledger: 'jobhunt', danger: true });
    if (!ok) return;
    updateAndSave('education', (profile.education || []).filter((_, i) => i !== idx));
  }

  function editEdu(idx) {
    setEduForm(profile.education[idx]);
    setEditingEduIndex(idx);
    setShowAddEdu(true);
  }

  // ── Experience CRUD ──
  function saveExp(e) {
    e.preventDefault();
    if (!expForm.company || !expForm.role) return;
    const highlights = (expForm.highlightsText || '')
      .split('\n')
      .map(s => s.trim().replace(/^[•\-*]\s*/, ''))
      .filter(Boolean);

    const item = {
      company: expForm.company,
      role: expForm.role,
      location: expForm.location,
      period: expForm.period,
      highlights
    };

    const list = [...(profile.experience || [])];
    if (editingExpIndex !== null) {
      list[editingExpIndex] = item;
    } else {
      list.push(item);
    }
    updateAndSave('experience', list);
    setExpForm({ company: '', role: '', location: '', period: '', highlightsText: '' });
    setEditingExpIndex(null);
    setShowAddExp(false);
  }

  async function removeExp(idx) {
    const ok = await confirm('Remove this work experience entry?', { ledger: 'jobhunt', danger: true });
    if (!ok) return;
    updateAndSave('experience', (profile.experience || []).filter((_, i) => i !== idx));
  }

  function editExp(idx) {
    const item = profile.experience[idx];
    setExpForm({
      company: item.company || '',
      role: item.role || '',
      location: item.location || '',
      period: item.period || '',
      highlightsText: Array.isArray(item.highlights) ? item.highlights.join('\n') : (item.highlights || '')
    });
    setEditingExpIndex(idx);
    setShowAddExp(true);
  }

  // ── Projects CRUD ──
  function saveProj(e) {
    e.preventDefault();
    if (!projForm.title) return;
    const list = [...(profile.projects || [])];
    if (editingProjIndex !== null) {
      list[editingProjIndex] = projForm;
    } else {
      list.push(projForm);
    }
    updateAndSave('projects', list);
    setProjForm({ title: '', tech_stack: '', link: '', description: '' });
    setEditingProjIndex(null);
    setShowAddProj(false);
  }

  async function removeProj(idx) {
    const ok = await confirm('Remove this project entry?', { ledger: 'jobhunt', danger: true });
    if (!ok) return;
    updateAndSave('projects', (profile.projects || []).filter((_, i) => i !== idx));
  }

  function editProj(idx) {
    setProjForm(profile.projects[idx]);
    setEditingProjIndex(idx);
    setShowAddProj(true);
  }

  // ── Publications CRUD ──
  function savePub(e) {
    e.preventDefault();
    if (!pubForm.title) return;
    const list = [...(profile.publications || [])];
    if (editingPubIndex !== null) {
      list[editingPubIndex] = pubForm;
    } else {
      list.push(pubForm);
    }
    updateAndSave('publications', list);
    setPubForm({ title: '', authors: '', venue: '', year: '', description: '' });
    setEditingPubIndex(null);
    setShowAddPub(false);
  }

  async function removePub(idx) {
    const ok = await confirm('Remove this publication entry?', { ledger: 'jobhunt', danger: true });
    if (!ok) return;
    updateAndSave('publications', (profile.publications || []).filter((_, i) => i !== idx));
  }

  function editPub(idx) {
    setPubForm(profile.publications[idx]);
    setEditingPubIndex(idx);
    setShowAddPub(true);
  }

  // ── Achievements CRUD ──
  function saveAch(e) {
    e.preventDefault();
    if (!achForm.title) return;
    const list = [...(profile.achievements || [])];
    if (editingAchIndex !== null) {
      list[editingAchIndex] = achForm;
    } else {
      list.push(achForm);
    }
    updateAndSave('achievements', list);
    setAchForm({ title: '', organization: '', year: '', description: '' });
    setEditingAchIndex(null);
    setShowAddAch(false);
  }

  async function removeAch(idx) {
    const ok = await confirm('Remove this achievement entry?', { ledger: 'jobhunt', danger: true });
    if (!ok) return;
    updateAndSave('achievements', (profile.achievements || []).filter((_, i) => i !== idx));
  }

  function editAch(idx) {
    setAchForm(profile.achievements[idx]);
    setEditingAchIndex(idx);
    setShowAddAch(true);
  }

  if (loading) return <div className="empty-state" style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading profile…</div>;
  if (!profile) return <div className="empty-state">Failed to load profile.</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="page-eyebrow">Your Resume &amp; Career Portfolio</div>
          <h1 className="page-title">My Career Profile</h1>
          <p className="page-sub">
            This is your career source of truth. The scoring engine references your degrees, work experience, projects, publications, and skills to compute opportunity match scores.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => save()} disabled={saving}>
            {saving ? 'Saving…' : '💾 Save Profile'}
          </button>
          <button className="btn" onClick={rescoreAll} disabled={rescoring} style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}>
            {rescoring ? 'Rescoring…' : '⚡ Save & Rescore'}
          </button>
          {saved && <span style={{ color: 'var(--green)', fontSize: 13, fontWeight: 600 }}>Saved ✓</span>}
        </div>
      </div>

      {rescoreMsg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 'var(--radius)',
          background: rescoreMsg.startsWith('✓') ? 'rgba(74, 158, 110, 0.12)' : 'rgba(224, 90, 58, 0.12)',
          color: rescoreMsg.startsWith('✓') ? 'var(--green)' : 'var(--rust)',
          marginBottom: 16,
          fontSize: 13,
          fontWeight: 500
        }}>
          {rescoreMsg}
        </div>
      )}

      {/* ── Section 1: Personal & Professional Summary ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="section-title" style={{ margin: 0 }}>Personal &amp; Contact Details</div>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Changes auto-save on blur</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 12, marginBottom: 14 }}>
          <div className="field">
            <label>Full Name</label>
            <input
              value={profile.full_name || ''}
              onChange={e => update('full_name', e.target.value)}
              onBlur={() => save()}
              placeholder="e.g. Reshav Sharma"
            />
          </div>
          <div className="field">
            <label>Phone Number</label>
            <input
              value={profile.phone || ''}
              onChange={e => update('phone', e.target.value)}
              onBlur={() => save()}
              placeholder="e.g. 8839750668"
            />
          </div>
          <div className="field">
            <label>Email Address</label>
            <input
              value={profile.email || ''}
              onChange={e => update('email', e.target.value)}
              onBlur={() => save()}
              placeholder="e.g. reshav2004b@gmail.com"
            />
          </div>
          <div className="field">
            <label>Age</label>
            <input
              type="number"
              value={profile.age || ''}
              onChange={e => update('age', e.target.value ? Number(e.target.value) : null)}
              onBlur={() => save()}
            />
          </div>
          <div className="field">
            <label>Total Experience (years)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={profile.experience_years || ''}
              onChange={e => update('experience_years', e.target.value ? Number(e.target.value) : 0)}
              onBlur={() => save()}
            />
          </div>
          <div className="field">
            <label>Primary Degree</label>
            <input
              value={profile.degree || ''}
              onChange={e => update('degree', e.target.value)}
              onBlur={() => save()}
              placeholder="e.g. B.Tech / BS"
            />
          </div>
          <div className="field">
            <label>Primary Branch / Discipline</label>
            <input
              value={profile.branch || ''}
              onChange={e => update('branch', e.target.value)}
              onBlur={() => save()}
              placeholder="e.g. Computer Science / Data Science"
            />
          </div>
          <div className="field">
            <label>Graduation Year</label>
            <input
              type="number"
              value={profile.graduation_year || ''}
              onChange={e => update('graduation_year', e.target.value ? Number(e.target.value) : null)}
              onBlur={() => save()}
              placeholder="e.g. 2026"
            />
          </div>
          <div className="field">
            <label>LinkedIn URL</label>
            <input
              value={profile.linkedin || ''}
              onChange={e => update('linkedin', e.target.value)}
              onBlur={() => save()}
              placeholder="https://linkedin.com/in/..."
            />
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>GitHub Profile URL</label>
            <input
              value={profile.github || ''}
              onChange={e => update('github', e.target.value)}
              onBlur={() => save()}
              placeholder="https://github.com/..."
            />
          </div>
        </div>

        <div className="field">
          <label>Professional Summary &amp; Career Highlights</label>
          <textarea
            rows={3}
            value={profile.summary || ''}
            onChange={e => update('summary', e.target.value)}
            onBlur={() => save()}
            placeholder="Brief overview of your expertise, production achievements, and technical strengths..."
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>
      </div>

      {/* ── Section 2: Education (Multiple) ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div className="section-title" style={{ margin: 0 }}>Education ({profile.education?.length || 0})</div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '4px 0 0 0' }}>
              Add all degrees, diplomas, and ongoing courses. The engine matches eligibility against all of them.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              if (showAddEdu) {
                setShowAddEdu(false);
                setEditingEduIndex(null);
              } else {
                setEduForm({ institution: '', degree: '', branch: '', cgpa: '', period: '', location: '', status: 'In Progress' });
                setEditingEduIndex(null);
                setShowAddEdu(true);
              }
            }}
          >
            {showAddEdu ? 'Cancel' : '+ Add Education'}
          </button>
        </div>

        {/* Education List */}
        {profile.education?.map((edu, idx) => (
          <div key={idx} className="profile-item-card">
            <div className="profile-item-header">
              <div className="profile-item-title">
                <span>🎓</span>
                <span>{edu.degree} in {edu.branch}</span>
                {edu.status && (
                  <span className="badge" style={{ fontSize: 11, background: 'rgba(91,127,186,0.15)', color: 'var(--accent)' }}>
                    {edu.status}
                  </span>
                )}
              </div>
              <div className="profile-item-actions">
                <button type="button" className="icon-btn" onClick={() => editEdu(idx)} title="Edit">✏️</button>
                <button type="button" className="icon-btn" onClick={() => removeEdu(idx)} title="Remove" style={{ color: 'var(--rust)' }}>✕</button>
              </div>
            </div>
            <div className="profile-item-meta">
              <span><strong>{edu.institution}</strong></span>
              {edu.location && <span>📍 {edu.location}</span>}
              {edu.period && <span>🗓️ {edu.period}</span>}
              {edu.cgpa && <span>📊 CGPA: {edu.cgpa}</span>}
            </div>
          </div>
        ))}

        {/* Add/Edit Education Form */}
        {showAddEdu && (
          <form onSubmit={saveEdu} className="profile-add-box">
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 10, color: 'var(--ink)' }}>
              {editingEduIndex !== null ? 'Edit Education' : 'Add New Degree / Education'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 12 }}>
              <div className="field">
                <label>Institution / University *</label>
                <input required value={eduForm.institution} onChange={e => setEduForm({ ...eduForm, institution: e.target.value })} placeholder="e.g. Sagar Institute of Research and Technology" />
              </div>
              <div className="field">
                <label>Degree *</label>
                <input required value={eduForm.degree} onChange={e => setEduForm({ ...eduForm, degree: e.target.value })} placeholder="e.g. B.Tech or BS" />
              </div>
              <div className="field">
                <label>Branch / Major</label>
                <input value={eduForm.branch} onChange={e => setEduForm({ ...eduForm, branch: e.target.value })} placeholder="e.g. Computer Science and Engineering" />
              </div>
              <div className="field">
                <label>CGPA / Percentage</label>
                <input value={eduForm.cgpa} onChange={e => setEduForm({ ...eduForm, cgpa: e.target.value })} placeholder="e.g. 8.19" />
              </div>
              <div className="field">
                <label>Period / Duration</label>
                <input value={eduForm.period} onChange={e => setEduForm({ ...eduForm, period: e.target.value })} placeholder="e.g. Aug 2022 – Jul 2026" />
              </div>
              <div className="field">
                <label>Location</label>
                <input value={eduForm.location} onChange={e => setEduForm({ ...eduForm, location: e.target.value })} placeholder="e.g. Bhopal, MP" />
              </div>
              <div className="field">
                <label>Status</label>
                <select value={eduForm.status} onChange={e => setEduForm({ ...eduForm, status: e.target.value })}>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Deferred">Deferred</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginRight: 8 }}>
              {editingEduIndex !== null ? 'Update Education' : 'Add Education'}
            </button>
            <button type="button" className="btn" onClick={() => { setShowAddEdu(false); setEditingEduIndex(null); }}>
              Cancel
            </button>
          </form>
        )}
      </div>

      {/* ── Section 3: Work Experience (Multiple) ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div className="section-title" style={{ margin: 0 }}>Work Experience ({profile.experience?.length || 0})</div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '4px 0 0 0' }}>
              Full-time roles, internships, and contract engagements with key achievements.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              if (showAddExp) {
                setShowAddExp(false);
                setEditingExpIndex(null);
              } else {
                setExpForm({ company: '', role: '', location: '', period: '', highlightsText: '' });
                setEditingExpIndex(null);
                setShowAddExp(true);
              }
            }}
          >
            {showAddExp ? 'Cancel' : '+ Add Experience'}
          </button>
        </div>

        {/* Experience List */}
        {profile.experience?.map((exp, idx) => (
          <div key={idx} className="profile-item-card">
            <div className="profile-item-header">
              <div className="profile-item-title">
                <span>💼</span>
                <span>{exp.role}</span>
                <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>@ {exp.company}</span>
              </div>
              <div className="profile-item-actions">
                <button type="button" className="icon-btn" onClick={() => editExp(idx)} title="Edit">✏️</button>
                <button type="button" className="icon-btn" onClick={() => removeExp(idx)} title="Remove" style={{ color: 'var(--rust)' }}>✕</button>
              </div>
            </div>
            <div className="profile-item-meta">
              {exp.period && <span>🗓️ {exp.period}</span>}
              {exp.location && <span>📍 {exp.location}</span>}
            </div>
            {Array.isArray(exp.highlights) && exp.highlights.length > 0 && (
              <ul className="profile-bullet-list">
                {exp.highlights.map((h, hIdx) => (
                  <li key={hIdx}>{h}</li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {/* Add/Edit Experience Form */}
        {showAddExp && (
          <form onSubmit={saveExp} className="profile-add-box">
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 10, color: 'var(--ink)' }}>
              {editingExpIndex !== null ? 'Edit Experience' : 'Add Work Experience'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 12 }}>
              <div className="field">
                <label>Company / Organization *</label>
                <input required value={expForm.company} onChange={e => setExpForm({ ...expForm, company: e.target.value })} placeholder="e.g. Netlink Software Group" />
              </div>
              <div className="field">
                <label>Job Title / Role *</label>
                <input required value={expForm.role} onChange={e => setExpForm({ ...expForm, role: e.target.value })} placeholder="e.g. FinOps Engineer or DevOps Intern" />
              </div>
              <div className="field">
                <label>Period / Dates</label>
                <input value={expForm.period} onChange={e => setExpForm({ ...expForm, period: e.target.value })} placeholder="e.g. Feb 2026 – Present" />
              </div>
              <div className="field">
                <label>Location</label>
                <input value={expForm.location} onChange={e => setExpForm({ ...expForm, location: e.target.value })} placeholder="e.g. Noida, India" />
              </div>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Key Highlights &amp; Accomplishments (One per line)</label>
              <textarea
                rows={4}
                value={expForm.highlightsText}
                onChange={e => setExpForm({ ...expForm, highlightsText: e.target.value })}
                placeholder="• Delivered ~$15,000/month in cloud savings across AWS, Azure, GCP&#10;• Automated ERP server monitoring across 141 municipalities"
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginRight: 8 }}>
              {editingExpIndex !== null ? 'Update Experience' : 'Add Experience'}
            </button>
            <button type="button" className="btn" onClick={() => { setShowAddExp(false); setEditingExpIndex(null); }}>
              Cancel
            </button>
          </form>
        )}
      </div>

      {/* ── Section 4: Projects (Multiple) ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div className="section-title" style={{ margin: 0 }}>Projects ({profile.projects?.length || 0})</div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '4px 0 0 0' }}>
              Key engineering and AI projects highlighting your practical stack proficiency.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              if (showAddProj) {
                setShowAddProj(false);
                setEditingProjIndex(null);
              } else {
                setProjForm({ title: '', tech_stack: '', link: '', description: '' });
                setEditingProjIndex(null);
                setShowAddProj(true);
              }
            }}
          >
            {showAddProj ? 'Cancel' : '+ Add Project'}
          </button>
        </div>

        {/* Projects List */}
        {profile.projects?.map((proj, idx) => (
          <div key={idx} className="profile-item-card">
            <div className="profile-item-header">
              <div className="profile-item-title">
                <span>⚡</span>
                <span>{proj.title}</span>
                {proj.link && (
                  <a href={proj.link} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>
                    🔗 Link ↗
                  </a>
                )}
              </div>
              <div className="profile-item-actions">
                <button type="button" className="icon-btn" onClick={() => editProj(idx)} title="Edit">✏️</button>
                <button type="button" className="icon-btn" onClick={() => removeProj(idx)} title="Remove" style={{ color: 'var(--rust)' }}>✕</button>
              </div>
            </div>
            {proj.tech_stack && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {proj.tech_stack.split(',').map((t, tIdx) => (
                  <span key={tIdx} className="badge" style={{ fontSize: 11, background: 'rgba(0,0,0,0.06)' }}>
                    {t.trim()}
                  </span>
                ))}
              </div>
            )}
            {proj.description && (
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                {proj.description}
              </p>
            )}
          </div>
        ))}

        {/* Add/Edit Project Form */}
        {showAddProj && (
          <form onSubmit={saveProj} className="profile-add-box">
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 10, color: 'var(--ink)' }}>
              {editingProjIndex !== null ? 'Edit Project' : 'Add New Project'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
              <div className="field">
                <label>Project Title *</label>
                <input required value={projForm.title} onChange={e => setProjForm({ ...projForm, title: e.target.value })} placeholder="e.g. Automated Data Pipeline Platform" />
              </div>
              <div className="field">
                <label>Tech Stack (comma-separated)</label>
                <input value={projForm.tech_stack} onChange={e => setProjForm({ ...projForm, tech_stack: e.target.value })} placeholder="Python, FastAPI, Docker, Gemini" />
              </div>
              <div className="field">
                <label>GitHub / Demo Link</label>
                <input value={projForm.link} onChange={e => setProjForm({ ...projForm, link: e.target.value })} placeholder="https://github.com/..." />
              </div>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Description &amp; Engineering Details</label>
              <textarea
                rows={3}
                value={projForm.description}
                onChange={e => setProjForm({ ...projForm, description: e.target.value })}
                placeholder="What it does, architecture decisions, metrics achieved..."
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginRight: 8 }}>
              {editingProjIndex !== null ? 'Update Project' : 'Add Project'}
            </button>
            <button type="button" className="btn" onClick={() => { setShowAddProj(false); setEditingProjIndex(null); }}>
              Cancel
            </button>
          </form>
        )}
      </div>

      {/* ── Section 5: Publications & Research ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div className="section-title" style={{ margin: 0 }}>Research &amp; Publications ({profile.publications?.length || 0})</div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '4px 0 0 0' }}>
              Academic papers, copyright registrations, and conference publications.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              if (showAddPub) {
                setShowAddPub(false);
                setEditingPubIndex(null);
              } else {
                setPubForm({ title: '', authors: '', venue: '', year: '', description: '' });
                setEditingPubIndex(null);
                setShowAddPub(true);
              }
            }}
          >
            {showAddPub ? 'Cancel' : '+ Add Publication'}
          </button>
        </div>

        {/* Publications List */}
        {profile.publications?.map((pub, idx) => (
          <div key={idx} className="profile-item-card">
            <div className="profile-item-header">
              <div className="profile-item-title">
                <span>📚</span>
                <span>&quot;{pub.title}&quot;</span>
              </div>
              <div className="profile-item-actions">
                <button type="button" className="icon-btn" onClick={() => editPub(idx)} title="Edit">✏️</button>
                <button type="button" className="icon-btn" onClick={() => removePub(idx)} title="Remove" style={{ color: 'var(--rust)' }}>✕</button>
              </div>
            </div>
            <div className="profile-item-meta">
              {pub.authors && <span>✍️ {pub.authors}</span>}
              {pub.venue && <span>🏛️ {pub.venue}</span>}
              {pub.year && <span>🗓️ {pub.year}</span>}
            </div>
            {pub.description && (
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                {pub.description}
              </p>
            )}
          </div>
        ))}

        {/* Add/Edit Publication Form */}
        {showAddPub && (
          <form onSubmit={savePub} className="profile-add-box">
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 10, color: 'var(--ink)' }}>
              {editingPubIndex !== null ? 'Edit Publication' : 'Add New Publication'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
              <div className="field">
                <label>Paper / Research Title *</label>
                <input required value={pubForm.title} onChange={e => setPubForm({ ...pubForm, title: e.target.value })} placeholder="e.g. Solving Transportation Problem Using Python" />
              </div>
              <div className="field">
                <label>Authors</label>
                <input value={pubForm.authors} onChange={e => setPubForm({ ...pubForm, authors: e.target.value })} placeholder="e.g. Prof. Sarla Raigar, Reshav Sharma" />
              </div>
              <div className="field">
                <label>Journal / Conference / Venue</label>
                <input value={pubForm.venue} onChange={e => setPubForm({ ...pubForm, venue: e.target.value })} placeholder="e.g. IRJMETS / IEEE Conference" />
              </div>
              <div className="field">
                <label>Year / Status</label>
                <input value={pubForm.year} onChange={e => setPubForm({ ...pubForm, year: e.target.value })} placeholder="e.g. May 2025 or Under Review" />
              </div>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Abstract / Key Contributions</label>
              <textarea
                rows={3}
                value={pubForm.description}
                onChange={e => setPubForm({ ...pubForm, description: e.target.value })}
                placeholder="Core algorithm, methodologies formulated, results..."
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginRight: 8 }}>
              {editingPubIndex !== null ? 'Update Publication' : 'Add Publication'}
            </button>
            <button type="button" className="btn" onClick={() => { setShowAddPub(false); setEditingPubIndex(null); }}>
              Cancel
            </button>
          </form>
        )}
      </div>

      {/* ── Section 6: Achievements & Leadership ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div className="section-title" style={{ margin: 0 }}>Achievements &amp; Leadership ({profile.achievements?.length || 0})</div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '4px 0 0 0' }}>
              Awards, community leadership, and recognized milestones.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              if (showAddAch) {
                setShowAddAch(false);
                setEditingAchIndex(null);
              } else {
                setAchForm({ title: '', organization: '', year: '', description: '' });
                setEditingAchIndex(null);
                setShowAddAch(true);
              }
            }}
          >
            {showAddAch ? 'Cancel' : '+ Add Achievement'}
          </button>
        </div>

        {/* Achievements List */}
        {profile.achievements?.map((ach, idx) => (
          <div key={idx} className="profile-item-card">
            <div className="profile-item-header">
              <div className="profile-item-title">
                <span>🏆</span>
                <span>{ach.title}</span>
              </div>
              <div className="profile-item-actions">
                <button type="button" className="icon-btn" onClick={() => editAch(idx)} title="Edit">✏️</button>
                <button type="button" className="icon-btn" onClick={() => removeAch(idx)} title="Remove" style={{ color: 'var(--rust)' }}>✕</button>
              </div>
            </div>
            <div className="profile-item-meta">
              {ach.organization && <span>🏛️ {ach.organization}</span>}
              {ach.year && <span>🗓️ {ach.year}</span>}
            </div>
            {ach.description && (
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                {ach.description}
              </p>
            )}
          </div>
        ))}

        {/* Add/Edit Achievement Form */}
        {showAddAch && (
          <form onSubmit={saveAch} className="profile-add-box">
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 10, color: 'var(--ink)' }}>
              {editingAchIndex !== null ? 'Edit Achievement' : 'Add New Achievement'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
              <div className="field">
                <label>Achievement / Award Title *</label>
                <input required value={achForm.title} onChange={e => setAchForm({ ...achForm, title: e.target.value })} placeholder="e.g. Best Student Research Award" />
              </div>
              <div className="field">
                <label>Organization / Issuer</label>
                <input value={achForm.organization} onChange={e => setAchForm({ ...achForm, organization: e.target.value })} placeholder="e.g. IEEE International Conference" />
              </div>
              <div className="field">
                <label>Year / Date</label>
                <input value={achForm.year} onChange={e => setAchForm({ ...achForm, year: e.target.value })} placeholder="e.g. Sep 2024" />
              </div>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Description &amp; Impact</label>
              <textarea
                rows={3}
                value={achForm.description}
                onChange={e => setAchForm({ ...achForm, description: e.target.value })}
                placeholder="Details of recognition, volunteer count, or leadership scope..."
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginRight: 8 }}>
              {editingAchIndex !== null ? 'Update Achievement' : 'Add Achievement'}
            </button>
            <button type="button" className="btn" onClick={() => { setShowAddAch(false); setEditingAchIndex(null); }}>
              Cancel
            </button>
          </form>
        )}
      </div>

      {/* ── Section 7: Technical Skills & Certifications ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title">Technical Skills &amp; Certifications</div>
        
        {/* Skills */}
        <div className="field" style={{ marginBottom: 16 }}>
          <label>Technical Skills ({profile.skills?.length || 0})</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {profile.skills?.map((s, idx) => (
              <span key={idx} className="badge" style={{ background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {s}
                <button type="button" className="icon-btn" style={{ padding: '0 2px', fontSize: 11 }} onClick={() => removeTag(profile.skills, 'skills', idx)}>✕</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="Add skill (e.g. Terraform, CI/CD, FinOps) + press Enter"
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(profile.skills, 'skills', skillInput, setSkillInput); } }}
            />
            <button type="button" className="btn btn-sm" onClick={() => addTag(profile.skills, 'skills', skillInput, setSkillInput)}>Add</button>
          </div>
        </div>

        {/* Certifications */}
        <div className="field">
          <label>Certifications &amp; Recognitions ({profile.certifications?.length || 0})</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {profile.certifications?.map((c, idx) => (
              <span key={idx} className="badge" style={{ background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {c}
                <button type="button" className="icon-btn" style={{ padding: '0 2px', fontSize: 11 }} onClick={() => removeTag(profile.certifications, 'certifications', idx)}>✕</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="Add cert (e.g. AWS SAA, CKA, Azure AZ-900) + press Enter"
              value={certInput}
              onChange={e => setCertInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(profile.certifications, 'certifications', certInput, setCertInput); } }}
            />
            <button type="button" className="btn btn-sm" onClick={() => addTag(profile.certifications, 'certifications', certInput, setCertInput)}>Add</button>
          </div>
        </div>
      </div>

      {/* ── Section 8: Competitive Exams & GATE Status ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="section-title" style={{ margin: 0 }}>National Competitive Exams &amp; GATE Status</div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '4px 0 0 0' }}>
              PSUs like GAIL, ONGC, NTPC, IOCL, POWERGRID, and NPCIL require a GATE score for fresher engineer recruitments.
            </p>
          </div>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Changes auto-save</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 14 }}>
          <div className="field">
            <label>Qualified in GATE?</label>
            <select
              value={profile.has_gate ? '1' : '0'}
              onChange={e => {
                const val = e.target.value === '1' ? 1 : 0;
                updateAndSave('has_gate', val);
              }}
              style={{ fontWeight: 600, color: profile.has_gate ? 'var(--green)' : 'var(--rust)' }}
            >
              <option value="0">❌ No — Filter out GATE-dependent PSU recruitments (Default)</option>
              <option value="1">✅ Yes — I have a valid GATE score</option>
            </select>
          </div>

          {!!profile.has_gate && (
            <>
              <div className="field">
                <label>GATE Score / Marks</label>
                <input
                  type="number"
                  placeholder="e.g. 720"
                  value={profile.gate_score || ''}
                  onChange={e => update('gate_score', e.target.value ? Number(e.target.value) : null)}
                  onBlur={() => save()}
                />
              </div>
              <div className="field">
                <label>GATE Exam Year</label>
                <input
                  type="number"
                  placeholder="e.g. 2026"
                  value={profile.gate_year || ''}
                  onChange={e => update('gate_year', e.target.value ? Number(e.target.value) : null)}
                  onBlur={() => save()}
                />
              </div>
            </>
          )}
        </div>

        {!profile.has_gate && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 'var(--radius)',
            background: 'rgba(91, 127, 186, 0.08)',
            border: '1px solid rgba(91, 127, 186, 0.2)',
            fontSize: 12.5,
            color: 'var(--ink-soft)',
            lineHeight: 1.5
          }}>
            🛡️ <strong>Auto-Filter Active:</strong> PSU recruitments requiring GATE (such as GAIL Executive Trainee, ONGC Graduate Trainee, NTPC EET) are automatically marked as ineligible and excluded from your active opportunities list. All organizations remain registered in your <strong>Organizations</strong> database for direct non-GATE drives.
          </div>
        )}
      </div>

      {/* ── Section 9: Opportunity Preferences ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="section-title" style={{ margin: 0 }}>Career Targets &amp; Opportunity Preferences</div>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Changes auto-save immediately</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 12, marginBottom: 16 }}>
          <div className="field">
            <label>Minimum Expected CTC (₹ annual)</label>
            <input
              type="number"
              step="50000"
              placeholder="e.g. 1200000"
              value={profile.pref_min_ctc || ''}
              onChange={e => update('pref_min_ctc', e.target.value ? Number(e.target.value) : null)}
              onBlur={() => save()}
            />
            {profile.pref_min_ctc && (
              <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                ≈ ₹{(Number(profile.pref_min_ctc) / 100000).toFixed(1)} LPA
              </span>
            )}
          </div>

          <div className="field">
            <label>Remote Work Flexibility</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38 }}>
              <input
                type="checkbox"
                id="pref_remote"
                checked={!!profile.pref_remote_ok}
                onChange={e => updateAndSave('pref_remote_ok', e.target.checked ? 1 : 0)}
              />
              <label htmlFor="pref_remote" style={{ cursor: 'pointer', margin: 0, fontSize: 13.5 }}>
                Open to Remote &amp; Hybrid roles
              </label>
            </div>
          </div>
        </div>

        {/* Preferred Locations */}
        <div className="field" style={{ marginBottom: 16 }}>
          <label>Preferred Locations ({profile.pref_locations?.length || 0})</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {profile.pref_locations?.map((loc, idx) => (
              <span key={idx} className="badge" style={{ background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                📍 {loc}
                <button type="button" className="icon-btn" style={{ padding: '0 2px', fontSize: 11 }} onClick={() => removeTag(profile.pref_locations, 'pref_locations', idx)}>✕</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="Add location (e.g. Noida, Bangalore, Pune, Remote) + press Enter"
              value={locInput}
              onChange={e => setLocInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(profile.pref_locations, 'pref_locations', locInput, setLocInput); } }}
            />
            <button type="button" className="btn btn-sm" onClick={() => addTag(profile.pref_locations, 'pref_locations', locInput, setLocInput)}>Add</button>
          </div>
        </div>

        {/* Preferred Sectors */}
        <div className="field" style={{ marginBottom: 16 }}>
          <label>Target Sectors</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SECTOR_OPTIONS.map(s => {
              const active = (profile.pref_sectors || []).includes(s);
              return (
                <button
                  type="button"
                  key={s}
                  className={`btn btn-sm ${active ? 'btn-primary' : ''}`}
                  style={{ borderRadius: 20 }}
                  onClick={() => {
                    const current = profile.pref_sectors || [];
                    updateAndSave('pref_sectors', active ? current.filter(x => x !== s) : [...current, s]);
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preferred Job Types */}
        <div className="field">
          <label>Preferred Organization &amp; Job Types</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {JOB_TYPE_OPTIONS.map(t => {
              const active = (profile.pref_job_types || []).includes(t.id);
              return (
                <button
                  type="button"
                  key={t.id}
                  className={`btn btn-sm ${active ? 'btn-primary' : ''}`}
                  style={{ borderRadius: 20 }}
                  onClick={() => {
                    const current = profile.pref_job_types || [];
                    updateAndSave('pref_job_types', active ? current.filter(x => x !== t.id) : [...current, t.id]);
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom action footer */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center', marginTop: 24, paddingBottom: 60 }}>
        {saved && <span style={{ color: 'var(--green)', fontSize: 13, fontWeight: 600 }}>✓ All changes saved</span>}
        <button className="btn btn-primary" onClick={() => save()} disabled={saving} style={{ minWidth: 140 }}>
          {saving ? 'Saving…' : '💾 Save All Changes'}
        </button>
        <button className="btn" onClick={rescoreAll} disabled={rescoring} style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}>
          {rescoring ? 'Rescoring…' : '⚡ Save & Rescore Opportunities'}
        </button>
      </div>
    </div>
  );
}
