const pool = require('../db/db');

/**
 * Automated Lifecycle Maintenance for Job Hunt Opportunities:
 * 
 * Rules enforced:
 * 1. AUTOMATIC PURGE OF EXPIRED DEADLINES:
 *    When application_deadline < CURDATE() (or deadline passed):
 *    - Automatically and permanently DELETE the opportunity from jobhunt_opportunities!
 *    - If tracked in applications table, decouple applications.opportunity_id to keep application records safe.
 * 
 * 2. AUTOMATIC ARCHIVAL OF STALE PRIVATE POSTS (>15 DAYS):
 *    For private companies (category_group LIKE 'private%' OR job_type = 'private'):
 *    - If posted_date < DATE_SUB(CURDATE(), INTERVAL 15 DAY) (posted > 15 days ago):
 *      Move to is_archived = 1, recommendation = 'ignore'.
 *      Reason: Private tech companies hire on rolling basis; posts older than 15 days risk filled requisitions.
 * 
 * 3. AUTOMATIC ARCHIVAL OF STALE GOVT / PSU POSTS (>20 DAYS):
 *    For govt / psu (category_group IN ('psu', 'govt', 'defence', 'research') OR job_type IN ('govt', 'psu', 'defence', 'research')):
 *    - If posted_date < DATE_SUB(CURDATE(), INTERVAL 20 DAY) (posted > 20 days ago):
 *      Move to is_archived = 1.
 * 
 * 4. AUTOMATIC PURGE OF ARCHIVED POSTS ONCE DEADLINE EXPIRES:
 *    Even if a private post was archived at day 16, once its application_deadline < CURDATE(),
 *    it is completely deleted from the database!
 */
async function runOpportunitiesLifecycle(targetPool) {
  const db = targetPool || pool;

  try {
    // 1. Decouple applications referencing opportunities that are about to be deleted
    await db.query(`
      UPDATE applications a
      JOIN jobhunt_opportunities op ON a.opportunity_id = op.id
      SET a.opportunity_id = NULL
      WHERE op.application_deadline IS NOT NULL AND op.application_deadline < CURDATE()
    `);

    // 2. Permanently delete all opportunities where application_deadline < CURDATE()
    // Applies to both active and archived opportunities
    const [delRes] = await db.query(`
      DELETE FROM jobhunt_opportunities
      WHERE application_deadline IS NOT NULL AND application_deadline < CURDATE()
    `);
    const deletedExpired = delRes.affectedRows || 0;

    // 3. Automatically archive private opportunities posted > 15 days ago (rolling hiring window)
    const [archPrivateRes] = await db.query(`
      UPDATE jobhunt_opportunities
      SET is_archived = 1,
          recommendation = 'ignore',
          notes = CONCAT(IFNULL(notes, ''), '\n[Auto-Archived: Private role posted > 15 days ago (rolling hiring basis)]')
      WHERE is_archived = 0
        AND (category_group LIKE 'private%' OR job_type = 'private')
        AND (
          (posted_date IS NOT NULL AND posted_date < DATE_SUB(CURDATE(), INTERVAL 15 DAY))
          OR (posted_date IS NULL AND discovered_at < DATE_SUB(NOW(), INTERVAL 15 DAY))
        )
    `);
    const archivedPrivate = archPrivateRes.affectedRows || 0;

    // 4. Automatically archive Govt / PSU opportunities posted > 20 days ago
    const [archGovtRes] = await db.query(`
      UPDATE jobhunt_opportunities
      SET is_archived = 1,
          recommendation = 'ignore',
          notes = CONCAT(IFNULL(notes, ''), '\n[Auto-Archived: Govt/PSU role posted > 20 days ago]')
      WHERE is_archived = 0
        AND (category_group IN ('psu', 'govt', 'defence', 'research') OR job_type IN ('govt', 'psu', 'defence', 'research'))
        AND (
          (posted_date IS NOT NULL AND posted_date < DATE_SUB(CURDATE(), INTERVAL 20 DAY))
          OR (posted_date IS NULL AND discovered_at < DATE_SUB(NOW(), INTERVAL 20 DAY))
        )
    `);
    const archivedGovt = archGovtRes.affectedRows || 0;

    // 5. Automatically archive ghost jobs where link is verified dead
    const [archGhostRes] = await db.query(`
      UPDATE jobhunt_opportunities
      SET is_archived = 1,
          recommendation = 'ignore',
          notes = CONCAT(IFNULL(notes, ''), '\n[Auto-Archived: Dead link / 404 ghost job]')
      WHERE is_archived = 0 AND is_active_link = 0
    `);
    const archivedGhost = archGhostRes.affectedRows || 0;

    if (deletedExpired > 0 || archivedPrivate > 0 || archivedGovt > 0) {
      console.log(`[JobHunt Lifecycle] Deleted ${deletedExpired} expired opportunities, archived ${archivedPrivate} stale private (>15d), archived ${archivedGovt} stale govt/psu (>20d).`);
    }

    return {
      deleted_expired: deletedExpired,
      archived_private: archivedPrivate,
      archived_govt: archivedGovt,
      timestamp: new Date()
    };
  } catch (err) {
    console.error('[JobHunt Lifecycle Error]:', err.message);
    return { error: err.message };
  }
}

module.exports = {
  runOpportunitiesLifecycle
};
