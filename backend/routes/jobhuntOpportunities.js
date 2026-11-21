const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const {syncOpportunityState,recordStatus}=require('../services/jobhuntApplicationState');
const { computeOpportunityScore, captureScoringFeatures } = require('../services/jobhuntScoring');
const { verifyAllOpportunities, verifyOpportunity } = require('../services/jobhuntVerification');
const { runOpportunitiesLifecycle } = require('../services/jobhuntLifecycle');

/**
 * Helper: fetch profile for scoring.
 */
async function getProfile() {
  const [rows] = await pool.query('SELECT * FROM jobhunt_profile WHERE id = 1');
  return rows[0] || {};
}

/**
 * Helper: fetch org by id.
 */
async function getOrg(orgId) {
  if (!orgId) return null;
  const [rows] = await pool.query('SELECT * FROM jobhunt_organizations WHERE id = ?', [orgId]);
  return rows[0] || null;
}

/**
 * Helper: fetch custom scoring thresholds from settings table.
 */
async function getScoringThresholds() {
  try {
    const [rows] = await pool.query(
      "SELECT `key`, `value` FROM settings WHERE `key` IN ('jobhunt_threshold_apply_now', 'jobhunt_threshold_worth_applying', 'jobhunt_threshold_investigate')"
    );
    const map = Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]));
    return {
      apply_now: map.jobhunt_threshold_apply_now || 75,
      worth_applying: map.jobhunt_threshold_worth_applying || 55,
      investigate: map.jobhunt_threshold_investigate || 35
    };
  } catch {
    return { apply_now: 75, worth_applying: 55, investigate: 35 };
  }
}

/**
 * Helper: auto-score an opportunity row and persist scores.
 */
async function scoreAndPersist(oppId, preloadedThresholds = null) {
  const [rows] = await pool.query('SELECT * FROM jobhunt_opportunities WHERE id = ?', [oppId]);
  if (rows.length === 0) return null;
  const opp = rows[0];
  const profile = await getProfile();
  const org = await getOrg(opp.org_id);
  const thresholds = preloadedThresholds || await getScoringThresholds();
  const scores = computeOpportunityScore(profile, opp, org, thresholds);

  await pool.query(
    `UPDATE jobhunt_opportunities SET
      eligibility_pct = ?, profile_match_pct = ?, compensation_score = ?,
      career_potential_score = ?, competition_signal = ?, application_difficulty_score = ?,
      org_quality_score = ?, deadline_urgency_score = ?,
      opportunity_score = ?, recommendation = ?
     WHERE id = ?`,
    [
      scores.eligibility_pct, scores.profile_match_pct, scores.compensation_score,
      scores.career_potential_score, scores.competition_signal, scores.application_difficulty_score,
      scores.org_quality_score, scores.deadline_urgency_score,
      scores.opportunity_score, scores.recommendation,
      oppId
    ]
  );

  return { ...opp, ...scores };
}

