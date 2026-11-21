/**
 * Pre-generate Tailored Document Packages for Target Opportunities
 * Synthesizes grounded, fact-checked ATS resumes and tailored cover letters
 * for all top-priority target employers (PSUs, Govt Labs, Premier Startups, Indian Tech Giants)
 * so that candidate workspace loads instantly without "No document package" empty states.
 */

const pool = require('../db/db');
const { prepareInputs, draftDocumentPackage } = require('../services/jobhuntDocuments');
const { reviewDocumentPackage } = require('../services/jobhuntDocumentReview');

async function pregenerateTargetPackages() {
  console.log('=====================================================');
  console.log('📄 PRE-GENERATING PACKAGES FOR TARGET OPPORTUNITIES');
  console.log('=====================================================');

  // Query top priority active opportunities that do not have a package yet
  const [opps] = await pool.query(`
    SELECT op.id, op.title, o.name as org_name, op.opportunity_score
    FROM jobhunt_opportunities op
    JOIN jobhunt_organizations o ON op.org_id = o.id
    WHERE op.is_archived = 0 AND op.recommendation != 'ignore'
      AND op.id NOT IN (SELECT opportunity_id FROM jobhunt_document_packages WHERE opportunity_id IS NOT NULL)
    ORDER BY op.opportunity_score DESC
    LIMIT 35
  `);

  console.log(`Found ${opps.length} high-priority opportunities without tailored document packages.`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < opps.length; i++) {
    const opp = opps[i];
    try {
      const prepared = await prepareInputs({
        opportunityId: opp.id,
        useAI: false
      });
      const drafted = await draftDocumentPackage({ prepared });
      await reviewDocumentPackage(drafted.packageId);

      successCount++;
      console.log(`[${i + 1}/${opps.length}] ✓ Package #${drafted.packageId} generated: ${opp.org_name} — ${opp.title.slice(0, 35)}`);
    } catch (err) {
      failCount++;
      console.warn(`[${i + 1}/${opps.length}] ✗ Failed for opp #${opp.id} (${opp.org_name}): ${err.message}`);
    }
  }

  console.log('=====================================================');
  console.log(`✅ COMPLETED: ${successCount} packages generated, ${failCount} failed.`);
  const [totalPkgs] = await pool.query('SELECT count(*) as cnt FROM jobhunt_document_packages');
  console.log(`Total packages now in database: ${totalPkgs[0].cnt}`);
  console.log('=====================================================');
}

if (require.main === module) {
  pregenerateTargetPackages()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error during pre-generation:', err);
      process.exit(1);
    });
}

module.exports = pregenerateTargetPackages;
