/**
 * Seed TrueUp Hot 200, Remote 200 & AI 50 Organizations into MariaDB
 * Idempotent: Skips organizations that already exist by name or short_name.
 */

const pool = require('../db/db');

const TRUEUP_ORGS = [
  {
    name: 'Supabase',
    short_name: 'Supabase',
    sector: 'Developer Tools & Database Infrastructure',
    org_type: 'private',
    careers_url: 'https://supabase.com/careers',
    website: 'https://supabase.com',
    category_group: 'private_global',
    country: 'Remote',
    region: 'Global',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'ashby',
    ats_id: 'supabase',
    quality_score: 96,
    notes: 'TrueUp Remote 200. Open-source Firebase alternative. Fully distributed global remote contracts via Deel/EOR.'
  },
  {
    name: 'Linear',
    short_name: 'Linear',
    sector: 'Developer Tools & Issue Tracking',
    org_type: 'private',
    careers_url: 'https://linear.app/careers',
    website: 'https://linear.app',
    category_group: 'private_global',
    country: 'Remote',
    region: 'Global',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'ashby',
    ats_id: 'linear',
    quality_score: 95,
    notes: 'TrueUp Remote 200. High-craft product management. Fully remote worldwide hiring with generous compensation.'
  },
  {
    name: 'ElevenLabs',
    short_name: 'ElevenLabs',
    sector: 'Generative AI & Voice Foundation Models',
    org_type: 'private',
    careers_url: 'https://elevenlabs.io/careers',
    website: 'https://elevenlabs.io',
    category_group: 'private_eu',
    country: 'United Kingdom',
    region: 'Europe',
    visa_sponsored: 1,
    currency: 'GBP',
    ats_type: 'ashby',
    ats_id: 'elevenlabs',
    quality_score: 97,
    notes: 'TrueUp AI 50. Unicorn valued at $11B. London and Warsaw offices. Full UK Skilled Worker & EU visa sponsorship.'
  },
  {
    name: 'Mistral AI',
    short_name: 'Mistral',
    sector: 'Frontier AI & Large Language Models',
    org_type: 'private',
    careers_url: 'https://mistral.ai/careers',
    website: 'https://mistral.ai',
    category_group: 'private_eu',
    country: 'France',
    region: 'Europe',
    visa_sponsored: 1,
    currency: 'EUR',
    ats_type: 'ashby',
    ats_id: 'mistral',
    quality_score: 98,
    notes: 'TrueUp AI 50 & Hot 200. European frontier AI leader. Paris headquarters. French Tech Visa & European relocation sponsored.'
  },
  {
    name: 'Cognition AI',
    short_name: 'Cognition',
    sector: 'Autonomous AI Software Engineering (Devin)',
    org_type: 'private',
    careers_url: 'https://cognition.ai/careers',
    website: 'https://cognition.ai',
    category_group: 'private_global',
    country: 'United States',
    region: 'North America',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'ashby',
    ats_id: 'cognition',
    quality_score: 96,
    notes: 'TrueUp Hot 200 ($48B). Creators of Devin AI. NYC & SF. US work authorization & O-1/H-1B transfer sponsorship.'
  },
  {
    name: 'Perplexity AI',
    short_name: 'Perplexity',
    sector: 'Conversational Search & Foundation Models',
    org_type: 'private',
    careers_url: 'https://www.perplexity.ai/careers',
    website: 'https://www.perplexity.ai',
    category_group: 'private_global',
    country: 'United States',
    region: 'North America',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'ashby',
    ats_id: 'perplexity',
    quality_score: 96,
    notes: 'TrueUp AI 50. High-velocity answer engine. San Francisco. US O-1 and H-1B transfer support.'
  },
  {
    name: 'Harvey AI',
    short_name: 'Harvey',
    sector: 'Legal & Professional Services AI',
    org_type: 'private',
    careers_url: 'https://www.harvey.ai/careers',
    website: 'https://www.harvey.ai',
    category_group: 'private_global',
    country: 'United States',
    region: 'North America',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'ashby',
    ats_id: 'harvey',
    quality_score: 94,
    notes: 'TrueUp AI 50 & Hot 200 ($16B). OpenAI Startup Fund backed. SF and NYC offices.'
  },
  {
    name: 'Kalshi',
    short_name: 'Kalshi',
    sector: 'Regulated Prediction Markets & FinTech',
    org_type: 'private',
    careers_url: 'https://kalshi.com/careers',
    website: 'https://kalshi.com',
    category_group: 'private_global',
    country: 'United States',
    region: 'North America',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'ashby',
    ats_id: 'kalshi',
    quality_score: 94,
    notes: 'TrueUp Hot 200 ($22B). CFTC-regulated event contract exchange. NYC headquarters.'
  },
  {
    name: 'Physical Intelligence',
    short_name: 'Physical Intelligence',
    sector: 'Robotics Foundation Models & Physical AI',
    org_type: 'private',
    careers_url: 'https://www.physicalintelligence.company/',
    website: 'https://www.physicalintelligence.company',
    category_group: 'private_global',
    country: 'United States',
    region: 'North America',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'ashby',
    ats_id: 'physical-intelligence',
    quality_score: 97,
    notes: 'TrueUp Hot 200 ($5.6B). Sequoia and Founders Fund backed robotics AI foundation model team.'
  },
  {
    name: 'Safe Superintelligence',
    short_name: 'SSI',
    sector: 'Pure AI Safety & Frontier Research',
    org_type: 'private',
    careers_url: 'https://ssi.inc',
    website: 'https://ssi.inc',
    category_group: 'private_global',
    country: 'United States',
    region: 'North America',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'greenhouse',
    ats_id: 'safe-superintelligence',
    quality_score: 98,
    notes: 'TrueUp Hot 200 ($32B). Founded by Ilya Sutskever. Single-focus AI safety lab in Palo Alto & Tel Aviv.'
  },
  {
    name: 'Lovable',
    short_name: 'Lovable',
    sector: 'Autonomous Full-Stack AI Software Creator',
    org_type: 'private',
    careers_url: 'https://lovable.dev/careers',
    website: 'https://lovable.dev',
    category_group: 'private_eu',
    country: 'Sweden',
    region: 'Europe',
    visa_sponsored: 1,
    currency: 'EUR',
    ats_type: 'ashby',
    ats_id: 'lovable',
    quality_score: 95,
    notes: 'TrueUp Hot 200 ($13B, Accel). Stockholm, Sweden. Full Swedish work permit & EU visa sponsorship provided.'
  },
  {
    name: 'Leya',
    short_name: 'Leya',
    sector: 'AI Legal Workspace & Document Reasoning',
    org_type: 'private',
    careers_url: 'https://leya.law/careers',
    website: 'https://leya.law',
    category_group: 'private_eu',
    country: 'Sweden',
    region: 'Europe',
    visa_sponsored: 1,
    currency: 'EUR',
    ats_type: 'ashby',
    ats_id: 'leya',
    quality_score: 93,
    notes: 'TrueUp YC Leaders ($5.6B). Stockholm and London. Full relocation and visa sponsorship for engineers.'
  },
  {
    name: 'Deel',
    short_name: 'Deel',
    sector: 'Global HR, Payroll & Compliance Platform',
    org_type: 'private',
    careers_url: 'https://www.deel.com/careers',
    website: 'https://www.deel.com',
    category_group: 'private_global',
    country: 'Remote',
    region: 'Global',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'greenhouse',
    ats_id: 'deel',
    quality_score: 95,
    notes: 'TrueUp Remote 200 ($12B). Fully distributed remote team operating across 100+ countries.'
  },
  {
    name: 'Remote.com',
    short_name: 'Remote',
    sector: 'Global Employment & Contractor Management',
    org_type: 'private',
    careers_url: 'https://remote.com/careers',
    website: 'https://remote.com',
    category_group: 'private_global',
    country: 'Remote',
    region: 'Global',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'greenhouse',
    ats_id: 'remote',
    quality_score: 94,
    notes: 'TrueUp Remote 200 ($3B). Global remote-first engineering team.'
  },
  {
    name: 'Wolt',
    short_name: 'Wolt',
    sector: 'European Delivery Tech & Real-Time Logistics',
    org_type: 'private',
    careers_url: 'https://wolt.com/en/jobs',
    website: 'https://wolt.com',
    category_group: 'private_eu',
    country: 'Finland',
    region: 'Europe',
    visa_sponsored: 1,
    currency: 'EUR',
    ats_type: 'greenhouse',
    ats_id: 'wolt',
    quality_score: 94,
    notes: 'TrueUp Top European Tech. Helsinki & Berlin hubs. Comprehensive EU relocation and Finnish/German visa support.'
  },
  {
    name: 'Revolut',
    short_name: 'Revolut',
    sector: 'Global FinTech Superapp & Neobank',
    org_type: 'private',
    careers_url: 'https://www.revolut.com/careers',
    website: 'https://www.revolut.com',
    category_group: 'private_eu',
    country: 'United Kingdom',
    region: 'Europe',
    visa_sponsored: 1,
    currency: 'GBP',
    ats_type: 'lever',
    ats_id: 'revolut',
    quality_score: 96,
    notes: 'TrueUp FinTech Leaders ($115B). London HQ. Extensive UK Skilled Worker & EU visa sponsorship.'
  },
  {
    name: 'Scale AI',
    short_name: 'Scale AI',
    sector: 'AI Training Data & Model Evaluation',
    org_type: 'private',
    careers_url: 'https://scale.com/careers',
    website: 'https://scale.com',
    category_group: 'private_global',
    country: 'United States',
    region: 'North America',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'greenhouse',
    ats_id: 'scaleai',
    quality_score: 95,
    notes: 'TrueUp AI 50 ($14B). Core data partner for OpenAI, Meta, and US Government.'
  },
  {
    name: 'Whatnot',
    short_name: 'Whatnot',
    sector: 'Live Marketplace & Social Commerce',
    org_type: 'private',
    careers_url: 'https://www.whatnot.com/careers',
    website: 'https://www.whatnot.com',
    category_group: 'private_global',
    country: 'United States',
    region: 'North America',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'greenhouse',
    ats_id: 'whatnot',
    quality_score: 93,
    notes: 'TrueUp Hot 200 ($20B). High-scale live video streaming and real-time bidding.'
  },
  {
    name: 'Automattic',
    short_name: 'Automattic',
    sector: 'Open Web Platforms (WordPress, Tumblr)',
    org_type: 'private',
    careers_url: 'https://automattic.com/work-with-us/',
    website: 'https://automattic.com',
    category_group: 'private_global',
    country: 'Remote',
    region: 'Global',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'greenhouse',
    ats_id: 'automattic',
    quality_score: 94,
    notes: 'TrueUp Remote 200. Pioneer of 100% remote asynchronous work worldwide.'
  },
  {
    name: 'DuckDuckGo',
    short_name: 'DuckDuckGo',
    sector: 'Private Search & Internet Privacy',
    org_type: 'private',
    careers_url: 'https://duckduckgo.com/hiring',
    website: 'https://duckduckgo.com',
    category_group: 'private_global',
    country: 'Remote',
    region: 'Global',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'greenhouse',
    ats_id: 'duckduckgo',
    quality_score: 93,
    notes: 'TrueUp Remote 200. Fully distributed remote team since inception.'
  },
  {
    name: 'Vercel',
    short_name: 'Vercel',
    sector: 'Frontend Cloud & Edge Compute (Next.js)',
    org_type: 'private',
    careers_url: 'https://vercel.com/careers',
    website: 'https://vercel.com',
    category_group: 'private_global',
    country: 'United States',
    region: 'Global',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'greenhouse',
    ats_id: 'vercel',
    quality_score: 96,
    notes: 'TrueUp Cloud Leaders ($3.2B). Remote-first engineering with US/global presence.'
  }
];

