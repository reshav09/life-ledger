/**
 * jobhuntDocuments.js - API Routes for Document Packages, Evidence Base & Follow-ups
 */

const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const { draftDocumentPackage, prepareInputs } = require('../services/jobhuntDocuments');
const { reviewDocumentPackage } = require('../services/jobhuntDocumentReview');
const { renderAtsHtml, renderPdf } = require('../services/jobhuntDocumentRenderer');
const { syncProfileEvidence, getEvidenceBase, listEvidenceClaims, confirmEvidence } = require('../services/jobhuntEvidence');
const { logApplicationEvent, getApplicationEvents, generateFollowupDraft, dueFollowups, updateReminder } = require('../services/jobhuntFollowups');

const { enqueueGeneration, getJob, changeJob } = require('../services/jobhuntGenerationJobs');
const { saveRevision, approvePackage, submitPackage } = require('../services/jobhuntDocumentVersions');

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

// Instant synchronous tailored document package generation
router.post('/generate-instant', async (req, res) => {
  try {
    const { opportunity_id, application_id, custom_job_description, target_org, target_role, force_regenerate } = req.body;
    
    // Check if an existing package already exists for this opportunity unless forced
    if (opportunity_id && !force_regenerate && !custom_job_description) {
      const [existing] = await pool.query(
        'SELECT id FROM jobhunt_document_packages WHERE opportunity_id = ? ORDER BY version DESC, id DESC LIMIT 1',
        [opportunity_id]
      );
      if (existing.length > 0) {
        return res.json({ success: true, package_id: existing[0].id, already_existed: true });
      }
    }
    
    const prepared = await prepareInputs({
      opportunityId: opportunity_id,
      applicationId: application_id,
      customJobDescription: custom_job_description,
      targetOrg: target_org,
      targetRole: target_role,
      useAI: req.body.use_ai === true
    });
    
    const drafted = await draftDocumentPackage({ prepared });
    await reviewDocumentPackage(drafted.packageId);
    
    res.json({ success: true, package_id: drafted.packageId, already_existed: false });
  } catch (err) {
    console.error('Instant generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate new tailored document package
router.post('/generate', async (req,res)=>{
 try{const b=req.body;const job=await enqueueGeneration({opportunityId:b.opportunity_id,applicationId:b.application_id,
   customJobDescription:b.custom_job_description,targetOrg:b.target_org,targetRole:b.target_role,useAI:b.use_ai===true},b.request_key);
   res.status(202).json({job_id:job.id,...job});
 }catch(e){res.status(400).json({error:e.message});}
});
router.get('/jobs/:id',async(req,res)=>{const job=await getJob(req.params.id).catch(()=>null);if(!job)return res.status(404).json({error:'Generation job not found'});res.json(job);});
router.post('/jobs/:id/:action',async(req,res)=>{try{res.json(await changeJob(req.params.id,req.params.action));}catch(e){res.status(400).json({error:e.message});}});

// Update package content (edits to markdown)
router.put('/packages/:id',async(req,res)=>{
 try{if(req.body.status)throw new Error('Use the explicit approval or submission action.');res.json({success:true,...await saveRevision(req.params.id,req.body)});}
 catch(e){res.status(400).json({error:e.message});}
});
router.post('/packages/:id/approve',async(req,res)=>{try{res.json(await approvePackage(req.params.id,req.body));}catch(e){res.status(400).json({error:e.message});}});
router.post('/packages/:id/submit',async(req,res)=>{try{res.json(await submitPackage(req.params.id,req.body));}catch(e){res.status(400).json({error:e.message});}});
router.get('/packages/:id/versions',async(req,res)=>{try{const [[p]]=await pool.query('SELECT id,root_package_id FROM jobhunt_document_packages WHERE id=?',[req.params.id]);if(!p)return res.status(404).json({error:'Package not found'});const root=p.root_package_id || p.id;const [rows]=await pool.query('SELECT id,version,status,created_at,submitted_at FROM jobhunt_document_packages WHERE id=? OR root_package_id=? ORDER BY version DESC',[root,root]);res.json(rows);}catch(e){res.status(500).json({error:e.message});}});
router.get('/packages/:id/pdf/:docType',async(req,res)=>{
 try{const type=req.params.docType;if(!['resume','cover_letter'].includes(type))return res.status(400).json({error:'Invalid document type'});
 const [[p]]=await pool.query('SELECT * FROM jobhunt_document_packages WHERE id=?',[req.params.id]);if(!p)return res.status(404).json({error:'Package not found'});
 const [[artifact]]=await pool.query('SELECT content FROM jobhunt_document_artifacts WHERE package_id=? AND doc_type=?',[p.id,type]);
 const bytes=artifact?.content || await renderPdf({title:`${p.org_name} — ${type}`,contentMarkdown:type==='resume'?p.tailored_resume_markdown:p.tailored_cover_letter_markdown});
 if(!artifact?.content){
   const hash=require('node:crypto').createHash('sha256').update(bytes).digest('hex');
   await pool.query('INSERT IGNORE INTO jobhunt_document_artifacts (package_id,doc_type,sha256,content) VALUES (?,?,?,?)',[p.id,type,hash,bytes]);
   const [[saved]]=await pool.query('SELECT content FROM jobhunt_document_artifacts WHERE package_id=? AND doc_type=?',[p.id,type]);
   if(saved?.content){res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${type}-v${p.version}.pdf"`);return res.send(saved.content);}
 }
 res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${type}-v${p.version}.pdf"`);res.send(bytes);
 }catch(e){res.status(500).json({error:e.message});}
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
    const { docType } = req.params;
    if(!['resume','cover_letter'].includes(docType))return res.status(400).send('Invalid document type');
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
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'");
    res.send(html);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ── 2. Evidence Base ──

router.get('/evidence/claims',async(req,res)=>{try{res.json(await listEvidenceClaims());}catch(e){res.status(500).json({error:e.message});}});
router.post('/evidence/confirm',async(req,res)=>{try{res.json(await confirmEvidence(req.body.ids));}catch(e){res.status(400).json({error:e.message});}});
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
router.get('/reminders',async(req,res)=>{try{res.json(await dueFollowups());}catch(e){res.status(500).json({error:e.message});}});
router.post('/reminders/:id',async(req,res)=>{try{res.json(await updateReminder(req.params.id,req.body));}catch(e){res.status(400).json({error:e.message});}});

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

