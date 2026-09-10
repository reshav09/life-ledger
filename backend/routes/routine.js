const express = require('express');
const router = express.Router();
const pool = require('../db/db');

// ── Activities CRUD ──

router.get('/activities', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM routine_activities WHERE is_active = 1 ORDER BY sort_order, id'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/activities', async (req, res) => {
  try {
    const { name, icon = '📌', color = '#5B7FBA', default_hours = 1 } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const [maxOrder] = await pool.query('SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM routine_activities');
    const [result] = await pool.query(
      'INSERT INTO routine_activities (name, icon, color, default_hours, sort_order) VALUES (?, ?, ?, ?, ?)',
      [name, icon, color, default_hours, maxOrder[0].next]
    );
    res.json({ id: result.insertId, name, icon, color, default_hours });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/activities/:id', async (req, res) => {
  try {
    const { name, icon, color, default_hours, sort_order } = req.body;
    await pool.query(
      'UPDATE routine_activities SET name=?, icon=?, color=?, default_hours=?, sort_order=? WHERE id=?',
      [name, icon, color, default_hours, sort_order, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/activities/:id', async (req, res) => {
  try {
    await pool.query('UPDATE routine_activities SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Schedule for Date (used by Diet Dashboard cross-ledger integration) ──
router.get('/today', async (req, res) => {
  try {
    const { date } = req.query;
    let dayOfWeek;
    if (date && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m, d] = date.split('-').map(Number);
      dayOfWeek = new Date(y, m - 1, d).getDay();
    } else {
      dayOfWeek = new Date().getDay(); // 0=Sun
    }
    const [rows] = await pool.query(
      `SELECT t.start_time, t.end_time, t.notes, a.name AS activity_name, a.icon
       FROM routine_templates t JOIN routine_activities a ON a.id = t.activity_id
       WHERE t.day_of_week = ? AND a.is_active = 1
       ORDER BY t.sort_order, t.start_time`,
      [dayOfWeek]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Template CRUD ──

router.get('/template', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT t.*, a.name AS activity_name, a.icon AS activity_icon, a.color AS activity_color
      FROM routine_templates t
      JOIN routine_activities a ON t.activity_id = a.id
      ORDER BY t.day_of_week, t.sort_order, t.start_time
    `);
    // Group by day_of_week
    const grouped = {};
    for (let d = 0; d < 7; d++) grouped[d] = [];
    rows.forEach((r) => grouped[r.day_of_week].push(r));
    res.json(grouped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/template', async (req, res) => {
  try {
    const { day_of_week, activity_id, start_time, end_time, notes = '' } = req.body;
    if (day_of_week === undefined || !activity_id || !start_time || !end_time) {
      return res.status(400).json({ error: 'day_of_week, activity_id, start_time, end_time are required' });
    }
    const [maxOrder] = await pool.query(
      'SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM routine_templates WHERE day_of_week = ?',
      [day_of_week]
    );
    const [result] = await pool.query(
      'INSERT INTO routine_templates (day_of_week, activity_id, start_time, end_time, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [day_of_week, activity_id, start_time, end_time, notes, maxOrder[0].next]
    );
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/template/:id', async (req, res) => {
  try {
    const { activity_id, start_time, end_time, notes } = req.body;
    await pool.query(
      'UPDATE routine_templates SET activity_id=?, start_time=?, end_time=?, notes=? WHERE id=?',
      [activity_id, start_time, end_time, notes, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/template/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM routine_templates WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Logs (daily actuals) ──

router.get('/logs', async (req, res) => {
  try {
    const { date, from, to } = req.query;
    let sql, params;
    if (date) {
      sql = `SELECT l.*, a.name AS activity_name, a.icon AS activity_icon, a.color AS activity_color
             FROM routine_logs l JOIN routine_activities a ON l.activity_id = a.id
             WHERE l.log_date = ? ORDER BY a.sort_order`;
      params = [date];
    } else if (from && to) {
      sql = `SELECT l.*, a.name AS activity_name, a.icon AS activity_icon, a.color AS activity_color
             FROM routine_logs l JOIN routine_activities a ON l.activity_id = a.id
             WHERE l.log_date BETWEEN ? AND ? ORDER BY l.log_date, a.sort_order`;
      params = [from, to];
    } else {
      sql = `SELECT l.*, a.name AS activity_name, a.icon AS activity_icon, a.color AS activity_color
             FROM routine_logs l JOIN routine_activities a ON l.activity_id = a.id
             ORDER BY l.log_date DESC, a.sort_order LIMIT 200`;
      params = [];
    }
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logs', async (req, res) => {
  try {
    const { log_date, entries } = req.body;
    if (!log_date || !entries || !Array.isArray(entries)) {
      return res.status(400).json({ error: 'log_date and entries[] are required' });
    }
    // Upsert each entry using INSERT ... ON DUPLICATE KEY UPDATE
    for (const entry of entries) {
      if (!entry.activity_id) continue;
      const hours = Math.max(0, Number(entry.hours) || 0);
      await pool.query(
        `INSERT INTO routine_logs (log_date, activity_id, hours, notes)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE hours = VALUES(hours), notes = VALUES(notes)`,
        [log_date, entry.activity_id, hours, entry.notes || '']
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Summary (aggregated hours) ──

router.get('/summary', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to date params required' });
    const [rows] = await pool.query(`
      SELECT a.id, a.name, a.icon, a.color, COALESCE(SUM(l.hours), 0) AS total_hours,
             COUNT(DISTINCT l.log_date) AS days_logged
      FROM routine_activities a
      LEFT JOIN routine_logs l ON a.id = l.activity_id AND l.log_date BETWEEN ? AND ?
      WHERE a.is_active = 1
      GROUP BY a.id
      ORDER BY total_hours DESC
    `, [from, to]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
