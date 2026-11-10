const crypto = require('crypto');
const cheerio = require('cheerio');
const pool = require('../db/db');
const { extractFromText, normalizeExtractedItem } = require('./jobhuntExtractor');
const { computeOpportunityScore } = require('./jobhuntScoring');
const { isATSConfigured, fetchATSOpportunities } = require('./jobhuntATS');
const { normalizeTitle } = require('./jobhuntVerification');

// Indian Govt / PSU portals frequently use CCA India certs that are not in default Node trust stores
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/**
 * Fetch text and structured links from a webpage safely.
 */
async function fetchWebpage(targetUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.8,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const contentType = res.headers.get('content-type') || '';

    // If direct PDF
    if (contentType.includes('application/pdf') || targetUrl.toLowerCase().endsWith('.pdf')) {
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      return {
        isPdf: true,
        buffer,
        base64: buffer.toString('base64'),
        hash,
        cleanText: `PDF Document at ${targetUrl}`,
        links: []
      };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove noise elements
    $('script, style, noscript, svg, iframe, nav, footer, form, header').remove();

    // Extract links, especially recruitment / careers / pdf notices
    const links = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href && text && !href.startsWith('javascript:') && !href.startsWith('#')) {
        try {
          const absoluteUrl = new URL(href, targetUrl).toString();
          links.push({ text, url: absoluteUrl });
        } catch {}
      }
    });

    // Clean body text
    const cleanText = $('body')
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50000);

    // Deterministic hash based on text and extracted links
    const contentToHash = cleanText + '||' + links.map(l => l.url).slice(0, 50).join(',');
    const hash = crypto.createHash('sha256').update(contentToHash).digest('hex');

    return {
      isPdf: false,
      cleanText,
      links,
      hash
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Polls an ATS-backed organization via official public JSON APIs.
 * Eliminates JavaScript rendering/Cheerio issues and automatically purges closed roles.
 */
async function pollATSOrganization(org) {
  const now = new Date();
  try {
    const rawJobs = await fetchATSOpportunities(org, { techOnly: true, maxRoles: 40 });

    await pool.query(
      `UPDATE jobhunt_organizations 
       SET last_checked_at = NOW(),
           last_successful_pull = NOW(),
           last_jobs_found = ?,
           last_crawl_status = 'success'
       WHERE id = ?`,
      [rawJobs.length, org.id]
    );

    const [[profile]] = await pool.query('SELECT * FROM jobhunt_profile WHERE id = 1');
    const [settingRows] = await pool.query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'jobhunt_threshold_%'");
    const thresholdMap = Object.fromEntries(settingRows.map(r => [r.key, Number(r.value)]));
    const thresholds = {
      apply_now: thresholdMap.jobhunt_threshold_apply_now || 75,
      worth_applying: thresholdMap.jobhunt_threshold_worth_applying || 55,
      investigate: thresholdMap.jobhunt_threshold_investigate || 35
    };

    const inserted = [];
    const activeApplyUrls = [];

    // Fetch existing opportunities for this org to perform deduplication and link refresh
    const [existingOpps] = await pool.query(
      'SELECT id, title, apply_url, confidence_metadata FROM jobhunt_opportunities WHERE org_id = ? AND is_archived = 0',
      [org.id]
    );

    for (const job of rawJobs) {
      activeApplyUrls.push(job.apply_url);
      const normalizedItem = normalizeExtractedItem(job, {
        org_name: org.name,
        source_url: job.apply_url,
        source_type: job.source_type,
        raw_text: job.raw_text
      });

      const normJobTitle = normalizeTitle(job.title);

      // Check if duplicate exists (either matching apply_url or fuzzy title)
      const existingMatch = existingOpps.find(eo => 
        (eo.apply_url && job.apply_url && eo.apply_url === job.apply_url) ||
        (normalizeTitle(eo.title) === normJobTitle)
      );

      if (existingMatch) {
        await pool.query(
          `UPDATE jobhunt_opportunities 
           SET is_verified_active = 1,
               is_active_link = 1,
               verified_at = CURRENT_TIMESTAMP,
               last_verified_at = CURRENT_TIMESTAMP,
               confidence_metadata = ?
           WHERE id = ?`,
          [JSON.stringify(normalizedItem.confidence_metadata), existingMatch.id]
        );
        continue;
      }

      // Compute score
      const scores = computeOpportunityScore(profile || {}, normalizedItem, org, thresholds);

      const [insRes] = await pool.query(
        `INSERT INTO jobhunt_opportunities (
          org_id, title, source_url, source_type,
          required_degree, required_branch, min_experience_years,
          max_age, min_age, required_skills, vacancies,
          location, pay_scale, ctc_min, ctc_max,
          application_deadline, exam_date, apply_url,
          job_type, category, raw_text, notes,
          eligibility_pct, profile_match_pct, compensation_score,
          career_potential_score, competition_signal, application_difficulty_score,
          org_quality_score, deadline_urgency_score, opportunity_score, recommendation,
          requires_gate, is_new, is_verified_active, is_active_link, verified_at, last_verified_at,
          category_group, country, region, visa_sponsored, currency, compensation_display,
          posted_date, confidence_metadata
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
          ?, ?, ?, ?, ?, ?,
          ?, ?
        )
        ON DUPLICATE KEY UPDATE
          apply_url = VALUES(apply_url),
          location = VALUES(location),
          raw_text = VALUES(raw_text),
          eligibility_pct = VALUES(eligibility_pct),
          profile_match_pct = VALUES(profile_match_pct),
          opportunity_score = VALUES(opportunity_score),
          recommendation = VALUES(recommendation),
          is_active_link = 1,
          is_archived = 0,
          last_verified_at = CURRENT_TIMESTAMP,
          confidence_metadata = VALUES(confidence_metadata)
        `,
        [
          org.id, normalizedItem.title, normalizedItem.source_url, normalizedItem.source_type,
          normalizedItem.required_degree || '', normalizedItem.required_branch || '', normalizedItem.min_experience_years,
          normalizedItem.max_age, normalizedItem.min_age, JSON.stringify(normalizedItem.required_skills || []), normalizedItem.vacancies,
          normalizedItem.location || '', normalizedItem.pay_scale || '', normalizedItem.ctc_min, normalizedItem.ctc_max,
          normalizedItem.application_deadline, normalizedItem.exam_date, normalizedItem.apply_url,
          normalizedItem.job_type || 'private', normalizedItem.category || 'job', normalizedItem.raw_summary || '', normalizedItem.highlights || '',
          scores.eligibility_pct, scores.profile_match_pct, scores.compensation_score,
          scores.career_potential_score, scores.competition_signal, scores.application_difficulty_score,
          scores.org_quality_score, scores.deadline_urgency_score, scores.opportunity_score, scores.recommendation,
          normalizedItem.requires_gate ? 1 : 0,
          org.category_group || 'private_global', org.country || 'USA', org.region || 'Global', org.visa_sponsored || 0,
          org.currency || 'USD', normalizedItem.compensation_display || '',
          normalizedItem.posted_date || now.toISOString().split('T')[0],
          JSON.stringify(normalizedItem.confidence_metadata)
        ]
      );

      inserted.push({
        id: insRes.insertId,
        title: normalizedItem.title,
        score: scores.opportunity_score,
        recommendation: scores.recommendation
      });
    }

    // Auto-archive closed roles that disappeared from this ATS feed
    if (activeApplyUrls.length > 0) {
      await pool.query(
        `UPDATE jobhunt_opportunities 
         SET is_archived = 1,
             is_active_link = 0,
             notes = CONCAT(IFNULL(notes, ''), ' [Auto-Closed: Vanished from ATS feed]')
         WHERE org_id = ? 
           AND source_type LIKE '%api%' 
           AND is_archived = 0 
           AND apply_url NOT IN (?)`,
        [org.id, activeApplyUrls]
      );
    }

    return {
      org_id: org.id,
      org_name: org.name,
      target_url: org.careers_url,
      is_ats: true,
      ats_type: org.ats_type,
      changed: true,
      status: 'success',
      jobs_found: rawJobs.length,
      new_opportunities_count: inserted.length,
      new_opportunities: inserted,
      last_checked_at: now
    };
  } catch (err) {
    await pool.query(
      `UPDATE jobhunt_organizations 
       SET last_checked_at = NOW(),
           last_crawl_status = ? 
       WHERE id = ?`,
      [`error: ${err.message.slice(0, 50)}`, org.id]
    );

    return {
      org_id: org.id,
      org_name: org.name,
      error: `ATS Ingest failed: ${err.message}`,
      target_url: org.careers_url
    };
  }
}

/**
 * Poll a single organization for changes and new opportunities.
 */
async function pollOrganization(orgId) {
  const [orgRows] = await pool.query('SELECT * FROM jobhunt_organizations WHERE id = ?', [orgId]);
  if (orgRows.length === 0) throw new Error('Organization not found');
  const org = orgRows[0];

  // Route to ATS API connector first if configured
  if (isATSConfigured(org)) {
    return pollATSOrganization(org);
  }

  const targetUrl = org.notification_url || org.pdf_page_url || org.careers_url;
  if (!targetUrl) {
    await pool.query(
      `UPDATE jobhunt_organizations SET last_checked_at = NOW(), last_crawl_status = 'skipped: no url' WHERE id = ?`,
      [org.id]
    );
    return {
      org_id: org.id,
      org_name: org.name,
      skipped: true,
      reason: 'No careers or notification URL configured'
    };
  }

  let crawlResult;
  try {
    crawlResult = await fetchWebpage(targetUrl);
  } catch (err) {
    await pool.query(
      `UPDATE jobhunt_organizations SET last_checked_at = NOW(), last_crawl_status = ? WHERE id = ?`,
      [`error: ${err.message.slice(0, 50)}`, org.id]
    );
    return {
      org_id: org.id,
      org_name: org.name,
      error: `Crawl failed: ${err.message}`,
      target_url: targetUrl
    };
  }

  const { hash, cleanText, links } = crawlResult;

  // Check if hash exists in jobhunt_content_hashes
  const [existingHashRows] = await pool.query(
    'SELECT * FROM jobhunt_content_hashes WHERE org_id = ? AND content_hash = ?',
    [org.id, hash]
  );

  const now = new Date();
  await pool.query(
    `UPDATE jobhunt_organizations 
     SET last_checked_at = NOW(),
         last_successful_pull = NOW(),
         last_crawl_status = 'success'
     WHERE id = ?`,
    [org.id]
  );

  if (existingHashRows.length > 0) {
    return {
      org_id: org.id,
      org_name: org.name,
      target_url: targetUrl,
      changed: false,
      status: 'unchanged',
      content_hash: hash,
      last_checked_at: now
    };
  }

  // Content has changed or is being checked for the first time!
  await pool.query(
    `INSERT INTO jobhunt_content_hashes (org_id, content_hash, title_hint, source_url)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE first_seen_at = CURRENT_TIMESTAMP`,
    [org.id, hash, (org.name + ' - Crawl ' + now.toISOString().split('T')[0]).slice(0, 300), targetUrl.slice(0, 500)]
  );

  // Quick heuristic filter: check if the crawled page contains recruitment/job signals
  const RECRUITMENT_REGEX = /recruitment|vacancy|vacancies|advertisement|advt|career|opportunity|opportunities|postings|application|eligibility|walk-in|notification|examination|hiring|opening|scientist|engineer|officer|trainee/i;
  if (!RECRUITMENT_REGEX.test(cleanText)) {
    return {
      org_id: org.id,
      org_name: org.name,
      target_url: targetUrl,
      changed: true,
      status: 'no_recruitment_keywords',
      content_hash: hash,
      note: 'No active recruitment keywords detected on page (skipped AI call to save quota)',
      last_checked_at: now
    };
  }

  // Attempt LLM extraction of new opportunities with polite spacing
  let extractedOpportunities = [];
  try {
    await new Promise(r => setTimeout(r, 1500));
    extractedOpportunities = await extractFromText(cleanText, {
      org_id: org.id,
      org_name: org.name,
      source_url: targetUrl,
      source_type: 'crawler'
    });
  } catch (extractErr) {
    console.warn(`Extraction note for org ${org.name}:`, extractErr.message);
    return {
      org_id: org.id,
      org_name: org.name,
      target_url: targetUrl,
      changed: true,
      status: 'updated_no_extracted_jobs',
      content_hash: hash,
      note: extractErr.message,
      last_checked_at: now
    };
  }

  // Load user profile & custom thresholds to auto-score new opportunities
  const [[profile]] = await pool.query('SELECT * FROM jobhunt_profile WHERE id = 1');
  const [settingRows] = await pool.query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'jobhunt_threshold_%'");
  const thresholdMap = Object.fromEntries(settingRows.map(r => [r.key, Number(r.value)]));
  const thresholds = {
    apply_now: thresholdMap.jobhunt_threshold_apply_now || 75,
    worth_applying: thresholdMap.jobhunt_threshold_worth_applying || 55,
    investigate: thresholdMap.jobhunt_threshold_investigate || 35
  };

  const inserted = [];

  for (const opp of extractedOpportunities) {
    // Check if duplicate opportunity already exists for this org with identical title
    const [dups] = await pool.query(
      'SELECT id FROM jobhunt_opportunities WHERE org_id = ? AND title = ? AND is_archived = 0',
      [org.id, opp.title]
    );

    if (dups.length > 0) continue; // Skip existing title

    // Calculate score
    const scores = computeOpportunityScore(profile || {}, opp, org, thresholds);

    const oppCat = opp.category_group || org.category_group || 'private_in';
    const oppCountry = opp.country || org.country || 'India';
    const oppRegion = opp.region || org.region || 'India';
    const oppVisa = opp.visa_sponsored != null ? opp.visa_sponsored : (org.visa_sponsored || 0);
    const oppCurrency = opp.currency || org.currency || 'INR';

    const [insRes] = await pool.query(
      `INSERT INTO jobhunt_opportunities (
        org_id, title, source_url, source_type,
        required_degree, required_branch, min_experience_years,
        max_age, min_age, required_skills, vacancies,
        location, pay_scale, ctc_min, ctc_max,
        application_deadline, exam_date, apply_url,
        job_type, category, raw_text, notes,
        eligibility_pct, profile_match_pct, compensation_score,
        career_potential_score, competition_signal, application_difficulty_score,
        org_quality_score, deadline_urgency_score, opportunity_score, recommendation,
        requires_gate, is_new, is_verified_active, is_active_link,
        category_group, country, region, visa_sponsored, currency, compensation_display,
        posted_date, confidence_metadata
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, 1, 1, 1,
        ?, ?, ?, ?, ?, ?,
        ?, ?
      )`,
      [
        org.id, opp.title, opp.source_url || targetUrl, 'crawler',
        opp.required_degree || '', opp.required_branch || '', opp.min_experience_years,
        opp.max_age, opp.min_age, JSON.stringify(opp.required_skills || []), opp.vacancies,
        opp.location || '', opp.pay_scale || '', opp.ctc_min, opp.ctc_max,
        opp.application_deadline, opp.exam_date, opp.apply_url || targetUrl,
        opp.job_type || 'other', opp.category || 'job', opp.raw_summary || '', opp.highlights || '',
        scores.eligibility_pct, scores.profile_match_pct, scores.compensation_score,
        scores.career_potential_score, scores.competition_signal, scores.application_difficulty_score,
        scores.org_quality_score, scores.deadline_urgency_score, scores.opportunity_score, scores.recommendation,
        opp.requires_gate ? 1 : 0,
        oppCat, oppCountry, oppRegion, oppVisa, oppCurrency, opp.compensation_display || '',
        opp.posted_date || new Date().toISOString().split('T')[0],
        JSON.stringify(opp.confidence_metadata || {})
      ]
    );

    inserted.push({ id: insRes.insertId, title: opp.title, score: scores.opportunity_score, recommendation: scores.recommendation });
  }

  return {
    org_id: org.id,
    org_name: org.name,
    target_url: targetUrl,
    changed: true,
    status: 'updated',
    content_hash: hash,
    new_opportunities_count: inserted.length,
    new_opportunities: inserted,
    last_checked_at: now
  };
}

/**
 * Global crawler progress state for real-time frontend monitoring.
 */
let crawlProgress = {
  is_running: false,
  current_index: 0,
  total: 0,
  current_org: '',
  new_opportunities_count: 0,
  errors_count: 0,
  started_at: null,
  completed_at: null,
  recent_logs: []
};

function getCrawlProgress() {
  return crawlProgress;
}

/**
 * Asynchronously crawl organizations in the background with progress reporting.
 */
async function startBatchCrawl(options = {}) {
  if (crawlProgress.is_running) {
    return { is_running: true, already_running: true, progress: crawlProgress };
  }

  const limit = options.limit || (options.all ? 100 : 15);
  const [orgs] = await pool.query(
    `SELECT id, name, careers_url, notification_url, pdf_page_url
     FROM jobhunt_organizations
     WHERE is_active = 1 AND (careers_url != '' OR notification_url != '' OR pdf_page_url != '')
     ORDER BY (last_checked_at IS NULL) DESC, last_checked_at ASC
     LIMIT ?`,
    [Number(limit)]
  );

  if (orgs.length === 0) {
    return { is_running: false, total: 0, message: 'No organizations due for polling' };
  }

  crawlProgress = {
    is_running: true,
    current_index: 0,
    total: orgs.length,
    current_org: orgs[0].name,
    new_opportunities_count: 0,
    errors_count: 0,
    started_at: new Date(),
    completed_at: null,
    recent_logs: [`Started batch poll for ${orgs.length} organizations.`]
  };

  // Run in background without blocking the HTTP request
  (async () => {
    try {
      for (let i = 0; i < orgs.length; i++) {
        const org = orgs[i];
        crawlProgress.current_index = i + 1;
        crawlProgress.current_org = org.name;

        try {
          const res = await pollOrganization(org.id);
          if (res.new_opportunities_count) {
            crawlProgress.new_opportunities_count += res.new_opportunities_count;
            crawlProgress.recent_logs.unshift(`✓ ${org.name}: +${res.new_opportunities_count} new opportunities`);
          } else if (res.changed) {
            crawlProgress.recent_logs.unshift(`• ${org.name}: ${res.status === 'no_recruitment_keywords' ? 'Checked (no job ads)' : 'Content updated'}`);
          } else {
            crawlProgress.recent_logs.unshift(`– ${org.name}: Unchanged (0 AI tokens)`);
          }
        } catch (err) {
          crawlProgress.errors_count++;
          crawlProgress.recent_logs.unshift(`✕ ${org.name}: ${err.message}`);
        }

        if (crawlProgress.recent_logs.length > 20) {
          crawlProgress.recent_logs.pop();
        }

        // Polite delay between organizations to avoid socket saturation and rate limits
        await new Promise(r => setTimeout(r, 1200));
      }
    } catch (batchErr) {
      console.error('[Crawler Batch Error]:', batchErr);
    } finally {
      crawlProgress.is_running = false;
      crawlProgress.completed_at = new Date();
      crawlProgress.recent_logs.unshift(`✓ Completed batch poll (${crawlProgress.total} orgs).`);
    }
  })().catch(e => console.error(e));

  return { is_running: true, progress: crawlProgress };
}

/**
 * Backward-compatible wrapper for pollAllActiveOrgs
 */
async function pollAllActiveOrgs() {
  return startBatchCrawl({ all: true });
}

/**
 * Background crawler scheduler.
 */
let crawlerInterval = null;

function startBackgroundCrawler() {
  if (crawlerInterval) clearInterval(crawlerInterval);

  // Run every 2 hours
  const INTERVAL_MS = 2 * 60 * 60 * 1000;

  crawlerInterval = setInterval(async () => {
    try {
      // Check if auto polling is enabled in settings
      const [[row]] = await pool.query("SELECT `value` FROM settings WHERE `key` = 'jobhunt_auto_poll_enabled'");
      const enabled = row ? row.value === '1' || row.value === 'true' : false;
      if (!enabled) return;

      console.log('[JobHunt Crawler] Running automated background poll for due organizations...');
      const [dueOrgs] = await pool.query(
        `SELECT id FROM jobhunt_organizations
         WHERE is_active = 1
           AND (careers_url != '' OR notification_url != '' OR pdf_page_url != '')
           AND (last_checked_at IS NULL OR last_checked_at < NOW() - INTERVAL 12 HOUR)
         LIMIT 10`
      );

      for (const org of dueOrgs) {
        await pollOrganization(org.id);
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err) {
      console.error('[JobHunt Crawler Error]:', err.message);
    }
  }, INTERVAL_MS);
}

module.exports = {
  fetchWebpage,
  pollOrganization,
  pollAllActiveOrgs,
  startBatchCrawl,
  getCrawlProgress,
  startBackgroundCrawler
};

