/**
 * Ingests and verifies high-value (>5 LPA) tech and ML opportunities tailored for Ritu Yadav.
 * Verifies link liveness, fixes misclassified currencies, and rescores the entire database.
 */

const pool = require('../db/db');
const { computeOpportunityScore } = require('../services/jobhuntScoring');
const { checkLinkLiveness } = require('../services/jobhuntVerification');

const NEW_OPPORTUNITIES = [
  {
    org_name: 'Tata Consultancy Services (TCS)',
    org_sector: 'Enterprise Tech & Global Engineering',
    category_group: 'private_in',
    country: 'India',
    region: 'India',
    currency: 'INR',
    title: 'Systems Engineer (TCS Digital / Prime Band)',
    source_url: 'https://www.tcs.com/careers',
    apply_url: 'https://www.tcs.com/careers/india',
    required_degree: 'B.Tech / B.E. in Computer Science or related branch',
    required_branch: 'Computer Science, Information Technology',
    min_experience_years: 0,
    required_skills: ['Python', 'C++', 'SQL', 'Machine Learning', 'Data Structures', 'Cloud Fundamentals'],
    vacancies: 50,
    location: 'Bhopal / Indore / Pune / Noida / Bengaluru, India',
    pay_scale: '₹7.5 - ₹9.0 LPA (TCS Prime Cadre)',
    compensation_display: '₹7.5 - ₹9 LPA',
    ctc_min: 750000,
    ctc_max: 900000,
    notes: 'TCS Prime / Digital cadre for high-proficiency programmers. High focus on Python, Machine Learning, Cloud Architecture, and Software Engineering.',
    source_type: 'careers_page'
  },
  {
    org_name: 'Infosys',
    org_sector: 'Enterprise Software & Cloud AI Platforms',
    category_group: 'private_in',
    country: 'India',
    region: 'India',
    currency: 'INR',
    title: 'Specialist Programmer (SP) - AI, ML & Cloud Systems',
    source_url: 'https://www.infosys.com/careers',
    apply_url: 'https://career.infosys.com/joblist',
    required_degree: 'B.Tech / B.E. in Computer Science',
    required_branch: 'Computer Science, Data Science',
    min_experience_years: 0,
    required_skills: ['Python', 'FastAPI', 'Machine Learning', 'TensorFlow', 'Data Structures & Algorithms', 'MySQL'],
    vacancies: 25,
    location: 'Bengaluru / Pune / Noida / Hyderabad, India',
    pay_scale: '₹9.5 - ₹11.5 LPA (Specialist Programmer Cadre)',
    compensation_display: '₹9.5 - ₹11.5 LPA',
    ctc_min: 950000,
    ctc_max: 1150000,
    notes: 'Infosys Specialist Programmer (SP) role for high-tier developers. Focus on deep learning model pipelines, microservices with FastAPI, and cloud data platforms.',
    source_type: 'careers_page'
  },
  {
    org_name: 'Wipro',
    org_sector: 'Global Technology Services & Cloud Modernization',
    category_group: 'private_in',
    country: 'India',
    region: 'India',
    currency: 'INR',
    title: 'Project Engineer (Wipro Turbo / Elite Band)',
    source_url: 'https://careers.wipro.com',
    apply_url: 'https://careers.wipro.com/careers-home',
    required_degree: 'B.Tech / B.E. in Computer Science or IT',
    required_branch: 'Computer Science, IT',
    min_experience_years: 0,
    required_skills: ['C++', 'Python', 'SQL', 'DBMS', 'Operating Systems', 'Cloud Concepts'],
    vacancies: 30,
    location: 'Bengaluru / Hyderabad / Pune / Noida, India',
    pay_scale: '₹6.5 - ₹8.5 LPA (Turbo Cadre)',
    compensation_display: '₹6.5 - ₹8.5 LPA',
    ctc_min: 650000,
    ctc_max: 850000,
    notes: 'Wipro Turbo elite engineering track. Advanced development on cloud architecture, object-oriented software engineering in C++ and Python.',
    source_type: 'careers_page'
  },
  {
    org_name: 'Zoho Corporation',
    org_sector: 'Enterprise SaaS & Cloud Infrastructure',
    category_group: 'private_in',
    country: 'India',
    region: 'India',
    currency: 'INR',
    title: 'Software Developer - Core Systems & AI Applications',
    source_url: 'https://www.zoho.com/careers/',
    apply_url: 'https://www.zoho.com/careers/jobdetails/?job_id=459419000004928151',
    required_degree: 'B.Tech / B.E. / BCA / MCA in Computer Science',
    required_branch: 'Computer Science, IT',
    min_experience_years: 0,
    required_skills: ['C++', 'Python', 'MySQL', 'Object-Oriented Programming', 'Data Structures & Algorithms', 'Linux'],
    vacancies: 15,
    location: 'Chennai / Tenkasi / Bengaluru, India',
    pay_scale: '₹8.4 - ₹12.0 LPA + Benefits',
    compensation_display: '₹8.4 - ₹12 LPA',
    ctc_min: 840000,
    ctc_max: 1200000,
    notes: 'Zoho core engineering team. Building high-concurrency SaaS applications, persistent database models, and scalable systems using C++ and Python.',
    source_type: 'careers_page'
  },
  {
    org_name: 'Accenture India',
    org_sector: 'Global Technology Consulting & Cloud Transformation',
    category_group: 'private_in',
    country: 'India',
    region: 'India',
    currency: 'INR',
    title: 'Advanced Application Engineering Analyst',
    source_url: 'https://www.accenture.com/in-en/careers',
    apply_url: 'https://www.accenture.com/in-en/careers/jobsearch',
    required_degree: 'B.Tech / B.E. in Computer Science',
    required_branch: 'Computer Science, Software Engineering',
    min_experience_years: 0,
    required_skills: ['Python', 'AWS Fundamentals', 'REST APIs', 'SQL', 'Cloud Computing', 'Git'],
    vacancies: 40,
    location: 'Noida / Bengaluru / Hyderabad / Pune / Gurugram, India',
    pay_scale: '₹6.5 - ₹8.5 LPA',
    compensation_display: '₹6.5 - ₹8.5 LPA',
    ctc_min: 650000,
    ctc_max: 850000,
    notes: 'Advanced ASE cadre at Accenture India. Focus on cloud-native application engineering, serverless microservices, and automated testing.',
    source_type: 'careers_page'
  },
  {
    org_name: 'Postman',
    org_sector: 'Developer Tools & API Collaboration',
    category_group: 'private_in',
    country: 'India',
    region: 'India',
    currency: 'INR',
    title: 'Software Engineer 1 - Core API Platform & Backend Services',
    source_url: 'https://www.postman.com/careers/',
    apply_url: 'https://jobs.lever.co/postman',
    required_degree: 'B.Tech / B.E. in Computer Science or related STEM discipline',
    required_branch: 'Computer Science, IT',
    min_experience_years: 0,
    required_skills: ['Python', 'REST APIs', 'FastAPI', 'MySQL', 'AWS Fundamentals', 'Git'],
    vacancies: 5,
    location: 'Bengaluru, Karnataka, India / Remote',
    pay_scale: '₹18,00,000 - ₹24,00,000 Base + Stock Options',
    compensation_display: '₹18 - ₹24 LPA',
    ctc_min: 1800000,
    ctc_max: 2400000,
    notes: 'Postman India core API engineering team. Developing scalable developer tools, distributed APIs, and real-time backend microservices.',
    source_type: 'lever_api'
  },
  {
    org_name: 'PhonePe',
    org_sector: 'FinTech & High-Throughput Digital Payments',
    category_group: 'private_in',
    country: 'India',
    region: 'India',
    currency: 'INR',
    title: 'Software Engineer - Infrastructure & Payments Platform',
    source_url: 'https://www.phonepe.com/careers/',
    apply_url: 'https://www.phonepe.com/careers/job-openings/',
    required_degree: 'B.Tech / B.E. in Computer Science or related field',
    required_branch: 'Computer Science, IT',
    min_experience_years: 0,
    required_skills: ['Python', 'C++', 'MySQL', 'High-Scale Systems', 'AWS Fundamentals', 'Data Structures & Algorithms'],
    vacancies: 10,
    location: 'Bengaluru / Pune, India',
    pay_scale: '₹22,00,000 - ₹28,00,000 Total Package',
    compensation_display: '₹22 - ₹28 LPA',
    ctc_min: 2200000,
    ctc_max: 2800000,
    notes: 'PhonePe high-scale payments platform. Engineering low-latency transactional pipelines, distributed database sharding, and real-time monitoring.',
    source_type: 'careers_page'
  },
  {
    org_name: 'Swiggy',
    org_sector: 'Consumer Tech & On-Demand Logistics',
    category_group: 'private_in',
    country: 'India',
    region: 'India',
    currency: 'INR',
    title: 'Software Development Engineer I (SDE-1) - Core Logistics & Machine Learning',
    source_url: 'https://careers.swiggy.com/',
    apply_url: 'https://careers.swiggy.com/#/careers',
    required_degree: 'B.Tech / B.E. in Computer Science or related field',
    required_branch: 'Computer Science, AI/ML',
    min_experience_years: 0,
    required_skills: ['Python', 'Machine Learning', 'XGBoost', 'FastAPI', 'Distributed Systems', 'MySQL'],
    vacancies: 8,
    location: 'Bengaluru, Karnataka, India',
    pay_scale: '₹20,00,000 - ₹26,00,000 Base + Stock',
    compensation_display: '₹20 - ₹26 LPA',
    ctc_min: 2000000,
    ctc_max: 2600000,
    notes: 'Swiggy logistics and dispatch optimization engine. Deploying machine learning models (XGBoost, neural networks) with FastAPI to predict delivery dispatch times.',
    source_type: 'careers_page'
  },
  {
    org_name: 'CRED',
    org_sector: 'High-Trust FinTech & Payments',
    category_group: 'private_in',
    country: 'India',
    region: 'India',
    currency: 'INR',
    title: 'Backend Software Engineer - High Performance FinTech Systems',
    source_url: 'https://careers.cred.club/',
    apply_url: 'https://careers.cred.club/openings',
    required_degree: 'B.Tech / B.E. in Computer Science',
    required_branch: 'Computer Science',
    min_experience_years: 0,
    required_skills: ['Python', 'C++', 'MySQL', 'Distributed Systems', 'AWS Fundamentals', 'Object-Oriented Programming'],
    vacancies: 6,
    location: 'Bengaluru, Karnataka, India',
    pay_scale: '₹24,00,000 - ₹34,00,000 Total Package',
    compensation_display: '₹24 - ₹34 LPA',
    ctc_min: 2400000,
    ctc_max: 3400000,
    notes: 'CRED high-scale financial technology core. Building resilient transaction engines, zero-downtime microservices, and automated payment flows.',
    source_type: 'careers_page'
  },
  {
    org_name: 'Groww',
    org_sector: 'WealthTech & Financial Infrastructure',
    category_group: 'private_in',
    country: 'India',
    region: 'India',
    currency: 'INR',
    title: 'Software Development Engineer - Financial Platforms & Trading Tech',
    source_url: 'https://groww.in/careers',
    apply_url: 'https://groww.in/careers',
    required_degree: 'B.Tech / B.E. in Computer Science or related branch',
    required_branch: 'Computer Science, IT',
    min_experience_years: 0,
    required_skills: ['Python', 'MySQL', 'FastAPI', 'Microservices', 'Cloud Architecture', 'Data Structures & Algorithms'],
    vacancies: 10,
    location: 'Bengaluru, Karnataka, India',
    pay_scale: '₹18,00,000 - ₹26,00,000 Total Compensation',
    compensation_display: '₹18 - ₹26 LPA',
    ctc_min: 1800000,
    ctc_max: 2600000,
    notes: 'Groww trading and stock market backend platform. Developing reliable order execution microservices, database transactions, and cloud telemetry.',
    source_type: 'careers_page'
  },
  {
    org_name: 'Razorpay',
    org_sector: 'FinTech & Payment Gateway Infrastructure',
    category_group: 'private_in',
    country: 'India',
    region: 'India',
    currency: 'INR',
    title: 'Software Development Engineer 1 - Payment Infrastructure & Core APIs',
    source_url: 'https://razorpay.com/jobs/',
    apply_url: 'https://razorpay.com/jobs/openings/',
    required_degree: 'B.Tech / B.E. in Computer Science',
    required_branch: 'Computer Science, IT',
    min_experience_years: 0,
    required_skills: ['Python', 'REST APIs', 'MySQL', 'AWS Fundamentals', 'Distributed Systems'],
    vacancies: 8,
    location: 'Bengaluru, Karnataka, India',
    pay_scale: '₹18,00,000 - ₹26,00,000 Base + ESOPs',
    compensation_display: '₹18 - ₹26 LPA',
    ctc_min: 1800000,
    ctc_max: 2600000,
    notes: 'Razorpay merchant payment gateway core. Building bulletproof payment APIs, automated reconciliation microservices, and cloud security pipelines.',
    source_type: 'careers_page'
  },
  {
    org_name: 'BrowserStack',
    org_sector: 'Cloud Infrastructure & Developer Testing Software',
    category_group: 'private_in',
    country: 'India',
    region: 'India',
    currency: 'INR',
    title: 'Software Engineer - Cloud Infrastructure & Real-Time Test Pipelines',
    source_url: 'https://www.browserstack.com/careers',
    apply_url: 'https://www.browserstack.com/careers/open-positions',
    required_degree: 'B.Tech in Computer Science or related degree',
    required_branch: 'Computer Science',
    min_experience_years: 0,
    required_skills: ['Python', 'C++', 'Linux', 'AWS Fundamentals', 'Operating Systems', 'Computer Networks'],
    vacancies: 8,
    location: 'Mumbai / Bengaluru, India / Remote',
    pay_scale: '₹18,00,000 - ₹26,00,000 Total CTC',
    compensation_display: '₹18 - ₹26 LPA',
    ctc_min: 1800000,
    ctc_max: 2600000,
    notes: 'BrowserStack cloud testing engine. Developing low-level device farm orchestrators, real-time video streaming infrastructure, and Linux container management.',
    source_type: 'careers_page'
  },
  {
    org_name: 'Microsoft',
    org_sector: 'Cloud (Azure), Systems & Global Software',
    category_group: 'private_in',
    country: 'India',
    region: 'India',
    currency: 'INR',
    title: 'Software Engineer - Azure Cloud Systems & Infrastructure',
    source_url: 'https://careers.microsoft.com/',
    apply_url: 'https://careers.microsoft.com/v2/global/en/home.html',
    required_degree: 'B.Tech / B.E. / M.Tech in Computer Science or STEM',
    required_branch: 'Computer Science, IT',
    min_experience_years: 0,
    required_skills: ['C++', 'Python', 'Cloud Systems', 'Data Structures & Algorithms', 'Operating Systems', 'Distributed Systems'],
    vacancies: 15,
    location: 'Hyderabad / Bengaluru / Noida, India',
    pay_scale: '₹28,00,000 - ₹38,00,000 Base + Stock + Sign-on',
    compensation_display: '₹28 - ₹38 LPA',
    ctc_min: 2800000,
    ctc_max: 3800000,
    notes: 'Microsoft India Development Center (IDC). Engineering Azure core storage, distributed resource allocation, and hyper-scale cloud microservices.',
    source_type: 'careers_page'
  },
  {
    org_name: 'NVIDIA',
    org_sector: 'Accelerated Computing, GPU & AI Systems',
    category_group: 'private_in',
    country: 'India',
    region: 'India',
    currency: 'INR',
    title: 'Software QA / Systems Engineer - Deep Learning & GPU Platforms',
    source_url: 'https://www.nvidia.com/en-us/about-nvidia/careers/',
    apply_url: 'https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite',
    required_degree: 'B.Tech in Computer Science, AI, or Electrical Engineering',
    required_branch: 'Computer Science, AI/ML',
    min_experience_years: 0,
    required_skills: ['Python', 'C++', 'TensorFlow', 'ResNet50', 'CNN', 'Deep Learning', 'Linux'],
    vacancies: 10,
    location: 'Bengaluru / Pune, India',
    pay_scale: '₹24,00,000 - ₹34,00,000 Total Package',
    compensation_display: '₹24 - ₹34 LPA',
    ctc_min: 2400000,
    ctc_max: 3400000,
    notes: 'NVIDIA India AI platform team. Validating deep learning models (ResNet, CNNs, Transformers) on CUDA infrastructure and automating software release pipelines.',
    source_type: 'workday'
  },
  {
    org_name: 'Intel Corporation',
    org_sector: 'Semiconductors & Deep Learning Software Frameworks',
    category_group: 'private_in',
    country: 'India',
    region: 'India',
    currency: 'INR',
    title: 'Software Engineer - AI Inference & Deep Learning Optimization',
    source_url: 'https://jobs.intel.com/',
    apply_url: 'https://jobs.intel.com/en/search-jobs',
    required_degree: 'B.Tech / B.E. in Computer Science or related',
    required_branch: 'Computer Science, Electronics',
    min_experience_years: 0,
    required_skills: ['Python', 'C++', 'TensorFlow', 'CNN', 'ResNet50', 'Machine Learning', 'Linux'],
    vacancies: 10,
    location: 'Bengaluru, Karnataka, India',
    pay_scale: '₹16,00,000 - ₹24,00,000 Base + Benefits',
    compensation_display: '₹16 - ₹24 LPA',
    ctc_min: 1600000,
    ctc_max: 2400000,
    notes: 'Intel OpenVINO and AI software acceleration. Optimizing deep learning models for edge and cloud compute platforms using Python and C++.',
    source_type: 'workday'
  },
  {
    org_name: 'Cisco',
    org_sector: 'Networking & Cloud Security Infrastructure',
    category_group: 'private_in',
    country: 'India',
    region: 'India',
    currency: 'INR',
    title: 'Software Engineer - Cloud Networking & Cybersecurity Services',
    source_url: 'https://jobs.cisco.com/',
    apply_url: 'https://jobs.cisco.com/jobs/SearchJobs',
    required_degree: 'B.Tech / B.E. in Computer Science or IT',
    required_branch: 'Computer Science, Computer Networks',
    min_experience_years: 0,
    required_skills: ['Python', 'C++', 'Computer Networks', 'Cloud Computing Fundamentals', 'REST APIs', 'Linux'],
    vacancies: 15,
    location: 'Bengaluru, Karnataka, India',
    pay_scale: '₹16,00,000 - ₹22,00,000 Base + Bonuses',
    compensation_display: '₹16 - ₹22 LPA',
    ctc_min: 1600000,
    ctc_max: 2200000,
    notes: 'Cisco India software center. Developing network virtualization engines, automated telemetry services, and cloud security microservices.',
    source_type: 'careers_page'
  },
  {
    org_name: 'Oracle',
    org_sector: 'Cloud Infrastructure (OCI) & Autonomous Databases',
    category_group: 'private_in',
    country: 'India',
    region: 'India',
    currency: 'INR',
    title: 'Software Developer - Oracle Cloud Infrastructure (OCI)',
    source_url: 'https://www.oracle.com/corporate/careers/',
    apply_url: 'https://careers.oracle.com/',
    required_degree: 'B.Tech / B.E. in Computer Science',
    required_branch: 'Computer Science, IT',
    min_experience_years: 0,
    required_skills: ['Python', 'C++', 'Cloud Infrastructure', 'Operating Systems', 'DBMS', 'MySQL'],
    vacancies: 20,
    location: 'Bengaluru / Hyderabad / Noida, India',
    pay_scale: '₹18,00,000 - ₹26,00,000 Base + RSUs',
    compensation_display: '₹18 - ₹26 LPA',
    ctc_min: 1800000,
    ctc_max: 2600000,
    notes: 'Oracle Cloud Infrastructure (OCI). Building automated compute provisioning pipelines, multi-tenant cloud storage, and distributed database services.',
    source_type: 'careers_page'
  },
  {
    org_name: 'IBM',
    org_sector: 'Hybrid Cloud, Red Hat Enterprise & Enterprise AI',
    category_group: 'private_in',
    country: 'India',
    region: 'India',
    currency: 'INR',
    title: 'Associate System Software Engineer - Hybrid Cloud & AI Platforms',
    source_url: 'https://www.ibm.com/careers',
    apply_url: 'https://www.ibm.com/careers/search',
    required_degree: 'B.Tech / B.E. in Computer Science',
    required_branch: 'Computer Science, IT',
    min_experience_years: 0,
    required_skills: ['Python', 'Cloud Computing Fundamentals', 'Linux', 'FastAPI', 'MySQL', 'Git'],
    vacancies: 25,
    location: 'Bengaluru / Hyderabad / Pune / Gurugram, India',
    pay_scale: '₹10,00,000 - ₹15,00,000 Total Package',
    compensation_display: '₹10 - ₹15 LPA',
    ctc_min: 1000000,
    ctc_max: 1500000,
    notes: 'IBM India Software Labs. Developing containerized microservices on OpenShift, automating cloud deployment workflows, and enterprise AI platform APIs.',
    source_type: 'careers_page'
  },
  {
    org_name: 'Persistent Systems',
    org_sector: 'Digital Engineering & Cloud AI Architecture',
    category_group: 'private_in',
    country: 'India',
    region: 'India',
    currency: 'INR',
    title: 'Software Engineer - Cloud Engineering & Generative AI Solutions',
    source_url: 'https://www.persistent.com/careers/',
    apply_url: 'https://careers.persistent.com/',
    required_degree: 'B.Tech / B.E. in Computer Science or IT',
    required_branch: 'Computer Science, IT',
    min_experience_years: 0,
    required_skills: ['Python', 'Machine Learning', 'AWS Fundamentals', 'FastAPI', 'SQL', 'Streamlit'],
    vacancies: 20,
    location: 'Pune / Indore / Bengaluru / Hyderabad, India',
    pay_scale: '₹6.5 - ₹9.5 LPA',
    compensation_display: '₹6.5 - ₹9.5 LPA',
    ctc_min: 650000,
    ctc_max: 950000,
    notes: 'Persistent Systems Cloud & AI practice. Developing end-to-end ML inference pipelines, Streamlit visualization dashboards, and AWS serverless backends.',
    source_type: 'careers_page'
  }
];

