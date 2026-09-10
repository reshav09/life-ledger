const express = require('express');
const router = express.Router();
const pool = require('../db/db');

async function getSavingsCategoryId() {
  const [[row]] = await pool.query(`SELECT id FROM categories WHERE name = 'Savings' LIMIT 1`);
  return row ? row.id : null;
}

router.get('/', async (req, res) => {
  try {
    const [goals] = await pool.query('SELECT * FROM savings_goals WHERE is_active = 1 ORDER BY created_at');
    const [contribTotals] = await pool.query(
      'SELECT goal_id, COALESCE(SUM(amount),0) total FROM savings_contributions GROUP BY goal_id'
    );
    const totalsMap = Object.fromEntries(contribTotals.map((c) => [c.goal_id, Number(c.total)]));
    res.json(
      goals.map((g) => {
        const saved = totalsMap[g.id] || 0;
        return {
          ...g,
          saved_so_far: saved,
          progress_pct: g.target_amount > 0 ? Math.min(100, (saved / Number(g.target_amount)) * 100) : 0
        };
      })
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch savings goals' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, target_amount, target_date } = req.body;
    if (!name || !target_amount) return res.status(400).json({ error: 'name and target_amount are required' });
    const [result] = await pool.query(
      'INSERT INTO savings_goals (name, target_amount, target_date) VALUES (?, ?, ?)',
      [name, target_amount, target_date || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE savings_goals SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

router.get('/:id/contributions', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM savings_contributions WHERE goal_id = ? ORDER BY contributed_on DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch contributions' });
  }
});

// Logs a contribution as a real expense transaction (category "Savings") so it
// correctly reduces your spendable balance, exactly like moving cash into a jar.
// Wrapped in a DB transaction so a failure partway through rolls back cleanly.
router.post('/:id/contribute', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { account_id, amount, contributed_on, note } = req.body;
    if (!account_id || !amount || !contributed_on) {
      conn.release();
      return res.status(400).json({ error: 'account_id, amount and contributed_on are required' });
    }
    const categoryId = await getSavingsCategoryId();

    await conn.beginTransaction();
    const [txnResult] = await conn.query(
      `INSERT INTO transactions (account_id, category_id, amount, type, description, txn_date) VALUES (?, ?, ?, 'expense', ?, ?)`,
      [account_id, categoryId, amount, note || 'Savings contribution', contributed_on]
    );
    await conn.query(
      'INSERT INTO savings_contributions (goal_id, transaction_id, amount, contributed_on) VALUES (?, ?, ?, ?)',
      [req.params.id, txnResult.insertId, amount, contributed_on]
    );
    await conn.commit();

    res.status(201).json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to log contribution' });
  } finally {
    conn.release();
  }
});

const { getTotalBalance } = require('../services/balanceCalc');

// ---------- Comprehensive Savings & Pay-Cycle Analytics ----------
router.get('/analytics', async (req, res) => {
  try {
    const { total: totalBalance, accounts: perAccount } = await getTotalBalance();
    const [settingsRows] = await pool.query('SELECT `key`, `value` FROM settings');
    const settingsMap = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
    const reserveCap = Number(settingsMap.reserve_cap || 0);
    const availableCash = totalBalance - reserveCap;
    const salaryDay = Number(settingsMap.salary_day || 7);
    const salaryWeekendShift = settingsMap.salary_weekend_shift || 'previous_business_day';

    // Account asset distribution
    const assetColors = ['#2F6F4E', '#5B7FBA', '#D97706', '#9333EA', '#0D9488'];
    const assetDistribution = perAccount
      .filter((a) => a.current_balance > 0)
      .map((a, idx) => ({
        id: a.id,
        name: a.name,
        bank_name: a.bank_name,
        balance: a.current_balance,
        share_pct: totalBalance > 0 ? Number(((a.current_balance / totalBalance) * 100).toFixed(1)) : 0,
        color: assetColors[idx % assetColors.length]
      }))
      .sort((a, b) => b.balance - a.balance);

    // Build cycle windows dynamically for last 6 cycles including active cycle
    const today = new Date();
    const cycleHistory = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const isPastThisMonthPayday = today.getDate() >= salaryDay;
    const startOffset = isPastThisMonthPayday ? -1 : 0;

    const isTransferCond = "(description LIKE '%Salary%Current%' OR description LIKE '%-> Current%' OR description LIKE '%-> Salary%' OR type = 'transfer')";

    for (let offset = startOffset + 5; offset >= startOffset; offset--) {
      const dTarget = new Date(today.getFullYear(), today.getMonth() - offset, salaryDay);
      const prevTarget = new Date(today.getFullYear(), today.getMonth() - offset - 1, salaryDay);
      
      const startISO = `${prevTarget.getFullYear()}-${String(prevTarget.getMonth() + 1).padStart(2, '0')}-${String(prevTarget.getDate()).padStart(2, '0')}`;
      const endISO = `${dTarget.getFullYear()}-${String(dTarget.getMonth() + 1).padStart(2, '0')}-${String(dTarget.getDate()).padStart(2, '0')}`;
      const isCurrent = offset === startOffset;
      const label = `${monthNames[prevTarget.getMonth()]} Cycle (${prevTarget.getDate()} ${monthNames[prevTarget.getMonth()]} - ${dTarget.getDate()} ${monthNames[dTarget.getMonth()]})${isCurrent ? ' (Current)' : ''}`;

      const [[exp]] = await pool.query(`SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type="expense" AND NOT ${isTransferCond} AND txn_date >= ? AND txn_date < ?`, [startISO, endISO]);
      const [[inc]] = await pool.query(`SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type="income" AND NOT ${isTransferCond} AND txn_date >= ? AND txn_date < ?`, [startISO, endISO]);
      const [[sal]] = await pool.query('SELECT COALESCE(SUM(amount),0) as total FROM salaries WHERE received_on >= ? AND received_on < ?', [startISO, endISO]);

      const totalInflow = Number(sal.total) + Number(inc.total);
      const totalExpense = Number(exp.total);
      
      // Only include cycles that have active transactions
      if (totalInflow > 0 || totalExpense > 0) {
        const surplus = totalInflow - totalExpense;
        const rate = totalInflow > 0 ? Number(((surplus / totalInflow) * 100).toFixed(1)) : 0;
        cycleHistory.push({
          label,
          start: startISO,
          end: endISO,
          inflows: totalInflow,
          expenses: totalExpense,
          surplus: Number(surplus.toFixed(2)),
          savings_rate: rate
        });
      }
    }

    // Monthly calendar history (excluding internal transfers)
    const [monthlyRows] = await pool.query(`
      SELECT ym, SUM(inflow) as inflows, SUM(expense) as expenses FROM (
        SELECT DATE_FORMAT(txn_date, '%Y-%m') as ym, 0 as inflow, amount as expense FROM transactions WHERE type = 'expense' AND NOT ${isTransferCond}
        UNION ALL
        SELECT DATE_FORMAT(txn_date, '%Y-%m') as ym, amount as inflow, 0 as expense FROM transactions WHERE type = 'income' AND NOT ${isTransferCond}
        UNION ALL
        SELECT DATE_FORMAT(received_on, '%Y-%m') as ym, amount as inflow, 0 as expense FROM salaries
      ) combined
      GROUP BY ym
      ORDER BY ym ASC
    `);

    const monthlyHistory = monthlyRows.map((r) => {
      const inflows = Number(r.inflows || 0);
      const expenses = Number(r.expenses || 0);
      const surplus = inflows - expenses;
      const rate = inflows > 0 ? Number(((surplus / inflows) * 100).toFixed(1)) : 0;
      return {
        month: r.ym,
        inflows,
        expenses,
        surplus: Number(surplus.toFixed(2)),
        savings_rate: rate
      };
    });

    const latestCycle = cycleHistory[cycleHistory.length - 1] || null;
    const avgMonthlySavings = monthlyHistory.length > 0
      ? Number((monthlyHistory.reduce((acc, m) => acc + m.surplus, 0) / monthlyHistory.length).toFixed(2))
      : 0;

    res.json({
      total_wealth: totalBalance,
      reserve_cap: reserveCap,
      available_cash: availableCash,
      asset_distribution: assetDistribution,
      cycle_history: cycleHistory,
      monthly_history: monthlyHistory,
      latest_cycle: latestCycle,
      avg_monthly_savings: avgMonthlySavings
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch savings analytics' });
  }
});

// ---------- Surplus Allocation Action ----------
router.post('/allocate-surplus', async (req, res) => {
  try {
    const { action, amount, goal_id, account_id } = req.body;
    const allocAmount = Number(amount);
    if (!action || isNaN(allocAmount) || allocAmount <= 0) {
      return res.status(400).json({ error: 'Valid action and amount are required' });
    }

    if (action === 'reserve') {
      const [[row]] = await pool.query("SELECT `value` FROM settings WHERE `key` = 'reserve_cap'");
      const currentReserve = Number(row ? row.value : 0);
      const newReserve = currentReserve + allocAmount;
      await pool.query("INSERT INTO settings (`key`, `value`) VALUES ('reserve_cap', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)", [String(newReserve)]);
      return res.json({ success: true, action: 'reserve', new_reserve_cap: newReserve });
    }

    if (action === 'goal' && goal_id && account_id) {
      const categoryId = await getSavingsCategoryId();
      const todayStr = new Date().toISOString().slice(0, 10);
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [txnResult] = await conn.query(
          "INSERT INTO transactions (account_id, category_id, amount, type, description, txn_date) VALUES (?, ?, ?, 'expense', ?, ?)",
          [account_id, categoryId, allocAmount, 'Payday surplus savings allocation', todayStr]
        );
        await conn.query(
          "INSERT INTO savings_contributions (goal_id, transaction_id, amount, contributed_on) VALUES (?, ?, ?, ?)",
          [goal_id, txnResult.insertId, allocAmount, todayStr]
        );
        await conn.commit();
        return res.json({ success: true, action: 'goal' });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }

    res.json({ success: true, action: 'dismissed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to allocate surplus' });
  }
});

module.exports = router;

