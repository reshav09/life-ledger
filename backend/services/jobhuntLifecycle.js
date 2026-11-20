const pool = require('../db/db');
// Availability changes never delete opportunities or detach shared application records.
async function runOpportunitiesLifecycle(targetPool = pool) {
  const [expired] = await targetPool.query(`UPDATE jobhunt_opportunities
    SET is_archived = 1, is_verified_active = 0
    WHERE is_archived = 0 AND application_deadline IS NOT NULL AND application_deadline < CURDATE()`);
  const [closed] = await targetPool.query(`UPDATE jobhunt_opportunities
    SET is_archived = 1, is_verified_active = 0
    WHERE is_archived = 0 AND is_active_link = 0`);
  return { deleted_expired: 0, archived_expired: expired.affectedRows || 0,
    archived_closed: closed.affectedRows || 0, archived_private: 0, archived_govt: 0, timestamp: new Date() };
}
module.exports = { runOpportunitiesLifecycle };
