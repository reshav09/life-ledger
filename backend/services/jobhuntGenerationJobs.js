const pool=require('../db/db');
const {randomUUID}=require('node:crypto');
const {prepareInputs,draftDocumentPackage,parseJson}=require('./jobhuntDocuments');
const {reviewDocumentPackage}=require('./jobhuntDocumentReview');
async function getJob(id){const [[r]]=await pool.query('SELECT id,opportunity_id,status,attempts,result_package_id,error,created_at,updated_at FROM jobhunt_generation_jobs WHERE id=?',[id]);return r || null;}
async function enqueueGeneration(input,key){
 if(typeof key!=='string'||!/^[a-zA-Z0-9_-]{16,64}$/.test(key))throw new Error('Provide a valid idempotency key.');
 const [[old]]=await pool.query('SELECT id,opportunity_id FROM jobhunt_generation_jobs WHERE request_key=?',[key]);
 if(old){if(Number(old.opportunity_id || 0)!==Number(input.opportunityId || 0))throw new Error('This request key belongs to another opportunity.');return getJob(old.id);}
 const prepared=await prepareInputs(input),id=randomUUID();
 await pool.query(`INSERT INTO jobhunt_generation_jobs (id,request_key,opportunity_id,payload_json) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE request_key=VALUES(request_key)`,[id,key,input.opportunityId || null,JSON.stringify(prepared)]);
 const [[job]]=await pool.query('SELECT id FROM jobhunt_generation_jobs WHERE request_key=?',[key]);
 setImmediate(() => runNextJob().catch(() => {}));
 return getJob(job.id);
}
async function runNextJob(){
 const conn=await pool.getConnection();let job,token=randomUUID();
 try{
  await conn.beginTransaction();
  await conn.query("UPDATE jobhunt_generation_jobs SET status='failed',error='Worker stopped repeatedly. Retry explicitly.',lease_token=NULL WHERE status='running' AND lease_until<NOW() AND attempts>=3");
  const [[row]]=await conn.query("SELECT * FROM jobhunt_generation_jobs WHERE attempts<3 AND (status='queued' OR (status='running' AND lease_until<NOW())) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED");
  if(!row){await conn.commit();return false;}job=row;
  await conn.query("UPDATE jobhunt_generation_jobs SET status='running',attempts=attempts+1,lease_token=?,lease_until=DATE_ADD(NOW(),INTERVAL 90 SECOND),error=NULL WHERE id=?",[token,job.id]);
  await conn.commit();
 }catch(e){await conn.rollback();throw e;}finally{conn.release();}
 const heartbeat=setInterval(()=>pool.query("UPDATE jobhunt_generation_jobs SET lease_until=DATE_ADD(NOW(),INTERVAL 90 SECOND) WHERE id=? AND lease_token=? AND status='running'",[job.id,token]).catch(()=>{}),20000);heartbeat.unref();
 let timeout;
 try{
  const result=await Promise.race([draftDocumentPackage({prepared:parseJson(job.payload_json),generationKey:job.id,jobId:job.id,leaseToken:token}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Generation timed out. Retry or use template drafting.')),120000);})]);
  // Drafting is idempotent. A restart can repeat review without replacing previous reviews.
  await reviewDocumentPackage(result.packageId);
  await pool.query("UPDATE jobhunt_generation_jobs SET status='complete',result_package_id=?,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=? AND status='running'",[result.packageId,job.id,token]);
 }catch(e){
  await pool.query("UPDATE jobhunt_generation_jobs SET status='failed',error=?,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=? AND status='running'",[String(e.message).slice(0,300),job.id,token]);
 }finally{clearInterval(heartbeat);clearTimeout(timeout);}
 return true;
}
async function changeJob(id,action){
 if(action==='cancel')await pool.query("UPDATE jobhunt_generation_jobs SET status='cancelled',lease_token=NULL,lease_until=NULL WHERE id=? AND status IN ('queued','running')",[id]);
 else if(action==='retry')await pool.query("UPDATE jobhunt_generation_jobs SET status='queued',attempts=0,error=NULL WHERE id=? AND status='failed'",[id]);
 else throw new Error('Unknown job action.');return getJob(id);
}
function startGenerationWorker(){
 let running=false,stopped=false;
 const tick=async()=>{if(running||stopped)return;running=true;try{await runNextJob();}catch(e){console.error('[Job Hunt worker]',e.code || e.name);}finally{running=false;}};
 const timer=setInterval(tick,2000);timer.unref();tick();return ()=>{stopped=true;clearInterval(timer);};
}
module.exports={enqueueGeneration,getJob,runNextJob,changeJob,startGenerationWorker};
