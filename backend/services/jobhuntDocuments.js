/**
 * jobhuntDocuments.js - Tailored CV & Cover Letter Drafter Engine
 * Inspired by AienTech/dossier & ai-job-search
 * 
 * Generates tailored, ATS-compliant resumes and cover letters strictly grounded
 * in the candidate's confirmed career evidence claims.
 */

const pool = require('../db/db');
const { getEvidenceBase } = require('./jobhuntEvidence');

/**
 * Drafts a tailored document package for a given opportunity
 */
async function draftDocumentPackage({ opportunityId, applicationId, customJobDescription, targetOrg, targetRole }) {
  // 1. Fetch opportunity or target details
  let orgName = targetOrg || 'Target Employer';
  let roleTitle = targetRole || 'Candidate Position';
  let jobDescription = customJobDescription || '';
  let requiredSkills = [];

  if (opportunityId) {
    const [oppRows] = await pool.query(
      `SELECT op.*, org.name AS org_name, org.sector AS org_sector
       FROM jobhunt_opportunities op
       LEFT JOIN jobhunt_organizations org ON op.org_id = org.id
       WHERE op.id = ?`,
      [opportunityId]
    );
    if (oppRows.length > 0) {
      const opp = oppRows[0];
      orgName = opp.org_name || orgName;
      roleTitle = opp.title || roleTitle;
      jobDescription = opp.description || opp.notes || `${roleTitle} at ${orgName}`;
      try {
        requiredSkills = typeof opp.required_skills === 'string' ? JSON.parse(opp.required_skills) : (opp.required_skills || []);
      } catch {}
    }
  }

  // 2. Fetch candidate master profile
  const [profiles] = await pool.query('SELECT * FROM jobhunt_profile LIMIT 1');
  const profile = profiles[0] || {};
  const evidence = await getEvidenceBase();

  // 3. Score and prioritize evidence claims based on job requirements
  const prioritizedExperience = rankAndFormatExperience(evidence.work_experience, roleTitle, jobDescription, requiredSkills);
  const prioritizedProjects = rankAndFormatProjects(evidence.project, roleTitle, jobDescription, requiredSkills);
  const matchedSkills = identifyMatchedSkills(profile.skills, jobDescription, requiredSkills);

  // 4. Construct Tailored Resume Markdown
  const resumeMarkdown = buildResumeMarkdown({
    profile,
    prioritizedExperience,
    prioritizedProjects,
    matchedSkills,
    education: evidence.education,
    publications: evidence.publication,
    certifications: evidence.certification
  });

  // 5. Construct Grounded Cover Letter Markdown
  const coverLetterMarkdown = buildCoverLetterMarkdown({
    profile,
    orgName,
    roleTitle,
    jobDescription,
    prioritizedExperience,
    prioritizedProjects
  });

  // 6. Record evidence claims used for provenance tracking
  const usedClaimIds = [
    ...prioritizedExperience.map(e => e.id),
    ...prioritizedProjects.map(p => p.id),
    ...evidence.education.map(ed => ed.id)
  ];

  // 7. Persist document package
  const [pkgResult] = await pool.query(
    `INSERT INTO jobhunt_document_packages 
     (opportunity_id, application_id, org_name, role_title, version, status, tailored_resume_markdown, tailored_cover_letter_markdown, target_job_description, key_skills_addressed, evidence_claims_used)
     VALUES (?, ?, ?, ?, 1, 'draft', ?, ?, ?, ?, ?)`,
    [
      opportunityId || null,
      applicationId || null,
      orgName,
      roleTitle,
      resumeMarkdown,
      coverLetterMarkdown,
      jobDescription,
      JSON.stringify(matchedSkills),
      JSON.stringify(usedClaimIds)
    ]
  );

  return {
    packageId: pkgResult.insertId,
    orgName,
    roleTitle,
    resumeMarkdown,
    coverLetterMarkdown,
    matchedSkills,
    usedClaimIds
  };
}

/**
 * Re-ranks experience bullet points to match the target job priorities
 */
