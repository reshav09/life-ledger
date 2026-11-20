const crypto = require('node:crypto');
const pool = require('../db/db');
const { normalizeExtractedItem } = require('./jobhuntExtractor');
const { computeOpportunityScore } = require('./jobhuntScoring');
function canonicalUrl(value) {
  try {const u=new URL(value);u.hash='';for(const k of [...u.searchParams.keys()])if(/^utm_|^fbclid$/.test(k))u.searchParams.delete(k);u.searchParams.sort();return u.href;}catch{return '';}
}
function identityFor(org,job) {
  const identity=job.external_id ? `id:${job.external_id}` : `url:${canonicalUrl(job.apply_url || job.source_url)}`;
  if(identity==='url:' && !job.raw_text) throw new Error('A source ID, URL, or full posting text is required.');
  return crypto.createHash('sha256').update(`${org.id || 'unassigned'}|${identity==='url:'?'text:'+job.title+'|'+job.raw_text:identity}`).digest('hex');
}
async function ingestOpportunity(org,job,{profile={},thresholds={},dryRun=false}={}) {
  const url=canonicalUrl(job.apply_url || job.source_url);
  const normalized=normalizeExtractedItem(job,{source_type:job.source_type || 'manual',source_url:url,raw_text:job.raw_text || job.raw_summary || ''});
  const fields={org_id:org.id,title:normalized.title,external_id:job.external_id || null,identity_key:identityFor(org,job),
    source_url:normalized.source_url,source_type:normalized.source_type,apply_url:url,
    required_degree:normalized.required_degree,required_branch:normalized.required_branch,
    min_experience_years:normalized.min_experience_years,required_skills:JSON.stringify(normalized.required_skills),
    location:normalized.location,ctc_min:normalized.ctc_min,ctc_max:normalized.ctc_max,pay_scale:normalized.pay_scale,
    application_deadline:normalized.application_deadline,raw_text:normalized.raw_text,
    job_type:normalized.job_type==='other' ? (org.ats_type ? 'private' : 'other') : normalized.job_type,
    category:normalized.category,category_group:org.category_group || 'private_global',country:job.country || '',region:job.region || '',
    visa_sponsored:job.visa_sponsored===true || job.visa_sponsored===1 ? 1 : 0,currency:job.currency || org.currency || 'INR',
    compensation_display:normalized.compensation_display,posted_date:job.posted_date || null,
    confidence_metadata:JSON.stringify(normalized.confidence_metadata),requires_gate:normalized.requires_gate};
  if(dryRun)return {dry_run:true,fields,scores:computeOpportunityScore(profile,{...normalized,...fields},org,thresholds)};
  const conn=await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SELECT id FROM jobhunt_organizations WHERE id = ? FOR UPDATE',[org.id]);
    const [rows]=await conn.query(`SELECT * FROM jobhunt_opportunities WHERE org_id <=> ? AND
      (identity_key = ? OR (external_id IS NOT NULL AND external_id = ?) OR (identity_key IS NULL AND apply_url = ? AND apply_url != '')) LIMIT 1 FOR UPDATE`,
      [org.id,fields.identity_key,fields.external_id,url]);
    const existing=rows[0];
    if(existing)for(const k of Object.keys(fields))if(fields[k]==null || fields[k]==='' || fields[k]==='[]')delete fields[k];
    const merged={...existing,...fields};
    const scores=computeOpportunityScore(profile,merged,org,thresholds);
    for(const k of ['eligibility_pct','profile_match_pct','compensation_score','career_potential_score','competition_signal','application_difficulty_score','org_quality_score','deadline_urgency_score','opportunity_score','recommendation'])fields[k]=scores[k];
    let id;
    if(existing){id=existing.id;await conn.query(`UPDATE jobhunt_opportunities SET ${Object.keys(fields).map(k=>`${k} = ?`).join(', ')}, last_verified_at = NOW() WHERE id = ?`,[...Object.values(fields),id]);}
    else {fields.is_verified_active=0;fields.is_active_link=1;const [r]=await conn.query(`INSERT INTO jobhunt_opportunities (${Object.keys(fields).join(', ')}) VALUES (${Object.keys(fields).map(()=>'?').join(', ')})`,Object.values(fields));id=r.insertId;}
    await conn.commit();return {id,inserted:!existing,title:fields.title,score:scores.opportunity_score,recommendation:scores.recommendation};
  }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
module.exports={ingestOpportunity,canonicalUrl,identityFor};
