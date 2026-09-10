const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const { getFinanceSnapshot } = require('../services/balanceCalc');

router.get('/', async (req, res) => {
  try {
    const [items] = await pool.query(
      `SELECT w.*, c.name AS category_name, c.icon AS category_icon
       FROM wishlist w LEFT JOIN categories c ON c.id = w.category_id
       ORDER BY FIELD(priority,'high','medium','low'), w.created_at DESC`
    );
    const snapshot = await getFinanceSnapshot();

    // total cash already "claimed" by other planned cash-mode items, used to give
    // a realistic verdict when several wishes compete for the same pool of money
    const plannedCashTotal = items
      .filter((i) => i.status === 'planned' && i.payment_mode === 'cash')
      .reduce((s, i) => s + Number(i.cost), 0);

    const withVerdict = items.map((item) => {
      const cost = Number(item.cost);
      let verdict = {};
      if (item.payment_mode === 'cash') {
        const affordableAlone = cost <= snapshot.availableCash;
        const affordableAfterOtherPlans = cost <= snapshot.availableCash - (plannedCashTotal - (item.status === 'planned' ? cost : 0));
        verdict = {
          mode: 'cash',
          affordable_alone: affordableAlone,
          affordable_with_other_plans: affordableAfterOtherPlans,
          shortfall_alone: affordableAlone ? 0 : Number((cost - snapshot.availableCash).toFixed(2))
        };
      } else {
        const months = Number(item.emi_months) || 1;
        const monthlyEmi = cost / months;
        const affordable = monthlyEmi <= snapshot.monthlySurplus;
        verdict = {
          mode: 'emi',
          monthly_emi: Number(monthlyEmi.toFixed(2)),
          monthly_surplus: Number(snapshot.monthlySurplus.toFixed(2)),
          affordable
        };
      }
      return { ...item, verdict };
    });

    res.json({ items: withVerdict, snapshot: { ...snapshot, planned_cash_total: plannedCashTotal } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, cost, category_id, payment_mode, emi_months, priority, notes } = req.body;
    if (!name || !cost) return res.status(400).json({ error: 'name and cost are required' });
    const [result] = await pool.query(
      `INSERT INTO wishlist (name, cost, category_id, payment_mode, emi_months, priority, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, cost, category_id || null, payment_mode || 'cash', emi_months || null, priority || 'medium', notes || '']
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create wishlist item' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, cost, category_id, payment_mode, emi_months, priority, notes, status } = req.body;
    await pool.query(
      `UPDATE wishlist SET name=?, cost=?, category_id=?, payment_mode=?, emi_months=?, priority=?, notes=?, status=?
       WHERE id=?`,
      [name, cost, category_id || null, payment_mode, emi_months || null, priority, notes || '', status || 'planned', req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update wishlist item' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM wishlist WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete wishlist item' });
  }
});

module.exports = router;

