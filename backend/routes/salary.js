const express = require('express');
const router = express.Router();
const pool = require('../db/db');

router.get('/', async (req, res) => {
  try {
    const { month } = req.query;
    let sql = `SELECT s.*, a.name AS account_name FROM salaries s JOIN accounts a ON a.id = s.account_id`;
    const params = [];
    if (month) {
      sql += ' WHERE DATE_FORMAT(s.received_on, "%Y-%m") = ?';
      params.push(month);
    }
    sql += ' ORDER BY received_on DESC, s.id DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch salary records' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { account_id, amount, label, received_on } = req.body;
    if (!account_id || !amount || !received_on) {
      return res.status(400).json({ error: 'account_id, amount and received_on are required' });
    }
    const [result] = await pool.query(
      'INSERT INTO salaries (account_id, amount, label, received_on) VALUES (?, ?, ?, ?)',
      [account_id, amount, label || 'Salary', received_on]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add salary record' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM salaries WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete salary record' });
  }
});

module.exports = router;
