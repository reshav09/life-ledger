/**
 * jobhuntFollowups.js - Application Lifecycle Events & Follow-up Intelligence (M8)
 * Inspired by ai-job-search & Dossier application workflows
 */

const pool = require('../db/db');

/**
 * Logs a timestamped application event (submitted, interview, feedback, rejected, followup)
 */
async function logApplicationEvent({ applicationId, eventType, title, notes, metadata }) {
  if (!applicationId || !eventType) throw new Error('applicationId and eventType are required');

  const [res] = await pool.query(
    `INSERT INTO jobhunt_application_events 
     (application_id, event_type, title, notes, metadata_json)
     VALUES (?, ?, ?, ?, ?)`,
    [
      applicationId,
      eventType,
      title || eventType,
      notes || null,
      metadata ? JSON.stringify(metadata) : null
    ]
  );

  return { id: res.insertId, eventType, title };
}

/**
 * Returns timeline of events for an application
 */
async function getApplicationEvents(applicationId) {
  const [rows] = await pool.query(
    'SELECT * FROM jobhunt_application_events WHERE application_id = ? ORDER BY event_date ASC, id ASC',
    [applicationId]
  );
  return rows.map(r => ({
    ...r,
    metadata: r.metadata_json ? (typeof r.metadata_json === 'string' ? JSON.parse(r.metadata_json) : r.metadata_json) : null
  }));
}

/**
 * Generates an editable follow-up email draft based on application context
 */
async function generateFollowupDraft({ applicationId, draftType = 'check_in' }) {
  const [apps] = await pool.query(
    `SELECT a.*, op.title AS opp_title, org.name AS org_name, pkg.tailored_resume_markdown
     FROM applications a
     LEFT JOIN jobhunt_opportunities op ON a.opportunity_id = op.id
     LEFT JOIN jobhunt_organizations org ON op.org_id = org.id
     LEFT JOIN jobhunt_document_packages pkg ON pkg.application_id = a.id
     WHERE a.id = ?`,
    [applicationId]
  );

  if (apps.length === 0) throw new Error('Application not found');
  const app = apps[0];
  const company = app.org_name || app.name || 'Hiring Team';
  const role = app.opp_title || app.role || 'Position';

  if (draftType === 'thank_you') {
    return {
      subject: `Thank you for the interview — ${role} at ${company}`,
      body: `Hi Team,\n\nThank you for taking the time to speak with me today regarding the ${role} position. I really enjoyed learning more about ${company}'s engineering priorities and technical challenges.\n\nOur conversation reinforced my excitement about the opportunity to contribute my multi-cloud and systems engineering background to your team. Please let me know if there are any follow-up materials or references I can provide.\n\nBest regards,\nReshav Sharma\nreshav2004b@gmail.com | 8839750668`
    };
  }

  return {
    subject: `Following up on my application for ${role} — Reshav Sharma`,
    body: `Hi ${company} Recruiting Team,\n\nI hope you are having a productive week.\n\nI am writing to check in on the status of my application for the ${role} role, which I submitted recently. I remain very enthusiastic about ${company} and believe my hands-on background in multi-cloud optimization, systems observability, and automation would allow me to make an immediate impact on your team.\n\nPlease let me know if you need any additional details or sample work from my end. I look forward to hearing from you regarding next steps.\n\nWarm regards,\nReshav Sharma\nreshav2004b@gmail.com | 8839750668`
  };
}

module.exports = {
  logApplicationEvent,
  getApplicationEvents,
  generateFollowupDraft
};
