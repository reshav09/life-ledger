const {
  fetchGreenhousePostings,
  fetchLeverPostings,
  fetchAshbyPostings,
  fetchSmartRecruitersPostings,
  fetchATSOpportunities
} = require('../services/jobhuntATS');

async function test() {
  console.log('--- Testing ATS Direct JSON Connectors ---');

  // Test Greenhouse
  try {
    const gh = await fetchGreenhousePostings('canonical');
    console.log(`[Greenhouse - Canonical] Fetched ${gh.length} jobs. Sample:`, {
      title: gh[0]?.title,
      apply_url: gh[0]?.apply_url,
      location: gh[0]?.location,
      confidence: gh[0]?.confidence_metadata
    });
  } catch (err) {
    console.error('[Greenhouse - Canonical] Error:', err.message);
  }

  // Test Lever
  try {
    const lev = await fetchLeverPostings('palantir');
    console.log(`[Lever - Palantir] Fetched ${lev.length} jobs. Sample:`, {
      title: lev[0]?.title,
      apply_url: lev[0]?.apply_url,
      location: lev[0]?.location,
      confidence: lev[0]?.confidence_metadata
    });
  } catch (err) {
    console.error('[Lever - Palantir] Error:', err.message);
  }

  // Test Ashby
  try {
    const ash = await fetchAshbyPostings('notion');
    console.log(`[Ashby - Notion] Fetched ${ash.length} jobs. Sample:`, {
      title: ash[0]?.title,
      apply_url: ash[0]?.apply_url,
      location: ash[0]?.location,
      confidence: ash[0]?.confidence_metadata
    });
  } catch (err) {
    console.error('[Ashby - Notion] Error:', err.message);
  }

  // Test SmartRecruiters
  try {
    const sr = await fetchSmartRecruitersPostings('deliveryhero');
    console.log(`[SmartRecruiters - DeliveryHero] Fetched ${sr.length} jobs. Sample:`, {
      title: sr[0]?.title,
      apply_url: sr[0]?.apply_url,
      location: sr[0]?.location,
      confidence: sr[0]?.confidence_metadata
    });
  } catch (err) {
    console.error('[SmartRecruiters - DeliveryHero] Error:', err.message);
  }

  // Test Org Dispatcher with filtering
  try {
    const org = { name: 'Coinbase', ats_type: 'greenhouse', ats_id: 'coinbase' };
    const filtered = await fetchATSOpportunities(org, { techOnly: true, maxRoles: 5 });
    console.log(`[Dispatcher - Coinbase Tech Roles] Fetched ${filtered.length} filtered tech jobs:`);
    filtered.forEach(j => console.log(`  • ${j.title} (${j.location})`));
  } catch (err) {
    console.error('[Dispatcher - Coinbase] Error:', err.message);
  }
}

test().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
