const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const {syncOpportunityState,recordStatus}=require('../services/jobhuntApplicationState');

// List all applications, optionally filtered by status or type
router.get('/', async (req, res) => {
  try {
    const { status, type } = req.query;
    let sql = 'SELECT * FROM applications';
    const conditions = [];
    const params = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (type) { conditions.push('type = ?'); params.push(type); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY FIELD(status, "interview","applied","planning","offer","cleared","rejected"), FIELD(priority,"high","medium","low"), deadline ASC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shared Applications ledger: Job Hunt side effects only for explicitly linked rows.
async function transaction(fn){const conn=await pool.getConnection();try{await conn.beginTransaction();const result=await fn(conn);await conn.commit();return result;}catch(e){await conn.rollback();throw e;}finally{conn.release();}}
function validate(b){if(!b.name)throw new Error('Name is required');if(!['planning','applied','interview','offer','rejected','cleared'].includes(b.status))throw new Error('Invalid application status');}
router.post('/',async(req,res)=>{try{
 const b={role:'',type:'job',status:'planning',deadline:null,url:'',notes:'',priority:'medium',opportunity_id:null,...req.body};validate(b);
 const result=await transaction(async db=>{if(b.opportunity_id){const [[opp]]=await db.query('SELECT id FROM jobhunt_opportunities WHERE id=? FOR UPDATE',[b.opportunity_id]);if(!opp)throw new Error('Opportunity not found');}
 const [r]=await db.query('INSERT INTO applications (name,role,type,status,deadline,url,notes,priority,opportunity_id) VALUES (?,?,?,?,?,?,?,?,?)',[b.name,b.role,b.type,b.status,b.deadline || null,b.url,b.notes,b.priority,b.opportunity_id || null]);
 if(b.opportunity_id){await syncOpportunityState(db,b.opportunity_id);await recordStatus(db,r.insertId,b.status);}return {id:r.insertId};});res.json(result);
}catch(e){res.status(400).json({error:e.message});}});
router.put('/:id',async(req,res)=>{try{
 await transaction(async db=>{const [[old]]=await db.query('SELECT * FROM applications WHERE id=? FOR UPDATE',[req.params.id]);if(!old)throw new Error('Application not found');
 const b={...old,...req.body};validate(b);
 if(b.opportunity_id&&Number(b.opportunity_id)!==Number(old.opportunity_id)){const [[opp]]=await db.query('SELECT id FROM jobhunt_opportunities WHERE id=?',[b.opportunity_id]);if(!opp)throw new Error('Opportunity not found');}
 await db.query('UPDATE applications SET name=?,role=?,type=?,status=?,deadline=?,url=?,notes=?,priority=?,opportunity_id=? WHERE id=?',[b.name,b.role,b.type,b.status,b.deadline || null,b.url,b.notes,b.priority,b.opportunity_id || null,req.params.id]);
 if(old.opportunity_id)await syncOpportunityState(db,old.opportunity_id);
 if(b.opportunity_id){await syncOpportunityState(db,b.opportunity_id);if(b.status!==old.status)await recordStatus(db,old.id,b.status);}});
 res.json({success:true});
}catch(e){res.status(400).json({error:e.message});}});
router.delete('/:id',async(req,res)=>{try{
 await transaction(async db=>{const [[old]]=await db.query('SELECT * FROM applications WHERE id=? FOR UPDATE',[req.params.id]);
 if(old?.opportunity_id){const [docs]=await db.query('SELECT id FROM jobhunt_document_packages WHERE application_id=? LIMIT 1',[old.id]);if(docs.length)throw new Error('This application has preserved document history. Keep the record and update its status instead.');}
 await db.query('DELETE FROM applications WHERE id=?',[req.params.id]);if(old?.opportunity_id)await syncOpportunityState(db,old.opportunity_id);});res.json({success:true});
}catch(e){res.status(400).json({error:e.message});}});
module.exports=router;
