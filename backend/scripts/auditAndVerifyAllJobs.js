/**
 * Comprehensive Job Audit & Verification Script
 * Audits every opportunity in the database to eliminate dead links, synthetic roles,
 * and generic search queries. Ingests genuine official ATS postings (including Databricks).
 */

const pool = require('../db/db');
const { fetchPublic: fetch } = require('../services/jobhuntFetch');
const { fetchATSOpportunities } = require('../services/jobhuntATS');
const { computeOpportunityScore } = require('../services/jobhuntScoring');
const { normalizeExtractedItem } = require('../services/jobhuntExtractor');
const { normalizeTitle, checkLinkLiveness } = require('../services/jobhuntVerification');

const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

async function main() {
  console.log('=====================================================');
  console.log('🔍 STARTING COMPREHENSIVE JOB AUDIT & VERIFICATION');
  console.log('=====================================================');

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // 1. Configure missing ATS organizations (Databricks, GitLab, Twilio)
  console.log('\n--- STEP 1: Updating Organization ATS Connectors ---');
  await pool.query(`
    UPDATE jobhunt_organizations 
    SET ats_type = 'greenhouse', ats_id = 'databricks', careers_url = 'https://boards.greenhouse.io/databricks', last_crawl_status = 'pending'
    WHERE id = 180 OR (name LIKE '%Databricks%' AND ats_id IS NULL)
  `);
  console.log('  ✓ Configured Databricks as Greenhouse ATS (slug: databricks)');

  await pool.query(`
    UPDATE jobhunt_organizations 
    SET ats_type = 'greenhouse', ats_id = 'gitlab', careers_url = 'https://boards.greenhouse.io/gitlab', last_crawl_status = 'pending'
    WHERE id = 140 OR (name LIKE '%GitLab%' AND ats_id IS NULL)
  `);
  console.log('  ✓ Configured GitLab as Greenhouse ATS (slug: gitlab)');

  await pool.query(`
    UPDATE jobhunt_organizations 
    SET ats_type = 'greenhouse', ats_id = 'twilio', careers_url = 'https://boards.greenhouse.io/twilio', last_crawl_status = 'pending'
    WHERE id = 15388 OR (name LIKE '%Twilio%' AND ats_id IS NULL)
  `);
  console.log('  ✓ Configured Twilio as Greenhouse ATS (slug: twilio)');

  // 2. Identify & Archive Known Synthetic / Mock / Generic Search URLs
  console.log('\n--- STEP 2: Archiving Synthetic Placeholders & Generic Search URLs ---');
  const syntheticPatterns = [
    'ams-swe-',
    'waw-data-',
    'waw-cloud-',
    'WAW-CLOUD-',
    'dub-aws-',
    'DUB-AWS-',
    'swe-platform-',
    'devops-engineer-warsaw',
    'careers.walmart.com/results',
    'careers.google.com/jobs/results',
    'careers.blackrock.com/job-search-results',
    'stripe.com/jobs/search',
    'jobs.intuit.com/search-jobs',
    'salesforce.wd1.myworkdayjobs.com/External_Career_Site',
    'www.goldmansachs.com/careers',
    'www.wellsfargo.com/about/careers',
    'www.adobe.com/careers.html',
    'www.coinbase.com/careers',
    'www.rippling.com/careers',
    'www.paypal.com/us/webapps/mpp/jobs',
    'jobs.apple.com/en-in/search',
    'careers.cred.club',
    'razorpay.com/jobs',
    'groww.in/careers',
    'www.zeptonow.com/careers',
    'www.nobroker.in/careers',
    'www.innopay.in/careers',
    'vahan.co/career.html',
    'lifesight.io/careers',
    'careers.even.in/open-roles',
    'recruitment.nic.in',
    'pfcindia.com/en/career',
    'opportunities.rbi.org.in',
    'sebi.gov.in',
    'rac.gov.in',
    'gailonline.com',
    'ntro.gov.in'
  ];

  let totalSyntheticArchived = 0;
  for (const pat of syntheticPatterns) {
    const [res] = await pool.query(`
      UPDATE jobhunt_opportunities
      SET is_archived = 1,
          is_verified_active = 0,
          is_active_link = 0,
          notes = CONCAT(COALESCE(notes, ''), '\n[Archived during audit: Generic search URL or legacy synthetic placeholder, not a verified direct requisition]')
      WHERE is_archived = 0 AND apply_url LIKE ?
    `, [`%${pat}%`]);
    if (res.affectedRows > 0) {
      console.log(`  Archived ${res.affectedRows} entries matching pattern "${pat}"`);
      totalSyntheticArchived += res.affectedRows;
    }
  }

  // Also archive any remaining manual_entry
  const [manualRes] = await pool.query(`
    UPDATE jobhunt_opportunities
    SET is_archived = 1,
        is_verified_active = 0,
        is_active_link = 0,
        notes = CONCAT(COALESCE(notes, ''), '\n[Archived during audit: Legacy manual entry without official ATS requisition ID]')
    WHERE is_archived = 0 AND source_type = 'manual_entry'
  `);
  totalSyntheticArchived += manualRes.affectedRows;
  console.log(`[Summary Step 2] Archived ${totalSyntheticArchived} synthetic / generic search / manual entries.`);

  // 3. Pull Live ATS Postings for newly configured ATS orgs (Databricks, GitLab, Twilio)
  console.log('\n--- STEP 3: Ingesting Live Genuine Postings from Databricks, GitLab, Twilio ---');
  const [[profile]] = await pool.query('SELECT * FROM jobhunt_profile WHERE id = 1');
  const [settingRows] = await pool.query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'jobhunt_threshold_%'");
  const thresholdMap = Object.fromEntries(settingRows.map(r => [r.key, Number(r.value)]));
  const thresholds = {
    apply_now: thresholdMap.jobhunt_threshold_apply_now || 75,
    worth_applying: thresholdMap.jobhunt_threshold_worth_applying || 55,
    investigate: thresholdMap.jobhunt_threshold_investigate || 35
  };

  const [targetOrgs] = await pool.query(`
    SELECT id, name, ats_type, ats_id, category_group, country, region, currency, visa_sponsored
    FROM jobhunt_organizations 
    WHERE id IN (180, 140, 15388)
  `);

  for (const org of targetOrgs) {
    try {
      console.log(`  Fetching live postings for ${org.name} (${org.ats_type} / ${org.ats_id})...`);
      const rawJobs = await fetchATSOpportunities(org, { techOnly: true, maxRoles: 15 });
      console.log(`  ✓ Found ${rawJobs.length} live tech postings for ${org.name}`);

      const [existingOpps] = await pool.query(
        'SELECT id, title, apply_url FROM jobhunt_opportunities WHERE org_id = ?',
        [org.id]
      );

      for (const job of rawJobs) {
        const normalizedItem = normalizeExtractedItem(job, {
          org_name: org.name,
          source_url: job.apply_url,
          source_type: job.source_type,
          raw_text: job.raw_text
        });

        const normJobTitle = normalizeTitle(job.title);
        const existingMatch = existingOpps.find(eo => 
          (eo.apply_url && job.apply_url && eo.apply_url === job.apply_url) ||
          (normalizeTitle(eo.title) === normJobTitle)
        );

        const scores = computeOpportunityScore(profile || {}, normalizedItem, org, thresholds);

        if (existingMatch) {
          await pool.query(
            `UPDATE jobhunt_opportunities 
             SET is_verified_active = 1,
                 is_active_link = 1,
                 is_archived = 0,
                 title = ?,
                 apply_url = ?,
                 location = ?,
                 posted_date = ?,
                 verified_at = CURRENT_TIMESTAMP,
                 last_verified_at = CURRENT_TIMESTAMP,
                 opportunity_score = ?,
                 recommendation = ?,
                 confidence_metadata = ?
             WHERE id = ?`,
            [normalizedItem.title, normalizedItem.apply_url, normalizedItem.location || '', todayStr, scores.opportunity_score, scores.recommendation, JSON.stringify(normalizedItem.confidence_metadata), existingMatch.id]
          );
        } else {
          await pool.query(
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
              requires_gate, is_new, is_verified_active, is_active_link, is_archived,
              verified_at, last_verified_at,
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
              ?, 1, 1, 1, 0,
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
              ?, ?, ?, ?, ?, ?,
              ?, ?
            )`,
            [
              org.id, normalizedItem.title, normalizedItem.source_url, normalizedItem.source_type,
              normalizedItem.required_degree || '', normalizedItem.required_branch || '', normalizedItem.min_experience_years,
              normalizedItem.max_age, normalizedItem.min_age, JSON.stringify(normalizedItem.required_skills || []), normalizedItem.vacancies || 1,
              normalizedItem.location || '', normalizedItem.pay_scale || '', normalizedItem.ctc_min, normalizedItem.ctc_max,
              normalizedItem.application_deadline || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
              normalizedItem.exam_date, normalizedItem.apply_url,
              normalizedItem.job_type || 'private', 'job', normalizedItem.raw_summary || '', normalizedItem.highlights || '',
              scores.eligibility_pct, scores.profile_match_pct, scores.compensation_score,
              scores.career_potential_score, scores.competition_signal, scores.application_difficulty_score,
              scores.org_quality_score, scores.deadline_urgency_score, scores.opportunity_score, scores.recommendation,
              normalizedItem.requires_gate ? 1 : 0,
              org.category_group || 'private_global', org.country || 'USA', org.region || 'Global', org.visa_sponsored || 0,
              org.currency || 'USD', normalizedItem.compensation_display || '',
              todayStr, JSON.stringify(normalizedItem.confidence_metadata)
            ]
          );
        }
      }

      await pool.query(
        `UPDATE jobhunt_organizations 
         SET last_checked_at = NOW(), last_successful_pull = NOW(), last_jobs_found = ?, last_crawl_status = 'success' 
         WHERE id = ?`,
        [rawJobs.length, org.id]
      );
    } catch (err) {
      console.error(`  ✕ Error syncing ${org.name}:`, err.message);
    }
  }

  // 4. Multi-threaded Link Verification of all remaining active opportunities
  console.log('\n--- STEP 4: Parallel Liveness Verification of Active Job Opportunities ---');
  const [activeOpps] = await pool.query(`
    SELECT id, org_id, title, apply_url, source_url, source_type, notes
    FROM jobhunt_opportunities
    WHERE is_archived = 0
    ORDER BY id ASC
  `);

  console.log(`Found ${activeOpps.length} active opportunities to verify.`);

  const CONCURRENCY = 20;
  let verifiedCount = 0;
  let deadCount = 0;
  let unconfirmedCount = 0;

  async function verifyWorker(queue) {
    while (queue.length > 0) {
      const opp = queue.shift();
      if (!opp) break;

      const targetUrl = opp.apply_url || opp.source_url;
      try {
        const liveness = await checkLinkLiveness(targetUrl);

        if (liveness.alive === false) {
          deadCount++;
          const reasonNote = `\n[Archived during audit: Dead link - ${liveness.reason || 'HTTP ' + liveness.status}]`;
          await pool.query(`
            UPDATE jobhunt_opportunities
            SET is_archived = 1,
                is_verified_active = 0,
                is_active_link = 0,
                last_verified_at = CURRENT_TIMESTAMP,
                notes = CONCAT(COALESCE(notes, ''), ?)
            WHERE id = ?
          `, [reasonNote, opp.id]);
          console.log(`  [DEAD ${deadCount}] id:${opp.id} "${opp.title.slice(0, 35)}" -> ${liveness.reason}`);
        } else if (liveness.alive === true) {
          verifiedCount++;
          await pool.query(`
            UPDATE jobhunt_opportunities
            SET is_verified_active = 1,
                is_active_link = 1,
                last_verified_at = CURRENT_TIMESTAMP,
                verified_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [opp.id]);
        } else {
          // Unconfirmed (e.g. rate limit 429 or timeout)
          unconfirmedCount++;
          await pool.query(`
            UPDATE jobhunt_opportunities
            SET last_verified_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [opp.id]);
        }
      } catch (err) {
        unconfirmedCount++;
      }

      const processed = verifiedCount + deadCount + unconfirmedCount;
      if (processed % 100 === 0 || processed === activeOpps.length) {
        console.log(`  Progress: ${processed}/${activeOpps.length} verified (${verifiedCount} live, ${deadCount} dead/archived, ${unconfirmedCount} unconfirmed)`);
      }
    }
  }

  // Run workers
  const queue = [...activeOpps];
  const workers = Array.from({ length: CONCURRENCY }, () => verifyWorker(queue));
  await Promise.all(workers);

  console.log(`\n[Summary Step 4] Complete. Live Verified: ${verifiedCount}, Dead Archived: ${deadCount}, Unconfirmed: ${unconfirmedCount}`);

  // 5. Final Active Count & Top Rankings Check
  const [[{ activeCount }]] = await pool.query('SELECT count(*) as activeCount FROM jobhunt_opportunities WHERE is_archived = 0');
  console.log(`\n=====================================================`);
  console.log(`🎉 VERIFICATION COMPLETE. Total Active Live Opportunities: ${activeCount}`);
  console.log(`=====================================================`);

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error during audit:', err);
  process.exit(1);
});
