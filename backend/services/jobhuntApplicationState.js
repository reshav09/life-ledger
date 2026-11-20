const SUBMITTED=['applied','interview','offer','rejected','cleared'];
async function syncOpportunityState(db,opportunityId){
 if(!opportunityId)return;
 await db.query(`UPDATE jobhunt_opportunities SET
   is_applied=EXISTS(SELECT 1 FROM applications WHERE opportunity_id=? AND status IN ('applied','interview','offer','rejected','cleared')),
   applied_at=CASE WHEN EXISTS(SELECT 1 FROM applications WHERE opportunity_id=? AND status IN ('applied','interview','offer','rejected','cleared')) THEN COALESCE(applied_at,NOW()) ELSE NULL END
   WHERE id=?`,[opportunityId,opportunityId,opportunityId]);
}
async function recordStatus(db,id,status){await db.query('INSERT INTO jobhunt_application_events (application_id,event_type,title) VALUES (?,?,?)',[id,status==='applied'?'submitted':status,`Application status: ${status}`]);}
module.exports={syncOpportunityState,recordStatus,SUBMITTED};
