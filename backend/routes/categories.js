const express = require('express');
const router = express.Router();
const pool = require('../db/db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories ORDER BY type, name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, type, icon, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });
    const [result] = await pool.query(
      'INSERT INTO categories (name, type, icon, color) VALUES (?, ?, ?, ?)',
      [name, type || 'expense', icon || '💸', color || '#8B8578']
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create category (name may already exist)' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM categories WHERE id = ? AND is_default = 0', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Full history, trend and average for one category — the "deep dive" page.
router.get('/:id/insights', async (req, res) => {
  try {
    const id = req.params.id;
    const [[category]] = await pool.query('SELECT * FROM categories WHERE id = ?', [id]);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const [transactions] = await pool.query(
      `SELECT t.*, a.name AS account_name FROM transactions t JOIN accounts a ON a.id = t.account_id
       WHERE t.category_id = ? ORDER BY t.txn_date DESC`,
      [id]
    );
    const [[agg]] = await pool.query(
      `SELECT COUNT(*) cnt, COALESCE(SUM(amount),0) total, COALESCE(AVG(amount),0) avg_amount FROM transactions WHERE category_id = ?`,
      [id]
    );
    const [monthly] = await pool.query(
      `SELECT DATE_FORMAT(txn_date,"%Y-%m") ym, COALESCE(SUM(amount),0) total FROM transactions
       WHERE category_id = ? GROUP BY ym ORDER BY ym DESC LIMIT 12`,
      [id]
    );

    res.json({
      category,
      transactions,
      total: Number(agg.total),
      count: agg.cnt,
      average: Number(Number(agg.avg_amount).toFixed(2)),
      monthly: monthly.reverse().map((m) => ({ month: m.ym, total: Number(m.total) }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch category insights' });
  }
});

module.exports = router;
