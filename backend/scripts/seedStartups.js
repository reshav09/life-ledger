/**
 * Seed High-Growth Startups & Scaleups into jobhunt_organizations.
 * Includes user-provided startups (Even, Whatfix, Vahan, Unberry, Motilal Oswal, Lifesight, NoBroker, Volopay, Innopay)
 * plus top-tier high-compensation peers (CRED, Zepto, Razorpay, Groww, Postman, BrowserStack, Atlan, Urban Company, Navi, Slice, Swiggy, Jupiter, InMobi).
 */

const pool = require('../db/db');

const STARTUPS = [
  // ── User Requested Startups ──
  {
    name: 'Even Healthcare',
    short_name: 'Even',
    sector: 'HealthTech & Managed Care',
    org_type: 'startup',
    careers_url: 'https://careers.even.in/open-roles',
    website: 'https://even.in',
    category_group: 'startup',
    country: 'India',
    region: 'Bengaluru',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 92,
    notes: 'HealthTech unicorn aspirant. Complete health coverage & clinics. High base pay, 3% referral bonus, relocation support. Direct applications to jobs@even.in.'
  },
  {
    name: 'Whatfix',
    short_name: 'Whatfix',
    sector: 'Enterprise SaaS & Digital Adoption Solutions',
    org_type: 'unicorn',
    careers_url: 'https://whatfix101.hire.trakstar.com/?loc=&rsu=mile&city=Bengaluru&q=&limit=25#content',
    website: 'https://whatfix.com',
    category_group: 'startup',
    country: 'India',
    region: 'Bengaluru / Hybrid',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 93,
    notes: 'SaaS Unicorn ($900M+). Backed by SoftBank & Peak XV. Top-tier B2B engineering, ₹28-55+ LPA CTC + ESOPs. Bengaluru & remote.'
  },
  {
    name: 'Vahan.ai',
    short_name: 'Vahan',
    sector: 'AI Recruitment & Workforce Automation',
    org_type: 'startup',
    careers_url: 'https://vahan.co/career.html',
    website: 'https://vahan.co',
    category_group: 'startup',
    country: 'India',
    region: 'Bengaluru',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 89,
    notes: 'AI-driven blue-collar hiring assistant. Y Combinator & Khosla Ventures backed. High-scale Python/Go & LLM pipelines. ₹25-45 LPA.'
  },
  {
    name: 'Unberry',
    short_name: 'Unberry',
    sector: 'AI Skill Intelligence & Gamified Assessment',
    org_type: 'startup',
    careers_url: 'https://app.unberry.com/careers/68399df0f6eadf0013d0df16',
    website: 'https://unberry.com',
    category_group: 'startup',
    country: 'India',
    region: 'Bengaluru',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 88,
    notes: 'Talent & behavioral assessment platform using neuroscience + AI. Fast-growing product engineering team. ₹20-40 LPA.'
  },
  {
    name: 'Motilal Oswal Financial Services (Tech & Quant)',
    short_name: 'MOFSL',
    sector: 'WealthTech, Brokerage & FinTech',
    org_type: 'private',
    careers_url: 'https://motilaloswal.turbohire.co/dashboardv2?orgId=0f6e3a76-85ff-4b66-8bfa-4cd4fede4ffa&type=0',
    website: 'https://www.motilaloswal.com',
    category_group: 'startup',
    country: 'India',
    region: 'Mumbai / Bengaluru',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 90,
    notes: 'Major Indian institutional brokerage and digital wealth platform. Heavy digital transformation in algos, trading APIs & low-latency execution. ₹22-45 LPA.'
  },
  {
    name: 'Lifesight',
    short_name: 'Lifesight',
    sector: 'Customer Data Platform & Marketing Analytics',
    org_type: 'startup',
    careers_url: 'https://lifesight.io/careers/',
    website: 'https://lifesight.io',
    category_group: 'startup',
    country: 'India',
    region: 'Bengaluru / Singapore',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 90,
    notes: 'Next-gen CDP and marketing measurement platform. High-scale streaming data pipelines (Kafka, ClickHouse, Spark). ₹24-50 LPA.'
  },
  {
    name: 'NoBroker',
    short_name: 'NoBroker',
    sector: 'PropTech & Real Estate Marketplace',
    org_type: 'unicorn',
    careers_url: 'https://www.nobroker.in/careers',
    website: 'https://www.nobroker.in',
    category_group: 'startup',
    country: 'India',
    region: 'Bengaluru',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 91,
    notes: 'PropTech Unicorn ($1B+). Backed by Tiger Global & General Atlantic. High scale microservices, search ranking & fintech mortgage arm. ₹25-50+ LPA.'
  },
  {
    name: 'Volopay',
    short_name: 'Volopay',
    sector: 'FinTech Corporate Spend & Cards',
    org_type: 'startup',
    careers_url: 'https://app.dover.com/dover/careers/ebed3959-fa8a-4719-b143-0730e1223ec8',
    website: 'https://www.volopay.com',
    category_group: 'startup',
    country: 'India',
    region: 'Bengaluru / Singapore',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 91,
    notes: 'YC W21 FinTech platform for corporate cards, expense management & cross-border payments. High cash + equity. ₹25-50 LPA.'
  },
  {
    name: 'Innopay Technologies',
    short_name: 'Innopay',
    sector: 'FinTech Payments & Payout Infrastructure',
    org_type: 'startup',
    careers_url: 'https://www.innopay.in/careers',
    website: 'https://www.innopay.in',
    category_group: 'startup',
    country: 'India',
    region: 'Bengaluru',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 87,
    notes: 'Payment aggregator and merchant collections infrastructure. Fast execution, distributed transaction processing. ₹20-40 LPA.'
  },

  // ── High-Compensation Tier-1 Startups & Unicorns ──
  {
    name: 'CRED',
    short_name: 'CRED',
    sector: 'FinTech & Premium Credit Rewards',
    org_type: 'unicorn',
    careers_url: 'https://careers.cred.club/',
    website: 'https://cred.club',
    category_group: 'startup',
    country: 'India',
    region: 'Bengaluru',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 98,
    notes: 'Top-tier Indian compensation (₹38-65+ LPA for SDE-1/2). ₹10L health cover, generous ESOP buybacks, stunning UI/design and high-scale distributed backend.'
  },
  {
    name: 'Zepto',
    short_name: 'Zepto',
    sector: 'Quick Commerce & Ultra-Fast Delivery',
    org_type: 'unicorn',
    careers_url: 'https://www.zeptonow.com/careers',
    website: 'https://www.zeptonow.com',
    category_group: 'startup',
    country: 'India',
    region: 'Bengaluru',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 95,
    notes: 'Decacorn-trajectory Quick Commerce ($5B). Hyper-growth, high compensation (₹32-60+ LPA). Distributed inventory optimization & real-time dispatch systems.'
  },
  {
    name: 'Razorpay',
    short_name: 'Razorpay',
    sector: 'FinTech Payments & Neo-Banking Infrastructure',
    org_type: 'unicorn',
    careers_url: 'https://razorpay.com/jobs/',
    website: 'https://razorpay.com',
    category_group: 'startup',
    country: 'India',
    region: 'Bengaluru',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'greenhouse',
    ats_id: 'razorpaysoftwareprivatelimited',
    quality_score: 96,
    notes: 'Fintech decacorn ($7.5B). Standard-bearer for Indian payments engineering. High base salaries (₹30-55+ LPA), ESOP liquidity, exceptional mentorship.'
  },
  {
    name: 'Groww',
    short_name: 'Groww',
    sector: 'FinTech Investments & Neo-Brokerage',
    org_type: 'unicorn',
    careers_url: 'https://groww.in/careers',
    website: 'https://groww.in',
    category_group: 'startup',
    country: 'India',
    region: 'Bengaluru',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 95,
    notes: 'Profitable Fintech unicorn ($3B+). Highest active retail stock trading market share in India. Distributed microservices in Spring Boot/Go. ₹28-52 LPA.'
  },
  {
    name: 'Postman',
    short_name: 'Postman',
    sector: 'API Platform & Developer Productivity',
    org_type: 'unicorn',
    careers_url: 'https://www.postman.com/company/careers/',
    website: 'https://www.postman.com',
    category_group: 'startup',
    country: 'India',
    region: 'Bengaluru / Remote',
    visa_sponsored: 1,
    currency: 'INR',
    ats_type: 'greenhouse',
    ats_id: 'postman',
    quality_score: 97,
    notes: 'Global API platform unicorn ($5.6B). Top-of-market global pay, flexible remote culture, generous equity, ₹35-65+ LPA.'
  },
  {
    name: 'BrowserStack',
    short_name: 'BrowserStack',
    sector: 'Cloud Infrastructure & Test Automation Platform',
    org_type: 'unicorn',
    careers_url: 'https://www.browserstack.com/careers',
    website: 'https://www.browserstack.com',
    category_group: 'startup',
    country: 'India',
    region: 'Mumbai / Bengaluru / Remote',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 96,
    notes: 'Bootstrapped & profitable SaaS unicorn ($4B). Huge bare-metal cloud infrastructure & virtualization engineering. ₹32-58+ LPA.'
  },
  {
    name: 'Atlan',
    short_name: 'Atlan',
    sector: 'Data Governance & Active Metadata Platform',
    org_type: 'unicorn',
    careers_url: 'https://jobs.lever.co/atlan',
    website: 'https://atlan.com',
    category_group: 'startup',
    country: 'India',
    region: 'Remote / Bengaluru',
    visa_sponsored: 1,
    currency: 'INR',
    ats_type: 'lever',
    ats_id: 'atlan',
    quality_score: 96,
    notes: 'Modern data stack unicorn ($750M+). Sequoia/Peak XV backed. 100% remote-first culture, top cash + equity compensation (₹35-65 LPA).'
  },
  {
    name: 'Urban Company',
    short_name: 'Urban Company',
    sector: 'Managed Home Services Marketplace',
    org_type: 'unicorn',
    careers_url: 'https://www.urbancompany.com/careers',
    website: 'https://www.urbancompany.com',
    category_group: 'startup',
    country: 'India',
    region: 'Gurugram / Bengaluru',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 93,
    notes: 'Marketplace unicorn ($2.8B). Heavy tech in dynamic dispatch, demand forecasting, IoT smart appliances. ₹28-50 LPA.'
  },
  {
    name: 'Navi Technologies',
    short_name: 'Navi',
    sector: 'Digital Lending, UPI & InsurTech',
    org_type: 'unicorn',
    careers_url: 'https://navi.com/careers',
    website: 'https://navi.com',
    category_group: 'startup',
    country: 'India',
    region: 'Bengaluru',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 94,
    notes: 'Founded by Sachin Bansal (Flipkart founder). Known for high fixed pay without ESOP inflation (₹35-60+ LPA). Top engineering bar.'
  },
  {
    name: 'Slice',
    short_name: 'Slice',
    sector: 'Consumer Payments & Small Finance Banking',
    org_type: 'unicorn',
    careers_url: 'https://www.sliceit.com/careers',
    website: 'https://www.sliceit.com',
    category_group: 'startup',
    country: 'India',
    region: 'Bengaluru',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 92,
    notes: 'Fintech unicorn merged with NESFB bank. Fast-paced consumer app scaling, risk modelling, real-time ledger systems. ₹28-50 LPA.'
  },
  {
    name: 'Jupiter Money',
    short_name: 'Jupiter',
    sector: 'Digital Banking & Neo-Financial Services',
    org_type: 'startup',
    careers_url: 'https://jupiter.money/careers/',
    website: 'https://jupiter.money',
    category_group: 'startup',
    country: 'India',
    region: 'Bengaluru / Mumbai',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 92,
    notes: 'Founded by Jitendra Gupta (Citrus Pay). Modern neo-banking app with heavy emphasis on product UX and high-scale banking switch APIs. ₹28-48 LPA.'
  },
  {
    name: 'Swiggy',
    short_name: 'Swiggy',
    sector: 'Hyperlocal Logistics & FoodTech Decacorn',
    org_type: 'unicorn',
    careers_url: 'https://careers.swiggy.com/',
    website: 'https://www.swiggy.com',
    category_group: 'startup',
    country: 'India',
    region: 'Bengaluru / Remote-Friendly',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 95,
    notes: 'Decacorn tech powerhouse. Millions of orders per day. Exceptional distributed systems, high throughput microservices in Go & Java. ₹30-60+ LPA.'
  },
  {
    name: 'InMobi / Glance',
    short_name: 'InMobi',
    sector: 'AdTech, AI Lockscreen & Consumer Content',
    org_type: 'unicorn',
    careers_url: 'https://www.inmobi.com/company/careers/',
    website: 'https://www.inmobi.com',
    category_group: 'startup',
    country: 'India',
    region: 'Bengaluru',
    visa_sponsored: 0,
    currency: 'INR',
    ats_type: 'custom_scrape',
    ats_id: null,
    quality_score: 93,
    notes: 'India’s first unicorn. Big data at petabyte scale (Spark, Druid, Flink). Deep learning models for live ad bidding and personalized content. ₹28-50 LPA.'
  }
];

async function seed() {
  console.log('[SeedStartups] Starting insertion of high-growth startups...');
  let inserted = 0;
  let updated = 0;

  for (const org of STARTUPS) {
    const [[existing]] = await pool.query(
      'SELECT id, name, category_group FROM jobhunt_organizations WHERE name = ? OR short_name = ? LIMIT 1',
      [org.name, org.short_name]
    );

    if (existing) {
      await pool.query(
        `UPDATE jobhunt_organizations 
         SET category_group = ?, careers_url = ?, website = ?, notes = ?, 
             quality_score = ?, ats_type = COALESCE(?, ats_type), ats_id = COALESCE(?, ats_id), is_active = 1
         WHERE id = ?`,
        [org.category_group, org.careers_url, org.website, org.notes, org.quality_score, org.ats_type, org.ats_id, existing.id]
      );
      updated++;
      console.log(`[SeedStartups] Updated: ${org.name}`);
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
      console.log(`[SeedStartups] Inserted: ${org.name}`);
    }
  }

  console.log(`[SeedStartups] Completed! Inserted: ${inserted}, Updated: ${updated}`);
  process.exit(0);
}

seed().catch(err => {
  console.error('[SeedStartups] Fatal error:', err);
  process.exit(1);
});
