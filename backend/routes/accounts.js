const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const { getAccountsWithBalances } = require('../services/balanceCalc');

// Get all accounts with their computed current balance
router.get('/', async (req, res) => {
  try {
    const accounts = await getAccountsWithBalances();
    res.json(accounts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, bank_name, account_type, opening_balance, currency, fx_rate_to_base } = req.body;
    if (!name) return res.status(400).json({ error: 'Account name is required' });
    const [result] = await pool.query(
      'INSERT INTO accounts (name, bank_name, account_type, opening_balance, currency, fx_rate_to_base) VALUES (?, ?, ?, ?, ?, ?)',
      [name, bank_name || null, account_type || 'bank', opening_balance || 0, currency || 'INR', fx_rate_to_base || 1]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, bank_name, account_type, opening_balance, currency, fx_rate_to_base } = req.body;
    await pool.query(
      'UPDATE accounts SET name = ?, bank_name = ?, account_type = ?, opening_balance = ?, currency = ?, fx_rate_to_base = ? WHERE id = ?',
      [name, bank_name || null, account_type || 'bank', opening_balance || 0, currency || 'INR', fx_rate_to_base || 1, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

router.post('/:id/pin', async (req, res) => {
  try {
    const [[row]] = await pool.query('SELECT is_pinned FROM accounts WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Account not found' });
    await pool.query('UPDATE accounts SET is_pinned = ? WHERE id = ?', [row.is_pinned ? 0 : 1, req.params.id]);
    res.json({ success: true, is_pinned: row.is_pinned ? 0 : 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle pin' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE accounts SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
