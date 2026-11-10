const pool = require('../db/db');
const { isGateMandatory } = require('./jobhuntScoring');

// User-Agent for verification checks
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/**
 * Checks link liveness using HTTP HEAD with GET fallback.
 * Detects dead URLs (404/410) and redirects to generic career homepages.
 */
async function checkLinkLiveness(targetUrl) {
  if (!targetUrl || !targetUrl.startsWith('http')) {
    return { alive: false, status: null, reason: 'Invalid or missing URL' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    let res = await fetch(targetUrl, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    // Fallback to GET if HEAD was blocked or not allowed (405 or 403)
    if (res.status === 405 || res.status === 403) {
      res = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': USER_AGENT,
          'Range': 'bytes=0-2048'
        }
      });
    }

    clearTimeout(timeoutId);

    if (res.status === 404 || res.status === 410) {
      return { alive: false, status: res.status, reason: `HTTP ${res.status} (Not Found / Expired)` };
    }

    // Check if redirected to root or generic /careers when a specific job ID was requested
    const finalUrl = res.url || '';
    const originalPath = new URL(targetUrl).pathname;
    const finalPath = finalUrl ? new URL(finalUrl).pathname : '';

    if (originalPath.length > 8 && (finalPath === '/' || finalPath === '/careers' || finalPath === '/jobs')) {
      return { alive: false, status: 302, reason: 'Listing closed: redirected to generic careers homepage' };
    }

    return { alive: true, status: res.status, final_url: finalUrl };
  } catch (err) {
    clearTimeout(timeoutId);
    // Network errors (DNS or timeout) — treat as unconfirmed rather than immediate 404 drop
    return { alive: true, status: null, is_unconfirmed: true, reason: err.message };
  }
}

/**
 * Normalizes job titles for fuzzy deduplication across feeds and scrapers.
 * e.g. "Software Development Engineer - I (Backend)" -> "sde 1 backend"
 */
