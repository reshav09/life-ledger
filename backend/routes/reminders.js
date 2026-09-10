const express = require('express');
const router = express.Router();
const pool = require('../db/db');

function computeNextDue(dueDay) {
  const today = new Date();
  let year = today.getFullYear();
  let month = today.getMonth();
  let day = Math.min(dueDay, new Date(year, month + 1, 0).getDate());
  let next = new Date(year, month, day);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (next < todayMidnight) {
    month += 1;
    day = Math.min(dueDay, new Date(year, month + 1, 0).getDate());
    next = new Date(year, month, day);
  }
  return next;
}

function withDueInfo(rows) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return rows
    .map((r) => {
      const next = computeNextDue(r.due_day);
      const daysUntil = Math.round((next - today) / (1000 * 60 * 60 * 24));
      return { ...r, next_due_date: next.toISOString().slice(0, 10), days_until: daysUntil };
    })
    .sort((a, b) => a.days_until - b.days_until);
}

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, c.name AS category_name, c.icon AS category_icon
       FROM bill_reminders r LEFT JOIN categories c ON c.id = r.category_id
       WHERE r.is_active = 1`
    );
    res.json(withDueInfo(rows));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// Only the ones due soon enough to actually show as a Dashboard banner.
router.get('/upcoming', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, c.name AS category_name, c.icon AS category_icon
       FROM bill_reminders r LEFT JOIN categories c ON c.id = r.category_id
       WHERE r.is_active = 1`
    );
    const due = withDueInfo(rows).filter((r) => r.days_until <= r.remind_days_before && r.days_until >= 0);
    res.json(due);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch upcoming reminders' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, amount, category_id, due_day, remind_days_before } = req.body;
    if (!name || !due_day) return res.status(400).json({ error: 'name and due_day are required' });
    if (due_day < 1 || due_day > 31) return res.status(400).json({ error: 'due_day must be between 1 and 31' });
    const [result] = await pool.query(
      `INSERT INTO bill_reminders (name, amount, category_id, due_day, remind_days_before) VALUES (?, ?, ?, ?, ?)`,
      [name, amount || null, category_id || null, due_day, remind_days_before || 3]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM bill_reminders WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

module.exports = router;
