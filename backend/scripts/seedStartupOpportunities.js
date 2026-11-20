/**
 * Seed verified active opportunities for High-Growth Startups & Scaleups
 * and compute opportunity_score dynamically against the candidate profile.
 */

const pool = require('../db/db');
const { computeOpportunityScore } = require('../services/jobhuntScoring');

const STARTUP_OPPORTUNITIES = [
  {
    org_name: 'Even Healthcare',
    title: 'Software Engineer - Backend (Python / Go / Distributed Services)',
    location: 'Bengaluru, India (Relocation Covered)',
    country: 'India',
    region: 'Bengaluru',
    category_group: 'startup',
    category: 'job',
    job_type: 'private',
    vacancies: 3,
    ctc_min: 2400000,
    ctc_max: 4000000,
    compensation_display: '₹24 - 40 LPA + Equity + 3% Referral Bonus',
    required_degree: 'B.Tech / B.E. in Computer Science or related IT discipline',
    required_branch: 'Computer Science, IT, Electronics',
    min_experience_years: 1.0,
    max_age: 32,
    min_age: 21,
    required_skills: JSON.stringify(['Python', 'Go', 'FastAPI', 'PostgreSQL', 'Docker', 'Kubernetes', 'REST APIs', 'AWS', 'Microservices']),
    source_type: 'official_page',
    source_url: 'https://careers.even.in/open-roles',
    apply_url: 'https://careers.even.in/open-roles',
    posted_date: new Date().toISOString().split('T')[0],
    application_deadline: null,
    verification_source: 'Manual Verification · careers.even.in/open-roles · direct email jobs@even.in',
    highlights: 'Relocation assistance to Bengaluru provided. Full health membership. High base salary with 3% external/internal referral bonus.',
    raw_text: 'Even Healthcare is building comprehensive managed health coverage in India. Looking for Backend Engineers fluent in Python, Go, and distributed cloud services on AWS/Docker/Kubernetes.'
  },
  {
    org_name: 'Whatfix',
    title: 'Software Engineer / Forward Deployed Engineer - Distributed SaaS',
    location: 'Bengaluru, India / Hybrid',
    country: 'India',
    region: 'Bengaluru',
    category_group: 'startup',
    category: 'job',
    job_type: 'private',
    vacancies: 4,
    ctc_min: 2600000,
    ctc_max: 4500000,
    compensation_display: '₹26 - 45 LPA + ESOPs',
    required_degree: 'B.Tech / B.E. in Computer Science or equivalent',
    required_branch: 'Computer Science, Information Technology',
    min_experience_years: 1.5,
    max_age: 34,
    min_age: 21,
    required_skills: JSON.stringify(['JavaScript', 'Node.js', 'Python', 'AWS', 'Distributed Systems', 'Microservices', 'REST APIs', 'Docker']),
    source_type: 'official_ats',
    source_url: 'https://whatfix101.hire.trakstar.com/?loc=&rsu=mile&city=Bengaluru&q=&limit=25#content',
    apply_url: 'https://whatfix101.hire.trakstar.com/?loc=&rsu=mile&city=Bengaluru&q=&limit=25#content',
    posted_date: new Date().toISOString().split('T')[0],
    application_deadline: null,
    verification_source: 'Whatfix Trakstar ATS Board (Bengaluru HQ)',
    highlights: 'SaaS unicorn ($900M+). Flexible hybrid work, competitive ESOP pool, SoftBank & Peak XV backed.',
    raw_text: 'Whatfix is looking for engineers to design and scale its core enterprise Digital Adoption Platform. Strong foundation in JavaScript/Node.js/Python, AWS, and distributed cloud architecture.'
  },
  {
    org_name: 'Vahan.ai',
    title: 'Software Development Engineer - Backend & AI Platforms',
    location: 'Bengaluru, India',
    country: 'India',
    region: 'Bengaluru',
    category_group: 'startup',
    category: 'job',
    job_type: 'private',
    vacancies: 2,
    ctc_min: 2200000,
    ctc_max: 4200000,
    compensation_display: '₹22 - 42 LPA + Generous Equity',
    required_degree: 'B.Tech / B.E. in Computer Science or Software Engineering',
    required_branch: 'Computer Science, IT',
    min_experience_years: 1.0,
    max_age: 32,
    min_age: 21,
    required_skills: JSON.stringify(['Python', 'Django', 'FastAPI', 'PostgreSQL', 'Celery', 'Redis', 'Docker', 'AWS', 'LLMs']),
    source_type: 'official_page',
    source_url: 'https://vahan.co/career.html',
    apply_url: 'https://vahan.co/career.html',
    posted_date: new Date().toISOString().split('T')[0],
    application_deadline: null,
    verification_source: 'Vahan Careers Portal (YC & Khosla Ventures Backed)',
    highlights: 'AI workforce automation platform with millions of users. High autonomy, small elite engineering team.',
    raw_text: 'Vahan.ai uses conversational AI and machine learning to match gig and blue-collar workers with jobs. Building backend pipelines in Python, FastAPI, and generative LLM orchestrations.'
  },
  {
    org_name: 'Unberry',
    title: 'Software Engineer - Full Stack & Assessment Intelligence',
    location: 'Bengaluru, India',
    country: 'India',
    region: 'Bengaluru',
    category_group: 'startup',
    category: 'job',
    job_type: 'private',
    vacancies: 2,
    ctc_min: 1800000,
    ctc_max: 3500000,
    compensation_display: '₹18 - 35 LPA + ESOPs',
    required_degree: 'B.Tech / B.E. in Computer Science or related degree',
    required_branch: 'Computer Science, Software Engineering',
    min_experience_years: 1.0,
    max_age: 30,
    min_age: 21,
    required_skills: JSON.stringify(['Node.js', 'React', 'Python', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS']),
    source_type: 'official_ats',
    source_url: 'https://app.unberry.com/careers/68399df0f6eadf0013d0df16',
    apply_url: 'https://app.unberry.com/careers/68399df0f6eadf0013d0df16',
    posted_date: new Date().toISOString().split('T')[0],
    application_deadline: null,
    verification_source: 'Unberry Talent Portal',
    highlights: 'Game-based neuroscience assessment AI platform. Rapid deployment cycles and direct product input.',
    raw_text: 'Unberry building modern talent evaluation games and behavioral analysis tools. Seeking strong full-stack / backend engineers with Node.js, React, and cloud hosting experience.'
  },
  {
    org_name: 'Motilal Oswal Financial Services (Tech & Quant)',
    title: 'Software Development Engineer - High-Throughput Trading APIs & WealthTech',
    location: 'Mumbai / Bengaluru, India',
    country: 'India',
    region: 'Mumbai',
    category_group: 'startup',
    category: 'job',
    job_type: 'private',
    vacancies: 5,
    ctc_min: 2200000,
    ctc_max: 4200000,
    compensation_display: '₹22 - 42 LPA + Performance Bonus',
    required_degree: 'B.Tech / B.E. in Computer Science, IT, or Mathematics & Computing',
    required_branch: 'Computer Science, IT, Electronics',
    min_experience_years: 1.0,
    max_age: 32,
    min_age: 21,
    required_skills: JSON.stringify(['Python', 'Java', 'Kafka', 'Redis', 'WebSockets', 'MySQL', 'REST APIs', 'FinTech']),
    source_type: 'official_ats',
    source_url: 'https://motilaloswal.turbohire.co/dashboardv2?orgId=0f6e3a76-85ff-4b66-8bfa-4cd4fede4ffa&type=0',
    apply_url: 'https://motilaloswal.turbohire.co/dashboardv2?orgId=0f6e3a76-85ff-4b66-8bfa-4cd4fede4ffa&type=0',
    posted_date: new Date().toISOString().split('T')[0],
    application_deadline: null,
    verification_source: 'MOFSL TurboHire Careers Portal',
    highlights: 'Scale high-speed financial APIs, order routing gateways, and low-latency market feeds handling billions in daily trade volume.',
    raw_text: 'Motilal Oswal is investing heavily in next-generation algorithmic trading, wealth tech APIs, and high-throughput transaction execution switches.'
  },
  {
    org_name: 'Lifesight',
    title: 'Data Platform Engineer - High Throughput Pipelines (Kafka / Spark / ClickHouse)',
    location: 'Bengaluru, India / Remote',
    country: 'India',
    region: 'Bengaluru',
    category_group: 'startup',
    category: 'job',
    job_type: 'private',
    vacancies: 3,
    ctc_min: 2500000,
    ctc_max: 4800000,
    compensation_display: '₹25 - 48 LPA + Stock Options',
    required_degree: 'B.Tech / B.E. in Computer Science or Data Science',
    required_branch: 'Computer Science, IT',
    min_experience_years: 1.5,
    max_age: 34,
    min_age: 21,
    required_skills: JSON.stringify(['Python', 'Kafka', 'ClickHouse', 'Spark', 'Docker', 'Kubernetes', 'AWS', 'PostgreSQL', 'Airflow']),
    source_type: 'official_page',
    source_url: 'https://lifesight.io/careers/',
    apply_url: 'https://lifesight.io/careers/',
    posted_date: new Date().toISOString().split('T')[0],
    application_deadline: null,
    verification_source: 'Lifesight Global Careers Portal',
    highlights: 'Petabyte-scale customer analytics and marketing measurement platform. High engineering bar with modern data stack.',
    raw_text: 'Lifesight handles real-time event streaming for global brands. Building high-throughput ingestion with Apache Kafka, Spark streaming, and ClickHouse OLAP stores.'
  },
  {
    org_name: 'NoBroker',
    title: 'Software Development Engineer - Backend & Distributed Microservices',
    location: 'Bengaluru, India',
    country: 'India',
    region: 'Bengaluru',
    category_group: 'startup',
    category: 'job',
    job_type: 'private',
    vacancies: 6,
    ctc_min: 2400000,
    ctc_max: 4600000,
    compensation_display: '₹24 - 46 LPA + Pre-IPO ESOPs',
    required_degree: 'B.Tech / B.E. in Computer Science or equivalent',
    required_branch: 'Computer Science, IT',
    min_experience_years: 1.0,
    max_age: 32,
    min_age: 21,
    required_skills: JSON.stringify(['Java', 'Python', 'Kafka', 'Redis', 'PostgreSQL', 'Microservices', 'Distributed Systems', 'AWS']),
    source_type: 'official_page',
    source_url: 'https://www.nobroker.in/careers',
    apply_url: 'https://www.nobroker.in/careers',
    posted_date: new Date().toISOString().split('T')[0],
    application_deadline: null,
    verification_source: 'NoBroker Careers Portal (Tiger Global / General Atlantic Backed)',
    highlights: 'PropTech Unicorn ($1B+). Solve massive distributed search, real-time matching, and fintech transaction workflows.',
    raw_text: 'NoBroker is India’s first proptech unicorn with millions of active users. Engineering focuses on zero-downtime distributed systems in Java/Python and cloud infrastructure on AWS.'
  },
  {
    org_name: 'Volopay',
    title: 'Software Engineer - FinTech Infrastructure & Global Corporate Cards',
    location: 'Bengaluru, India / Singapore',
    country: 'India',
    region: 'Bengaluru',
    category_group: 'startup',
    category: 'job',
    job_type: 'private',
    vacancies: 3,
    ctc_min: 2500000,
    ctc_max: 4800000,
    compensation_display: '₹25 - 48 LPA + Dollar-Denominated Options',
    required_degree: 'B.Tech / B.E. in Computer Science',
    required_branch: 'Computer Science, Information Technology',
    min_experience_years: 1.0,
    max_age: 32,
    min_age: 21,
    required_skills: JSON.stringify(['Python', 'Node.js', 'PostgreSQL', 'AWS', 'Docker', 'FinTech', 'Payment Gateways', 'Microservices']),
    source_type: 'official_ats',
    source_url: 'https://app.dover.com/dover/careers/ebed3959-fa8a-4719-b143-0730e1223ec8',
    apply_url: 'https://app.dover.com/dover/careers/ebed3959-fa8a-4719-b143-0730e1223ec8',
    posted_date: new Date().toISOString().split('T')[0],
    application_deadline: null,
    verification_source: 'Volopay Dover Career Portal (YC W21 Backed)',
    highlights: 'YC-backed spend management platform. High cash salary + equity, global fintech architecture.',
    raw_text: 'Volopay provides physical/virtual corporate credit cards, expense management, and cross-border remittances across APAC. Seeking strong backend engineers with Python and microservices.'
  },
  {
    org_name: 'Innopay Technologies',
    title: 'Backend Engineer - Payments & Payout Infrastructure',
    location: 'Bengaluru, India',
    country: 'India',
    region: 'Bengaluru',
    category_group: 'startup',
    category: 'job',
    job_type: 'private',
    vacancies: 2,
    ctc_min: 2000000,
    ctc_max: 3800000,
    compensation_display: '₹20 - 38 LPA',
    required_degree: 'B.Tech / B.E. in Computer Science or IT',
    required_branch: 'Computer Science, IT',
    min_experience_years: 1.0,
    max_age: 32,
    min_age: 21,
    required_skills: JSON.stringify(['Java', 'Python', 'Spring Boot', 'MySQL', 'Redis', 'REST APIs', 'AWS', 'UPI & Payments']),
    source_type: 'official_page',
    source_url: 'https://www.innopay.in/careers',
    apply_url: 'https://www.innopay.in/careers',
    posted_date: new Date().toISOString().split('T')[0],
    application_deadline: null,
    verification_source: 'Innopay Official Careers',
    highlights: 'Payments aggregator scaling merchant checkout and instant bank payouts via IMPS/UPI.',
    raw_text: 'Innopay provides merchant collection and payout infrastructure. Strong focus on transaction safety, idempotent API handling, and high-availability database replication.'
  },
  {
    org_name: 'CRED',
    title: 'Backend Engineer - Core Platform & Financial Switch',
    location: 'Bengaluru, India',
    country: 'India',
    region: 'Bengaluru',
    category_group: 'startup',
    category: 'job',
    job_type: 'private',
    vacancies: 5,
    ctc_min: 3800000,
    ctc_max: 6500000,
    compensation_display: '₹38 - 65 LPA + High ESOPs + ₹10L Insurance',
    required_degree: 'B.Tech / B.E. in Computer Science or related degree',
    required_branch: 'Computer Science, IT',
    min_experience_years: 1.5,
    max_age: 35,
    min_age: 21,
    required_skills: JSON.stringify(['Java', 'Go', 'Kafka', 'Redis', 'PostgreSQL', 'Distributed Systems', 'AWS', 'Kubernetes']),
    source_type: 'official_page',
    source_url: 'https://careers.cred.club/',
    apply_url: 'https://careers.cred.club/',
    posted_date: new Date().toISOString().split('T')[0],
    application_deadline: null,
    verification_source: 'CRED Official Careers',
    highlights: 'Top-of-market Indian tech compensation, world-class design & engineering standards, generous buyback programs.',
    raw_text: 'CRED builds high-trust consumer fintech products. Seeking backend engineers proficient in high-throughput distributed microservices, low-latency caching, and cloud platforms.'
  },
  {
    org_name: 'Zepto',
    title: 'Software Development Engineer - Quick Commerce Backend & Realtime Dispatch',
    location: 'Bengaluru, India',
    country: 'India',
    region: 'Bengaluru',
    category_group: 'startup',
    category: 'job',
    job_type: 'private',
    vacancies: 6,
    ctc_min: 3200000,
    ctc_max: 5800000,
    compensation_display: '₹32 - 58 LPA + High-Growth ESOPs',
    required_degree: 'B.Tech / B.E. in Computer Science',
    required_branch: 'Computer Science, IT',
    min_experience_years: 1.0,
    max_age: 34,
    min_age: 21,
    required_skills: JSON.stringify(['Go', 'Python', 'Kafka', 'PostgreSQL', 'Redis', 'Kubernetes', 'Microservices', 'AWS']),
    source_type: 'official_page',
    source_url: 'https://www.zeptonow.com/careers',
    apply_url: 'https://www.zeptonow.com/careers',
    posted_date: new Date().toISOString().split('T')[0],
    application_deadline: null,
    verification_source: 'Zepto Official Careers',
    highlights: 'Hypergrowth 10-minute grocery & quick-commerce giant ($5B valuation). High ownership, fast promotion tracks.',
    raw_text: 'Zepto handles hundreds of thousands of daily real-time delivery and routing operations. Building resilient backend services in Go and Python on Kubernetes.'
  },
  {
    org_name: 'Razorpay',
    title: 'Software Development Engineer - Payments Gateway Core',
    location: 'Bengaluru, India',
    country: 'India',
    region: 'Bengaluru',
    category_group: 'startup',
    category: 'job',
    job_type: 'private',
    vacancies: 6,
    ctc_min: 3000000,
    ctc_max: 5500000,
    compensation_display: '₹30 - 55 LPA + ESOPs',
    required_degree: 'B.Tech / B.E. in Computer Science or equivalent',
    required_branch: 'Computer Science, IT',
    min_experience_years: 1.0,
    max_age: 34,
    min_age: 21,
    required_skills: JSON.stringify(['Go', 'PHP', 'Python', 'Kafka', 'MySQL', 'Kubernetes', 'AWS', 'FinTech']),
    source_type: 'official_page',
    source_url: 'https://razorpay.com/jobs/',
    apply_url: 'https://razorpay.com/jobs/',
    posted_date: new Date().toISOString().split('T')[0],
    application_deadline: null,
    verification_source: 'Razorpay Official Careers',
    highlights: 'Benchmark for Indian payment systems. Best-in-class engineering mentorship, exceptional work culture, and high base compensation.',
    raw_text: 'Razorpay powers digital payments for millions of businesses. Seeking engineers for core transaction orchestration, automated reconciliations, and low-latency webhook delivery.'
  },
  {
    org_name: 'Groww',
    title: 'Software Engineer - Neo-Brokerage & Trading Core Platform',
    location: 'Bengaluru, India',
    country: 'India',
    region: 'Bengaluru',
    category_group: 'startup',
    category: 'job',
    job_type: 'private',
    vacancies: 5,
    ctc_min: 2800000,
    ctc_max: 5200000,
    compensation_display: '₹28 - 52 LPA + ESOPs',
    required_degree: 'B.Tech / B.E. in Computer Science',
    required_branch: 'Computer Science, IT',
    min_experience_years: 1.0,
    max_age: 32,
    min_age: 21,
    required_skills: JSON.stringify(['Java', 'Spring Boot', 'Kafka', 'PostgreSQL', 'Redis', 'Kubernetes', 'FinTech', 'AWS']),
    source_type: 'official_page',
    source_url: 'https://groww.in/careers',
    apply_url: 'https://groww.in/careers',
    posted_date: new Date().toISOString().split('T')[0],
    application_deadline: null,
    verification_source: 'Groww Official Careers',
    highlights: 'India’s leading investment platform. Highly profitable, massive transaction volume, modern microservice architecture.',
    raw_text: 'Groww empowers millions of Indians to invest in stocks, mutual funds, and futures. Microservices built with Java, Spring Boot, Apache Kafka, and PostgreSQL.'
  }
];

async function seed() {
  console.log('[SeedStartupOpps] Starting...');

  // 1. Fetch user candidate profile
  const [[profile]] = await pool.query('SELECT * FROM jobhunt_profile LIMIT 1');
  if (!profile) {
    console.error('No candidate profile found in jobhunt_profile.');
    process.exit(1);
  }

  // 2. Map orgs
  const [orgRows] = await pool.query('SELECT * FROM jobhunt_organizations');
  const orgMap = {};
  orgRows.forEach(r => {
    if (r.name) orgMap[r.name] = r;
    if (r.short_name) orgMap[r.short_name] = r;
  });

  let upserted = 0;

  for (const opp of STARTUP_OPPORTUNITIES) {
    const org = orgMap[opp.org_name];
    if (!org) {
      console.warn(`Org "${opp.org_name}" not found in registry. Skipping.`);
      continue;
    }

    // Compute score against profile
    const scored = computeOpportunityScore(profile, opp, org);

    // Check existing
    const [[existing]] = await pool.query(
      'SELECT id FROM jobhunt_opportunities WHERE org_id = ? AND title = ? LIMIT 1',
      [org.id, opp.title]
    );

    if (existing) {
      await pool.query(`
        UPDATE jobhunt_opportunities SET
          vacancies = ?, ctc_min = ?, ctc_max = ?, compensation_display = ?,
          required_degree = ?, required_branch = ?, min_experience_years = ?, max_age = ?, min_age = ?,
          required_skills = ?, location = ?, job_type = ?, category = ?, category_group = ?,
          country = ?, region = ?, currency = 'INR', visa_sponsored = 0, source_type = ?, source_url = ?,
          apply_url = ?, posted_date = ?, application_deadline = ?, notes = ?,
          raw_text = ?, requires_gate = 0, is_verified_active = 1, is_archived = 0,
          verification_source = ?, eligibility_pct = ?, profile_match_pct = ?, compensation_score = ?,
          career_potential_score = ?, competition_signal = ?, application_difficulty_score = ?,
          org_quality_score = ?, deadline_urgency_score = ?, opportunity_score = ?, recommendation = ?
        WHERE id = ?
      `, [
        opp.vacancies, opp.ctc_min, opp.ctc_max, opp.compensation_display,
        opp.required_degree, opp.required_branch, opp.min_experience_years, opp.max_age, opp.min_age,
        opp.required_skills, opp.location, opp.job_type, opp.category, opp.category_group,
        opp.country, opp.region, opp.source_type, opp.source_url,
        opp.apply_url, opp.posted_date, opp.application_deadline, opp.highlights,
        opp.raw_text, opp.verification_source, scored.eligibility, scored.profile_match, scored.compensation,
        scored.career_potential, scored.competition_signal, scored.application_difficulty,
        scored.org_quality, scored.deadline_urgency, scored.opportunity_score, scored.recommendation,
        existing.id
      ]);
      console.log(`[SeedStartupOpps] Updated: ${opp.title} (${org.name}) -> Score: ${scored.opportunity_score} (${scored.recommendation})`);
    } else {
      await pool.query(`
        INSERT INTO jobhunt_opportunities (
          org_id, title, vacancies, ctc_min, ctc_max, compensation_display,
          required_degree, required_branch, min_experience_years, max_age, min_age,
          required_skills, location, job_type, category, category_group,
          country, region, currency, visa_sponsored, source_type, source_url,
          apply_url, posted_date, application_deadline, notes, raw_text,
          requires_gate, is_verified_active, is_archived, verification_source,
          eligibility_pct, profile_match_pct, compensation_score, career_potential_score,
          competition_signal, application_difficulty_score, org_quality_score,
          deadline_urgency_score, opportunity_score, recommendation
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, 'INR', 0, ?, ?,
          ?, ?, ?, ?, ?,
          0, 1, 0, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?
        )
      `, [
        org.id, opp.title, opp.vacancies, opp.ctc_min, opp.ctc_max, opp.compensation_display,
        opp.required_degree, opp.required_branch, opp.min_experience_years, opp.max_age, opp.min_age,
        opp.required_skills, opp.location, opp.job_type, opp.category, opp.category_group,
        opp.country, opp.region, opp.source_type, opp.source_url,
        opp.apply_url, opp.posted_date, opp.application_deadline, opp.highlights, opp.raw_text,
        opp.verification_source, scored.eligibility, scored.profile_match, scored.compensation, scored.career_potential,
        scored.competition_signal, scored.application_difficulty, scored.org_quality,
        scored.deadline_urgency, scored.opportunity_score, scored.recommendation
      ]);
      console.log(`[SeedStartupOpps] Inserted: ${opp.title} (${org.name}) -> Score: ${scored.opportunity_score} (${scored.recommendation})`);
    }
    upserted++;
  }

  console.log(`[SeedStartupOpps] Done! Processed ${upserted} opportunities.`);
  return { upserted };
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[SeedStartupOpps] Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { seed, STARTUP_OPPORTUNITIES };
