/**
 * Master Seed Script for Standalone Job Hunt deployment.
 * Populates all 350+ organizations, tier list companies, prep plans, question bank,
 * and initial opportunities if the database is fresh.
 */
const pool = require('../db/db');

async function seedStandalone() {
  console.log('[Seed] Checking if standalone database requires initialization...');
  
  try {
    const [[{ org_count }]] = await pool.query('SELECT COUNT(*) AS org_count FROM jobhunt_organizations');
    
    if (org_count > 0) {
      console.log(`[Seed] Organizations already seeded (${org_count} found). Skipping full seed.`);
    } else {
      console.log('[Seed] Database is empty. Running complete seed sequence...');

      // 1. Seed Base Tier List Companies (FAANG, Unicorns, HFT, MNCs)
      try {
        console.log('[Seed 1/8] Seeding Tier List Companies...');
        const seedTierList = require('./seedTierListCompanies');
        if (typeof seedTierList === 'function') await seedTierList();
      } catch (e) { console.warn('[Seed TierList]:', e.message); }

      // 2. Seed PSUs & Indian Govt R&D
      try {
        console.log('[Seed 2/8] Seeding PSUs & Govt R&D...');
        const seedPSUs = require('./seedPSUs');
        if (typeof seedPSUs === 'function') await seedPSUs();
      } catch (e) { console.warn('[Seed PSUs]:', e.message); }

      // 3. Seed Research Fellowships & Internships
      try {
        console.log('[Seed 3/8] Seeding Research Fellowships...');
        const seedResearch = require('./seedResearchInternships');
        if (typeof seedResearch === 'function') await seedResearch();
      } catch (e) { console.warn('[Seed Research]:', e.message); }

      // 4. Seed Startups & Scaleups
      try {
        console.log('[Seed 4/8] Seeding Startups & Scaleups...');
        const seedStartups = require('./seedStartups');
        if (typeof seedStartups === 'function') await seedStartups();
      } catch (e) { console.warn('[Seed Startups]:', e.message); }

      // 5. Seed EU & International Visa Companies
      try {
        console.log('[Seed 5/8] Seeding EU & Global Visa Orgs...');
        const syncEU = require('./syncEUOrgs');
        if (typeof syncEU === 'function') await syncEU();
      } catch (e) { console.warn('[Seed EU]:', e.message); }

      // 6. Seed Additional Orgs (NatWest, D.E. Shaw, etc.)
      try {
        console.log('[Seed 6/8] Seeding NatWest & High-Yield Orgs...');
        const addNatwest = require('./add_natwest');
        if (typeof addNatwest === 'function') await addNatwest();
      } catch (e) { console.warn('[Seed NatWest]:', e.message); }

      // 7. Seed Initial Opportunities
      try {
        console.log('[Seed 7/8] Seeding Opportunities...');
        const seedOpps = require('./seedOpportunities');
        if (typeof seedOpps === 'function') await seedOpps();
        const seedStartupOpps = require('./seedStartupOpportunities');
        if (typeof seedStartupOpps === 'function') await seedStartupOpps();
      } catch (e) { console.warn('[Seed Opps]:', e.message); }

      // 8. Seed Prep Plans & Questions
      try {
        console.log('[Seed 8/8] Seeding Prep Plans & Interview Questions...');
        const seedPrep = require('./seedAllPrepPlans');
        if (typeof seedPrep === 'function') await seedPrep();
        const seedQuestions = require('./seedTrueUpQuestions');
        if (typeof seedQuestions === 'function') await seedQuestions();
      } catch (e) { console.warn('[Seed Prep]:', e.message); }

      console.log('[Seed] ✓ Full seed sequence complete!');
    }

    // Ensure default career profile exists
    const [[prof]] = await pool.query('SELECT id FROM jobhunt_profile WHERE id = 1');
    if (!prof) {
      console.log('[Seed] Creating starter career profile...');
      await pool.query(`
        INSERT INTO jobhunt_profile (id, full_name, email, phone, candidate_name, primary_branch, current_location, work_mode_preference, target_roles, target_skills, expected_ctc_lpa)
        VALUES (1, 'Candidate', '', '', 'Candidate', 'Computer Science & Engineering', 'India / Remote', 'hybrid', '["Software Engineer", "Backend Engineer", "Platform Engineer", "Full Stack Developer"]', '["Python", "JavaScript", "TypeScript", "React", "Node.js", "SQL", "Docker", "Git"]', 18)
      `);
    }

    // Auto-configure Gemini API Key if passed via environment variable
    const geminiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
    if (geminiKey) {
      console.log('[Seed] Configuring Gemini AI Key from environment...');
      const { encrypt } = require('../services/crypto');
      const encKey = encrypt(geminiKey);
      await pool.query(`
        INSERT INTO ai_settings (id, provider, gemini_api_key, gemini_model)
        VALUES (1, 'gemini', ?, 'gemini-1.5-flash')
        ON DUPLICATE KEY UPDATE gemini_api_key = VALUES(gemini_api_key), provider = 'gemini'
      `, [encKey]);
    }

  } catch (err) {
    console.error('[Seed Error]:', err.message);
  }
}

module.exports = { seedStandalone };

