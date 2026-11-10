const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../db/db');
const { extractFromText, extractFromPDF } = require('../services/jobhuntExtractor');
const { fetchWebpage, pollOrganization, pollAllActiveOrgs, startBatchCrawl, getCrawlProgress } = require('../services/jobhuntCrawler');
const { computeOpportunityScore } = require('../services/jobhuntScoring');

// In-memory file upload handler (max 20MB for recruitment PDFs)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

/**
 * Helper to compute live score preview against user profile.
 */
async function scorePreview(oppItem, org = null) {
  try {
    const [[profile]] = await pool.query('SELECT * FROM jobhunt_profile WHERE id = 1');
    const [settingRows] = await pool.query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'jobhunt_threshold_%'");
    const thresholdMap = Object.fromEntries(settingRows.map(r => [r.key, Number(r.value)]));
    const thresholds = {
      apply_now: thresholdMap.jobhunt_threshold_apply_now || 75,
      worth_applying: thresholdMap.jobhunt_threshold_worth_applying || 55,
      investigate: thresholdMap.jobhunt_threshold_investigate || 35
    };
    return computeOpportunityScore(profile || {}, oppItem, org, thresholds);
  } catch (err) {
    console.warn('Score preview calculation failed:', err.message);
    return {
      opportunity_score: 50,
      recommendation: 'worth_applying',
      eligibility_pct: 70,
      profile_match_pct: 50
    };
  }
}

/**
 * Helper to find or create an organization by name.
 */
