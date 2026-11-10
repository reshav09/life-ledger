const express = require('express');
const router = express.Router();
const pool = require('../db/db');

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

// Create
router.post('/', async (req, res) => {
  try {
    const { name, role = '', type = 'job', status = 'planning', deadline, url = '', notes = '', priority = 'medium', opportunity_id = null } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const [result] = await pool.query(
      'INSERT INTO applications (name, role, type, status, deadline, url, notes, priority, opportunity_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, role, type, status, deadline || null, url, notes, priority, opportunity_id || null]
    );
    if (opportunity_id) {
      await pool.query('UPDATE jobhunt_opportunities SET is_applied = 1, applied_at = NOW() WHERE id = ?', [opportunity_id]);
    }
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update
router.put('/:id', async (req, res) => {
  try {
    const { name, role, type, status, deadline, url, notes, priority, opportunity_id = null } = req.body;
    await pool.query(
      `UPDATE applications SET name=?, role=?, type=?, status=?, deadline=?, url=?, notes=?, priority=?, opportunity_id=?
       WHERE id=?`,
      [name, role, type, status, deadline || null, url, notes, priority, opportunity_id || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete
router.delete('/:id', async (req, res) => {
  try {
    const [[appRow]] = await pool.query('SELECT opportunity_id FROM applications WHERE id = ?', [req.params.id]);
    await pool.query('DELETE FROM applications WHERE id = ?', [req.params.id]);
    if (appRow?.opportunity_id) {
      const [rem] = await pool.query('SELECT id FROM applications WHERE opportunity_id = ?', [appRow.opportunity_id]);
      if (rem.length === 0) {
        await pool.query('UPDATE jobhunt_opportunities SET is_applied = 0, applied_at = NULL WHERE id = ?', [appRow.opportunity_id]);
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
