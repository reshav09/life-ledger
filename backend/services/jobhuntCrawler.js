const { fetchPublic: fetch } = require('./jobhuntFetch');
const crypto = require('crypto');
const cheerio = require('cheerio');
const pool = require('../db/db');
const { extractFromText, normalizeExtractedItem } = require('./jobhuntExtractor');
const { computeOpportunityScore } = require('./jobhuntScoring');
const { isATSConfigured, fetchATSOpportunities } = require('./jobhuntATS');
const { normalizeTitle } = require('./jobhuntVerification');

// Indian Govt / PSU portals frequently use CCA India certs that are not in default Node trust stores
// TLS certificate verification remains enabled for the entire process.

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
  const { ingestOpportunity } = require('./jobhuntIngestion');
  try {
    const jobs = await fetchATSOpportunities(org, {techOnly:false, maxRoles:0});
    const [[profile]] = await pool.query('SELECT * FROM jobhunt_profile WHERE id = 1');
    const [settings] = await pool.query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'jobhunt_threshold_%'");
    const thresholds = Object.fromEntries(settings.map(r=>[r.key.replace('jobhunt_threshold_',''),Number(r.value)]));
    const results=[];
    for(const job of jobs)results.push(await ingestOpportunity(org,job,{profile:profile || {},thresholds}));
    await pool.query("UPDATE jobhunt_organizations SET last_checked_at=NOW(), last_successful_pull=NOW(), last_jobs_found=?, last_crawl_status='success' WHERE id=?",[jobs.length,org.id]);
    // Absence from a bounded/filtered feed never proves a role is closed.
    return {org_id:org.id,org_name:org.name,is_ats:true,status:'success',jobs_found:jobs.length,
      new_opportunities_count:results.filter(x=>x.inserted).length,new_opportunities:results.filter(x=>x.inserted)};
  }catch(err){
    await pool.query("UPDATE jobhunt_organizations SET last_checked_at=NOW(),last_crawl_status='error' WHERE id=?",[org.id]);
    throw err;
  }
}

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

  const { ingestOpportunity } = require('./jobhuntIngestion');
  for (const opp of extractedOpportunities) {
    const result = await ingestOpportunity(org, {...opp, raw_text: opp.raw_text || cleanText,
      source_type:'crawler', source_url:targetUrl}, {profile:profile || {},thresholds});
    if(result.inserted) inserted.push(result);
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
     WHERE is_active = 1 AND (careers_url != '' OR notification_url != '' OR pdf_page_url != '' OR ats_id IS NOT NULL)
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
  const INTERVAL_MS = 60 * 1000;
  let running=false;

  crawlerInterval = setInterval(async () => {
    if(running)return;running=true;
    try {
      // Check if auto polling is enabled in settings
      const [[row]] = await pool.query("SELECT `value` FROM settings WHERE `key` = 'jobhunt_auto_poll_enabled'");
      const enabled = row ? row.value === '1' || row.value === 'true' : false;
      if (!enabled) return;

      const [[frequency]]=await pool.query("SELECT `value` FROM settings WHERE `key`='jobhunt_default_polling'");
      const hours=({hourly:1,daily:24,weekly:168,monthly:720})[frequency?.value] || 168;
      console.log('[JobHunt Crawler] Checking due organizations');
      const [dueOrgs] = await pool.query(
        `SELECT id FROM jobhunt_organizations
         WHERE is_active = 1
           AND (careers_url != '' OR notification_url != '' OR pdf_page_url != '' OR ats_id IS NOT NULL)
           AND (last_checked_at IS NULL OR last_checked_at < DATE_SUB(NOW(),INTERVAL ? HOUR))
         ORDER BY last_checked_at ASC LIMIT 10`,[hours]
      );

      for (const org of dueOrgs) {
        await pollOrganization(org.id);
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err) {
      console.error('[JobHunt Crawler Error]:', err.message);
    } finally {running=false;}
  }, INTERVAL_MS);
}

module.exports = {
  fetchWebpage,
  pollOrganization,
  pollAllActiveOrgs,
  pollATSOrganization,
  startBatchCrawl,
  getCrawlProgress,
  startBackgroundCrawler
};

