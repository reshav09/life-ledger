const pool = require('../db/db');
const { fetchATSOpportunities } = require('../services/jobhuntATS');

async function testAll() {
  const [orgs] = await pool.query(
    "SELECT id, name, ats_type, ats_id, careers_url FROM jobhunt_organizations WHERE category_group = 'startup' AND ats_type != 'custom_scrape'"
  );
  console.log(`Testing ${orgs.length} startups with configured ATS connectors...\n`);

  for (const org of orgs) {
    try {
      const jobs = await fetchATSOpportunities(org, { techOnly: false, maxRoles: 10 });
      console.log(`✅ [${org.ats_type.toUpperCase()}] ${org.name} (${org.ats_id}): ${jobs.length} jobs found`);
      await pool.query(
        "UPDATE jobhunt_organizations SET last_crawl_status = 'success', last_jobs_found = ?, last_checked_at = NOW() WHERE id = ?",
        [jobs.length, org.id]
      );
    } catch (err) {
      console.log(`❌ [${org.ats_type.toUpperCase()}] ${org.name} (${org.ats_id}): ${err.message}`);
      // If 404, we can switch to custom_scrape
      if (err.message.includes('404')) {
        console.log(`   -> Setting ${org.name} to custom_scrape`);
        await pool.query(
          "UPDATE jobhunt_organizations SET ats_type = 'custom_scrape', ats_id = NULL, last_crawl_status = NULL, last_checked_at = NOW() WHERE id = ?",
          [org.id]
        );
      }
    }
  }

  process.exit(0);
}

testAll().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

