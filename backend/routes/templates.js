const express = require('express');
const router = express.Router();
const pool = require('../db/db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, c.icon AS category_icon, c.name AS category_name, c.color AS category_color, a.name AS account_name
       FROM templates t JOIN categories c ON c.id = t.category_id JOIN accounts a ON a.id = t.account_id
       ORDER BY t.name`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, account_id, category_id, amount, type, description } = req.body;
    if (!name || !account_id || !category_id || !amount) {
      return res.status(400).json({ error: 'name, account_id, category_id and amount are required' });
    }
    const [result] = await pool.query(
      `INSERT INTO templates (name, account_id, category_id, amount, type, description) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, account_id, category_id, amount, type || 'expense', description || '']
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM templates WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// One tap: log a transaction straight from a saved template, dated today (or a given date).
router.post('/:id/use', async (req, res) => {
  try {
    const [[tpl]] = await pool.query('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    const txnDate = req.body.txn_date || new Date().toISOString().slice(0, 10);
    const [result] = await pool.query(
      `INSERT INTO transactions (account_id, category_id, amount, type, description, txn_date) VALUES (?, ?, ?, ?, ?, ?)`,
      [tpl.account_id, tpl.category_id, tpl.amount, tpl.type, tpl.description, txnDate]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log from template' });
  }
});

module.exports = router;