async function seedTrueUpOrgs() {
  console.log('[SeedTrueUp] Starting ingestion of top TrueUp Hot 200, Remote 200 & AI 50 organizations...');
  let inserted = 0;
  let skipped = 0;

  for (const org of TRUEUP_ORGS) {
    // Check if organization exists by exact name or short_name
    const [[existing]] = await pool.query(
      'SELECT id, name FROM jobhunt_organizations WHERE name = ? OR short_name = ? LIMIT 1',
      [org.name, org.short_name]
    );

    if (existing) {
      // Update ATS info and notes if needed
      await pool.query(
        `UPDATE jobhunt_organizations 
         SET ats_type = COALESCE(ats_type, ?), 
             ats_id = COALESCE(ats_id, ?),
             country = COALESCE(country, ?),
             visa_sponsored = GREATEST(COALESCE(visa_sponsored, 0), ?)
         WHERE id = ?`,
        [org.ats_type, org.ats_id, org.country, org.visa_sponsored, existing.id]
      );
      skipped++;
    } else {
      await pool.query(
        `INSERT INTO jobhunt_organizations 
         (name, short_name, sector, org_type, careers_url, website, notes, quality_score, is_active, category_group, country, region, visa_sponsored, currency, ats_type, ats_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
        [
          org.name,
          org.short_name,
          org.sector,
          org.org_type,
          org.careers_url,
          org.website,
          org.notes,
          org.quality_score,
          org.category_group,
          org.country,
          org.region,
          org.visa_sponsored,
          org.currency,
          org.ats_type,
          org.ats_id
        ]
      );
      inserted++;
      console.log(`[SeedTrueUp] + Ingested: ${org.name} (${org.ats_type}:${org.ats_id}) [Visa: ${org.visa_sponsored ? 'Yes' : 'No'}]`);
    }
  }

  console.log(`[SeedTrueUp] Complete. Inserted: ${inserted}, Updated/Skipped existing: ${skipped}`);
  process.exit(0);
}

seedTrueUpOrgs().catch(err => {
  console.error('[SeedTrueUp] Fatal error:', err);
  process.exit(1);
});
