/**
 * consolidateOrgs.js
 * 
 * Consolidates fragmented and duplicate corporate entities into single canonical organizations.
 * Re-links all opportunities at the posting level, preserving location, country, currency,
 * category_group, and visa_sponsored attributes.
 */

const pool = require('../db/db');
const { computeOpportunityScore } = require('../services/jobhuntScoring');
const { runOpportunitiesLifecycle } = require('../services/jobhuntLifecycle');

const CONSOLIDATION_SPECS = [
  {
    canonicalName: 'Amazon',
    targetName: 'Amazon',
    shortName: 'Amazon',
    sector: 'Big Tech & Cloud Infrastructure',
    orgType: 'Global Tech Giant',
    website: 'https://www.amazon.com',
    careersUrl: 'https://www.amazon.jobs',
    atsType: 'custom_scrape',
    atsId: null,
    qualityScore: 98,
    categoryGroup: 'private_in',
    visaSponsored: 1, // Has global visa sponsorship in EU
    notes: 'Global technology giant and cloud infrastructure leader (AWS). Employs software, systems, and DevOps engineers globally with active hiring in India, Luxembourg, Ireland, and USA.',
    aliases: ['Amazon India', 'Amazon EU SARL (Luxembourg)', 'AWS Ireland (Dublin)']
  },
  {
    canonicalName: 'Google (Alphabet)',
    targetName: 'Google',
    shortName: 'Google',
    sector: 'Big Tech & Distributed Systems',
    orgType: 'Global Tech Giant',
    website: 'https://about.google',
    careersUrl: 'https://careers.google.com',
    atsType: 'custom_scrape',
    atsId: null,
    qualityScore: 99,
    categoryGroup: 'private_in',
    visaSponsored: 1,
    notes: 'Global technology leader in search, cloud infrastructure, AI, and systems. Active engineering hubs in India, Switzerland (Zurich B-Permit quota), Poland (Warsaw Cloud Hub), and USA.',
    aliases: ['Google India', 'Google Zurich', 'Google Cloud Warsaw']
  },
  {
    canonicalName: 'Uber',
    targetName: 'Uber',
    shortName: 'Uber',
    sector: 'Distributed Systems & Mobility Tech',
    orgType: 'Global Tech Giant',
    website: 'https://www.uber.com',
    careersUrl: 'https://www.uber.com/careers',
    atsType: 'smartrecruiters',
    atsId: 'uber',
    qualityScore: 96,
    categoryGroup: 'private_in',
    visaSponsored: 1,
    notes: 'Global mobility, logistics, and fintech platform. Engineering hubs in India (Bengaluru/Hyderabad) and Netherlands (Amsterdam EMEA HQ - Dutch HSM sponsor).',
    aliases: ['Uber India', 'Uber Amsterdam (EMEA HQ)']
  },
  {
    canonicalName: 'Stripe',
    targetName: 'Stripe',
    shortName: 'Stripe',
    sector: 'FinTech & Payments Infrastructure',
    orgType: 'Global FinTech Leader',
    website: 'https://stripe.com',
    careersUrl: 'https://stripe.com/jobs',
    atsType: 'greenhouse',
    atsId: 'stripe',
    qualityScore: 99,
    categoryGroup: 'private_in',
    visaSponsored: 1,
    notes: 'Global economic infrastructure for the internet. Engineering centers in India and Ireland (Dublin European HQ - CSEP sponsor).',
    aliases: ['Stripe Europe']
  },
  {
    canonicalName: 'Databricks',
    targetName: 'Databricks',
    shortName: 'Databricks',
    sector: 'Data Lakehouse & Enterprise AI',
    orgType: 'Global Enterprise AI Leader',
    website: 'https://www.databricks.com',
    careersUrl: 'https://www.databricks.com/company/careers',
    atsType: 'custom_scrape',
    atsId: null,
    qualityScore: 97,
    categoryGroup: 'private_in',
    visaSponsored: 1,
    notes: 'Unified data platform and AI pioneer (Spark, Delta Lake, MLflow). Engineering centers in India and Netherlands (Amsterdam EMEA Hub).',
    aliases: ['Databricks Europe (Amsterdam)']
  },
  {
    canonicalName: 'Snowflake Poland',
    targetName: 'Snowflake',
    shortName: 'Snowflake',
    sector: 'Data Cloud Platform & Systems Architecture',
    orgType: 'Global Cloud Data Leader',
    website: 'https://www.snowflake.com',
    careersUrl: 'https://careers.snowflake.com',
    atsType: 'custom_scrape',
    atsId: null,
    qualityScore: 97,
    categoryGroup: 'private_eu',
    visaSponsored: 1,
    notes: 'The Data Cloud platform provider. Major global engineering hubs in USA and Poland (Warsaw systems engineering center).',
    aliases: []
  },
  {
    canonicalName: 'Adobe',
    targetName: 'Adobe',
    shortName: 'Adobe',
    sector: 'Digital Media & Cloud Software',
    orgType: 'Global Tech Giant',
    website: 'https://www.adobe.com',
    careersUrl: 'https://adobe.wd5.myworkdayjobs.com/adobe/external_experienced',
    atsType: 'workday',
    atsId: 'adobe.wd5.myworkdayjobs.com/adobe/external_experienced',
    qualityScore: 96,
    categoryGroup: 'private_in',
    visaSponsored: 0,
    notes: 'Global leader in creative software, digital experience, and AI. Major engineering presence across India and USA.',
    aliases: ['Adobe India']
  },
  {
    canonicalName: 'Apple',
    targetName: 'Apple',
    shortName: 'Apple',
    sector: 'Consumer Tech & Systems',
    orgType: 'Global Tech Giant',
    website: 'https://www.apple.com',
    careersUrl: 'https://jobs.apple.com',
    atsType: 'custom_scrape',
    atsId: null,
    qualityScore: 98,
    categoryGroup: 'private_in',
    visaSponsored: 0,
    notes: 'Global hardware, software, and cloud services leader. Engineering centers in India and USA.',
    aliases: ['Apple India']
  },
  {
    canonicalName: 'Microsoft',
    targetName: 'Microsoft',
    shortName: 'Microsoft',
    sector: 'Big Tech & Cloud Systems',
    orgType: 'Global Tech Giant',
    website: 'https://www.microsoft.com',
    careersUrl: 'https://careers.microsoft.com',
    atsType: 'custom_scrape',
    atsId: null,
    qualityScore: 98,
    categoryGroup: 'private_in',
    visaSponsored: 0,
    notes: 'Global software, cloud (Azure), and AI leader. Major engineering campuses in India (Hyderabad/Bengaluru/Noida) and USA.',
    aliases: ['Microsoft India']
  },
  {
    canonicalName: 'Salesforce',
    targetName: 'Salesforce',
    shortName: 'Salesforce',
    sector: 'Enterprise Cloud & CRM',
    orgType: 'Global Cloud Enterprise',
    website: 'https://www.salesforce.com',
    careersUrl: 'https://salesforce.wd12.myworkdayjobs.com/salesforce/External_Career_Site',
    atsType: 'workday',
    atsId: 'salesforce.wd12.myworkdayjobs.com/salesforce/External_Career_Site',
    qualityScore: 95,
    categoryGroup: 'private_in',
    visaSponsored: 0,
    notes: 'Global enterprise cloud CRM and platform company. Major development centers in India and USA.',
    aliases: ['Salesforce India']
  },
  {
    canonicalName: 'PayPal',
    targetName: 'PayPal',
    shortName: 'PayPal',
    sector: 'FinTech & Payments Infrastructure',
    orgType: 'Global FinTech Leader',
    website: 'https://www.paypal.com',
    careersUrl: 'https://careers.pypl.com',
    atsType: 'custom_scrape',
    atsId: null,
    qualityScore: 94,
    categoryGroup: 'private_in',
    visaSponsored: 0,
    notes: 'Global digital payments platform. Large engineering hubs in India (Bengaluru/Chennai) and USA.',
    aliases: ['PayPal India']
  },
  {
    canonicalName: 'Atlassian',
    targetName: 'Atlassian',
    shortName: 'Atlassian',
    sector: 'Collaboration Software & Cloud Platforms',
    orgType: 'Global Enterprise SaaS',
    website: 'https://www.atlassian.com',
    careersUrl: 'https://www.atlassian.com/company/careers',
    atsType: 'custom_scrape',
    atsId: null,
    qualityScore: 96,
    categoryGroup: 'private_in',
    visaSponsored: 0,
    notes: 'Collaboration and developer tools platform (Jira, Confluence). Major distributed and India engineering centers.',
    aliases: ['Atlassian India']
  },
  {
    canonicalName: 'BlackRock',
    targetName: 'BlackRock',
    shortName: 'BlackRock',
    sector: 'Financial Technology & Asset Management',
    orgType: 'Global FinTech Asset Manager',
    website: 'https://www.blackrock.com',
    careersUrl: 'https://careers.blackrock.com',
    atsType: 'custom_scrape',
    atsId: null,
    qualityScore: 95,
    categoryGroup: 'private_in',
    visaSponsored: 0,
    notes: 'World largest asset manager and creator of the Aladdin financial operating system. Significant tech presence in Gurgaon and Mumbai.',
    aliases: ['BlackRock India']
  },
  {
    canonicalName: 'Goldman Sachs',
    targetName: 'Goldman Sachs',
    shortName: 'Goldman Sachs',
    sector: 'Investment Banking & FinTech Systems',
    orgType: 'Global Financial Institution',
    website: 'https://www.goldmansachs.com',
    careersUrl: 'https://www.goldmansachs.com/careers',
    atsType: 'custom_scrape',
    atsId: null,
    qualityScore: 96,
    categoryGroup: 'private_in',
    visaSponsored: 0,
    notes: 'Global investment banking and securities leader. Large engineering campuses in Bengaluru and Hyderabad.',
    aliases: ['Goldman Sachs India']
  },
  {
    canonicalName: 'Walmart',
    targetName: 'Walmart',
    shortName: 'Walmart',
    sector: 'Retail Tech & High-Scale E-Commerce',
    orgType: 'Global Retail Tech Enterprise',
    website: 'https://www.walmart.com',
    careersUrl: 'https://careers.walmart.com',
    atsType: 'custom_scrape',
    atsId: null,
    qualityScore: 95,
    categoryGroup: 'private_in',
    visaSponsored: 0,
    notes: 'Walmart Global Tech develops enterprise supply chain, e-commerce, and cloud platforms with large hubs in Bengaluru and Chennai.',
    aliases: ['Walmart Global Tech India']
  },
  {
    canonicalName: 'Wells Fargo',
    targetName: 'Wells Fargo',
    shortName: 'Wells Fargo',
    sector: 'Banking & Financial Technology',
    orgType: 'Global Financial Institution',
    website: 'https://www.wellsfargo.com',
    careersUrl: 'https://www.wellsfargo.com/about/careers',
    atsType: 'custom_scrape',
    atsId: null,
    qualityScore: 93,
    categoryGroup: 'private_in',
    visaSponsored: 0,
    notes: 'Major global banking and financial services institution with extensive engineering operations in India.',
    aliases: ['Wells Fargo India']
  },
  {
    canonicalName: 'ByteDance',
    targetName: 'ByteDance',
    shortName: 'ByteDance',
    sector: 'Social Tech & Algorithmic Media',
    orgType: 'Global Tech Unicorn',
    website: 'https://www.bytedance.com',
    careersUrl: 'https://jobs.bytedance.com',
    atsType: 'smartrecruiters',
    atsId: 'bytedance',
    qualityScore: 97,
    categoryGroup: 'private_sg',
    visaSponsored: 1,
    notes: 'Creator of TikTok and Douyin. Singapore Asia-Pacific headquarters sponsoring employment passes and visas.',
    aliases: ['ByteDance Singapore']
  },
  {
    canonicalName: 'Citadel',
    targetName: 'Citadel',
    shortName: 'Citadel',
    sector: 'Quantitative Trading & Market Making',
    orgType: 'Global Quantitative Giant',
    website: 'https://www.citadel.com',
    careersUrl: 'https://www.citadel.com/careers',
    atsType: 'custom_scrape',
    atsId: null,
    qualityScore: 99,
    categoryGroup: 'quant_hft',
    visaSponsored: 1,
    notes: 'Premier global hedge fund and quantitative market maker (Citadel & Citadel Securities).',
    aliases: ['Citadel & Citadel Securities']
  },
  {
    canonicalName: 'Hudson River Trading',
    targetName: 'Hudson River Trading',
    shortName: 'HRT',
    sector: 'Quantitative Trading & High-Frequency Systems',
    orgType: 'Global Quantitative Giant',
    website: 'https://www.hudsonrivertrading.com',
    careersUrl: 'https://www.hudsonrivertrading.com/careers',
    atsType: 'custom_scrape',
    atsId: null,
    qualityScore: 99,
    categoryGroup: 'quant_hft',
    visaSponsored: 1,
    notes: 'Leading quantitative trading firm building high-performance low-latency distributed trading systems.',
    aliases: ['Hudson River Trading (HRT)']
  }
];

