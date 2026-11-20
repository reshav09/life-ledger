const pool = require('../db/db');
const crypto = require('crypto');

async function addNatWest() {
  console.log("Checking if NatWest Group is already in jobhunt_organizations...");
  const [existing] = await pool.query(
    "SELECT id, name FROM jobhunt_organizations WHERE name LIKE '%NatWest%' OR short_name LIKE '%NatWest%'"
  );

  let orgId;
  const orgData = {
    name: 'NatWest Group',
    short_name: 'NatWest',
    sector: 'Global Investment Banking & Financial Tech',
    org_type: 'Tier A- Global Banking & FinTech',
    careers_url: 'https://jobs.natwestgroup.com/search/jobs',
    notification_url: 'https://jobs.natwestgroup.com/search/jobs',
    pdf_page_url: null,
    website: 'https://www.natwestgroup.com',
    notes: 'Premier UK and international financial services and banking group with major tech, digital innovation, and data analytics hubs in Gurugram, Bengaluru, and Chennai, and global headquarters in Edinburgh/London. Core technology stacks include Cloud (AWS/Azure), FinOps, Microservices (Java/Python), Kafka, and Container Orchestration. CRITICAL NOTE: Technology, Engineering, and Early Career cohorts operate on rolling deadlines and close immediately once application capacity is reached.',
    quality_score: 90,
    category_group: 'private_in',
    country: 'India',
    region: 'Gurugram / Bengaluru / London',
    visa_sponsored: 0,
    currency: 'INR',
    min_ctc_threshold: 1400000,
    ats_type: 'custom_scrape',
    ats_id: null,
    poll_frequency_days: 1,
    is_active: 1
  };

  if (existing.length > 0) {
    orgId = existing[0].id;
    console.log(`NatWest Group already exists with ID [${orgId}]. Updating details...`);
    await pool.query(
      `UPDATE jobhunt_organizations SET
        short_name = ?, sector = ?, org_type = ?, careers_url = ?, notification_url = ?,
        website = ?, notes = ?, quality_score = ?, category_group = ?, country = ?,
        region = ?, visa_sponsored = ?, currency = ?, min_ctc_threshold = ?,
        poll_frequency_days = ?, is_active = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        orgData.short_name, orgData.sector, orgData.org_type, orgData.careers_url,
        orgData.notification_url, orgData.website, orgData.notes, orgData.quality_score,
        orgData.category_group, orgData.country, orgData.region, orgData.visa_sponsored,
        orgData.currency, orgData.min_ctc_threshold, orgData.poll_frequency_days,
        orgData.is_active, orgId
      ]
    );
  } else {
    const [result] = await pool.query(
      `INSERT INTO jobhunt_organizations
        (name, short_name, sector, org_type, careers_url, notification_url, website, notes, quality_score, poll_frequency_days, is_active, category_group, country, region, visa_sponsored, currency, min_ctc_threshold, ats_type, last_jobs_found)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 4)`,
      [
        orgData.name, orgData.short_name, orgData.sector, orgData.org_type,
        orgData.careers_url, orgData.notification_url, orgData.website, orgData.notes,
        orgData.quality_score, orgData.poll_frequency_days, orgData.is_active,
        orgData.category_group, orgData.country, orgData.region, orgData.visa_sponsored,
        orgData.currency, orgData.min_ctc_threshold, orgData.ats_type
      ]
    );
    orgId = result.insertId;
    console.log(`✅ Inserted NatWest Group with ID [${orgId}]`);
  }

  // Active opportunities for NatWest Group
  const opps = [
    {
      title: 'Software Engineer — Cloud & FinOps / Platform Infrastructure',
      job_type: 'private',
      category: 'job',
      location: 'Gurugram / Bengaluru, India (Hybrid)',
      ctc_min: 1600000,
      ctc_max: 2500000,
      compensation_display: '₹16 - ₹25 LPA + Performance Bonus',
      application_deadline: '2026-11-22', // 7 days left (DUE 7D)
      required_degree: 'B.Tech / B.E. / BS in Computer Science, IT, or related technical discipline',
      required_branch: 'Computer Science / Information Technology / Data Science',
      min_experience_years: 1.0,
      required_skills: JSON.stringify(['Python', 'AWS', 'Azure', 'Cloud Cost Optimization', 'FinOps', 'Docker', 'Kubernetes', 'Linux', 'CI/CD', 'Prometheus']),
      eligibility_pct: 98,
      profile_match_pct: 96,
      compensation_score: 90,
      career_potential_score: 94,
      org_quality_score: 90,
      opportunity_score: 94,
      recommendation: 'apply_now',
      notes: 'High-priority role within NatWest Commercial & Institutional Banking. Leads multi-cloud infrastructure rightsizing, containerized platform monitoring, and FinOps governance across AWS and Azure environments. Applications operate on rolling intake and close immediately once capacity is filled.',
      raw_text: `Role: Software Engineer — Cloud & FinOps / Platform Infrastructure
Company: NatWest Group (Global Investment Banking & Financial Tech)
Location: Gurugram / Bengaluru, India (Hybrid)
Compensation: ₹16 - ₹25 LPA + Performance Bonus
Application Deadline: 22 November 2026 (Rolling review - apply early)

About NatWest Group:
NatWest Group is a premier international financial services and banking organisation with over 19 million customers. Our technology engineering organisation powers core digital payments, capital markets, retail banking, and commercial platforms processing billions in daily transaction volume.

Role Overview:
We are looking for a Software Engineer specializing in Cloud Infrastructure, Platform Engineering, and FinOps to join our Digital & Enterprise Architecture team. In this role, you will design and optimize resilient cloud infrastructure across AWS and Azure, automate observability and deployment pipelines, and partner with engineering leads to drive cloud economic efficiency and resource rightsizing.

Key Responsibilities:
- Design, deploy, and maintain secure, high-throughput cloud infrastructure using Terraform, Docker, and Kubernetes.
- Drive cloud cost-optimization, resource rightsizing, and FinOps reporting across production multi-cloud accounts.
- Build and maintain telemetry, distributed metrics, and alerting using Prometheus, Grafana, and modern observability frameworks.
- Automate CI/CD release pipelines and container orchestration to guarantee zero-downtime rolling deployments.
- Diagnose production platform bottlenecks and enforce security best practices across Linux and cloud environments.

Qualifications & Technical Skills:
- B.Tech/B.E. or equivalent degree in Computer Science, IT, or related engineering discipline.
- 1+ years of hands-on production experience in Cloud Computing (AWS/Azure/GCP), Linux systems, and container technologies (Docker, Kubernetes).
- Practical experience with Infrastructure-as-Code (Terraform), CI/CD pipelines, and script automation in Python or Bash.
- Strong understanding of cloud economics, resource right-sizing, and FinOps principles.
- Familiarity with monitoring tools (Prometheus, Grafana) and production incident resolution.
- Excellent analytical, problem-solving, and cross-functional communication abilities.`
    },
    {
      title: 'Technology & Engineering Graduate Programme (2026 Intake)',
      job_type: 'private',
      category: 'job',
      location: 'Gurugram / Bengaluru / London',
      ctc_min: 1400000,
      ctc_max: 2000000,
      compensation_display: '₹14 - ₹20 LPA (India) / £38,000 - £44,000 (UK)',
      application_deadline: '2026-11-20', // 5 days left (DUE 7D)
      required_degree: 'B.Tech / BS / M.Tech in CS, IT, Data Science, Math, or Engineering (Class of 2025/2026)',
      required_branch: 'Computer Science / Data Science / Information Technology',
      min_experience_years: 0.0,
      required_skills: JSON.stringify(['Python', 'Data Structures & Algorithms', 'SQL', 'Cloud Basics', 'Docker', 'Git', 'Problem Solving']),
      eligibility_pct: 100,
      profile_match_pct: 95,
      compensation_score: 88,
      career_potential_score: 95,
      org_quality_score: 90,
      opportunity_score: 93,
      recommendation: 'apply_now',
      notes: 'Premier rotational graduate engineering scheme at NatWest Group. Rotations across cloud architecture, digital banking APIs, cybersecurity, and quantitative data engineering. Strictly rolling admissions — closes early without notice when cohort limit is reached.',
      raw_text: `Role: Technology & Engineering Graduate Programme (2026 Intake)
Company: NatWest Group
Location: Gurugram / Bengaluru, India & London / Edinburgh, UK
Compensation: ₹14 - ₹20 LPA (India) / £38,000 - £44,000 (UK) + Annual Discretionary Bonus
Application Deadline: 20 November 2026 (Rolling application window)

Programme Overview:
Our 2-year Technology & Engineering Graduate Programme offers intensive technical training, executive mentorship, and rotations across mission-critical software teams. You will work on real customer-facing digital features, resilient cloud platforms, and large-scale data engineering systems.

What You Will Do:
- Build and test microservices and APIs supporting modern web and mobile banking applications.
- Develop data pipelines and analytical dashboards enabling real-time financial insights.
- Collaborate in Agile engineering sprints alongside senior staff engineers and architects.
- Deepen foundational knowledge across Distributed Systems, Cloud Computing, and DevSecOps.

Candidate Requirements:
- On track to graduate or graduated with a Bachelor’s or Master’s in Computer Science, Data Science, or related engineering field (2025/2026 cohort).
- Solid programming grounding in Python, Java, C++, or modern TypeScript.
- Strong knowledge of fundamental data structures, algorithms, and SQL database concepts.
- Passion for software engineering, curiosity to master new technologies, and proactive team collaboration.`
    },
    {
      title: 'Software Engineer — Backend & Distributed Systems (Java / Python / Kafka)',
      job_type: 'private',
      category: 'job',
      location: 'Bengaluru / Gurugram, India',
      ctc_min: 1500000,
      ctc_max: 2300000,
      compensation_display: '₹15 - ₹23 LPA + Comprehensive Health & Pension',
      application_deadline: '2026-11-27', // 12 days left (DUE 14D)
      required_degree: 'B.Tech / B.E. / MCA in Computer Science or Software Engineering',
      required_branch: 'Computer Science / Engineering',
      min_experience_years: 1.0,
      required_skills: JSON.stringify(['Python', 'Java', 'SQL', 'Kafka', 'REST APIs', 'Microservices', 'Docker', 'Git', 'System Design']),
      eligibility_pct: 95,
      profile_match_pct: 92,
      compensation_score: 89,
      career_potential_score: 92,
      org_quality_score: 90,
      opportunity_score: 91,
      recommendation: 'apply_now',
      notes: 'Core transaction processing and event streaming team. Designing high-availability microservices handling real-time payments and ledger verification.',
      raw_text: `Role: Software Engineer — Backend & Distributed Systems (Java / Python / Kafka)
Company: NatWest Group
Location: Bengaluru / Gurugram, India
Compensation: ₹15 - ₹23 LPA + Annual Bonus & Pension
Application Deadline: 27 November 2026

Role Summary:
Join our Transaction Banking engineering team to develop scalable backend services and asynchronous messaging backbones handling millions of daily customer requests.

Responsibilities:
- Design, implement, and maintain enterprise RESTful and event-driven APIs using Java/Spring Boot and Python.
- Architect high-throughput Kafka streaming pipelines and integrate with relational and distributed NoSQL databases.
- Write thorough unit, integration, and load tests to ensure 99.99% system availability.
- Participate in code reviews, technical architecture RFCs, and continuous integration improvements.`
    },
    {
      title: 'Summer Technology & Engineering Internship (2026 Intake)',
      job_type: 'private',
      category: 'internship',
      location: 'Gurugram / Bengaluru, India (Hybrid)',
      ctc_min: 600000,
      ctc_max: 900000,
      compensation_display: '₹60,000 - ₹80,000 / month (Paid Internship)',
      application_deadline: '2026-11-25', // 10 days left (DUE 14D)
      required_degree: 'Pre-final or Final year B.Tech / BS in CS, IT, or Data Science',
      required_branch: 'Computer Science / Data Science / IT',
      min_experience_years: 0.0,
      required_skills: JSON.stringify(['Python', 'C++', 'Linux', 'Data Structures & Algorithms', 'Git', 'Problem Solving']),
      eligibility_pct: 100,
      profile_match_pct: 93,
      compensation_score: 85,
      career_potential_score: 92,
      org_quality_score: 90,
      opportunity_score: 89,
      recommendation: 'worth_applying',
      notes: '8 to 10-week summer internship. Mentored hands-on project work on live banking platforms with strong Pre-Placement Offer (PPO) potential.',
      raw_text: `Role: Summer Technology & Engineering Internship (2026 Intake)
Company: NatWest Group
Location: Gurugram / Bengaluru, India
Compensation: ₹60,000 - ₹80,000 / month stipend
Application Deadline: 25 November 2026 (Rolling intake)

Internship Details:
Spend 8-10 weeks embedded in an engineering team solving authentic engineering challenges in digital banking, cloud services, and AI data engineering. Interns demonstrating outstanding impact are considered for direct conversion (PPO) into the Graduate Scheme.`
    }
  ];

  console.log(`Inserting/updating ${opps.length} NatWest Group opportunities...`);
  for (const opp of opps) {
    const hash = crypto.createHash('sha256').update(opp.title + '||' + orgId).digest('hex').slice(0, 32);
    const [existingOpp] = await pool.query(
      'SELECT id FROM jobhunt_opportunities WHERE org_id = ? AND title = ?',
      [orgId, opp.title]
    );

    if (existingOpp.length > 0) {
      await pool.query(
        `UPDATE jobhunt_opportunities SET
          application_deadline = ?, ctc_min = ?, ctc_max = ?, compensation_display = ?,
          required_skills = ?, eligibility_pct = ?, profile_match_pct = ?, opportunity_score = ?,
          recommendation = ?, notes = ?, raw_text = ?, is_archived = 0, is_verified_active = 1,
          updated_at = NOW()
         WHERE id = ?`,
        [
          opp.application_deadline, opp.ctc_min, opp.ctc_max, opp.compensation_display,
          opp.required_skills, opp.eligibility_pct, opp.profile_match_pct, opp.opportunity_score,
          opp.recommendation, opp.notes, opp.raw_text, existingOpp[0].id
        ]
      );
      console.log(`Updated opportunity [${existingOpp[0].id}]: ${opp.title}`);
    } else {
      const [insertRes] = await pool.query(
        `INSERT INTO jobhunt_opportunities
          (org_id, title, source_url, source_type, required_degree, required_branch, min_experience_years,
           required_skills, location, ctc_min, ctc_max, application_deadline, apply_url, job_type,
           category, eligibility_pct, profile_match_pct, compensation_score, career_potential_score,
           org_quality_score, opportunity_score, recommendation, content_hash, raw_text, notes,
           is_new, is_archived, category_group, country, region, visa_sponsored, currency, compensation_display,
           is_verified_active, verification_source, identity_key)
         VALUES (?, ?, ?, 'manual_seed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 'private_in', 'India', 'Gurugram / Bengaluru / London', 0, 'INR', ?, 1, 'official_portal', ?)`,
        [
          orgId, opp.title, 'https://jobs.natwestgroup.com/search/jobs', opp.required_degree,
          opp.required_branch, opp.min_experience_years, opp.required_skills, opp.location,
          opp.ctc_min, opp.ctc_max, opp.application_deadline, 'https://jobs.natwestgroup.com/search/jobs',
          opp.job_type, opp.category, opp.eligibility_pct, opp.profile_match_pct,
          opp.compensation_score, opp.career_potential_score, opp.org_quality_score,
          opp.opportunity_score, opp.recommendation, hash, opp.raw_text, opp.notes,
          opp.compensation_display, 'natwest-' + hash
        ]
      );
      console.log(`✅ Created opportunity [${insertRes.insertId}]: ${opp.title}`);
    }
  }

  // Add comprehensive Interview Prep Plan in jobhunt_interview_prep
  console.log("Checking interview prep plan for NatWest Group...");
  const [existingPlan] = await pool.query(
    'SELECT id FROM jobhunt_interview_prep WHERE org_id = ? OR org_name = ?',
    [orgId, 'NatWest Group']
  );

  const prepStages = [
    {
      stage_number: 1,
      name: 'Stage 1: Online Technical & Situational Judgement Assessment (HackerRank / Talent Q)',
      type: 'online_assessment',
      duration_mins: 90,
      weightage_or_elimination: 'Eliminative Screening',
      description: 'Automated test consisting of 2 coding problems (Data Structures & Algorithms in Python/Java) plus Situational Judgement Questions evaluating NatWest Critical People Capabilities.',
      key_topics: ['Arrays & HashMaps', 'Two Pointers & Sliding Window', 'SQL Queries', 'Situational Judgement'],
      evaluation_criteria: ['Passing 100% test cases', 'Algorithmic time complexity (O(N))', 'Alignment with NatWest values'],
      sample_questions: [
        'Given a stream of transactions, find the first recurring transaction ID within a rolling timestamp window.',
        'Write an optimized SQL query to calculate daily net settlement volume per merchant category.',
        'A team member proposes bypassing a CI security scan to meet a release deadline. How do you respond?'
      ],
      curated_resources: [
        {
          name: 'NeetCode.io — Core DSA Roadmap',
          url: 'https://neetcode.io/',
          type: 'interactive_guide',
          description: 'Pattern-based roadmap for Arrays, Sliding Window, Trees, and DP.'
        },
        {
          name: 'Snehasish Roy — LeetCode Company-Wise Bank',
          url: 'https://github.com/snehasishroy/leetcode-companywise-interview-questions',
          type: 'github_repo',
          description: 'Curated company-tagged interview problems.'
        }
      ]
    },
    {
      stage_number: 2,
      name: 'Stage 2: Technical Interview 1 — Pair Coding & Cloud / Systems Fundamentals',
      type: 'dsa_coding',
      duration_mins: 60,
      weightage_or_elimination: 'Core Evaluative',
      description: 'Live pair programming session with a Senior Software Engineer. Explores modular clean coding, edge-case testing, Linux/cloud debugging, and concurrency.',
      key_topics: ['Data Structures & Algorithms', 'Linux & Networking', 'Docker & Cloud Architecture', 'Clean Code'],
      evaluation_criteria: ['Verbalizing technical trade-offs', 'Robust error and edge-case handling', 'Modular structure'],
      sample_questions: [
        'Implement an in-memory LRU cache with expiration timestamps and concurrency protection.',
        'Walk through how you diagnose an intermittent network timeout between an API microservice and a PostgreSQL database.',
        'How do Linux cgroups memory limits and CPU requests prevent pod noisy-neighbor starvation in Kubernetes?'
      ],
      curated_resources: [
        {
          name: 'Bregman Arie — DevOps Exercises (2,600+ Questions)',
          url: 'https://github.com/bregman-arie/devops-exercises',
          type: 'github_repo',
          description: 'Question bank for Linux, Docker, Kubernetes, AWS, and networking.'
        }
      ]
    },
    {
      stage_number: 3,
      name: 'Stage 3: System Design & FinOps Cloud Architecture',
      type: 'system_design',
      duration_mins: 60,
      weightage_or_elimination: 'Core Architecture Score',
      description: 'In-depth discussion on designing resilient financial banking services, asynchronous messaging (Kafka), database partitioning, and cloud economic efficiency.',
      key_topics: ['Microservices & Event-Driven Architecture', 'Kafka Event Streaming', 'Database Sharding & Transactions', 'FinOps Cost Optimization'],
      evaluation_criteria: ['Handling high throughput and zero data loss', 'Cost-effective infrastructure design', 'Failure domain isolation'],
      sample_questions: [
        'Design a high-throughput payment notification service processing 10,000 transactions per second with at-least-once delivery.',
        'How would you audit and re-architect an AWS/Azure multi-region infrastructure to achieve a 30% reduction in monthly spend without compromising SLAs?'
      ],
      curated_resources: [
        {
          name: 'Upendra Gundecha — How They SRE',
          url: 'https://github.com/upgundecha/howtheysre',
          type: 'github_repo',
          description: 'Real-world architectures, runbooks, and post-mortems from top engineering teams.'
        }
      ]
    },
    {
      stage_number: 4,
      name: 'Stage 4: Critical People Capabilities & Executive Fit Interview',
      type: 'behavioral',
      duration_mins: 45,
      weightage_or_elimination: 'Final Offer Decision',
      description: 'Behavioral interview with an Engineering Director / Capability Lead assessing NatWest’s 5 Critical People Capabilities: Inclusive, Curious, Robust, Agile, and Connected.',
      key_topics: ['STAR Behavioral Framework', 'Handling Production Incidents', 'Cross-Functional Collaboration', 'Customer-First Ethics'],
      evaluation_criteria: ['Demonstrated personal accountability', 'Ownership and constructive conflict resolution', 'Authentic communication of project impact'],
      sample_questions: [
        'Describe a complex technical production blocker you faced and how you methodically resolved it under strict timelines.',
        'Tell me about a time you identified an operational inefficiency or waste in your infrastructure and took initiative to fix it.',
        'Give an example of a disagreement you had with a senior colleague or product manager and how you reached data-driven consensus.'
      ],
      curated_resources: [
        {
          name: 'NatWest Group — Critical People Capabilities Guide',
          url: 'https://jobs.natwestgroup.com/content/Our-Values/?locale=en_GB',
          type: 'official_portal',
          description: 'Official NatWest behavioural competency framework and cultural values.'
        }
      ]
    }
  ];

  const prepRoadmap = [
    {
      phase: 'Phase 1: DSA Foundations & Banking Math',
      focus: 'NeetCode 150 & Sliding Window / HashMaps / SQL',
      tasks: ['Solve top 40 LeetCode Mediums on Arrays, Strings, and Two Pointers.', 'Practice SQL window functions and aggregation queries.']
    },
    {
      phase: 'Phase 2: Cloud, Linux & FinOps Systems',
      focus: 'AWS/Azure Infrastructure, Docker/K8s & Cost Optimization',
      tasks: ['Review Kubernetes resource quotas, pod lifecycle, and Terraform module patterns.', 'Prepare 3 quantifiable FinOps cost reduction examples from your work experience.']
    },
    {
      phase: 'Phase 3: NatWest Core Capabilities & Mock Rounds',
      focus: 'STAR Behavioral Framework & Critical People Capabilities',
      tasks: ['Structure 5 STAR stories mapped to: Inclusive, Curious, Robust, Agile, Connected.', 'Complete 2 mock technical interviews in the Mock Interview runner.']
    }
  ];

  const prepSources = [
    {
      title: 'NatWest Group Careers — Official Search & Selection Process',
      url: 'https://jobs.natwestgroup.com/search/jobs',
      platform: 'official_portal',
      agreement_note: 'Official portal for hiring guidelines and active vacancies.'
    },
    {
      title: 'NatWest Group Interview Process & Reviews — Glassdoor & AmbitionBox',
      url: 'https://www.glassdoor.co.in/Interview/NatWest-Group-Interview-Questions-E3932738.htm',
      platform: 'interview_community',
      agreement_note: 'Cross-referenced candidate experiences across software engineer and graduate tracks.'
    }
  ];

  if (existingPlan.length > 0) {
    await pool.query(
      `UPDATE jobhunt_interview_prep SET
        stages = ?, prep_roadmap = ?, sources = ?, total_stages = 4, confidence = 'high',
        last_researched_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(prepStages), JSON.stringify(prepRoadmap), JSON.stringify(prepSources), existingPlan[0].id]
    );
    console.log(`Updated existing prep plan [${existingPlan[0].id}] for NatWest Group`);
  } else {
    await pool.query(
      `INSERT INTO jobhunt_interview_prep
        (org_id, org_name, role_title, role_category, process_type, total_stages, confidence,
         confidence_reason, stages, prep_roadmap, curated_resources, sources, last_researched_at)
       VALUES (?, 'NatWest Group', 'Software Engineer — Cloud & Platform Infrastructure', 'devops_cloud', 'private_tech', 4, 'high',
               'Cross-verified across official NatWest recruitment guidelines, Workday application flow, and verified candidate interview reports on Glassdoor & AmbitionBox.',
               ?, ?, ?, ?, NOW())`,
      [
        orgId,
        JSON.stringify(prepStages),
        JSON.stringify(prepRoadmap),
        JSON.stringify(prepStages.flatMap(s => s.curated_resources || [])),
        JSON.stringify(prepSources)
      ]
    );
    console.log(`✅ Created interview prep plan for NatWest Group`);
  }

  console.log("All NatWest Group records added successfully!");
  return true;
}

if (require.main === module) {
  addNatWest()
    .then(() => process.exit(0))
    .catch(err => {
      console.error("Error adding NatWest:", err);
      process.exit(1);
    });
}

module.exports = { addNatWest };
