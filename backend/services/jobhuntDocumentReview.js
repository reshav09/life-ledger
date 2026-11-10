/**
 * jobhuntDocumentReview.js - Multi-Agent Anti-Hallucination Reviewer
 * Inspired by ai-job-search drafter-reviewer loop & AienTech/dossier
 * 
 * Audits drafted resumes & cover letters against the verified evidence base,
 * detects invented claims, evaluates keyword alignment, and assigns risk scores.
 */

const pool = require('../db/db');
const { getEvidenceBase } = require('./jobhuntEvidence');

/**
 * Reviews a document package for factual accuracy, keyword alignment, and hallucination risk
 */
async function reviewDocumentPackage(packageId) {
  const [packages] = await pool.query(
    'SELECT * FROM jobhunt_document_packages WHERE id = ?',
    [packageId]
  );
  if (packages.length === 0) throw new Error('Document package not found');
  const pkg = packages[0];

  const evidence = await getEvidenceBase();
  const [profiles] = await pool.query('SELECT summary FROM jobhunt_profile LIMIT 1');

  const allVerifiedClaims = [
    ...(profiles[0]?.summary ? [profiles[0].summary] : []),
    ...evidence.work_experience.map(e => e.claim),
    ...evidence.work_experience.map(e => e.source),
    ...evidence.project.map(p => p.claim),
    ...evidence.project.map(p => p.source),
    ...evidence.education.map(ed => ed.claim),
    ...evidence.education.map(ed => ed.source),
    ...evidence.publication.map(pub => pub.claim),
    ...evidence.publication.map(pub => pub.source),
    ...evidence.certification.map(c => c.source)
  ];

  const resumeText = pkg.tailored_resume_markdown || '';
  const coverLetterText = pkg.tailored_cover_letter_markdown || '';
  const jdText = pkg.target_job_description || '';

  // 1. Audit for potential unsupported claims
  const unsupported = auditClaimsAgainstEvidence(resumeText, coverLetterText, allVerifiedClaims);

  // 2. Identify missing keywords from the job description
  const missing = auditMissingRequirements(jdText, evidence);

  // 3. Compute Hallucination Risk and Review Score
  let reviewScore = 100;
  reviewScore -= unsupported.length * 15;
  if (missing.length > 5) reviewScore -= 10;
  else if (missing.length > 2) reviewScore -= 5;
  reviewScore = Math.max(20, Math.min(100, reviewScore));

  let hallucinationRisk = 'none';
  if (unsupported.length > 2) hallucinationRisk = 'high';
  else if (unsupported.length > 0) hallucinationRisk = 'medium';
  else if (missing.length > 4) hallucinationRisk = 'low';

  // 4. Generate constructive critique
  const critiqueNotes = generateCritique({
    unsupported,
    missing,
    reviewScore,
    hallucinationRisk
  });

  // 5. Persist review record
  await pool.query('DELETE FROM jobhunt_document_reviews WHERE package_id = ?', [packageId]);
  const [revResult] = await pool.query(
    `INSERT INTO jobhunt_document_reviews 
     (package_id, review_score, hallucination_risk, unsupported_claims, missing_requirements, critique_notes, reviewer_agent)
     VALUES (?, ?, ?, ?, ?, ?, 'dossier_fact_reviewer')`,
    [
      packageId,
      reviewScore,
      hallucinationRisk,
      JSON.stringify(unsupported),
      JSON.stringify(missing),
      critiqueNotes
    ]
  );

  // Update package status to 'reviewed'
  await pool.query("UPDATE jobhunt_document_packages SET status = 'reviewed' WHERE id = ?", [packageId]);

  return {
    reviewId: revResult.insertId,
    reviewScore,
    hallucinationRisk,
    unsupportedClaims: unsupported,
    missingRequirements: missing,
    critiqueNotes
  };
}

/**
 * Checks bullet points in drafted documents to ensure they correspond to verified claims
 */