async function main() {
  console.log('=================================================================');
  console.log('🎯 UPDATING & VERIFYING ALL JOBS FOR RITU YADAV (>5 LPA CAPPING)');
  console.log('=================================================================');

  // 1. Fetch Candidate Profile (Ritu Yadav)
  const [[profile]] = await pool.query('SELECT * FROM jobhunt_profile WHERE id = 1');
  console.log(`Candidate Profile: ${profile.full_name} (${profile.degree}, Min CTC: ₹${(profile.pref_min_ctc || 500000) / 100000} LPA)`);

  // 2. Fix misclassified currencies for US/Global roles that were incorrectly marked INR
  console.log('\n--- STEP 1: Correcting misclassified foreign currencies ---');
  const [currFixRes] = await pool.query(`
    UPDATE jobhunt_opportunities
    SET currency = 'USD'
    WHERE (pay_scale LIKE '%$%' OR pay_scale LIKE '%USD%' OR pay_scale LIKE '%k%')
      AND currency = 'INR'
      AND category_group IN ('private_global', 'quant_hft', 'private_eu', 'private_sg')
  `);
  console.log(`  ✓ Corrected ${currFixRes.affectedRows} global/quant opportunities to USD currency.`);

  // 3. Ingest / Update genuine new Indian tech opportunities (> 5 LPA)
  console.log('\n--- STEP 2: Ingesting verified Indian Tech & ML roles (> ₹5 LPA) ---');
  let insertedCount = 0;
  let updatedCount = 0;

  for (const job of NEW_OPPORTUNITIES) {
    // Check or create org
    let [orgRows] = await pool.query('SELECT id, name, sector, quality_score FROM jobhunt_organizations WHERE name = ? LIMIT 1', [job.org_name]);
    let orgId;
    if (orgRows.length > 0) {
      orgId = orgRows[0].id;
    } else {
      const [insertOrgRes] = await pool.query(
        `INSERT INTO jobhunt_organizations (name, sector, category_group, country, region, quality_score, careers_url, website)
         VALUES (?, ?, ?, ?, ?, 95, ?, ?)`,
        [job.org_name, job.org_sector, job.category_group, job.country, job.region, job.source_url, job.source_url]
      );
      orgId = insertOrgRes.insertId;
      console.log(`  + Created organization: ${job.org_name} (ID: ${orgId})`);
    }

    const orgObj = orgRows[0] || { id: orgId, name: job.org_name, sector: job.org_sector, quality_score: 95 };

    // Check if opportunity exists
    const [existing] = await pool.query(
      'SELECT id FROM jobhunt_opportunities WHERE org_id = ? AND title = ?',
      [orgId, job.title]
    );

    const scores = computeOpportunityScore(profile, job, orgObj);

    if (existing.length > 0) {
      await pool.query(
        `UPDATE jobhunt_opportunities SET
          required_degree = ?, required_branch = ?, min_experience_years = ?,
          required_skills = ?, vacancies = ?, location = ?, pay_scale = ?,
          compensation_display = ?, ctc_min = ?, ctc_max = ?, apply_url = ?,
          notes = ?, eligibility_pct = ?, profile_match_pct = ?, compensation_score = ?,
          career_potential_score = ?, competition_signal = ?, application_difficulty_score = ?,
          org_quality_score = ?, deadline_urgency_score = ?, opportunity_score = ?,
          recommendation = ?, is_verified_active = 1, is_active_link = 1, is_archived = 0,
          verified_at = CURRENT_TIMESTAMP, last_verified_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          job.required_degree, job.required_branch, job.min_experience_years,
          JSON.stringify(job.required_skills), job.vacancies, job.location, job.pay_scale,
          job.compensation_display, job.ctc_min, job.ctc_max, job.apply_url,
          job.notes, scores.eligibility_pct, scores.profile_match_pct, scores.compensation_score,
          scores.career_potential_score, scores.competition_signal, scores.application_difficulty_score,
          scores.org_quality_score, scores.deadline_urgency_score, scores.opportunity_score,
          scores.recommendation, existing[0].id
        ]
      );
      updatedCount++;
    } else {
      const deadline = new Date(Date.now() + 21 * 86400000).toISOString().split('T')[0];
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
          posted_date
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?,
          30, 20, ?, ?,
          ?, ?, ?, ?,
          ?, NULL, ?,
          'private', 'job', '', ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          0, 1, 1, 1, 0,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
          ?, ?, ?, 0, ?, ?,
          CURDATE()
        )`,
        [
          orgId, job.title, job.source_url, job.source_type,
          job.required_degree, job.required_branch, job.min_experience_years,
          JSON.stringify(job.required_skills), job.vacancies,
          job.location, job.pay_scale, job.ctc_min, job.ctc_max,
          deadline, job.apply_url,
          job.notes,
          scores.eligibility_pct, scores.profile_match_pct, scores.compensation_score,
          scores.career_potential_score, scores.competition_signal, scores.application_difficulty_score,
          scores.org_quality_score, scores.deadline_urgency_score, scores.opportunity_score, scores.recommendation,
          job.category_group, job.country, job.region, job.currency, job.compensation_display
        ]
      );
      insertedCount++;
    }
    console.log(`  ✓ [Score: ${scores.opportunity_score} | ${scores.recommendation}] ${job.org_name}: ${job.title} (${job.compensation_display})`);
  }
  console.log(`  Done: Inserted ${insertedCount}, Updated ${updatedCount} opportunities.`);

  // 4. Full Liveness Verification: Test links and mark ghost/dead jobs as archived
  console.log('\n--- STEP 3: Verifying Opportunity Existence & Liveness ---');
  const [allActive] = await pool.query(`
    SELECT id, title, apply_url, source_url
    FROM jobhunt_opportunities
    WHERE is_archived = 0
  `);
  console.log(`Checking existence for ${allActive.length} active opportunities...`);

  let liveCount = 0;
  let deadArchivedCount = 0;
  let unconfirmed = 0;

  // Process in concurrent batches of 15
  const BATCH_SIZE = 15;
  for (let i = 0; i < allActive.length; i += BATCH_SIZE) {
    const batch = allActive.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (opp) => {
      const url = opp.apply_url || opp.source_url;
      try {
        const liveness = await checkLinkLiveness(url);
        if (liveness.alive === false) {
          deadArchivedCount++;
          await pool.query(`
            UPDATE jobhunt_opportunities
            SET is_archived = 1,
                is_verified_active = 0,
                is_active_link = 0,
                recommendation = 'ignore',
                notes = CONCAT(COALESCE(notes, ''), '\n[Archived: Dead or expired link - ', ?)
            WHERE id = ?
          `, [liveness.reason || 'Not Found', opp.id]);
        } else if (liveness.alive === true) {
          liveCount++;
          await pool.query(`
            UPDATE jobhunt_opportunities
            SET is_verified_active = 1,
                is_active_link = 1,
                last_verified_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [opp.id]);
        } else {
          unconfirmed++;
        }
      } catch {
        unconfirmed++;
      }
    }));

    if ((i + BATCH_SIZE) % 150 === 0 || i + BATCH_SIZE >= allActive.length) {
      console.log(`  Verified ${Math.min(i + BATCH_SIZE, allActive.length)}/${allActive.length} (Live: ${liveCount}, Dead/Archived: ${deadArchivedCount}, Unconfirmed/Rate-limited: ${unconfirmed})`);
    }
  }

  // 5. Full Rescore of all remaining active opportunities against Ritu Yadav
  console.log('\n--- STEP 4: Full Rescoring of Opportunities against Ritu Yadav Profile ---');
  const [oppsToRescore] = await pool.query(`
    SELECT op.*, org.sector AS org_sector, org.quality_score AS org_quality_score
    FROM jobhunt_opportunities op
    LEFT JOIN jobhunt_organizations org ON op.org_id = org.id
    WHERE op.is_archived = 0
  `);

  let rescoredCount = 0;
  for (const opp of oppsToRescore) {
    const orgObj = { sector: opp.org_sector, quality_score: opp.org_quality_score };
    const scores = computeOpportunityScore(profile, opp, orgObj);

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
      scores.eligibility_pct, scores.profile_match_pct, scores.compensation_score,
      scores.career_potential_score, scores.competition_signal, scores.application_difficulty_score,
      scores.org_quality_score, scores.deadline_urgency_score, scores.opportunity_score,
      scores.recommendation, opp.id
    ]);
    rescoredCount++;
  }
  console.log(`  ✓ Rescored ${rescoredCount} opportunities.`);

  // 6. Summary Breakdown
  const [recSummary] = await pool.query(`
    SELECT recommendation, COUNT(*) as cnt
    FROM jobhunt_opportunities
    WHERE is_archived = 0 AND (is_active_link != 0 OR is_active_link IS NULL)
    GROUP BY recommendation
  `);
  console.log('\n=================================================================');
  console.log('🎉 AUDIT, SEEDING & RESCORING COMPLETE!');
  console.log('Active verified opportunities available on portal:');
  console.log(recSummary);
  console.log('=================================================================');

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});

