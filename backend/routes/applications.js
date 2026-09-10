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
    const { name, role = '', type = 'job', status = 'planning', deadline, url = '', notes = '', priority = 'medium' } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const [result] = await pool.query(
      'INSERT INTO applications (name, role, type, status, deadline, url, notes, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, role, type, status, deadline || null, url, notes, priority]
    );
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update
router.put('/:id', async (req, res) => {
  try {
    const { name, role, type, status, deadline, url, notes, priority } = req.body;
    await pool.query(
      `UPDATE applications SET name=?, role=?, type=?, status=?, deadline=?, url=?, notes=?, priority=?
       WHERE id=?`,
      [name, role, type, status, deadline || null, url, notes, priority, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM applications WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
