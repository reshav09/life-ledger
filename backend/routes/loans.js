const express = require('express');
const router = express.Router();
const pool = require('../db/db');

async function getLoanCategoryId() {
  const [[row]] = await pool.query(`SELECT id FROM categories WHERE name = 'EMI/Loan' LIMIT 1`);
  return row ? row.id : null;
}

router.get('/', async (req, res) => {
  try {
    const [loans] = await pool.query('SELECT * FROM loans WHERE is_active = 1 ORDER BY created_at');
    const [paidTotals] = await pool.query(
      'SELECT loan_id, COALESCE(SUM(amount),0) total, COUNT(*) cnt FROM loan_payments GROUP BY loan_id'
    );
    const map = Object.fromEntries(paidTotals.map((p) => [p.loan_id, { total: Number(p.total), count: p.cnt }]));
    res.json(
      loans.map((l) => {
        const paid = map[l.id]?.total || 0;
        const paymentsMade = map[l.id]?.count || 0;
        const remaining = Math.max(Number(l.principal) - paid, 0);
        const monthsLeft = l.emi_amount > 0 ? Math.ceil(remaining / Number(l.emi_amount)) : null;
        return {
          ...l,
          paid_so_far: paid,
          remaining_balance: Number(remaining.toFixed(2)),
          payments_made: paymentsMade,
          estimated_months_left: remaining <= 0 ? 0 : monthsLeft
        };
      })
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch loans' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, principal, interest_rate, emi_amount, tenure_months, start_date, notes } = req.body;
    if (!name || !principal || !start_date) {
      return res.status(400).json({ error: 'name, principal and start_date are required' });
    }
    const [result] = await pool.query(
      `INSERT INTO loans (name, principal, interest_rate, emi_amount, tenure_months, start_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, principal, interest_rate || null, emi_amount || null, tenure_months || null, start_date, notes || '']
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create loan' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE loans SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete loan' });
  }
});

router.get('/:id/payments', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM loan_payments WHERE loan_id = ? ORDER BY paid_on DESC', [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Logs a payment as a real expense transaction (category "EMI/Loan") so it
// reduces your spendable balance the same way any other expense would.
// Wrapped in a DB transaction so a failure partway through rolls back cleanly.
router.post('/:id/pay', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { account_id, amount, paid_on } = req.body;
    if (!account_id || !amount || !paid_on) {
      conn.release();
      return res.status(400).json({ error: 'account_id, amount and paid_on are required' });
    }
    const categoryId = await getLoanCategoryId();
    const [[loan]] = await pool.query('SELECT name FROM loans WHERE id = ?', [req.params.id]);

    await conn.beginTransaction();
    const [txnResult] = await conn.query(
      `INSERT INTO transactions (account_id, category_id, amount, type, description, txn_date) VALUES (?, ?, ?, 'expense', ?, ?)`,
      [account_id, categoryId, amount, `EMI: ${loan?.name || ''}`, paid_on]
    );
    await conn.query(
      'INSERT INTO loan_payments (loan_id, transaction_id, amount, paid_on) VALUES (?, ?, ?, ?)',
      [req.params.id, txnResult.insertId, amount, paid_on]
    );
    await conn.commit();

    res.status(201).json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to log payment' });
  } finally {
    conn.release();
  }
});

module.exports = router;
