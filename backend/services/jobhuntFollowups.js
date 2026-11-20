const pool=require('../db/db');
const {parseJson}=require('./jobhuntDocuments');
async function logApplicationEvent({applicationId,eventType,title,notes,metadata}){
 if(!applicationId || !['contacted','interview','feedback','offer','rejected','followup_sent','thank_you_sent','note'].includes(eventType))throw new Error('Choose a valid event. Record submission through the reviewed document package.');
 const [[app]]=await pool.query('SELECT id,opportunity_id FROM applications WHERE id=?',[applicationId]);
 if(!app)throw new Error('Application not found');
 const [r]=await pool.query('INSERT INTO jobhunt_application_events (application_id,event_type,title,notes,metadata_json) VALUES (?,?,?,?,?)',[applicationId,eventType,String(title || eventType).slice(0,255),notes || null,metadata?JSON.stringify(metadata):null]);
 return {id:r.insertId,eventType,title};
}
async function getApplicationEvents(id){const [rows]=await pool.query('SELECT * FROM jobhunt_application_events WHERE application_id=? ORDER BY event_date,id',[id]);return rows.map(x=>({...x,metadata:parseJson(x.metadata_json,null)}));}
async function generateFollowupDraft({applicationId,draftType='check_in'}){
 const [[app]]=await pool.query('SELECT * FROM applications WHERE id=?',[applicationId]);if(!app)throw new Error('Application not found');
 const [[pkg]]=await pool.query("SELECT * FROM jobhunt_document_packages WHERE application_id=? AND status='submitted' ORDER BY submitted_at DESC,id DESC LIMIT 1",[applicationId]);
 if(app.status==='planning'&&!pkg)throw new Error('Record submission before drafting a follow-up.');
 if(['rejected','cleared'].includes(app.status))throw new Error('This application is closed.');
 const profile=parseJson(pkg?.profile_snapshot,{});
 const company=pkg?.org_name || app.name,role=pkg?.role_title || app.role;
 const signature=[profile.full_name || '[Your name]',[profile.email,profile.phone].filter(Boolean).join(' | ')].filter(Boolean).join('\n');
 if(draftType==='thank_you'){
  const [[event]]=await pool.query("SELECT event_date FROM jobhunt_application_events WHERE application_id=? AND event_type='interview' ORDER BY event_date DESC LIMIT 1",[applicationId]);
  if(!event)throw new Error('Record the interview event before drafting a thank-you note.');
  return {subject:`Thank you — ${role} at ${company}`,body:`Hello ${company} team,\n\nThank you for taking the time to discuss the ${role} position with me. I appreciate the opportunity to learn more about the role. Please let me know if I can provide further information.\n\nBest regards,\n${signature}`};
 }
 return {subject:`Following up — ${role} at ${company}`,body:`Hello ${company} team,\n\nI am following up on my application for the ${role} position. I remain interested in the opportunity and would appreciate any update on next steps. Please let me know if you need additional information.\n\nBest regards,\n${signature}`};
}
async function dueFollowups(){
 const [[s]]=await pool.query("SELECT `value` FROM settings WHERE `key`='jobhunt_followup_days'");const days=Math.max(1,Math.min(365,Number(s?.value)||7));
 const [rows]=await pool.query(`SELECT a.id,a.name,a.role,a.status,
  COALESCE((SELECT MAX(e.event_date) FROM jobhunt_application_events e WHERE e.application_id=a.id AND e.event_type IN ('submitted','contacted','interview','followup_sent','thank_you_sent')),a.created_at) AS last_contact
  FROM applications a LEFT JOIN jobhunt_followup_reminders r ON r.application_id=a.id
  WHERE a.status IN ('applied','interview') AND (a.opportunity_id IS NOT NULL OR EXISTS(SELECT 1 FROM jobhunt_document_packages p WHERE p.application_id=a.id))
  AND COALESCE(r.dismissed,0)=0 AND (r.snoozed_until IS NULL OR r.snoozed_until<=NOW())
  HAVING last_contact<DATE_SUB(NOW(),INTERVAL ? DAY) ORDER BY last_contact`,[days]);
 return {days,items:rows};
}
async function updateReminder(id,{dismiss=false,snoozeDays=0}){
 const [[app]]=await pool.query('SELECT id FROM applications WHERE id=?',[id]);if(!app)throw new Error('Application not found');
 const days=Math.max(0,Math.min(365,Number(snoozeDays)||0));
 await pool.query('INSERT INTO jobhunt_followup_reminders (application_id,dismissed,snoozed_until) VALUES (?,?,DATE_ADD(NOW(),INTERVAL ? DAY)) ON DUPLICATE KEY UPDATE dismissed=VALUES(dismissed),snoozed_until=VALUES(snoozed_until)',[id,dismiss?1:0,days]);return {success:true};
}
module.exports={logApplicationEvent,getApplicationEvents,generateFollowupDraft,dueFollowups,updateReminder};