async function runConsolidation() {
  console.log('=== Starting Company Entity Consolidation ===');
  
  // 1. Remove duplicate opportunity titles before repointing
  console.log('Step 1: Removing duplicate opportunity postings...');
  await pool.query('DELETE FROM jobhunt_opportunities WHERE id = 170'); // Duplicate of 153 (Google early career)
  await pool.query('DELETE FROM jobhunt_opportunities WHERE id = 166'); // Duplicate of 149 (BlackRock analyst)
  console.log('Duplicate opportunities removed.');

  const [allOrgs] = await pool.query('SELECT id, name, short_name, ats_type, ats_id FROM jobhunt_organizations');
  const orgMap = new Map(allOrgs.map(o => [o.name.toLowerCase(), o]));

  let totalMergedAliases = 0;
  let totalOpportunitiesRepointed = 0;

  for (const spec of CONSOLIDATION_SPECS) {
    const canonicalOrg = orgMap.get(spec.canonicalName.toLowerCase());
    if (!canonicalOrg) {
      console.warn(`[WARNING] Canonical org "${spec.canonicalName}" not found in database!`);
      continue;
    }

    const canonicalId = canonicalOrg.id;
    console.log(`\nProcessing canonical: "${spec.targetName}" (id: ${canonicalId})...`);

    // Update canonical org with cleaned name and best attributes
    await pool.query(`
      UPDATE jobhunt_organizations
      SET name = ?,
          short_name = ?,
          sector = COALESCE(NULLIF(?, ''), sector),
          org_type = COALESCE(NULLIF(?, ''), org_type),
          website = COALESCE(NULLIF(?, ''), website),
          careers_url = COALESCE(NULLIF(?, ''), careers_url),
          ats_type = COALESCE(NULLIF(?, ''), ats_type),
          ats_id = COALESCE(NULLIF(?, ''), ats_id),
          quality_score = GREATEST(COALESCE(quality_score, 0), ?),
          visa_sponsored = GREATEST(visa_sponsored, ?),
          notes = ?
      WHERE id = ?
    `, [
      spec.targetName,
      spec.shortName,
      spec.sector,
      spec.orgType,
      spec.website,
      spec.careersUrl,
      spec.atsType,
      spec.atsId,
      spec.qualityScore,
      spec.visaSponsored,
      spec.notes,
      canonicalId
    ]);

    // Find all alias orgs to merge
    for (const aliasName of spec.aliases) {
      const aliasOrg = orgMap.get(aliasName.toLowerCase());
      if (!aliasOrg || aliasOrg.id === canonicalId) continue;

      const aliasId = aliasOrg.id;
      console.log(`  Merging alias "${aliasOrg.name}" (id: ${aliasId}) -> Canonical (id: ${canonicalId})...`);

      // 1. Repoint opportunities
      const [oppUpdate] = await pool.query(
        'UPDATE jobhunt_opportunities SET org_id = ? WHERE org_id = ?',
        [canonicalId, aliasId]
      );
      totalOpportunitiesRepointed += oppUpdate.affectedRows || 0;

      // 2. Repoint content hashes (or ignore if duplicate hash)
      await pool.query(
        'UPDATE IGNORE jobhunt_content_hashes SET org_id = ? WHERE org_id = ?',
        [canonicalId, aliasId]
      );
      await pool.query('DELETE FROM jobhunt_content_hashes WHERE org_id = ?', [aliasId]);

      // 3. Delete alias org safely
      await pool.query('DELETE FROM jobhunt_organizations WHERE id = ?', [aliasId]);
      totalMergedAliases++;
    }
  }

  console.log(`\n=== Consolidation Summary ===`);
  console.log(`Aliases Consolidated & Removed: ${totalMergedAliases}`);
  console.log(`Opportunities Safely Repointed: ${totalOpportunitiesRepointed}`);

  // 2. Rescore all opportunities
  console.log('\n=== Rescoring All Opportunities Against Profile ===');
  const [profiles] = await pool.query('SELECT * FROM jobhunt_profile LIMIT 1');
  const profile = profiles[0] || {};
  const [opps] = await pool.query(`
    SELECT o.*, org.name as org_name, org.quality_score as org_qs, org.category_group as org_cat
    FROM jobhunt_opportunities o
    JOIN jobhunt_organizations org ON o.org_id = org.id
  `);

  for (const opp of opps) {
    const org = {
      name: opp.org_name,
      quality_score: opp.org_qs,
      category_group: opp.org_cat
    };
    const scores = computeOpportunityScore(profile, opp, org);
    await pool.query(`
      UPDATE jobhunt_opportunities
      SET eligibility_pct = ?,
          profile_match_pct = ?,
          compensation_score = ?,
          career_potential_score = ?,
          competition_signal = ?,
          application_difficulty_score = ?,
          org_quality_score = ?,
          deadline_urgency_score = ?,
          opportunity_score = ?,
          recommendation = ?
      WHERE id = ?
    `, [
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
      opp.id
    ]);
  }
  console.log(`Scoring engine updated ${opps.length} opportunities successfully.`);

  // 3. Lifecycle run
  const lifecycleRes = await runOpportunitiesLifecycle(pool);
  console.log('Lifecycle run:', lifecycleRes);

  console.log('=== Company Entity Consolidation Complete ===');
}

if (require.main === module) {
  runConsolidation()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Consolidation failed:', err);
      process.exit(1);
    });
}

module.exports = { runConsolidation };
