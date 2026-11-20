// Explicit operator command. Never run at migration/startup. --dry-run does not write.
const pool=require('../db/db');
const {fetchATSOpportunities}=require('../services/jobhuntATS');
const {ingestOpportunity}=require('../services/jobhuntIngestion');
async function run({dryRun=process.argv.includes('--dry-run')}={}) {
 const [[profile]]=await pool.query('SELECT * FROM jobhunt_profile WHERE id=1');
 const [settings]=await pool.query("SELECT `key`,`value` FROM settings WHERE `key` LIKE 'jobhunt_threshold_%'");
 const thresholds=Object.fromEntries(settings.map(r=>[r.key.replace('jobhunt_threshold_',''),Number(r.value)]));
 const [orgs]=await pool.query("SELECT * FROM jobhunt_organizations WHERE is_active=1 AND ats_id IS NOT NULL AND ats_type IN ('greenhouse','lever','ashby','smartrecruiters','workday','pyjamahr')");
 let processed=0,errors=0;
 for(const org of orgs){try{
  const jobs=await fetchATSOpportunities(org,{techOnly:false,maxRoles:0});
  for(const job of jobs){await ingestOpportunity(org,job,{profile:profile || {},thresholds,dryRun});processed++;}
  console.log(`${org.name}: ${jobs.length} source records ${dryRun?'previewed':'processed'}`);
 }catch(err){errors++;console.error(`${org.name}: ${err.message}`);}}
 return {dryRun,processed,errors};
}
if(require.main===module)run().then(r=>{console.log(r);process.exitCode=r.errors?1:0;}).catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());
module.exports={run};
