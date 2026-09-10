const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const { validate } = require('../middleware/validate');

const txnSchema = {
  account_id: { type: 'number', required: true, integer: true, min: 1 },
  category_id: { type: 'number', required: true, integer: true, min: 1 },
  amount: { type: 'number', required: true, min: 0.01, max: 999999999 },
  type: { type: 'string', enum: ['income', 'expense', 'transfer'], default: 'expense' },
  description: { type: 'string', maxLen: 255, default: '' },
  txn_date: { type: 'date', required: true }
};

// List transactions with optional filters: from, to, category_id, account_id, type
router.get('/', async (req, res, next) => {
  try {
    const { from, to, category_id, account_id, type, month, limit, search } = req.query;
    let sql = `SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
                      a.name AS account_name
               FROM transactions t
               JOIN categories c ON c.id = t.category_id
               JOIN accounts a ON a.id = t.account_id
               WHERE 1=1`;
    const params = [];
    if (from) { sql += ' AND t.txn_date >= ?'; params.push(from); }
    if (to) { sql += ' AND t.txn_date <= ?'; params.push(to); }
    if (month) { sql += ' AND DATE_FORMAT(t.txn_date, "%Y-%m") = ?'; params.push(month); }
    if (category_id) { sql += ' AND t.category_id = ?'; params.push(category_id); }
    if (account_id) { sql += ' AND t.account_id = ?'; params.push(account_id); }
    if (type) { sql += ' AND t.type = ?'; params.push(type); }
    if (search && search.trim()) {
      const sanitizedSearch = search.trim().replace(/[%_\\]/g, '\\$&');
      sql += ' AND t.description LIKE ?';
      params.push(`%${sanitizedSearch}%`);
    }
    sql += ' ORDER BY t.txn_date DESC, t.id DESC';
    if (limit) { sql += ' LIMIT ?'; params.push(Math.min(Math.max(Number(limit) || 50, 1), 1000)); }
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(txnSchema), async (req, res, next) => {
  try {
    const { account_id, category_id, amount, type, description, txn_date } = req.body;
    const [result] = await pool.query(
      'INSERT INTO transactions (account_id, category_id, amount, type, description, txn_date) VALUES (?, ?, ?, ?, ?, ?)',
      [account_id, category_id, amount, type, description, txn_date]
    );
    res.status(201).json({ id: result.insertId, success: true });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', validate(txnSchema), async (req, res, next) => {
  try {
    const { account_id, category_id, amount, type, description, txn_date } = req.body;
    await pool.query(
      'UPDATE transactions SET account_id=?, category_id=?, amount=?, type=?, description=?, txn_date=? WHERE id=?',
      [account_id, category_id, amount, type, description, txn_date, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM transactions WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Bulk actions for cleaning up several entries at once (e.g. recategorizing a
// batch that got mis-tagged, or clearing out a bunch of test entries).
router.post('/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    const [result] = await pool.query(`DELETE FROM transactions WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    res.json({ success: true, deleted: result.affectedRows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bulk delete failed' });
  }
});

router.post('/bulk-recategorize', async (req, res) => {
  try {
    const { ids, category_id } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !category_id) {
      return res.status(400).json({ error: 'ids array and category_id are required' });
    }
    const [result] = await pool.query(`UPDATE transactions SET category_id = ? WHERE id IN (${ids.map(() => '?').join(',')})`, [category_id, ...ids]);
    res.json({ success: true, updated: result.affectedRows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bulk recategorize failed' });
  }
});

module.exports = router;
