const pool=require('../db/db');
const crypto=require('node:crypto');
const {contentHash,parseJson}=require('./jobhuntDocuments');
const {renderPdf}=require('./jobhuntDocumentRenderer');
async function saveRevision(id,{tailored_resume_markdown,tailored_cover_letter_markdown}){
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction();
  const [[initial]]=await conn.query('SELECT * FROM jobhunt_document_packages WHERE id=?',[id]);
  if(!initial)throw new Error('Package not found.');
  const root=initial.root_package_id || initial.id;
  await conn.query('SELECT id FROM jobhunt_document_packages WHERE id=? FOR UPDATE',[root]);
  const [[p]]=await conn.query('SELECT * FROM jobhunt_document_packages WHERE id=? FOR UPDATE',[id]);
  const resume=tailored_resume_markdown ?? p.tailored_resume_markdown,letter=tailored_cover_letter_markdown ?? p.tailored_cover_letter_markdown;
  if(typeof resume!=='string'||(letter!=null&&typeof letter!=='string')||resume.length>100000||(letter || '').length>50000)throw new Error('Document text is invalid or too large.');
  const hash=contentHash(resume,letter);
  if(hash===contentHash(p.tailored_resume_markdown,p.tailored_cover_letter_markdown)){await conn.commit();return {package_id:p.id,version:p.version};}
  const [[last]]=await conn.query('SELECT MAX(version) AS version FROM jobhunt_document_packages WHERE id=? OR root_package_id=?',[root,root]);
  const version=Number(last.version || 1)+1;
  const [r]=await conn.query(`INSERT INTO jobhunt_document_packages (opportunity_id,application_id,org_name,role_title,root_package_id,version,status,tailored_resume_markdown,tailored_cover_letter_markdown,target_job_description,key_skills_addressed,evidence_claims_used,profile_snapshot,evidence_snapshot,content_hash)
    VALUES (?,?,?,?,?,?,'draft',?,?,?,?,?,?,?,?)`,[p.opportunity_id,p.application_id,p.org_name,p.role_title,root,version,resume,letter || '',p.target_job_description,p.key_skills_addressed==null?null:JSON.stringify(parseJson(p.key_skills_addressed)),JSON.stringify(parseJson(p.evidence_claims_used,[])),p.profile_snapshot,p.evidence_snapshot,hash]);
  await conn.commit();return {package_id:r.insertId,version};
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
async function approvePackage(id,{confirmed=false}={}){
 if(confirmed!==true)throw new Error('Confirm that you reviewed this exact version.');
 const conn=await pool.getConnection();try{
  await conn.beginTransaction();const [[p]]=await conn.query('SELECT * FROM jobhunt_document_packages WHERE id=? FOR UPDATE',[id]);
  if(!p)throw new Error('Package not found.');if(p.status==='submitted'){await conn.commit();return {status:'submitted'};}
  const hash=contentHash(p.tailored_resume_markdown,p.tailored_cover_letter_markdown);
  const [[r]]=await conn.query('SELECT * FROM jobhunt_document_reviews WHERE package_id=? AND content_hash=? ORDER BY id DESC LIMIT 1',[id,hash]);
  if(!r || parseJson(r.unsupported_claims,[]).length)throw new Error('Run the factual check and resolve the flagged claims before approval.');
  await conn.query("UPDATE jobhunt_document_packages SET status='approved',content_hash=? WHERE id=?",[hash,id]);await conn.commit();return {status:'approved'};
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
async function submitPackage(id,{confirmed=false}={}){
 if(confirmed!==true)throw new Error('Confirm that you have submitted this exact version externally.');
 const conn=await pool.getConnection();try{
  await conn.beginTransaction();const [[p]]=await conn.query('SELECT * FROM jobhunt_document_packages WHERE id=? FOR UPDATE',[id]);
  if(!p)throw new Error('Package not found.');if(p.status==='submitted'){await conn.commit();return {application_id:p.application_id,status:'submitted'};}
  if(p.status!=='approved'||!p.application_id)throw new Error('Approve the documents and link a planning application first.');
  const [[app]]=await conn.query('SELECT * FROM applications WHERE id=? FOR UPDATE',[p.application_id]);if(!app)throw new Error('Linked application no longer exists.');
  for(const [type,text] of [['resume',p.tailored_resume_markdown],['cover_letter',p.tailored_cover_letter_markdown]]){
   if(!text)continue;const [[stored]]=await conn.query('SELECT content FROM jobhunt_document_artifacts WHERE package_id=? AND doc_type=?',[p.id,type]);if(stored?.content)continue;const bytes=await renderPdf({title:`${p.org_name} — ${type}`,contentMarkdown:text});
   await conn.query('INSERT INTO jobhunt_document_artifacts (package_id,doc_type,sha256,content) VALUES (?,?,?,?)',[p.id,type,crypto.createHash('sha256').update(bytes).digest('hex'),bytes]);
  }
  await conn.query("UPDATE jobhunt_document_packages SET status='submitted',submitted_at=NOW() WHERE id=?",[id]);
  await conn.query("UPDATE applications SET status=CASE WHEN status='planning' THEN 'applied' ELSE status END WHERE id=?",[p.application_id]);
  if(p.opportunity_id)await conn.query('UPDATE jobhunt_opportunities SET is_applied=1,applied_at=COALESCE(applied_at,NOW()) WHERE id=?',[p.opportunity_id]);
  await conn.query("INSERT INTO jobhunt_application_events (application_id,event_type,title,metadata_json) VALUES (?,'submitted','Recorded external submission',?)",[p.application_id,JSON.stringify({packageId:p.id,version:p.version,contentHash:p.content_hash})]);
  await conn.commit();return {application_id:p.application_id,status:'submitted'};
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}
module.exports={saveRevision,approvePackage,submitPackage};
