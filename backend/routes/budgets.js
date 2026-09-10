const express = require('express');
const router = express.Router();
const pool = require('../db/db');

// Get budgets for a month, joined with actual spend so far and any envelope transfers
router.get('/', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [budgets] = await pool.query(
      `SELECT b.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
       FROM budgets b JOIN categories c ON c.id = b.category_id
       WHERE b.month = ?`,
      [month]
    );
    const [spent] = await pool.query(
      `SELECT category_id, COALESCE(SUM(amount),0) AS spent
       FROM transactions
       WHERE type = 'expense' AND DATE_FORMAT(txn_date, "%Y-%m") = ?
       GROUP BY category_id`,
      [month]
    );
    const [transfersIn] = await pool.query(
      `SELECT to_category_id AS category_id, COALESCE(SUM(amount),0) total FROM budget_transfers WHERE month = ? GROUP BY to_category_id`,
      [month]
    );
    const [transfersOut] = await pool.query(
      `SELECT from_category_id AS category_id, COALESCE(SUM(amount),0) total FROM budget_transfers WHERE month = ? GROUP BY from_category_id`,
      [month]
    );
    const spentMap = Object.fromEntries(spent.map((s) => [s.category_id, Number(s.spent)]));
    const inMap = Object.fromEntries(transfersIn.map((s) => [s.category_id, Number(s.total)]));
    const outMap = Object.fromEntries(transfersOut.map((s) => [s.category_id, Number(s.total)]));
    const result = budgets.map((b) => {
      const transferredIn = inMap[b.category_id] || 0;
      const transferredOut = outMap[b.category_id] || 0;
      const effectiveAmount = Number(b.amount) + transferredIn - transferredOut;
      const spentAmt = spentMap[b.category_id] || 0;
      return {
        ...b,
        spent: spentAmt,
        transferred_in: transferredIn,
        transferred_out: transferredOut,
        effective_amount: Number(effectiveAmount.toFixed(2)),
        remaining: Number((effectiveAmount - spentAmt).toFixed(2))
      };
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

// Upsert a budget for category+month
router.post('/', async (req, res) => {
  try {
    const { category_id, month, amount } = req.body;
    if (!category_id || !month || amount == null) {
      return res.status(400).json({ error: 'category_id, month and amount are required' });
    }
    await pool.query(
      'INSERT INTO budgets (category_id, month, amount) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE amount = VALUES(amount)',
      [category_id, month, amount]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save budget' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM budgets WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

// Envelope budgeting: move money from one category's cap to another for the
// same month. Doesn't touch actual account balances — it only reshuffles caps.
router.post('/transfer', async (req, res) => {
  try {
    const { month, from_category_id, to_category_id, amount, note } = req.body;
    if (!month || !from_category_id || !to_category_id || !amount) {
      return res.status(400).json({ error: 'month, from_category_id, to_category_id and amount are required' });
    }
    if (String(from_category_id) === String(to_category_id)) {
      return res.status(400).json({ error: 'Pick two different categories' });
    }
    await pool.query(
      'INSERT INTO budget_transfers (month, from_category_id, to_category_id, amount, note) VALUES (?, ?, ?, ?, ?)',
      [month, from_category_id, to_category_id, amount, note || '']
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to move budget' });
  }
});

router.get('/transfers', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [rows] = await pool.query(
      `SELECT bt.*, fc.name AS from_name, fc.icon AS from_icon, tc.name AS to_name, tc.icon AS to_icon
       FROM budget_transfers bt
       JOIN categories fc ON fc.id = bt.from_category_id
       JOIN categories tc ON tc.id = bt.to_category_id
       WHERE bt.month = ? ORDER BY bt.created_at DESC`,
      [month]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transfers' });
  }
});

module.exports = router;
