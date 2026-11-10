/**
 * jobhuntDocuments.js - API Routes for Document Packages, Evidence Base & Follow-ups
 */

const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const { draftDocumentPackage } = require('../services/jobhuntDocuments');
const { reviewDocumentPackage } = require('../services/jobhuntDocumentReview');
const { renderAtsHtml } = require('../services/jobhuntDocumentRenderer');
const { syncProfileEvidence, getEvidenceBase } = require('../services/jobhuntEvidence');
const { logApplicationEvent, getApplicationEvents, generateFollowupDraft } = require('../services/jobhuntFollowups');

// ── 1. Document Packages ──

// List packages
router.get('/packages', async (req, res) => {
  try {
    const { opportunity_id, application_id } = req.query;
    let sql = 'SELECT * FROM jobhunt_document_packages';
    const params = [];
    const conds = [];
    if (opportunity_id) { conds.push('opportunity_id = ?'); params.push(opportunity_id); }
    if (application_id) { conds.push('application_id = ?'); params.push(application_id); }
    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    sql += ' ORDER BY id DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get package by ID with review details
router.get('/packages/:id', async (req, res) => {
  try {
    const [packages] = await pool.query('SELECT * FROM jobhunt_document_packages WHERE id = ?', [req.params.id]);
    if (packages.length === 0) return res.status(404).json({ error: 'Package not found' });
    const pkg = packages[0];

    const [reviews] = await pool.query('SELECT * FROM jobhunt_document_reviews WHERE package_id = ? ORDER BY id DESC LIMIT 1', [pkg.id]);
    const review = reviews[0] || null;

    res.json({
      ...pkg,
      key_skills_addressed: pkg.key_skills_addressed ? (typeof pkg.key_skills_addressed === 'string' ? JSON.parse(pkg.key_skills_addressed) : pkg.key_skills_addressed) : null,
      evidence_claims_used: pkg.evidence_claims_used ? (typeof pkg.evidence_claims_used === 'string' ? JSON.parse(pkg.evidence_claims_used) : pkg.evidence_claims_used) : [],
      latest_review: review ? {
        ...review,
        unsupported_claims: review.unsupported_claims ? (typeof review.unsupported_claims === 'string' ? JSON.parse(review.unsupported_claims) : review.unsupported_claims) : [],
        missing_requirements: review.missing_requirements ? (typeof review.missing_requirements === 'string' ? JSON.parse(review.missing_requirements) : review.missing_requirements) : []
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate new tailored document package
router.post('/generate', async (req, res) => {
  try {
    const { opportunity_id, application_id, custom_job_description, target_org, target_role } = req.body;
    const drafted = await draftDocumentPackage({
      opportunityId: opportunity_id,
      applicationId: application_id,
      customJobDescription: custom_job_description,
      targetOrg: target_org,
      targetRole: target_role
    });

    // Automatically trigger initial review
    const review = await reviewDocumentPackage(drafted.packageId);

    // If linked to an application, log an event
    if (application_id) {
      await logApplicationEvent({
        applicationId: application_id,
        eventType: 'package_drafted',
        title: `Drafted tailored package v1 for ${drafted.orgName}`,
        metadata: { packageId: drafted.packageId, score: review.reviewScore }
      });
    }

    res.json({
      success: true,
      package_id: drafted.packageId,
      org_name: drafted.orgName,
      role_title: drafted.roleTitle,
      review_score: review.reviewScore,
      hallucination_risk: review.hallucinationRisk
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update package content (edits to markdown)
router.put('/packages/:id', async (req, res) => {
  try {
    const { tailored_resume_markdown, tailored_cover_letter_markdown, status } = req.body;
    await pool.query(
      `UPDATE jobhunt_document_packages SET
         tailored_resume_markdown = COALESCE(?, tailored_resume_markdown),
         tailored_cover_letter_markdown = COALESCE(?, tailored_cover_letter_markdown),
         status = COALESCE(?, status)
       WHERE id = ?`,
      [tailored_resume_markdown, tailored_cover_letter_markdown, status, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Re-run anti-hallucination review
router.post('/packages/:id/review', async (req, res) => {
  try {
    const review = await reviewDocumentPackage(req.params.id);
    res.json({ success: true, review });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Render ATS printable HTML
router.get('/packages/:id/render/:docType', async (req, res) => {
  try {
    const { docType } = req.params; // 'resume' or 'cover_letter'
    const [packages] = await pool.query('SELECT * FROM jobhunt_document_packages WHERE id = ?', [req.params.id]);
    if (packages.length === 0) return res.status(404).send('Package not found');
    const pkg = packages[0];

    const content = docType === 'cover_letter' ? pkg.tailored_cover_letter_markdown : pkg.tailored_resume_markdown;
    const title = `${pkg.org_name} - ${docType === 'cover_letter' ? 'Cover Letter' : 'Resume'} (${pkg.role_title})`;

    const html = renderAtsHtml({
      title,
      contentMarkdown: content,
      type: docType
    });

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ── 2. Evidence Base ──

router.get('/evidence', async (req, res) => {
  try {
    const evidence = await getEvidenceBase();
    res.json(evidence);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/evidence/sync', async (req, res) => {
  try {
    const result = await syncProfileEvidence();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 3. Application Events & Follow-ups ──

router.get('/applications/:id/events', async (req, res) => {
  try {
    const events = await getApplicationEvents(req.params.id);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/applications/:id/events', async (req, res) => {
  try {
    const { event_type, title, notes, metadata } = req.body;
    const result = await logApplicationEvent({
      applicationId: req.params.id,
      eventType: event_type,
      title,
      notes,
      metadata
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/applications/:id/followup-draft', async (req, res) => {
  try {
    const { type } = req.query; // 'check_in' or 'thank_you'
    const draft = await generateFollowupDraft({
      applicationId: req.params.id,
      draftType: type || 'check_in'
    });
    res.json(draft);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