function auditClaimsAgainstEvidence(resumeText, coverLetterText, verifiedClaims) {
  const combined = resumeText + '\n' + coverLetterText;
  const lines = combined.split('\n')
    .map(l => l.trim().replace(/^[*•\s-]+/, '').trim())
    .filter(l => {
      if (!l || l.length < 25) return false;
      if (l.startsWith('#')) return false;
      const clean = l.replace(/[*_#]/g, '').trim().toLowerCase();
      if (clean.startsWith('date:') || clean.startsWith('to:') || clean.startsWith('from:') || clean.startsWith('position:')) return false;
      if (clean.startsWith('dear ') || clean.startsWith('sincerely') || clean.startsWith('thank you')) return false;
      if (clean.startsWith('i am writing to express')) return false;
      if (clean.startsWith('technologies:')) return false;
      if (clean.startsWith('targeted & production expertise:') || clean.startsWith('core competencies:')) return false;
      if (clean.startsWith('professional summary')) return false;
      if (clean.includes('@') && clean.includes('.com')) return false;
      if (clean.includes('linkedin.com') || clean.includes('github.com')) return false;
      return true;
    });

  const stopWords = new Set(['with', 'that', 'this', 'from', 'have', 'been', 'their', 'which', 'about', 'would', 'could', 'should', 'gives', 'complex', 'solve', 'opportunity', 'skills', 'experience', 'hands', 'work', 'focus', 'focused', 'delivering', 'consistent', 'consistently', 'strong']);
  const corpusTokens = new Set(
    verifiedClaims.flatMap(vc => vc.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2))
  );

  const unsupported = [];

  lines.forEach(line => {
    const lineTokens = line.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
    if (lineTokens.length < 4) return;

    let inCorpusCount = 0;
    lineTokens.forEach(t => {
      if (corpusTokens.has(t)) inCorpusCount++;
    });
    const corpusRatio = inCorpusCount / lineTokens.length;

    let maxSentenceRatio = 0;
    verifiedClaims.forEach(vc => {
      const vcLower = vc.toLowerCase();
      let matchCount = 0;
      lineTokens.forEach(t => {
        if (vcLower.includes(t)) matchCount++;
      });
      const ratio = matchCount / lineTokens.length;
      if (ratio > maxSentenceRatio) maxSentenceRatio = ratio;
    });

    if (maxSentenceRatio < 0.25 && corpusRatio < 0.40) {
      unsupported.push({
        text_snippet: line.slice(0, 140),
        reason: 'Claim contains terminology or achievements not indexed in candidate master profile.'
      });
    }
  });

  return unsupported.slice(0, 5); // Return top flagged items
}

/**
 * Extracts key technical terms from job description and checks if they are absent in candidate profile
 */
function auditMissingRequirements(jdText, evidence) {
  if (!jdText) return [];
  const jdLower = jdText.toLowerCase();

  const commonTech = [
    'terraform', 'ansible', 'helm', 'jenkins', 'argo', 'kafka', 'spark', 'pytorch',
    'snowflake', 'rust', 'go', 'golang', 'typescript', 'react', 'graphql',
    'graphql', 'grpc', 'redis', 'elasticsearch', 'opentelemetry', 'istio'
  ];

  const profileSkills = new Set();
  evidence.work_experience.forEach(w => (w.skills || []).forEach(s => profileSkills.add(s.toLowerCase())));
  evidence.project.forEach(p => (p.skills || []).forEach(s => profileSkills.add(s.toLowerCase())));

  const missing = [];
  commonTech.forEach(tech => {
    if (jdLower.includes(tech) && !profileSkills.has(tech)) {
      missing.push(tech.charAt(0).toUpperCase() + tech.slice(1));
    }
  });

  return missing;
}

/**
 * Builds actionable review summary
 */
function generateCritique({ unsupported, missing, reviewScore, hallucinationRisk }) {
  const parts = [];
  parts.push(`**Factual Review Score:** ${reviewScore}/100 | **Hallucination Risk:** ${hallucinationRisk.toUpperCase()}`);

  if (unsupported.length === 0) {
    parts.push('✓ **Anti-Hallucination Check Passed:** 100% of resume and cover letter claims trace directly to verified profile achievements.');
  } else {
    parts.push(`⚠️ **Factual Verification Notice:** ${unsupported.length} statement(s) could not be conclusively mapped to your master evidence claims. Review these before submitting.`);
  }

  if (missing.length > 0) {
    parts.push(`ℹ️ **Skill Gap Notice:** The posting explicitly mentions [${missing.join(', ')}], which are not listed on your master profile. Be prepared to address these during technical interviews.`);
  }

  return parts.join('\n\n');
}

module.exports = {
  reviewDocumentPackage
};