// ── Helper: Retrieve filtered top opportunities and total match count for radar ──
async function getRadarOpportunities({ filter = 'all', category_group = '', sector = '', limit = 50 } = {}) {
  const whereClauses = [
    'op.is_archived = 0',
    '(op.is_verified_active = 1 AND (op.is_active_link != 0 OR op.is_active_link IS NULL))',
    '(op.visa_sponsored = 0 OR op.visa_sponsored IS NULL)',
    "(op.category_group != 'quant_hft' OR op.category_group IS NULL)",
    "(op.country = 'India' OR op.location LIKE '%India%' OR op.location LIKE '%Remote%' OR op.location LIKE '%Anywhere%' OR op.country IS NULL)",
    '(op.ctc_min >= 500000 OR op.ctc_max >= 500000 OR (op.ctc_min IS NULL AND op.ctc_max IS NULL))'
  ];
  const params = [];

  if (filter === 'apply_now') {
    whereClauses.push("op.recommendation = 'apply_now'");
  } else if (filter === 'worth_applying' || filter === 'worth_it') {
    whereClauses.push("op.recommendation = 'worth_applying'");
  } else if (filter === 'investigate') {
    whereClauses.push("op.recommendation = 'investigate'");
  } else if (filter === 'applied') {
    whereClauses.push("(op.is_applied = 1 OR EXISTS (SELECT 1 FROM applications a WHERE (a.opportunity_id = op.id OR (a.role = op.title AND a.name = org.name)) AND a.status IN ('applied', 'interview', 'offer', 'rejected', 'cleared')))");
  } else if (filter === 'due_7d') {
    whereClauses.push("(op.recommendation != 'ignore' OR op.recommendation IS NULL)");
    whereClauses.push("op.application_deadline BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)");
  } else if (filter === 'due_14d') {
    whereClauses.push("(op.recommendation != 'ignore' OR op.recommendation IS NULL)");
    whereClauses.push("op.application_deadline BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 14 DAY)");
  } else {
    // 'all' / default
    whereClauses.push("(op.recommendation != 'ignore' OR op.recommendation IS NULL)");
  }

  if (category_group) {
    if (category_group === 'remote') {
      whereClauses.push("(op.location LIKE '%Remote%' OR op.location LIKE '%Anywhere%' OR op.country LIKE '%Remote%')");
    } else if (category_group.includes(',')) {
      const groups = category_group.split(',').map(s => s.trim()).filter(Boolean);
      if (groups.length > 0) {
        whereClauses.push(`op.category_group IN (${groups.map(() => '?').join(',')})`);
        params.push(...groups);
      }
    } else {
      whereClauses.push('op.category_group = ?');
      params.push(category_group);
    }
  }

  if (sector) {
    whereClauses.push('org.sector = ?');
    params.push(sector);
  }

  const whereSql = whereClauses.join(' AND ');

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total_matches
     FROM jobhunt_opportunities op
     LEFT JOIN jobhunt_organizations org ON op.org_id = org.id
     WHERE ${whereSql}`,
    params
  );
  const total_matches = countRows[0]?.total_matches || 0;

  let orderSql = 'op.opportunity_score DESC, op.application_deadline ASC';
  if (filter === 'applied') {
    orderSql = "COALESCE((SELECT a.id FROM applications a WHERE (a.opportunity_id = op.id OR (a.role = op.title AND a.name = org.name)) AND a.status IN ('applied', 'interview', 'offer', 'rejected', 'cleared') ORDER BY a.id DESC LIMIT 1), op.id) DESC, op.opportunity_score DESC";
  } else if (filter === 'due_7d' || filter === 'due_14d') {
    orderSql = 'op.application_deadline ASC, op.opportunity_score DESC';
  }

  const queryParams = [...params, Math.min(Math.max(Number(limit) || 50, 1), 200)];
  const [rows] = await pool.query(
    `SELECT op.*, org.name AS org_name, org.sector AS org_sector, org.careers_url AS org_careers_url, org.website AS org_website,
       (SELECT a.status FROM applications a WHERE (a.opportunity_id = op.id OR (a.role = op.title AND a.name = org.name)) AND a.status IN ('applied', 'interview', 'offer', 'rejected', 'cleared') ORDER BY a.id DESC LIMIT 1) AS application_status,
       (SELECT a.id FROM applications a WHERE (a.opportunity_id = op.id OR (a.role = op.title AND a.name = org.name)) AND a.status IN ('applied', 'interview', 'offer', 'rejected', 'cleared') ORDER BY a.id DESC LIMIT 1) AS application_id
     FROM jobhunt_opportunities op
     LEFT JOIN jobhunt_organizations org ON op.org_id = org.id
     WHERE ${whereSql}
     ORDER BY ${orderSql}
     LIMIT ?`,
    queryParams
  );

  return { rows, total_matches };
}

// ── Dashboard aggregation ──
router.get('/dashboard', async (req, res) => {
  try {
    const verifiedCondition = "op.is_archived = 0 AND op.is_verified_active = 1 AND (op.is_active_link != 0 OR op.is_active_link IS NULL) AND (op.visa_sponsored = 0 OR op.visa_sponsored IS NULL) AND (op.category_group != 'quant_hft' OR op.category_group IS NULL) AND (op.country = 'India' OR op.location LIKE '%India%' OR op.location LIKE '%Remote%' OR op.location LIKE '%Anywhere%' OR op.country IS NULL) AND (op.ctc_min >= 500000 OR op.ctc_max >= 500000 OR (op.ctc_min IS NULL AND op.ctc_max IS NULL))";
    const [total] = await pool.query(`SELECT COUNT(*) AS cnt FROM jobhunt_opportunities op WHERE ${verifiedCondition}`);
    const [applyNow] = await pool.query(`SELECT COUNT(*) AS cnt FROM jobhunt_opportunities op WHERE op.recommendation = 'apply_now' AND ${verifiedCondition}`);
    const [worthApplying] = await pool.query(`SELECT COUNT(*) AS cnt FROM jobhunt_opportunities op WHERE op.recommendation = 'worth_applying' AND ${verifiedCondition}`);
    const [investigate] = await pool.query(`SELECT COUNT(*) AS cnt FROM jobhunt_opportunities op WHERE op.recommendation = 'investigate' AND ${verifiedCondition}`);
    const [appliedCnt] = await pool.query(`SELECT COUNT(*) AS cnt FROM jobhunt_opportunities op WHERE (op.is_applied = 1 OR op.id IN (SELECT DISTINCT opportunity_id FROM applications WHERE opportunity_id IS NOT NULL AND status IN ('applied', 'interview', 'offer', 'rejected', 'cleared'))) AND ${verifiedCondition}`);

    const now = new Date().toISOString().slice(0, 10);
    const [d7] = await pool.query(`SELECT COUNT(*) AS cnt FROM jobhunt_opportunities op WHERE op.application_deadline BETWEEN ? AND DATE_ADD(?, INTERVAL 7 DAY) AND ${verifiedCondition}`, [now, now]);
    const [d14] = await pool.query(`SELECT COUNT(*) AS cnt FROM jobhunt_opportunities op WHERE op.application_deadline BETWEEN ? AND DATE_ADD(?, INTERVAL 14 DAY) AND ${verifiedCondition}`, [now, now]);
    const [d30] = await pool.query(`SELECT COUNT(*) AS cnt FROM jobhunt_opportunities op WHERE op.application_deadline BETWEEN ? AND DATE_ADD(?, INTERVAL 30 DAY) AND ${verifiedCondition}`, [now, now]);

    const [sectorBreakdown] = await pool.query(
      `SELECT o.sector, COUNT(*) AS cnt
       FROM jobhunt_opportunities op
       LEFT JOIN jobhunt_organizations o ON op.org_id = o.id
       WHERE ${verifiedCondition}
       GROUP BY o.sector ORDER BY cnt DESC`
    );

    const [catRows] = await pool.query(
      `SELECT op.category_group, COUNT(*) AS cnt
       FROM jobhunt_opportunities op
       WHERE ${verifiedCondition} AND (op.recommendation != 'ignore' OR op.recommendation IS NULL) AND (op.eligibility_pct IS NULL OR op.eligibility_pct > 0)
       GROUP BY op.category_group`
    );
    const [remoteRow] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM jobhunt_opportunities op
       WHERE ${verifiedCondition} AND (op.recommendation != 'ignore' OR op.recommendation IS NULL) AND (op.eligibility_pct IS NULL OR op.eligibility_pct > 0)
       AND (op.location LIKE '%Remote%' OR op.location LIKE '%Anywhere%' OR op.country LIKE '%Remote%')`
    );
    const [countryRows] = await pool.query(
      `SELECT DISTINCT op.country
       FROM jobhunt_opportunities op
       WHERE ${verifiedCondition} AND op.country IS NOT NULL AND op.country != ''
       ORDER BY op.country ASC`
    );

    const categoryCounts = {
      all: total[0].cnt,
      startup: 0,
      research_internship: 0,
      psu: 0,
      govt: 0,
      private_in: 0,
      service_tech: 0,
      research: 0,
      remote: remoteRow[0]?.cnt || 0,
      'research,research_internship': 0,
      'private_in,service_tech': 0
    };
    catRows.forEach(r => {
      if (r.category_group) {
        categoryCounts[r.category_group] = (categoryCounts[r.category_group] || 0) + r.cnt;
      }
    });
    categoryCounts['research,research_internship'] = (categoryCounts['research'] || 0) + (categoryCounts['research_internship'] || 0);
    categoryCounts['private_in,service_tech'] = (categoryCounts['private_in'] || 0) + (categoryCounts['service_tech'] || 0);

    const { filter = 'all', category_group = '', sector = '', limit = 50 } = req.query;
    const { rows: topOpps, total_matches } = await getRadarOpportunities({ filter, category_group, sector, limit });

    const [recentOpps] = await pool.query(
      `SELECT op.*, org.name AS org_name, org.careers_url AS org_careers_url, org.website AS org_website,
         (SELECT a.status FROM applications a WHERE (a.opportunity_id = op.id OR (a.role = op.title AND a.name = org.name)) AND a.status IN ('applied', 'interview', 'offer', 'rejected', 'cleared') ORDER BY a.id DESC LIMIT 1) AS application_status,
         (SELECT a.id FROM applications a WHERE (a.opportunity_id = op.id OR (a.role = op.title AND a.name = org.name)) AND a.status IN ('applied', 'interview', 'offer', 'rejected', 'cleared') ORDER BY a.id DESC LIMIT 1) AS application_id
       FROM jobhunt_opportunities op
       LEFT JOIN jobhunt_organizations org ON op.org_id = org.id
       WHERE ${verifiedCondition}
       ORDER BY op.opportunity_score DESC, op.discovered_at DESC
       LIMIT 5`
    );

    res.json({
      stats: {
        total: total[0].cnt,
        apply_now: applyNow[0].cnt,
        worth_applying: worthApplying[0].cnt,
        investigate: investigate[0].cnt,
        applied: appliedCnt[0].cnt,
        deadlines_7d: d7[0].cnt,
        deadlines_14d: d14[0].cnt,
        deadlines_30d: d30[0].cnt
      },
      category_counts: categoryCounts,
      countries: countryRows.map(r => r.country),
      sector_breakdown: sectorBreakdown,
      top_opportunities: topOpps,
      total_matches,
      recent_opportunities: recentOpps
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Dedicated fast live-filter endpoint for dashboard radar ──
router.get('/top', async (req, res) => {
  try {
    const { filter = 'all', category_group = '', sector = '', limit = 50 } = req.query;
    const { rows: opportunities, total_matches } = await getRadarOpportunities({ filter, category_group, sector, limit });
    res.json({ opportunities, total_matches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── List opportunities ──
router.get('/', async (req, res) => {
  try {
    // Automatically purge expired deadlines & archive stale private/govt posts before listing
    await runOpportunitiesLifecycle();

    const {
      recommendation, job_type, category, is_archived, q, sort,
      include_ignored, category_group, country, visa_sponsored, posted_within,
      deadline
    } = req.query;

    let sql = `SELECT op.*, org.name AS org_name, org.sector AS org_sector, org.short_name AS org_short_name, org.careers_url AS org_careers_url, org.website AS org_website,
                 (SELECT a.status FROM applications a WHERE (a.opportunity_id = op.id OR (a.role = op.title AND a.name = org.name)) AND a.status IN ('applied', 'interview', 'offer', 'rejected', 'cleared') ORDER BY a.id DESC LIMIT 1) AS application_status,
                 (SELECT a.id FROM applications a WHERE (a.opportunity_id = op.id OR (a.role = op.title AND a.name = org.name)) AND a.status IN ('applied', 'interview', 'offer', 'rejected', 'cleared') ORDER BY a.id DESC LIMIT 1) AS application_id
               FROM jobhunt_opportunities op
               LEFT JOIN jobhunt_organizations org ON op.org_id = org.id`;
    const conditions = [];
    const params = [];

    if (category_group) {
      if (category_group === 'remote') {
        conditions.push("(op.location LIKE '%Remote%' OR op.location LIKE '%Anywhere%' OR op.country LIKE '%Remote%')");
      } else if (category_group.includes(',')) {
        const groups = category_group.split(',').map((s) => s.trim()).filter(Boolean);
        if (groups.length > 0) {
          conditions.push(`op.category_group IN (${groups.map(() => '?').join(',')})`);
          params.push(...groups);
        }
      } else {
        conditions.push('op.category_group = ?');
        params.push(category_group);
      }
    }

    if (country) {
      conditions.push('op.country = ?');
      params.push(country);
    }

    if (visa_sponsored != null && visa_sponsored !== '') {
      conditions.push('op.visa_sponsored = ?');
      params.push(Number(visa_sponsored));
    }

    if (posted_within === '7') {
      conditions.push('(op.posted_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) OR (op.posted_date IS NULL AND op.discovered_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)))');
    } else if (posted_within === '15') {
      conditions.push('(op.posted_date >= DATE_SUB(CURDATE(), INTERVAL 15 DAY) OR (op.posted_date IS NULL AND op.discovered_at >= DATE_SUB(NOW(), INTERVAL 15 DAY)))');
    } else if (posted_within === '20') {
      conditions.push('(op.posted_date >= DATE_SUB(CURDATE(), INTERVAL 20 DAY) OR (op.posted_date IS NULL AND op.discovered_at >= DATE_SUB(NOW(), INTERVAL 20 DAY)))');
    }

    if (deadline === '7') {
      conditions.push('op.application_deadline BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)');
    } else if (deadline === '14') {
      conditions.push('op.application_deadline BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 14 DAY)');
    } else if (deadline === '30') {
      conditions.push('op.application_deadline BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)');
    }

    if (recommendation) {
      conditions.push('op.recommendation = ?');
      params.push(recommendation);
    } else if (include_ignored !== 'true') {
      conditions.push("(op.recommendation IS NULL OR op.recommendation != 'ignore')");
      conditions.push('(op.eligibility_pct IS NULL OR op.eligibility_pct > 0)');
    }

    if (is_archived === '0' || is_archived == null) {
      // Strictly enforce verified existence: exclude dead links, ghost jobs, and non-existent jobs
      conditions.push('(op.is_verified_active = 1 AND (op.is_active_link != 0 OR op.is_active_link IS NULL))');
      // Exclude foreign visa-sponsored jobs & non-Indian locations without remote
      conditions.push('(op.visa_sponsored = 0 OR op.visa_sponsored IS NULL)');
      conditions.push("(op.country = 'India' OR op.location LIKE '%India%' OR op.location LIKE '%Remote%' OR op.location LIKE '%Anywhere%' OR op.country IS NULL)");
      // Exclude Quant / HFT hedge funds
      conditions.push("(op.category_group != 'quant_hft' OR op.category_group IS NULL)");
      // Strictly enforce >= 5 LPA minimum compensation threshold
      conditions.push('(op.ctc_min >= 500000 OR op.ctc_max >= 500000 OR (op.ctc_min IS NULL AND op.ctc_max IS NULL))');
    }

    if (job_type) { conditions.push('op.job_type = ?'); params.push(job_type); }
    if (category) { conditions.push('op.category = ?'); params.push(category); }
    if (is_archived != null) { conditions.push('op.is_archived = ?'); params.push(is_archived); }
    else { conditions.push('op.is_archived = 0'); } // default: hide archived
    if (q) {
      conditions.push('(op.title LIKE ? OR op.required_skills LIKE ? OR org.name LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;

    // Sorting
    if (sort === 'score_asc') sql += ' ORDER BY op.opportunity_score ASC';
    else if (sort === 'deadline') sql += ' ORDER BY op.application_deadline ASC';
    else if (sort === 'ctc') sql += ' ORDER BY op.ctc_max DESC';
    else if (sort === 'posted' || sort === 'posted_recent') sql += ' ORDER BY COALESCE(op.posted_date, DATE(op.discovered_at)) DESC';
    else if (sort === 'newest') sql += ' ORDER BY op.discovered_at DESC';
    else sql += ' ORDER BY op.opportunity_score DESC'; // default

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Trigger background refresh across all organizations ──
router.post('/poll-active-orgs', async (req, res) => {
  try {
    const refreshAllData = require('../scripts/refreshAllData');
    refreshAllData().catch(e => console.error('[poll-active-orgs error]:', e));
    res.json({ success: true, summary: 'Pulling live jobs across all ATS connectors and organizations…' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get single opportunity ──
router.get('/outcome-analytics', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, role, status, priority, scoring_features_snapshot, created_at, updated_at,
       EXISTS(SELECT 1 FROM jobhunt_application_events e WHERE e.application_id=applications.id AND e.event_type='interview') AS had_interview
       FROM applications
       WHERE scoring_features_snapshot IS NOT NULL`
    );

    let totalTracked = rows.length;
    let interviews = 0;
    let offers = 0;
    let rejections = 0;
    let inProgress = 0;

    const featureAverages = {
      callback: { score: 0, profile_match: 0, eligibility: 0, compensation: 0, count: 0 },
      rejection: { score: 0, profile_match: 0, eligibility: 0, compensation: 0, count: 0 }
    };

    for (const r of rows) {
      let snap = r.scoring_features_snapshot;
      if (typeof snap === 'string') {
        try { snap = JSON.parse(snap); } catch {}
      }
      if (!snap) continue;

      const isCallback = Boolean(r.had_interview) || ['interview', 'offer', 'cleared'].includes(r.status);
      const isRejected = r.status === 'rejected';

      if (isCallback) {
        if (r.status === 'offer' || r.status === 'cleared') offers++;
        else interviews++;
        featureAverages.callback.count++;
        featureAverages.callback.score += snap.opportunity_score || 0;
        featureAverages.callback.profile_match += snap.profile_match_pct || 0;
        featureAverages.callback.eligibility += snap.eligibility_pct || 0;
        featureAverages.callback.compensation += snap.compensation_score || 0;
      } else if (isRejected) {
        rejections++;
        featureAverages.rejection.count++;
        featureAverages.rejection.score += snap.opportunity_score || 0;
        featureAverages.rejection.profile_match += snap.profile_match_pct || 0;
        featureAverages.rejection.eligibility += snap.eligibility_pct || 0;
        featureAverages.rejection.compensation += snap.compensation_score || 0;
      } else {
        inProgress++;
      }
    }

    const computeAvg = group => ({
      avg_opportunity_score: group.count ? Math.round(group.score / group.count) : 0,
      avg_profile_match: group.count ? Math.round(group.profile_match / group.count) : 0,
      avg_eligibility: group.count ? Math.round(group.eligibility / group.count) : 0,
      avg_compensation: group.count ? Math.round(group.compensation / group.count) : 0,
      total_count: group.count
    });

    const callbackRate = totalTracked > 0
      ? Math.round(((interviews + offers) / totalTracked) * 100)
      : null;

    res.json({
      total_tracked: totalTracked,
      callbacks: interviews + offers,
      offers,
      interviews,
      rejections,
      in_progress: inProgress,
      callback_rate_pct: callbackRate,
      callback_rate_denominator: totalTracked,
      metric_note: 'Applications with scoring snapshots; unresolved applications included in denominator. Historical interviews are retained.',
      calibrated_metrics: {
        successful_profiles: computeAvg(featureAverages.callback),
        rejected_profiles: computeAvg(featureAverages.rejection)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT op.*, org.name AS org_name, org.sector AS org_sector, org.careers_url AS org_careers_url, org.website AS org_website,
         (SELECT a.status FROM applications a WHERE (a.opportunity_id = op.id OR (a.role = op.title AND a.name = org.name)) AND a.status IN ('applied', 'interview', 'offer', 'rejected', 'cleared') ORDER BY a.id DESC LIMIT 1) AS application_status,
         (SELECT a.id FROM applications a WHERE (a.opportunity_id = op.id OR (a.role = op.title AND a.name = org.name)) AND a.status IN ('applied', 'interview', 'offer', 'rejected', 'cleared') ORDER BY a.id DESC LIMIT 1) AS application_id
       FROM jobhunt_opportunities op
       LEFT JOIN jobhunt_organizations org ON op.org_id = org.id
       WHERE op.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Opportunity not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create opportunity + auto-score ──
router.post('/', async (req, res) => {
  try {
    const {
      org_id = null, title, source_url = '', source_type = 'manual',
      required_degree = '', required_branch = '', min_experience_years = null,
      max_age = null, min_age = null, required_skills = '',
      vacancies = null, location = '', pay_scale = '',
      ctc_min = null, ctc_max = null, application_deadline = null, exam_date = null,
      apply_url = '', job_type = 'other', category = 'job',
      raw_text = '', notes = '', requires_gate = 0,
      category_group, country, region,
      visa_sponsored, currency, compensation_display = '',
      posted_date = null
    } = req.body;

    if (!title) return res.status(400).json({ error: 'Title is required' });

    let finalCatGroup = category_group;
    let finalCountry = country;
    let finalRegion = region;
    let finalVisa = visa_sponsored;
    let finalCurrency = currency;

    if (org_id && (!finalCatGroup || !finalCountry)) {
      const [orgRows] = await pool.query('SELECT * FROM jobhunt_organizations WHERE id = ?', [org_id]);
      if (orgRows.length > 0) {
        const o = orgRows[0];
        if (!finalCatGroup) finalCatGroup = o.category_group;
        if (!finalCountry) finalCountry = o.country;
        if (!finalRegion) finalRegion = o.region;
        if (finalVisa === undefined) finalVisa = o.visa_sponsored;
        if (!finalCurrency) finalCurrency = o.currency;
      }
    }

    finalCatGroup = finalCatGroup || 'private_in';
    finalCountry = finalCountry || 'India';
    finalRegion = finalRegion || 'India';
    finalVisa = finalVisa ? 1 : 0;
    finalCurrency = finalCurrency || 'INR';

    const skillsStr = typeof required_skills === 'string' ? required_skills : JSON.stringify(required_skills || []);

    const [result] = await pool.query(
      `INSERT INTO jobhunt_opportunities
        (org_id, title, source_url, source_type,
         required_degree, required_branch, min_experience_years,
         max_age, min_age, required_skills,
         vacancies, location, pay_scale, ctc_min, ctc_max,
         application_deadline, exam_date, apply_url,
         job_type, category, raw_text, notes, requires_gate,
         category_group, country, region, visa_sponsored, currency, compensation_display, posted_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        org_id || null, title, source_url, source_type,
        required_degree, required_branch, min_experience_years,
        max_age, min_age, skillsStr,
        vacancies, location, pay_scale, ctc_min || null, ctc_max || null,
        application_deadline || null, exam_date || null, apply_url,
        job_type, category, raw_text, notes, requires_gate ? 1 : 0,
        finalCatGroup, finalCountry, finalRegion,
        finalVisa, finalCurrency, compensation_display || '',
        posted_date || new Date().toISOString().split('T')[0]
      ]
    );

    // Auto-score
    const scored = await scoreAndPersist(result.insertId);
    res.json({ id: result.insertId, ...scored });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Update opportunity + re-score ──
router.put('/:id', async (req, res) => {
  try {
    const {
      org_id, title, source_url, source_type,
      required_degree, required_branch, min_experience_years,
      max_age, min_age, required_skills,
      vacancies, location, pay_scale, ctc_min, ctc_max,
      application_deadline, exam_date, apply_url,
      job_type, category, raw_text, notes, is_new, is_archived,
      requires_gate, category_group, country, region,
      visa_sponsored, currency, compensation_display, posted_date
    } = req.body;

    const skillsStr = required_skills != null
      ? (typeof required_skills === 'string' ? required_skills : JSON.stringify(required_skills))
      : '';

    await pool.query(
      `UPDATE jobhunt_opportunities SET
        org_id = ?, title = ?, source_url = ?, source_type = ?,
        required_degree = ?, required_branch = ?, min_experience_years = ?,
        max_age = ?, min_age = ?, required_skills = ?,
        vacancies = ?, location = ?, pay_scale = ?, ctc_min = ?, ctc_max = ?,
        application_deadline = ?, exam_date = ?, apply_url = ?,
        job_type = ?, category = ?, raw_text = ?, notes = ?,
        is_new = ?, is_archived = ?, requires_gate = ?,
        category_group = COALESCE(?, category_group),
        country = COALESCE(?, country),
        region = COALESCE(?, region),
        visa_sponsored = COALESCE(?, visa_sponsored),
        currency = COALESCE(?, currency),
        compensation_display = COALESCE(?, compensation_display),
        posted_date = COALESCE(?, posted_date)
       WHERE id = ?`,
      [
        org_id || null, title, source_url || '', source_type || 'manual',
        required_degree || '', required_branch || '', min_experience_years || null,
        max_age || null, min_age || null, skillsStr,
        vacancies || null, location || '', pay_scale || '',
        ctc_min || null, ctc_max || null,
        application_deadline || null, exam_date || null, apply_url || '',
        job_type || 'other', category || 'job', raw_text || '', notes || '',
        is_new != null ? is_new : 0, is_archived != null ? is_archived : 0,
        requires_gate ? 1 : 0,
        category_group != null ? category_group : null,
        country != null ? country : null,
        region != null ? region : null,
        visa_sponsored != null ? (visa_sponsored ? 1 : 0) : null,
        currency != null ? currency : null,
        compensation_display != null ? compensation_display : null,
        posted_date != null ? posted_date : null,
        req.params.id
      ]
    );

    // Re-score
    const scored = await scoreAndPersist(req.params.id);
    res.json({ success: true, ...scored });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Manually trigger re-score ──
router.post('/:id/score', async (req, res) => {
  try {
    const scored = await scoreAndPersist(req.params.id);
    if (!scored) return res.status(404).json({ error: 'Opportunity not found' });
    res.json(scored);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Bulk re-score all opportunities ──
router.post('/rescore-all', async (req, res) => {
  try {
    const thresholds = await getScoringThresholds();
    const [allOpps] = await pool.query('SELECT id FROM jobhunt_opportunities WHERE is_archived = 0');
    let count = 0;
    for (const opp of allOpps) {
      await scoreAndPersist(opp.id, thresholds);
      count++;
    }
    res.json({ success: true, rescored: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Archive (soft-delete) or permanent delete ──
router.delete('/:id', async (req, res) => {
  try {
    const permanent = req.query.permanent === 'true' || req.query.hard === 'true';
    if (permanent) {
      await pool.query('DELETE FROM jobhunt_opportunities WHERE id = ?', [req.params.id]);
    } else {
      await pool.query('UPDATE jobhunt_opportunities SET is_archived = 1 WHERE id = ?', [req.params.id]);
    }
    res.json({ success: true, permanent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Restore archived opportunity ──
router.post('/:id/restore', async (req, res) => {
  try {
    await pool.query('UPDATE jobhunt_opportunities SET is_archived = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Bulk delete / archive ──
router.post('/bulk-delete', async (req, res) => {
  try {
    const { ids, permanent = false } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No opportunity IDs provided' });
    }
    if (permanent) {
      await pool.query('DELETE FROM jobhunt_opportunities WHERE id IN (?)', [ids]);
    } else {
      await pool.query('UPDATE jobhunt_opportunities SET is_archived = 1 WHERE id IN (?)', [ids]);
    }
    res.json({ success: true, count: ids.length, permanent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Live availability & eligibility verification audit ──
router.post('/verify-all', async (req, res) => {
  try {
    // 1. Run lifecycle maintenance (purge expired deadlines, archive stale posts)
    const lifecycleResult = await runOpportunitiesLifecycle();

    // 2. Run verification on remaining active opportunities
    const autoArchive = req.body?.auto_archive !== false;
    const result = await verifyAllOpportunities({ autoArchive });
    res.json({ success: true, lifecycle: lifecycleResult, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/verify', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM jobhunt_opportunities WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Opportunity not found' });
    const result = await verifyOpportunity(rows[0]);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 1-Click Apply & Track into Applications ──
router.post('/:id/apply', async (req, res) => {
  try {
    const oppId = req.params.id;
    const [rows] = await pool.query(
      `SELECT op.*, org.name AS org_name, org.careers_url AS org_careers_url, org.website AS org_website
       FROM jobhunt_opportunities op
       LEFT JOIN jobhunt_organizations org ON op.org_id = org.id
       WHERE op.id = ?`,
      [oppId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Opportunity not found' });
    const opp = rows[0];

    const appName = opp.org_name || 'Direct Employer';
    const appRole = opp.title || 'Candidate Position';
    const appType = req.body.type || (
      ['job', 'internship', 'fellowship', 'grant', 'higher_ed', 'exam'].includes(opp.category)
        ? opp.category
        : (opp.job_type === 'internship' ? 'internship' : opp.job_type === 'fellowship' ? 'fellowship' : 'job')
    );
    const appStatus = req.body.status || 'applied';
    if(!['planning','applied','interview','offer','rejected','cleared'].includes(appStatus))return res.status(400).json({error:'Invalid status'});
    const appDeadline = opp.application_deadline || null;
    const directUrl = opp.apply_url || opp.source_url || opp.org_careers_url || opp.org_website || '';
    
    // Notes: CTC/Pay scale, Location, Mode, etc.
    const noteSegments = [];
    if (opp.pay_scale) noteSegments.push(`Pay: ${opp.pay_scale}`);
    else if (opp.ctc_max) noteSegments.push(`CTC: ₹${opp.ctc_min || 0}L - ₹${opp.ctc_max}L`);
    if (opp.location) noteSegments.push(`Location: ${opp.location}`);
    if (opp.job_type) noteSegments.push(`Type: ${opp.job_type}`);
    if (opp.vacancies) noteSegments.push(`Vacancies: ${opp.vacancies}`);
    const appNotes = req.body.notes || (noteSegments.length ? noteSegments.join(' | ') : 'Logged via Job Hunt Radar');

    const appPriority = req.body.priority || (opp.opportunity_score >= 75 ? 'high' : opp.opportunity_score >= 50 ? 'medium' : 'low');

    // Check if an application record already exists for this opportunity
    const [existing] = await pool.query(
      `SELECT id, status FROM applications
       WHERE opportunity_id = ?
       ORDER BY id DESC LIMIT 1`,
      [oppId]
    );

    const scoringSnapshot = JSON.stringify(captureScoringFeatures(opp));

    let applicationId = null;
    if (existing.length > 0) {
      applicationId = existing[0].id;
      await pool.query(
        `UPDATE applications SET
           opportunity_id = ?,
           status = ?,
           url = COALESCE(NULLIF(?, ''), url),
           deadline = COALESCE(?, deadline),
           priority = ?,
           scoring_features_snapshot = COALESCE(scoring_features_snapshot, ?)
         WHERE id = ?`,
        [oppId, appStatus, directUrl, appDeadline, appPriority, scoringSnapshot, applicationId]
      );
    } else {
      const [insertRes] = await pool.query(
        `INSERT INTO applications (name, role, type, status, deadline, url, notes, priority, opportunity_id, scoring_features_snapshot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [appName, appRole, appType, appStatus, appDeadline, directUrl, appNotes, appPriority, oppId, scoringSnapshot]
      );
      applicationId = insertRes.insertId;
    }

    await syncOpportunityState(pool,oppId);
    if(!existing[0] || existing[0].status!==appStatus)await recordStatus(pool,applicationId,appStatus);

    res.json({
      success: true,
      application_id: applicationId,
      status: appStatus,
      apply_url: directUrl,
      org_name: appName,
      role: appRole
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Unapply / untrack ──
router.post('/:id/unapply', async (req, res) => {
  try {
    const oppId = req.params.id;
    const [docs]=await pool.query('SELECT id FROM jobhunt_document_packages WHERE opportunity_id=? LIMIT 1',[oppId]);
    if(docs.length)return res.status(409).json({error:'This opportunity has application document history. Update its status instead of untracking.'});
    await pool.query('UPDATE jobhunt_opportunities SET is_applied = 0, applied_at = NULL WHERE id = ?', [oppId]);
    if (req.body.delete_application) {
      await pool.query('DELETE FROM applications WHERE opportunity_id = ?', [oppId]);
    } else {
      await pool.query('UPDATE applications SET opportunity_id = NULL WHERE opportunity_id = ?', [oppId]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Quick update application status for an opportunity (e.g. 'rejected', 'applied', 'interview') ──
router.post('/:id/mark-status', async (req, res) => {
  try {
    const oppId = req.params.id;
    const { status, notes } = req.body;
    if (!['planning','applied','interview','offer','rejected','cleared'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    // Find application by opportunity_id
    const [apps] = await pool.query(
      'SELECT id, notes, status FROM applications WHERE opportunity_id = ? ORDER BY id DESC LIMIT 1',
      [oppId]
    );

    let applicationId = null;
    if (apps.length > 0) {
      applicationId = apps[0].id;
      const existingNotes = apps[0].notes || '';
      const updatedNotes = notes ? (existingNotes ? `${existingNotes} | ${notes}` : notes) : existingNotes;
      await pool.query(
        'UPDATE applications SET status = ?, notes = ? WHERE id = ?',
        [status, updatedNotes, applicationId]
      );
    } else {
      // Lookup opportunity to create corresponding application record
      const [oppRows] = await pool.query(
        `SELECT op.*, org.name AS org_name, org.careers_url AS org_careers_url, org.website AS org_website
         FROM jobhunt_opportunities op
         LEFT JOIN jobhunt_organizations org ON op.org_id = org.id
         WHERE op.id = ?`,
        [oppId]
      );
      if (oppRows.length === 0) return res.status(404).json({ error: 'Opportunity not found' });
      const opp = oppRows[0];
      const appName = opp.org_name || 'Direct Employer';
      const appRole = opp.title || 'Candidate Position';
      const appType = ['job', 'internship', 'fellowship', 'grant', 'higher_ed', 'exam'].includes(opp.category)
        ? opp.category
        : (opp.job_type === 'internship' ? 'internship' : 'job');
      const directUrl = opp.apply_url || opp.source_url || opp.org_careers_url || opp.org_website || '';

      const [insertRes] = await pool.query(
        `INSERT INTO applications (name, role, type, status, url, notes, priority, opportunity_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [appName, appRole, appType, status, directUrl, notes || 'Marked via Job Hunt Radar', 'medium', oppId]
      );
      applicationId = insertRes.insertId;
      await syncOpportunityState(pool,oppId);
    }

    await syncOpportunityState(pool,oppId);
    if(!apps[0] || apps[0].status!==status)await recordStatus(pool,applicationId,status);
    res.json({
      success: true,
      application_id: applicationId,
      status
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Outcome Feedback Loop & Predictive Calibration ──


module.exports = router;

