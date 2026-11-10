/**
 * jobhuntEvidence.js - Confirmed Career Evidence & Anti-Hallucination Source of Truth
 * Inspired by AienTech/dossier & ai-job-search
 * 
 * Extracts, structures, and indexes atomic verified facts from candidate profile
 * to ground CV/Cover Letter drafting and prevent AI hallucinations.
 */

const pool = require('../db/db');

/**
 * Extracts atomic claims from jobhunt_profile and syncs them to jobhunt_evidence_claims
 */
async function syncProfileEvidence() {
  const [profiles] = await pool.query('SELECT * FROM jobhunt_profile LIMIT 1');
  if (profiles.length === 0) return { synced: 0 };
  const p = profiles[0];

  const claims = [];

  // 1. Work Experience
  if (p.experience) {
    try {
      const exps = typeof p.experience === 'string' ? JSON.parse(p.experience) : p.experience;
      if (Array.isArray(exps)) {
        exps.forEach(exp => {
          const sourceTitle = `${exp.company || 'Company'} — ${exp.role || 'Role'} (${exp.period || ''})`;
          if (Array.isArray(exp.highlights)) {
            exp.highlights.forEach(h => {
              claims.push({
                category: 'work_experience',
                source_title: sourceTitle,
                claim_text: h,
                metrics_json: extractMetrics(h),
                skills_tags: extractSkills(h, p.skills)
              });
            });
          }
        });
      }
    } catch (err) {
      console.warn('Could not parse experience for evidence sync:', err.message);
    }
  }

  // 2. Projects
  if (p.projects) {
    try {
      const projs = typeof p.projects === 'string' ? JSON.parse(p.projects) : p.projects;
      if (Array.isArray(projs)) {
        projs.forEach(proj => {
          const sourceTitle = `Project: ${proj.title || 'Untitled'}`;
          if (proj.description) {
            claims.push({
              category: 'project',
              source_title: sourceTitle,
              claim_text: proj.description,
              metrics_json: extractMetrics(proj.description),
              skills_tags: proj.tech_stack ? proj.tech_stack.split(',').map(s => s.trim()) : []
            });
          }
        });
      }
    } catch (err) {
      console.warn('Could not parse projects for evidence sync:', err.message);
    }
  }

  // 3. Education
  if (p.education) {
    try {
      const edus = typeof p.education === 'string' ? JSON.parse(p.education) : p.education;
      if (Array.isArray(edus)) {
        edus.forEach(edu => {
          claims.push({
            category: 'education',
            source_title: `${edu.degree || 'Degree'} (${edu.branch || ''}) — ${edu.institution || ''}`,
            claim_text: `${edu.degree || ''} in ${edu.branch || ''} from ${edu.institution || ''} (${edu.period || ''}) with CGPA: ${edu.cgpa || 'N/A'}, Status: ${edu.status || 'Active'}`,
            metrics_json: edu.cgpa ? { cgpa: parseFloat(edu.cgpa) || null } : null,
            skills_tags: ['Education', edu.branch || '']
          });
        });
      }
    } catch (err) {
      console.warn('Could not parse education for evidence sync:', err.message);
    }
  }

  // 4. Publications
  if (p.publications) {
    try {
      const pubs = typeof p.publications === 'string' ? JSON.parse(p.publications) : p.publications;
      if (Array.isArray(pubs)) {
        pubs.forEach(pub => {
          claims.push({
            category: 'publication',
            source_title: `Publication: ${pub.title || ''}`,
            claim_text: `"${pub.title}" published in/with ${pub.venue || ''} (${pub.year || ''}). ${pub.description || ''}`,
            metrics_json: null,
            skills_tags: ['Research', 'Publication']
          });
        });
      }
    } catch (err) {
      console.warn('Could not parse publications for evidence sync:', err.message);
    }
  }

  // 5. Certifications
  if (p.certifications) {
    try {
      const certs = typeof p.certifications === 'string' ? JSON.parse(p.certifications) : p.certifications;
      if (Array.isArray(certs)) {
        certs.forEach(cert => {
          claims.push({
            category: 'certification',
            source_title: `Certification: ${cert}`,
            claim_text: `Holder of credential: ${cert}`,
            metrics_json: null,
            skills_tags: [cert]
          });
        });
      }
    } catch (err) {
      console.warn('Could not parse certifications for evidence sync:', err.message);
    }
  }

  // Clear and insert atomic claims in a clean sync
  await pool.query('DELETE FROM jobhunt_evidence_claims WHERE is_verified = 1');
  for (const c of claims) {
    await pool.query(
      `INSERT INTO jobhunt_evidence_claims (category, source_title, claim_text, metrics_json, skills_tags, is_verified)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [c.category, c.source_title, c.claim_text, JSON.stringify(c.metrics_json), JSON.stringify(c.skills_tags)]
    );
  }

  return { synced: claims.length };
}

/**
 * Helper to extract quantifiable metrics ($ amounts, % changes, numbers)
 */
function extractMetrics(text) {
  if (!text) return null;
  const metrics = {};
  const dollarMatch = text.match(/\$[\d,]+(\/month|\s*annualized|\/yr)?/gi);
  if (dollarMatch) metrics.monetary_values = dollarMatch;
  const pctMatch = text.match(/\d+%/g);
  if (pctMatch) metrics.percentages = pctMatch;
  const numCounts = text.match(/\b\d+\s+(municipalities|accounts|clients|teams|attendees|volunteers|servers)\b/gi);
  if (numCounts) metrics.counts = numCounts;
  return Object.keys(metrics).length > 0 ? metrics : null;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Helper to tag skills referenced in text from known skills
 */
function extractSkills(text, masterSkillsJson) {
  if (!text) return [];
  let master = [];
  try {
    master = typeof masterSkillsJson === 'string' ? JSON.parse(masterSkillsJson) : (masterSkillsJson || []);
  } catch {}
  return master.filter(skill => {
    try {
      return new RegExp(`\\b${escapeRegex(skill)}\\b`, 'i').test(text);
    } catch {
      return text.toLowerCase().includes(skill.toLowerCase());
    }
  });
}

/**
 * Returns structured evidence base grouped by category
 */
async function getEvidenceBase() {
  const [rows] = await pool.query('SELECT * FROM jobhunt_evidence_claims WHERE is_verified = 1 ORDER BY category, id');
  const grouped = {
    work_experience: [],
    project: [],
    education: [],
    publication: [],
    certification: [],
    other: []
  };

  rows.forEach(r => {
    const list = grouped[r.category] || grouped.other;
    list.push({
      id: r.id,
      source: r.source_title,
      claim: r.claim_text,
      metrics: r.metrics_json ? (typeof r.metrics_json === 'string' ? JSON.parse(r.metrics_json) : r.metrics_json) : null,
      skills: r.skills_tags ? (typeof r.skills_tags === 'string' ? JSON.parse(r.skills_tags) : r.skills_tags) : []
    });
  });

  return grouped;
}

module.exports = {
  syncProfileEvidence,
  getEvidenceBase,
  extractMetrics
};