function normalizeTitle(title) {
  if (!title) return '';
  let clean = title.toLowerCase()
    .replace(/\b(software development engineer|software dev engineer)\b/g, 'sde')
    .replace(/\b(member of technical staff|mts)\b/g, 'mts')
    .replace(/\b(senior|sr\.)\b/g, 'sr')
    .replace(/\b(junior|jr\.)\b/g, 'jr')
    .replace(/[-–—/\\()[\],]/g, ' ')
    .replace(/\b(i|1)\b/g, '1')
    .replace(/\b(ii|2)\b/g, '2')
    .replace(/\b(iii|3)\b/g, '3')
    .replace(/\b(remote|hybrid|onsite|bangalore|bengaluru|hyderabad|pune|gurgaon|noida|india)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return clean;
}

/**
 * Normalizes location string.
 */
function normalizeLocation(loc) {
  if (!loc) return '';
  return loc.toLowerCase()
    .replace(/bengaluru/g, 'bangalore')
    .replace(/gurugram/g, 'gurgaon')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes token Jaccard similarity between two strings.
 */
function tokenSimilarity(a, b) {
  const setA = new Set(a.split(' ').filter(Boolean));
  const setB = new Set(b.split(' ').filter(Boolean));
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Verify a single opportunity for active availability and eligibility.
 */
async function verifyOpportunity(opp, profile = null) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let isExpired = false;
  let daysUntilDeadline = null;

  if (opp.application_deadline) {
    const deadline = new Date(opp.application_deadline);
    deadline.setHours(0, 0, 0, 0);
    daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    if (daysUntilDeadline < 0) {
      isExpired = true;
    }
  }

  // Profile-based eligibility checks
  const p = profile || (await getProfile());
  const gateRequired = isGateMandatory(opp);
  const gateIneligible = gateRequired && (!p.has_gate || p.has_gate === 0 || p.has_gate === '0');

  const prefMinCtc = Number(p.pref_min_ctc) || 0;
  const bestCtc = Number(opp.ctc_max) || Number(opp.ctc_min) || 0;
  const ctcBelowPref = prefMinCtc > 0 && bestCtc > 0 && (bestCtc < prefMinCtc * 0.65);

  // Link Liveness Check
  let linkAlive = true;
  let linkHttpCode = null;
  let linkReason = null;

  const urlToCheck = opp.apply_url || opp.source_url;
  if (urlToCheck && !isExpired && !gateIneligible && !ctcBelowPref) {
    const linkCheck = await checkLinkLiveness(urlToCheck);
    linkAlive = linkCheck.alive;
    linkHttpCode = linkCheck.status;
    linkReason = linkCheck.reason;
  }

  const isPrivate = (opp.category_group && opp.category_group.startsWith('private')) || opp.job_type === 'private';
  const isGovtPsu = ['psu', 'govt', 'defence', 'research'].includes(opp.category_group) || ['govt', 'psu', 'defence', 'research'].includes(opp.job_type);

  let isStalePosting = false;
  let postedDaysAgo = null;
  const postedRef = opp.posted_date || (opp.discovered_at ? new Date(opp.discovered_at).toISOString().split('T')[0] : null);
  if (postedRef) {
    const pDate = new Date(postedRef);
    pDate.setHours(0, 0, 0, 0);
    postedDaysAgo = Math.round((now - pDate) / (1000 * 60 * 60 * 24));
    if (isPrivate && postedDaysAgo > 15) {
      isStalePosting = true;
    } else if (isGovtPsu && postedDaysAgo > 20) {
      isStalePosting = true;
    }
  }

  const isEligibleAndActive = !isExpired && !gateIneligible && !ctcBelowPref && !isStalePosting && linkAlive;

  let reason = 'Active and Eligible';
  if (!linkAlive) reason = `Ghost Job: ${linkReason || 'Apply URL returned 404/dead'}`;
  else if (isExpired) reason = `Application deadline passed (${Math.abs(daysUntilDeadline)} days ago)`;
  else if (isStalePosting && isPrivate) reason = `Private role posted > 15 days ago (${postedDaysAgo}d ago, rolling hiring basis)`;
  else if (isStalePosting && isGovtPsu) reason = `Govt/PSU notification posted > 20 days ago (${postedDaysAgo}d ago)`;
  else if (gateIneligible) reason = 'Mandates GATE score for freshers (candidate is non-GATE)';
  else if (ctcBelowPref) reason = `CTC below preference (offers ₹${(bestCtc / 100000).toFixed(1)} LPA vs ₹${(prefMinCtc / 100000).toFixed(1)} LPA min)`;

  return {
    opp_id: opp.id,
    title: opp.title,
    org_id: opp.org_id,
    is_active: isEligibleAndActive,
    is_active_link: linkAlive ? 1 : 0,
    is_expired: isExpired,
    days_left: daysUntilDeadline,
    gate_required: gateRequired,
    gate_ineligible: gateIneligible,
    ctc_below_pref: ctcBelowPref,
    link_status: linkAlive ? 'accessible' : 'dead_ghost_job',
    link_code: linkHttpCode,
    status_reason: reason
  };
}

async function getProfile() {
  const [rows] = await pool.query('SELECT * FROM jobhunt_profile WHERE id = 1');
  return rows[0] || {};
}

/**
 * Verify all active opportunities in the database.
 * Automatically marks expired or disqualified opportunities as archived if autoArchive is true.
 */
async function verifyAllOpportunities(options = {}) {
  const { autoArchive = true } = options;
  const profile = await getProfile();

  const [opps] = await pool.query(`
    SELECT op.*, org.name AS org_name
    FROM jobhunt_opportunities op
    LEFT JOIN jobhunt_organizations org ON op.org_id = org.id
    WHERE op.is_archived = 0
  `);

  const results = [];
  let activeCount = 0;
  let archivedCount = 0;

  for (const opp of opps) {
    const check = await verifyOpportunity(opp, profile);
    results.push({ ...check, org_name: opp.org_name });

    if (!check.is_active && autoArchive) {
      await pool.query(
        `UPDATE jobhunt_opportunities 
         SET is_archived = 1, 
             notes = CONCAT(IFNULL(notes, ''), ' [Auto-Archived during verification: ', ?, ']'),
             recommendation = 'ignore'
         WHERE id = ?`,
        [check.status_reason, opp.id]
      );
      archivedCount++;
    } else {
      activeCount++;
      await pool.query(
        `UPDATE jobhunt_opportunities 
         SET is_verified_active = 1,
             is_active_link = 1,
             verified_at = CURRENT_TIMESTAMP,
             last_verified_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [opp.id]
      );
    }
  }

  return {
    total_checked: opps.length,
    active_count: activeCount,
    archived_count: archivedCount,
    details: results
  };
}

module.exports = {
  verifyOpportunity,
  verifyAllOpportunities,
  checkLinkLiveness,
  normalizeTitle,
  normalizeLocation,
  tokenSimilarity
};