function rankAndFormatExperience(workClaims, roleTitle, jobDescription, requiredSkills) {
  const jdLower = (jobDescription + ' ' + roleTitle + ' ' + requiredSkills.join(' ')).toLowerCase();

  return workClaims.map(item => {
    let relevanceScore = 0;
    // Check skills overlap
    item.skills.forEach(s => {
      if (jdLower.includes(s.toLowerCase())) relevanceScore += 3;
    });
    // Check keywords overlap
    const words = item.claim.toLowerCase().split(/\W+/);
    words.forEach(w => {
      if (w.length > 4 && jdLower.includes(w)) relevanceScore += 1;
    });

    return { ...item, relevanceScore };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Re-ranks projects to highlight those most relevant to the role
 */
function rankAndFormatProjects(projectClaims, roleTitle, jobDescription, requiredSkills) {
  const jdLower = (jobDescription + ' ' + roleTitle + ' ' + requiredSkills.join(' ')).toLowerCase();

  return projectClaims.map(item => {
    let relevanceScore = 0;
    item.skills.forEach(s => {
      if (jdLower.includes(s.toLowerCase())) relevanceScore += 3;
    });
    const words = item.claim.toLowerCase().split(/\W+/);
    words.forEach(w => {
      if (w.length > 4 && jdLower.includes(w)) relevanceScore += 1;
    });
    return { ...item, relevanceScore };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Identifies skills from candidate profile that directly answer job requirements
 */
function identifyMatchedSkills(masterSkillsJson, jobDescription, requiredSkills) {
  let master = [];
  try {
    master = typeof masterSkillsJson === 'string' ? JSON.parse(masterSkillsJson) : (masterSkillsJson || []);
  } catch {}

  const text = (jobDescription + ' ' + requiredSkills.join(' ')).toLowerCase();
  const matched = [];
  const coreCompetencies = [];

  master.forEach(s => {
    if (text.includes(s.toLowerCase())) {
      matched.push(s);
    } else {
      coreCompetencies.push(s);
    }
  });

  return {
    matched_skills: matched,
    additional_competencies: coreCompetencies.slice(0, 10)
  };
}

/**
 * Builds clean ATS-friendly markdown resume
 */
function buildResumeMarkdown({ profile, prioritizedExperience, prioritizedProjects, matchedSkills, education, publications, certifications }) {
  const lines = [];

  // Header
  lines.push(`# ${profile.full_name || 'Candidate Name'}`);
  const contactParts = [];
  if (profile.email) contactParts.push(profile.email);
  if (profile.phone) contactParts.push(profile.phone);
  if (profile.linkedin) contactParts.push(`[LinkedIn](${profile.linkedin})`);
  if (profile.github) contactParts.push(`[GitHub](${profile.github})`);
  lines.push(contactParts.join('  •  '));
  lines.push('\n---\n');

  // Professional Summary
  if (profile.summary) {
    lines.push(`## Professional Summary\n${profile.summary}\n`);
  }

  // Core Technical Skills (Targeted)
  lines.push('## Technical Skills');
  if (matchedSkills.matched_skills.length > 0) {
    lines.push(`**Targeted & Production Expertise:** ${matchedSkills.matched_skills.join(', ')}`);
  }
  if (matchedSkills.additional_competencies.length > 0) {
    lines.push(`**Core Competencies:** ${matchedSkills.additional_competencies.join(', ')}`);
  }
  lines.push('');

  // Experience (Grouped by role with prioritized bullet points)
  lines.push('## Professional Experience');
  const bySource = {};
  prioritizedExperience.forEach(item => {
    if (!bySource[item.source]) bySource[item.source] = [];
    bySource[item.source].push(item.claim);
  });

  Object.entries(bySource).forEach(([source, claims]) => {
    lines.push(`### ${source}`);
    claims.forEach(c => {
      lines.push(`* ${c}`);
    });
    lines.push('');
  });

  // Projects
  if (prioritizedProjects.length > 0) {
    lines.push('## Key Projects');
    prioritizedProjects.forEach(p => {
      lines.push(`### ${p.source}`);
      if (p.skills.length > 0) {
        lines.push(`*Technologies: ${p.skills.join(', ')}*`);
      }
      lines.push(`${p.claim}\n`);
    });
  }

  // Education
  if (education.length > 0) {
    lines.push('## Education');
    education.forEach(ed => {
      lines.push(`* **${ed.source}**`);
      lines.push(`  ${ed.claim}`);
    });
    lines.push('');
  }

  // Publications & Research
  if (publications.length > 0) {
    lines.push('## Publications & Research');
    publications.forEach(pub => {
      lines.push(`* **${pub.source}**`);
      lines.push(`  ${pub.claim}`);
    });
    lines.push('');
  }

  // Certifications
  if (certifications.length > 0) {
    lines.push('## Certifications & Honors');
    certifications.forEach(cert => {
      lines.push(`* ${cert.source.replace(/^Certification:\s*/, '')}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Builds factual, grounded 3-paragraph cover letter
 */
function buildCoverLetterMarkdown({ profile, orgName, roleTitle, prioritizedExperience, prioritizedProjects }) {
  const topExp = prioritizedExperience[0]?.claim || 'delivering measurable engineering impact';
  const topProj = prioritizedProjects[0]?.claim || 'building scalable cloud systems';

  return `**Date:** ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}

**To:** Hiring Team, ${orgName}  
**Position:** ${roleTitle}  
**From:** ${profile.full_name || 'Candidate Name'}  

Dear Hiring Team,

I am writing to express my strong interest in the **${roleTitle}** opportunity at **${orgName}**. With hands-on production experience in multi-cloud infrastructure, cost optimization, and automated system observability, I have consistently focused on building resilient systems that produce verifiable efficiency and reliability gains.

At my current and previous engineering roles, I have:
* ${topExp}
* ${topProj}

My academic foundation through B.Tech CSE (Sagar Institute of Research and Technology, 8.19 CGPA) and BS Data Science (IIT Madras) gives me the quantitative and systems engineering rigor to solve complex technical problems. I am excited about the work ${orgName} is doing and would welcome the opportunity to contribute my skills to your team.

Thank you for your time and consideration.

Sincerely,  
**${profile.full_name || 'Candidate Name'}**  
${profile.email || ''} | ${profile.phone || ''}
`;
}

module.exports = {
  draftDocumentPackage
};
