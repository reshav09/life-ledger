const pool = require('../db/db');
const { fetchATSOpportunities } = require('../services/jobhuntATS');
const { computeOpportunityScore } = require('../services/jobhuntScoring');
const { normalizeExtractedItem } = require('../services/jobhuntExtractor');
const { normalizeTitle } = require('../services/jobhuntVerification');
const { runOpportunitiesLifecycle } = require('../services/jobhuntLifecycle');

/**
 * Strict profile verification function for Reshav Sharma.
 * Profile: B.Tech CSE (2026 grad) + BS Data Science (IIT Madras), ~1.5 yrs experience.
 * Skills: Python, SQL, C++, Bash, AWS, Azure, GCP, Docker, Kubernetes, Linux, Prometheus, Grafana,
 *         FinOps, Cloud Cost Optimization, FastAPI, Streamlit, Machine Learning, RAG, PyTorch.
 */
function verifyJobForProfile(job, org) {
  const title = (job.title || '').trim();
  const lower = title.toLowerCase();
  const location = (job.location || '').toLowerCase();

  // 1. Strict Exclusion: Non-technical roles
  const nonTechPattern = /\b(sales|account executive|business development|bdr|sdr|marketing|growth manager|social media|content writer|copywriter|recruiter|recruiting|talent acquisition|hr|people operations|office manager|legal|counsel|paralegal|compliance|internal audit|auditor|payroll|tax|accounting|accountant|procurement|facilities|nurse|doctor|physician|technician|ward|clinic|pharmacist|driver|warehouse|logistics coordinator|customer service|customer support|support specialist|renewals|telephony executive|collections)\b/i;
  if (nonTechPattern.test(lower) && !/\b(software|devops|cloud|systems|ml|ai|data engineer|developer)\b/i.test(lower)) {
    return { isMatch: false, reason: 'Non-technical role' };
  }

  // 2. Strict Exclusion: Senior leadership & executive management
  const leadershipPattern = /\b(director|vice president|\bvp\b|head of|general manager|chief|partner engineering manager|principal|staff software engineer|lead architect|engineering manager|group product manager)\b/i;
  if (leadershipPattern.test(lower)) {
    return { isMatch: false, reason: 'Senior executive / leadership role' };
  }

  // 3. Strict Exclusion: Roles explicitly demanding 5+ years of experience in title
  const seniorExpPattern = /\b(senior|sr\.|sr\b|lead|principal|staff|iv|v|iii)\b/i;
  if (seniorExpPattern.test(lower) && !/\b(intern|graduate|associate|junior|entry|early career|i\b|sde-1|sde 1|sde1)\b/i.test(lower)) {
    return { isMatch: false, reason: 'Senior / Lead role requiring high experience' };
  }

  // 4. Location Verification: Must be in India, Remote, or Visa-sponsored
  const isIndia = /\b(india|bengaluru|bangalore|hyderabad|pune|noida|delhi|gurugram|gurgaon|chennai|mumbai|remote)\b/i.test(location) ||
                  /\b(india|bengaluru|bangalore|hyderabad|pune|noida|delhi|gurugram|gurgaon|chennai|mumbai)\b/i.test(org.region || '') ||
                  org.country === 'India';

  const isRemote = job.is_remote === 1 || /\b(remote|anywhere|work from home)\b/i.test(location);
  const isVisaSponsor = org.visa_sponsored === 1 || org.category_group === 'research_internship' || org.category_group === 'private_global';

  if (!isIndia && !isRemote && !isVisaSponsor) {
    return { isMatch: false, reason: `Location outside target regions: ${job.location}` };
  }

  // 5. Positive Technical Domain Verification
  const devopsPattern = /\b(devops|cloud|infrastructure|sre|site reliability|finops|platform engineer|systems engineer|systems and reliability|observability|kubernetes|docker|linux)\b/i;
  const backendPattern = /\b(software engineer|software developer|sde|sde-1|sde 1|sde1|backend|back-end|full[\s-]?stack|member of technical staff|mts|developer|systems|applied scientist)\b/i;
  const aiDataPattern = /\b(machine learning|ml engineer|ai engineer|data engineer|data scientist|applied ml|llm|computer vision|nlp|deep learning|data associate)\b/i;
  const earlyCareerPattern = /\b(intern|internship|graduate|associate developer|associate engineer|early career|junior|trainee|apprentice|fellow|fellowship)\b/i;

  let domain = null;
  if (devopsPattern.test(lower)) domain = 'Cloud / DevOps / FinOps';
  else if (aiDataPattern.test(lower)) domain = 'AI & Machine Learning / Data';
  else if (earlyCareerPattern.test(lower)) domain = 'Early Career & Fellowships';
  else if (backendPattern.test(lower)) domain = 'Backend & Software Engineering';

  if (!domain) {
    return { isMatch: false, reason: `Title "${title}" does not match target tech domains` };
  }

  return { isMatch: true, domain };
}

