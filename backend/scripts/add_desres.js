const pool = require('../db/db');

async function addDESRES() {
  console.log("Checking if D. E. Shaw Research is already added...");
  const [existing] = await pool.query(
    "SELECT id, name FROM jobhunt_organizations WHERE name LIKE '%Shaw Research%' OR name LIKE '%DESRES%'"
  );

  let orgId;
  if (existing.length > 0) {
    orgId = existing[0].id;
    console.log(`D. E. Shaw Research already exists with ID [${orgId}]. Updating metadata...`);
    await pool.query(
      `UPDATE jobhunt_organizations SET
        short_name = 'DESRES',
        sector = 'Computational Biology & Supercomputing (Anton)',
        org_type = 'research',
        careers_url = 'https://www.deshawresearch.com/joining.html',
        notification_url = 'https://www.deshawresearch.com/current-opportunities.html',
        pdf_page_url = 'https://www.deshawresearch.com/joining_summerinternships.html',
        website = 'https://www.deshawresearch.com',
        notes = 'Elite computational biochemistry & supercomputing research institute founded by David E. Shaw. Creators of custom Anton supercomputers for millisecond-scale molecular dynamics. 12-15 week Summer Research Internships & Data Associate / ML / HPC roles. Python, C/C++, PyTorch, CUDA. Contact: Zelimir.Galjanic@career.DEShawResearch.com.',
        quality_score = 98,
        category_group = 'research_internship',
        country = 'United States',
        region = 'New York / Global',
        visa_sponsored = 1,
        currency = 'USD',
        min_ctc_threshold = 100000,
        ats_type = 'custom_scrape',
        ats_id = NULL,
        is_active = 1,
        updated_at = NOW()
       WHERE id = ?`,
      [orgId]
    );
  } else {
    const [result] = await pool.query(
      `INSERT INTO jobhunt_organizations 
       (name, short_name, sector, org_type, careers_url, notification_url, pdf_page_url, website, notes, quality_score, poll_frequency_days, is_active, category_group, country, region, visa_sponsored, currency, min_ctc_threshold, ats_type, ats_id, last_jobs_found)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 7, 1, ?, ?, ?, 1, 'USD', ?, 'custom_scrape', NULL, 2)`,
      [
        'D. E. Shaw Research (DESRES)',
        'DESRES',
        'Computational Biology & Supercomputing (Anton)',
        'research',
        'https://www.deshawresearch.com/joining.html',
        'https://www.deshawresearch.com/current-opportunities.html',
        'https://www.deshawresearch.com/joining_summerinternships.html',
        'https://www.deshawresearch.com',
        'Elite computational biochemistry & supercomputing research institute founded by David E. Shaw. Creators of custom Anton supercomputers for millisecond-scale molecular dynamics. 12-15 week Summer Research Internships & Data Associate / ML / HPC roles. Python, C/C++, PyTorch, CUDA. Contact: Zelimir.Galjanic@career.DEShawResearch.com.',
        98,
        'research_internship',
        'United States',
        'New York / Global',
        100000
      ]
    );
    orgId = result.insertId;
    console.log(`✅ Inserted D. E. Shaw Research (DESRES) with ID [${orgId}]`);
  }

  // Insert or update the 2 active opportunities
  console.log("Checking opportunities for DESRES...");
  const opps = [
    {
      title: 'DESRES Summer Research Internship (ML & Scientific Computing)',
      source_url: 'https://www.deshawresearch.com/joining_summerinternships.html',
      apply_url: 'https://www.deshawresearch.com/joining_summerinternships.html',
      job_type: 'research',
      category: 'internship',
      category_group: 'research_internship',
      country: 'United States',
      region: 'New York',
      visa_sponsored: 1,
      currency: 'USD',
      compensation_display: 'Paid Internship + Housing & Travel',
      eligibility_pct: 95,
      profile_match_pct: 94,
      org_quality_score: 98,
      opportunity_score: 96,
      recommendation: 'apply_now',
      required_degree: 'B.Tech / B.E. / M.Tech / MS / PhD in CS, EE, Math, Physics, Chem',
      required_skills: 'Python, C/C++, Linux, PyTorch, CUDA, High-Performance Computing, Machine Learning',
      notes: '12 to 15 weeks paid summer research internship. Deep involvement in ML, LLMs for drug discovery, Anton supercomputer software. Direct application via portal or CV to Zelimir.Galjanic@career.DEShawResearch.com.'
    },
    {
      title: 'Data Associate (Machine Learning & Scientific Datasets)',
      source_url: 'https://www.deshawresearch.com/current-opportunities.html',
      apply_url: 'https://www.deshawresearch.com/current-opportunities.html',
      job_type: 'research',
      category: 'job',
      category_group: 'research_internship',
      country: 'United States',
      region: 'New York',
      visa_sponsored: 1,
      currency: 'USD',
      compensation_display: '$100K - $150K / yr + Benefits',
      eligibility_pct: 92,
      profile_match_pct: 90,
      org_quality_score: 98,
      opportunity_score: 93,
      recommendation: 'worth_applying',
      required_degree: 'Undergraduate degree in STEM field',
      required_skills: 'Python, SQL, Linux, Data Engineering, Metadata Provenance, Machine Learning datasets',
      notes: 'Two-year research position with full benefits. Supports ML team processing scientific datasets relevant to drug discovery.'
    }
  ];

  for (const o of opps) {
    const [existOpp] = await pool.query(
      "SELECT id FROM jobhunt_opportunities WHERE org_id = ? AND title = ?",
      [orgId, o.title]
    );

    if (existOpp.length > 0) {
      console.log(`Opportunity "${o.title}" already exists [${existOpp[0].id}]. Updating...`);
      await pool.query(
        `UPDATE jobhunt_opportunities SET
          source_url = ?, apply_url = ?, compensation_display = ?, notes = ?, recommendation = ?, opportunity_score = ?, updated_at = NOW()
         WHERE id = ?`,
        [o.source_url, o.apply_url, o.compensation_display, o.notes, o.recommendation, o.opportunity_score, existOpp[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO jobhunt_opportunities 
         (org_id, title, source_url, source_type, required_degree, required_branch, min_experience_years, required_skills, location, apply_url, job_type, category, eligibility_pct, profile_match_pct, compensation_score, career_potential_score, org_quality_score, opportunity_score, recommendation, notes, is_new, is_archived, category_group, country, region, visa_sponsored, currency, compensation_display, is_verified_active, is_active_link)
         VALUES (?, ?, ?, 'official_portal', ?, 'Computer Science / Engineering / STEM', 0, ?, 'New York, NY', ?, ?, ?, ?, ?, 98, 98, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?, 1, 1)`,
        [
          orgId, o.title, o.source_url, o.required_degree, o.required_skills, o.apply_url,
          o.job_type, o.category, o.eligibility_pct, o.profile_match_pct, o.org_quality_score, o.opportunity_score,
          o.recommendation, o.notes, o.category_group, o.country, o.region, o.visa_sponsored, o.currency, o.compensation_display
        ]
      );
      console.log(`✅ Added Opportunity: "${o.title}"`);
    }
  }

  const [verify] = await pool.query(
    "SELECT id, name, category_group, careers_url, (SELECT count(*) FROM jobhunt_opportunities WHERE org_id = jobhunt_organizations.id) as opp_count FROM jobhunt_organizations WHERE id = ?",
    [orgId]
  );
  console.log("\nDESRES Record in DB:", verify[0]);
  process.exit(0);
}

addDESRES().catch(err => {
  console.error("Error adding DESRES:", err);
  process.exit(1);
});