async function findOrCreateOrg(orgName, defaultSector = 'IT / Tech') {
  if (!orgName || !orgName.trim()) return null;
  const name = orgName.trim();

  const [existing] = await pool.query(
    'SELECT id, name, sector FROM jobhunt_organizations WHERE name = ? OR short_name = ? LIMIT 1',
    [name, name]
  );

  if (existing.length > 0) return existing[0];

  const [res] = await pool.query(
    `INSERT INTO jobhunt_organizations (name, short_name, sector, org_type, quality_score, is_active)
     VALUES (?, ?, ?, 'company', 75, 1)`,
    [name, name.slice(0, 50), defaultSector]
  );

  return { id: res.insertId, name, sector: defaultSector };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. INGEST: Raw Text / Pasted Job Description
// ─────────────────────────────────────────────────────────────────────────────
router.post('/ingest/text', async (req, res) => {
  try {
    const { text, org_id, org_name, source_url } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required for extraction' });
    }

    let org = null;
    if (org_id) {
      const [[found]] = await pool.query('SELECT * FROM jobhunt_organizations WHERE id = ?', [org_id]);
      org = found;
    }

    const items = await extractFromText(text, {
      org_id: org?.id,
      org_name: org?.name || org_name,
      source_url: source_url || '',
      source_type: 'ai_ingest'
    });

    // Attach live score preview to each item
    const enriched = await Promise.all(
      items.map(async (item) => {
        const previewScore = await scorePreview(item, org);
        return { ...item, preview_score: previewScore };
      })
    );

    res.json({
      success: true,
      count: enriched.length,
      opportunities: enriched
    });
  } catch (err) {
    console.error('Ingest text error:', err);
    res.status(500).json({ error: err.message || 'Failed to extract from text' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. INGEST: URL (HTML Careers Page or Direct PDF link)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/ingest/url', async (req, res) => {
  try {
    const { url, org_id, org_name } = req.body;
    if (!url || !url.trim()) {
      return res.status(400).json({ error: 'Valid URL is required' });
    }

    let org = null;
    if (org_id) {
      const [[found]] = await pool.query('SELECT * FROM jobhunt_organizations WHERE id = ?', [org_id]);
      org = found;
    }

    const crawl = await fetchWebpage(url.trim());
    let items = [];

    if (crawl.isPdf) {
      items = await extractFromPDF(crawl.base64, 'application/pdf', {
        org_id: org?.id,
        org_name: org?.name || org_name,
        source_url: url,
        source_type: 'pdf_ingest'
      });
    } else {
      items = await extractFromText(crawl.cleanText, {
        org_id: org?.id,
        org_name: org?.name || org_name,
        source_url: url,
        source_type: 'crawler'
      });
    }

    const enriched = await Promise.all(
      items.map(async (item) => {
        const previewScore = await scorePreview(item, org);
        return { ...item, preview_score: previewScore };
      })
    );

    res.json({
      success: true,
      url,
      hash: crawl.hash,
      count: enriched.length,
      opportunities: enriched
    });
  } catch (err) {
    console.error('Ingest URL error:', err);
    res.status(500).json({ error: err.message || 'Failed to extract from URL' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. INGEST: Upload PDF / File
// ─────────────────────────────────────────────────────────────────────────────
router.post('/ingest/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { org_id, org_name, source_url } = req.body;
    const base64Data = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'application/pdf';

    let org = null;
    if (org_id) {
      const [[found]] = await pool.query('SELECT * FROM jobhunt_organizations WHERE id = ?', [org_id]);
      org = found;
    }

    let items = [];
    if (mimeType === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf')) {
      items = await extractFromPDF(base64Data, 'application/pdf', {
        org_id: org?.id,
        org_name: org?.name || org_name,
        source_url: source_url || '',
        fileName: req.file.originalname
      });
    } else if (mimeType.startsWith('text/')) {
      const textContent = req.file.buffer.toString('utf-8');
      items = await extractFromText(textContent, {
        org_id: org?.id,
        org_name: org?.name || org_name,
        source_url: source_url || '',
        source_type: 'ai_ingest'
      });
    } else {
      // Direct multimodal for image or other documents
      items = await extractFromPDF(base64Data, mimeType, {
        org_id: org?.id,
        org_name: org?.name || org_name,
        source_url: source_url || '',
        fileName: req.file.originalname
      });
    }

    const enriched = await Promise.all(
      items.map(async (item) => {
        const previewScore = await scorePreview(item, org);
        return { ...item, preview_score: previewScore };
      })
    );

    res.json({
      success: true,
      file_name: req.file.originalname,
      count: enriched.length,
      opportunities: enriched
    });
  } catch (err) {
    console.error('Ingest upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to extract from uploaded file' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CONFIRM: Batch Insert Reviewed Opportunities
// ─────────────────────────────────────────────────────────────────────────────
router.post('/ingest/confirm', async (req, res) => {
  try {
    const { opportunities } = req.body;
    if (!Array.isArray(opportunities) || opportunities.length === 0) {
      return res.status(400).json({ error: 'opportunities array is required' });
    }

    const [[profile]] = await pool.query('SELECT * FROM jobhunt_profile WHERE id = 1');
    const [settingRows] = await pool.query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'jobhunt_threshold_%'");
    const thresholdMap = Object.fromEntries(settingRows.map(r => [r.key, Number(r.value)]));
    const thresholds = {
      apply_now: thresholdMap.jobhunt_threshold_apply_now || 75,
      worth_applying: thresholdMap.jobhunt_threshold_worth_applying || 55,
      investigate: thresholdMap.jobhunt_threshold_investigate || 35
    };

    const saved = [];

    for (const opp of opportunities) {
      let orgId = opp.org_id;

      // If org_name is present but no org_id, resolve or create
      if (!orgId && opp.org_name) {
        const orgRecord = await findOrCreateOrg(opp.org_name);
        orgId = orgRecord?.id || null;
      }

      let org = null;
      if (orgId) {
        const [[found]] = await pool.query('SELECT * FROM jobhunt_organizations WHERE id = ?', [orgId]);
        org = found;
      }

      const scores = computeOpportunityScore(profile || {}, opp, org, thresholds);

      const oppCat = opp.category_group || org?.category_group || 'private_in';
      const oppCountry = opp.country || org?.country || 'India';
      const oppRegion = opp.region || org?.region || 'India';
      const oppVisa = opp.visa_sponsored != null ? (opp.visa_sponsored ? 1 : 0) : (org?.visa_sponsored ? 1 : 0);
      const oppCurrency = opp.currency || org?.currency || 'INR';
      const oppCompDisplay = opp.compensation_display || '';
      const oppPostedDate = opp.posted_date || new Date().toISOString().split('T')[0];

      const [result] = await pool.query(
        `INSERT INTO jobhunt_opportunities (
          org_id, title, source_url, source_type,
          required_degree, required_branch, min_experience_years,
          max_age, min_age, required_skills,
          vacancies, location, pay_scale, ctc_min, ctc_max,
          application_deadline, exam_date, apply_url,
          job_type, category, raw_text, notes,
          eligibility_pct, profile_match_pct, compensation_score,
          career_potential_score, competition_signal, application_difficulty_score,
          org_quality_score, deadline_urgency_score, opportunity_score, recommendation,
          requires_gate, is_new, is_verified_active, is_active_link,
          category_group, country, region, visa_sponsored, currency, compensation_display,
          posted_date
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, 1, 1, 1,
          ?, ?, ?, ?, ?, ?,
          ?
        )`,
        [
          orgId || null,
          opp.title || 'Untitled Opportunity',
          opp.source_url || '',
          opp.source_type || 'ai_ingest',
          opp.required_degree || '',
          opp.required_branch || '',
          opp.min_experience_years ?? null,
          opp.max_age ?? null,
          opp.min_age ?? null,
          JSON.stringify(opp.required_skills || []),
          opp.vacancies ?? null,
          opp.location || '',
          opp.pay_scale || '',
          opp.ctc_min ?? null,
          opp.ctc_max ?? null,
          opp.application_deadline || null,
          opp.exam_date || null,
          opp.apply_url || opp.source_url || '',
          opp.job_type || (org?.org_type?.includes('PSU') ? 'psu' : 'private'),
          opp.category || 'job',
          opp.raw_summary || '',
          opp.highlights || '',
          scores.eligibility_pct,
          scores.profile_match_pct,
          scores.compensation_score,
          scores.career_potential_score,
          scores.competition_signal,
          scores.application_difficulty_score,
          scores.org_quality_score,
          scores.deadline_urgency_score,
          scores.opportunity_score,
          scores.recommendation,
          opp.requires_gate ? 1 : 0,
          oppCat,
          oppCountry,
          oppRegion,
          oppVisa,
          oppCurrency,
          oppCompDisplay,
          oppPostedDate
        ]
      );

      saved.push({
        id: result.insertId,
        title: opp.title,
        org_name: opp.org_name || org?.name,
        opportunity_score: scores.opportunity_score,
        recommendation: scores.recommendation
      });
    }

    res.json({
      success: true,
      saved_count: saved.length,
      saved
    });
  } catch (err) {
    console.error('Confirm opportunities error:', err);
    res.status(500).json({ error: err.message || 'Failed to save opportunities' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. CRAWLER: On-Demand Organization Poll
// ─────────────────────────────────────────────────────────────────────────────
router.post('/crawler/poll/:orgId', async (req, res) => {
  try {
    const result = await pollOrganization(req.params.orgId);
    res.json({ success: true, result });
  } catch (err) {
    console.error('Poll org error:', err);
    res.status(500).json({ error: err.message || 'Failed to poll organization' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. CRAWLER: Batch Poll Active Organizations (Non-blocking background runner)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/crawler/poll-all', async (req, res) => {
  try {
    const { all, limit } = req.body || {};
    const result = await startBatchCrawl({ all: all === true, limit: limit || 15 });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Poll all orgs error:', err);
    res.status(500).json({ error: err.message || 'Failed to start crawler' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. CRAWLER: Status & Recent Hashes
// ─────────────────────────────────────────────────────────────────────────────
router.get('/crawler/status', async (req, res) => {
  try {
    const [[countRow]] = await pool.query(
      `SELECT
        COUNT(*) as total_orgs,
        SUM(CASE WHEN careers_url != '' OR notification_url != '' OR pdf_page_url != '' THEN 1 ELSE 0 END) as monitored_orgs,
        SUM(CASE WHEN last_checked_at IS NOT NULL THEN 1 ELSE 0 END) as polled_orgs
       FROM jobhunt_organizations WHERE is_active = 1`
    );

    const [hashes] = await pool.query(
      `SELECT h.*, o.name as org_name
       FROM jobhunt_content_hashes h
       JOIN jobhunt_organizations o ON h.org_id = o.id
       ORDER BY h.first_seen_at DESC LIMIT 15`
    );

    const [[settingRow]] = await pool.query("SELECT `value` FROM settings WHERE `key` = 'jobhunt_auto_poll_enabled'");

    res.json({
      auto_poll_enabled: settingRow ? settingRow.value === '1' || settingRow.value === 'true' : false,
      total_orgs: countRow.total_orgs || 0,
      monitored_orgs: countRow.monitored_orgs || 0,
      polled_orgs: countRow.polled_orgs || 0,
      recent_hashes: hashes,
      crawl_progress: getCrawlProgress()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 8. CRAWLER: Source Health Telemetry Panel ──
router.get('/crawler/source-health', async (req, res) => {
  try {
    const [orgs] = await pool.query(`
      SELECT 
        id, name, short_name, sector, category_group, country, region,
        ats_type, ats_id, careers_url, last_checked_at, last_successful_pull,
        last_jobs_found, last_crawl_status, quality_score, is_active
      FROM jobhunt_organizations
      ORDER BY 
        CASE WHEN ats_type != 'custom_scrape' AND ats_id IS NOT NULL THEN 0 ELSE 1 END,
        last_successful_pull DESC,
        name ASC
    `);

    let atsCount = 0;
    let healthyCount = 0;
    let warningCount = 0;
    let totalJobsTracked = 0;

    for (const org of orgs) {
      if (org.ats_type && org.ats_type !== 'custom_scrape') atsCount++;
      if (org.last_crawl_status === 'success') healthyCount++;
      else if (org.last_crawl_status && org.last_crawl_status.startsWith('error')) warningCount++;
      totalJobsTracked += (org.last_jobs_found || 0);
    }

    res.json({
      summary: {
        total_orgs: orgs.length,
        ats_connected_count: atsCount,
        healthy_count: healthyCount,
        warning_count: warningCount,
        total_jobs_tracked: totalJobsTracked
      },
      organizations: orgs
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
