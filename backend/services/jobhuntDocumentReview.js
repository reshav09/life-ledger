const pool=require('../db/db');
const {parseJson,contentHash}=require('./jobhuntDocuments');
function normalize(s){return String(s).replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1 $2').replace(/[*#_]/g,'').replace(/[^\p{L}\p{N}%$€₹]+/gu,' ').trim().toLowerCase();}
function reviewAgainstSnapshot(pkg){
 const evidence=parseJson(pkg.evidence_snapshot,null),profile=parseJson(pkg.profile_snapshot,null);
 if(!evidence || !profile)return {unsupported:[{text_snippet:'Legacy package',reason:'No immutable evidence snapshot exists. Generate a new package before approval.'}],missing:[],score:0,risk:'high'};
 const facts=Object.values(evidence).flat();
 const allowed=facts.flatMap(x=>[x.claim,x.source,...(x.skills || [])]).concat([profile.full_name,profile.email,profile.phone,profile.linkedin,profile.github,profile.summary]).filter(Boolean).map(normalize);
 const structural=new Set(['professional summary','technical skills','professional experience','key projects','education','publications research','certifications honors']);
 const unsupported=[];
 for(const raw of `${pkg.tailored_resume_markdown || ''}\n${pkg.tailored_cover_letter_markdown || ''}`.split('\n')){
  let line=raw.trim();if(!line || line==='---')continue;
  const clean=normalize(line);
  if(structural.has(clean))continue;

  if(/^(?:\*\*)?(Date:|To:|Position:|From:)/.test(line))continue;
  if(/^(Dear Hiring Team,|Sincerely,|Relevant experience and project work:|Thank you for your time and consideration\.|I would welcome the opportunity to discuss how this experience relates to your team’s requirements\.)$/.test(line))continue;
  if(line===`I am writing to express my strong interest in the **${pkg.role_title}** opportunity at **${pkg.org_name}**. The experience and projects below reflect the confirmed facts in my career profile.`)continue;


  line=line.replace(/^\s*[*-]\s*/, '').replace(/^\*\*(Relevant skills|Core Competencies):\*\*\s*/,'').replace(/^\*Technologies:\s*/,'').replace(/\*$/,'');
  const parts=line.split(/\s+[•|]\s+|,\s*/).map(normalize).filter(Boolean);
  const n=normalize(line);
  const matched=allowed.some(x=>x===n) || (parts.length>1 && parts.every(p=>allowed.some(x=>x===p)));
  if(!matched)unsupported.push({text_snippet:raw.slice(0,400),reason:'This wording, number, credential, or claim is not an exact match to the confirmed snapshot. Review and update evidence before using it.'});
 }
 const jd=String(pkg.target_job_description || '').toLowerCase();
 const skills=new Set(facts.flatMap(x=>x.skills || []).map(x=>x.toLowerCase()));
 const terms=['terraform','kubernetes','python','rust','typescript','react','kafka','spark','pytorch','redis','ansible','golang'];
 const missing=terms.filter(t=>new RegExp(`\\b${t}\\b`,'i').test(jd)&&!skills.has(t));
 return {unsupported,missing,score:Math.max(0,100-unsupported.length*15),risk:unsupported.length?'high':'none'};
}
async function reviewDocumentPackage(packageId){
 const [[pkg]]=await pool.query('SELECT * FROM jobhunt_document_packages WHERE id=?',[packageId]);
 if(!pkg)throw new Error('Document package not found.');
 const result=reviewAgainstSnapshot(pkg);
 const hash=contentHash(pkg.tailored_resume_markdown,pkg.tailored_cover_letter_markdown);
 const notes=`Snapshot consistency check: ${result.unsupported.length} item(s) need review. This checks exact wording against confirmed facts; it does not prove factual truth or predict ATS acceptance. Human review is required.`;
 const [r]=await pool.query(`INSERT INTO jobhunt_document_reviews (package_id,review_score,hallucination_risk,unsupported_claims,missing_requirements,critique_notes,reviewer_agent,content_hash) VALUES (?,?,?,?,?,?,'snapshot-validator-v1',?)`,
 [packageId,result.score,result.risk,JSON.stringify(result.unsupported),JSON.stringify(result.missing),notes,hash]);
 await pool.query("UPDATE jobhunt_document_packages SET status='reviewed' WHERE id=? AND status IN ('draft','reviewed')",[packageId]);
 return {reviewId:r.insertId,reviewScore:result.score,hallucinationRisk:result.risk,unsupportedClaims:result.unsupported,missingRequirements:result.missing,critiqueNotes:notes,contentHash:hash};
}
module.exports={reviewDocumentPackage,reviewAgainstSnapshot};