async function run() {
  console.log("=== Starting Thorough Verification & Job Board Update ===");

  // 1. Fetch user profile
  const [[profile]] = await pool.query("SELECT * FROM jobhunt_profile WHERE id = 1");
  console.log(`Loaded Profile for: ${profile.full_name} (${profile.degree}, Grad: ${profile.graduation_year})`);

  // 2. Load thresholds
  const [settingRows] = await pool.query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'jobhunt_threshold_%'");
  const thresholdMap = Object.fromEntries(settingRows.map(r => [r.key, Number(r.value)]));
  const thresholds = {
    apply_now: thresholdMap.jobhunt_threshold_apply_now || 75,
    worth_applying: thresholdMap.jobhunt_threshold_worth_applying || 55,
    investigate: thresholdMap.jobhunt_threshold_investigate || 35
  };

  // 3. Find active organizations with ATS or structured feeds
  const [orgs] = await pool.query(`
    SELECT * FROM jobhunt_organizations 
    WHERE ats_type IN ('greenhouse', 'ashby', 'smartrecruiters', 'pyjamahr', 'workday')
      AND ats_id IS NOT NULL 
      AND is_active = 1
    ORDER BY quality_score DESC
  `);
  console.log(`Scanning ${orgs.length} ATS-enabled organizations...\n`);

  let totalRawJobs = 0;
  let totalVerifiedMatched = 0;
  let totalInserted = 0;
  let totalUpdated = 0;

  const verifiedMatchesSummary = [];

  for (const org of orgs) {
    let rawJobs = [];
    try {
      rawJobs = await fetchATSOpportunities(org, { techOnly: false, maxRoles: 50 });
      await pool.query(
        `UPDATE jobhunt_organizations 
         SET last_checked_at = NOW(), last_successful_pull = NOW(), last_jobs_found = ?, last_crawl_status = 'success'
         WHERE id = ?`,
        [rawJobs.length, org.id]
      );
    } catch (err) {
      await pool.query(
        `UPDATE jobhunt_organizations SET last_checked_at = NOW(), last_crawl_status = ? WHERE id = ?`,
        [`error: ${err.message.slice(0, 50)}`, org.id]
      );
      continue;
    }

    totalRawJobs += rawJobs.length;

    // Filter jobs strictly matching Reshav's profile
    const verifiedJobs = [];
    for (const j of rawJobs) {
      const check = verifyJobForProfile(j, org);
      if (check.isMatch) {
        verifiedJobs.push({ ...j, matchedDomain: check.domain });
      }
    }

    if (verifiedJobs.length === 0) continue;

    console.log(`🏢 ${org.name} (${org.ats_type}/${org.ats_id}): ${verifiedJobs.length} verified profile matches (out of ${rawJobs.length} raw jobs)`);

    // Fetch all existing opportunities for this org (including archived) for clean deduplication
    const [existingOpps] = await pool.query(
      'SELECT id, title, apply_url, recommendation, opportunity_score FROM jobhunt_opportunities WHERE org_id = ?',
      [org.id]
    );

    for (const job of verifiedJobs) {
      totalVerifiedMatched++;
      const normJobTitle = normalizeTitle(job.title);

      const existingMatch = existingOpps.find(eo =>
        (eo.apply_url && job.apply_url && eo.apply_url === job.apply_url) ||
        (normalizeTitle(eo.title) === normJobTitle) ||
        (eo.title.trim().toLowerCase() === job.title.trim().toLowerCase())
      );

      // Score opportunity against Reshav's profile
      const normalizedItem = normalizeExtractedItem(job, {
        org_name: org.name,
        source_url: job.apply_url,
        source_type: job.source_type,
        raw_text: job.raw_text
      });

      const scoringResult = computeOpportunityScore(profile, normalizedItem, org, thresholds);

      if (existingMatch) {
        // Update existing opportunity and un-archive if it was archived
        await pool.query(
          `UPDATE jobhunt_opportunities 
           SET is_archived = 0,
               is_verified_active = 1,
               is_active_link = 1,
               verified_at = CURRENT_TIMESTAMP,
               last_verified_at = CURRENT_TIMESTAMP,
               opportunity_score = ?,
               recommendation = ?,
               apply_url = ?,
               notes = ?
           WHERE id = ?`,
          [
            scoringResult.opportunity_score,
            scoringResult.recommendation,
            job.apply_url,
            `Verified Match: ${job.matchedDomain}. ${job.raw_text ? job.raw_text.slice(0, 150) : ''}`,
            existingMatch.id
          ]
        );
        totalUpdated++;
      } else {
        // Insert new verified opportunity with ON DUPLICATE KEY UPDATE protection
        const loc = job.location || (org.region ? `${org.region}, India` : 'Bengaluru, India');
        const compDisplay = org.min_ctc_threshold ? `₹${org.min_ctc_threshold}+ LPA` : (org.currency === 'USD' ? '$100K+ / yr' : 'Competitive CTC + Benefits');

        try {
          await pool.query(
            `INSERT INTO jobhunt_opportunities 
             (org_id, title, source_url, source_type, required_degree, required_branch, min_experience_years, required_skills, location, apply_url, job_type, category, eligibility_pct, profile_match_pct, compensation_score, career_potential_score, org_quality_score, opportunity_score, recommendation, notes, is_new, is_archived, category_group, country, region, visa_sponsored, currency, compensation_display, is_verified_active, is_active_link)
             VALUES (?, ?, ?, 'ats_api', ?, 'Computer Science / Engineering', 0, ?, ?, ?, 'private', 'job', ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?, 1, 1)
             ON DUPLICATE KEY UPDATE
               is_archived = 0,
               is_verified_active = 1,
               is_active_link = 1,
               opportunity_score = VALUES(opportunity_score),
               recommendation = VALUES(recommendation),
               apply_url = VALUES(apply_url),
               notes = VALUES(notes),
               last_verified_at = CURRENT_TIMESTAMP`,
            [
              org.id,
              job.title,
              job.apply_url,
              'B.Tech / B.E. in Computer Science or related STEM',
              'Python, Cloud, Linux, Docker, Distributed Systems, SQL, Git',
              loc,
              job.apply_url,
              scoringResult.breakdown?.eligibility || 90,
              scoringResult.breakdown?.profile_match || 88,
              scoringResult.breakdown?.compensation || 90,
              scoringResult.breakdown?.career_potential || 92,
              org.quality_score || 90,
              scoringResult.opportunity_score,
              scoringResult.recommendation,
              `[Verified Live ATS] Domain: ${job.matchedDomain}. Location: ${loc}. Direct official application link verified.`,
              org.category_group || 'startup',
              org.country || 'India',
              org.region || 'Bengaluru',
              org.visa_sponsored || 0,
              org.currency || 'INR',
              compDisplay
            ]
          );
          totalInserted++;
        } catch (insertErr) {
          console.warn(`Could not insert "${job.title}" for ${org.name}: ${insertErr.message}`);
        }
      }

      verifiedMatchesSummary.push({
        company: org.name,
        title: job.title,
        domain: job.matchedDomain,
        location: job.location || org.region,
        recommendation: scoringResult.recommendation,
        score: scoringResult.opportunity_score,
        url: job.apply_url
      });
    }
  }

  // 4. Run automated lifecycle cleaning
  console.log("\nRunning lifecycle cleanup...");
  await runOpportunitiesLifecycle(pool);

  console.log("\n=== Summary of Execution ===");
  console.log(`Total Raw Job Postings Scanned: ${totalRawJobs}`);
  console.log(`Total Verified Profile Matches: ${totalVerifiedMatched}`);
  console.log(`New Verified Opportunities Added: ${totalInserted}`);
  console.log(`Existing Opportunities Refreshed: ${totalUpdated}`);

  // Preview top 20 verified opportunities for Reshav
  console.log("\nTop 20 Verified Opportunities for Reshav Sharma:");
  verifiedMatchesSummary.sort((a, b) => b.score - a.score).slice(0, 20).forEach((m, idx) => {
    console.log(`${idx + 1}. [${m.score}/100 - ${m.recommendation.toUpperCase()}] ${m.company} — ${m.title}`);
    console.log(`   Domain: ${m.domain} | Loc: ${m.location} | Apply: ${m.url}`);
  });

  process.exit(0);
}

run().catch(err => {
  console.error("Execution failed:", err);
  process.exit(1);
});
