const express = require('express');
const router = express.Router();
const pool = require('../db/db');

// All Gym-category transactions for a month, each annotated with whether
// it's been classified yet. transactions is read via plain SELECT — never
// UPDATE/DELETE — this route cannot alter Money Ledger data.
router.get('/', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [[category]] = await pool.query(`SELECT id FROM categories WHERE name = 'Gym' LIMIT 1`);
    if (!category) return res.json({ month, total: 0, classified: 0, unclassified: 0, transactions: [] });

    const [txns] = await pool.query(
      `SELECT t.id, t.amount, t.description, t.txn_date, a.name AS account_name
       FROM transactions t JOIN accounts a ON a.id = t.account_id
       WHERE t.category_id = ? AND t.type = 'expense' AND DATE_FORMAT(t.txn_date,"%Y-%m") = ?
       ORDER BY t.txn_date DESC`,
      [category.id, month]
    );
    const [classifications] = await pool.query(
      `SELECT * FROM gym_purchase_classifications WHERE transaction_id IN (${txns.map(() => '?').join(',') || 'NULL'})`,
      txns.map((t) => t.id)
    );
    const classMap = {};
    classifications.forEach((c) => {
      if (!classMap[c.transaction_id]) classMap[c.transaction_id] = [];
      classMap[c.transaction_id].push(c);
    });

    const total = txns.reduce((s, t) => s + Number(t.amount), 0);
    let classifiedTotal = 0;
    const enriched = txns.map((t) => {
      const classes = classMap[t.id] || [];
      const classifiedAmount = classes.reduce((s, c) => s + Number(c.amount_allocated), 0);
      classifiedTotal += classifiedAmount;
      return {
        ...t,
        classifications: classes,
        classified_amount: classifiedAmount,
        remaining_to_classify: Math.max(Number(t.amount) - classifiedAmount, 0)
      };
    });

    res.json({
      month,
      total,
      classified: classifiedTotal,
      unclassified: Math.max(total - classifiedTotal, 0),
      transactions: enriched
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch gym spending' });
  }
});

// Classify (part of) a transaction. Only ever writes to
// gym_purchase_classifications — the referenced transaction is untouched.
router.post('/classify', async (req, res) => {
  try {
    const { transaction_id, purchase_type, amount_allocated, notes } = req.body;
    if (!transaction_id || !purchase_type || !amount_allocated) {
      return res.status(400).json({ error: 'transaction_id, purchase_type and amount_allocated are required' });
    }
    const [[txn]] = await pool.query('SELECT id FROM transactions WHERE id = ?', [transaction_id]);
    if (!txn) return res.status(404).json({ error: 'Referenced transaction not found' });
    const [result] = await pool.query(
      'INSERT INTO gym_purchase_classifications (transaction_id, purchase_type, amount_allocated, notes) VALUES (?, ?, ?, ?)',
      [transaction_id, purchase_type, amount_allocated, notes || '']
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to classify purchase' });
  }
});

router.delete('/classify/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM gym_purchase_classifications WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove classification' });
  }
});

module.exports = router;
