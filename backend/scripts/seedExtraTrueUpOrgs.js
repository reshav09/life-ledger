/**
 * Seed Additional TrueUp Leaders (PostHog, Pinecone, LangChain, Cursor, Resend, Vapi)
 * and update visa status for Anthropic, OpenAI, GitLab, Mistral AI.
 */

const pool = require('../db/db');

const EXTRA_ORGS = [
  {
    name: 'PostHog',
    short_name: 'PostHog',
    sector: 'Product Analytics & Developer Tools (Open Source)',
    org_type: 'private',
    careers_url: 'https://posthog.com/careers',
    website: 'https://posthog.com',
    category_group: 'startup',
    country: 'Remote',
    region: 'Global',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'ashby',
    ats_id: 'posthog',
    quality_score: 96,
    notes: 'TrueUp Remote 200. Transparent pay, 100% remote worldwide contracts via Deel.'
  },
  {
    name: 'Pinecone',
    short_name: 'Pinecone',
    sector: 'Vector Database Infrastructure for AI',
    org_type: 'private',
    careers_url: 'https://www.pinecone.io/careers/',
    website: 'https://www.pinecone.io',
    category_group: 'startup',
    country: 'United States',
    region: 'North America',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'ashby',
    ats_id: 'pinecone',
    quality_score: 95,
    notes: 'TrueUp AI 50 ($750M). High-performance vector search engine. US H-1B/O-1 & Israel sponsorship.'
  },
  {
    name: 'LangChain',
    short_name: 'LangChain',
    sector: 'LLM Frameworks & LangSmith Observability',
    org_type: 'private',
    careers_url: 'https://www.langchain.com/careers',
    website: 'https://www.langchain.com',
    category_group: 'startup',
    country: 'United States',
    region: 'North America',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'ashby',
    ats_id: 'langchain',
    quality_score: 94,
    notes: 'TrueUp AI 50. Creators of LangChain & LangSmith. SF & remote. US visa sponsorship.'
  },
  {
    name: 'Cursor',
    short_name: 'Cursor',
    sector: 'AI-First Code Editor & Developer Experience (Anysphere)',
    org_type: 'private',
    careers_url: 'https://cursor.com/careers',
    website: 'https://cursor.com',
    category_group: 'startup',
    country: 'United States',
    region: 'North America',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 97,
    notes: 'TrueUp Hot 200 ($2.5B). Anysphere. SF office. US H-1B transfer & O-1 visa sponsorship.'
  },
  {
    name: 'Resend',
    short_name: 'Resend',
    sector: 'Developer-First Email & Communication Infrastructure',
    org_type: 'private',
    careers_url: 'https://resend.com/careers',
    website: 'https://resend.com',
    category_group: 'startup',
    country: 'Remote',
    region: 'Global',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'ashby',
    ats_id: 'resend',
    quality_score: 95,
    notes: 'TrueUp High Craft. Creators of React Email. Fully distributed global remote team.'
  },
  {
    name: 'Vapi',
    short_name: 'Vapi',
    sector: 'Voice AI Platform & Real-Time Telephony Infrastructure',
    org_type: 'private',
    careers_url: 'https://vapi.ai/careers',
    website: 'https://vapi.ai',
    category_group: 'startup',
    country: 'United States',
    region: 'North America',
    visa_sponsored: 1,
    currency: 'USD',
    ats_type: 'ashby',
    ats_id: 'vapi',
    quality_score: 94,
    notes: 'TrueUp AI 50. Sub-500ms voice agents over WebSockets/SIP. SF & remote with visa sponsorship.'
  }
];

async function seed() {
  console.log('[SeedExtra] Starting...');
  for (const org of EXTRA_ORGS) {
    const [[existing]] = await pool.query(
      'SELECT id FROM jobhunt_organizations WHERE name = ? OR short_name = ? LIMIT 1',
      [org.name, org.short_name]
    );

    if (existing) {
      await pool.query(
        'UPDATE jobhunt_organizations SET category_group = ?, visa_sponsored = 1, ats_type = COALESCE(ats_type, ?), ats_id = COALESCE(ats_id, ?) WHERE id = ?',
        [org.category_group, org.ats_type, org.ats_id, existing.id]
      );
      console.log(`[SeedExtra] Updated: ${org.name}`);
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
      console.log(`[SeedExtra] Inserted: ${org.name}`);
    }
  }

  // Update visa and slugs for frontier orgs
  await pool.query("UPDATE jobhunt_organizations SET visa_sponsored = 1 WHERE name IN ('Anthropic', 'OpenAI', 'GitLab')");
  await pool.query("UPDATE jobhunt_organizations SET ats_id = 'mistral.ai' WHERE name = 'Mistral AI'");

  console.log('[SeedExtra] Completed successfully.');
  process.exit(0);
}

seed().catch(err => {
  console.error('[SeedExtra] Fatal error:', err);
  process.exit(1);
});
