const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const { getTotalBalance } = require('../services/balanceCalc');

/**
 * Calculates pay cycle information based on salary credit day and weekend shift rules.
 */
function getSalaryCycleInfo(today = new Date(), salaryDay = 7, weekendRule = 'previous_business_day', cycleMode = 'salary') {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();

  function getAdjustedPayday(year, month, day) {
    const maxDays = new Date(year, month + 1, 0).getDate();
    const targetDay = Math.min(day, maxDays);
    const dateObj = new Date(year, month, targetDay);
    
    if (weekendRule === 'previous_business_day') {
      const dow = dateObj.getDay();
      if (dow === 0) { // Sunday -> Friday (-2 days)
        dateObj.setDate(dateObj.getDate() - 2);
      } else if (dow === 6) { // Saturday -> Friday (-1 day)
        dateObj.setDate(dateObj.getDate() - 1);
      }
    }
    return dateObj;
  }

  function toISO(dt) {
    const yr = dt.getFullYear();
    const mo = String(dt.getMonth() + 1).padStart(2, '0');
    const da = String(dt.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  }

  if (cycleMode === 'calendar') {
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysLeft = Math.max(daysInMonth - d + 1, 1);
    return {
      mode: 'calendar',
      cycle_start: `${y}-${String(m + 1).padStart(2, '0')}-01`,
      cycle_end: `${y}-${String(m + 1).padStart(2, '0')}-${daysInMonth}`,
      next_payday: null,
      days_left: daysLeft,
      cycle_label: 'this month'
    };
  }

  const currentMonthPayday = getAdjustedPayday(y, m, salaryDay);
  let cycleStart, nextPayday;
  const todayMidnight = new Date(y, m, d);

  if (todayMidnight.getTime() < currentMonthPayday.getTime()) {
    const prevMonthPayday = getAdjustedPayday(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, salaryDay);
    cycleStart = prevMonthPayday;
    nextPayday = currentMonthPayday;
  } else {
    const nextMonthPayday = getAdjustedPayday(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1, salaryDay);
    cycleStart = currentMonthPayday;
    nextPayday = nextMonthPayday;
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((nextPayday.getTime() - todayMidnight.getTime()) / msPerDay);
  const daysLeft = Math.max(diffDays, 1);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedNextPayday = `${nextPayday.getDate()} ${monthNames[nextPayday.getMonth()]}`;

  return {
    mode: 'salary',
    cycle_start: toISO(cycleStart),
    cycle_end: toISO(nextPayday),
    next_payday: toISO(nextPayday),
    days_left: daysLeft,
    cycle_label: `until payday (${formattedNextPayday})`
  };
}

router.get('/summary', async (req, res) => {
  try {
    const { total: totalBalance, accounts: perAccount } = await getTotalBalance();

    const [settingsRows] = await pool.query('SELECT `key`, `value` FROM settings');
    const settingsMap = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));

    const reserveCap = Number(settingsMap.reserve_cap || 0);
    const availableCash = totalBalance - reserveCap;

    const salaryDay = Number(settingsMap.salary_day || 7);
    const salaryWeekendShift = settingsMap.salary_weekend_shift || 'previous_business_day';
    const payCycleMode = settingsMap.pay_cycle_mode || 'salary'; // 'salary' | 'calendar'

    const today = new Date();
    const month = today.toISOString().slice(0, 7);
    
    // Calculate Pay Cycle info (e.g. Aug 7 -> Sep 7)
    const cycleInfo = getSalaryCycleInfo(today, salaryDay, salaryWeekendShift, payCycleMode);
    const daysLeft = cycleInfo.days_left;

    // Exclude internal account transfers from aggregate spending & income calculations
    const isTransferCond = "(description LIKE '%Salary%Current%' OR description LIKE '%-> Current%' OR description LIKE '%-> Salary%' OR type = 'transfer')";

    const [[spentThisMonthRow]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE type='expense' AND NOT ${isTransferCond} AND DATE_FORMAT(txn_date,"%Y-%m")=?`,
      [month]
    );
    const [[incomeThisMonthRow]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE type='income' AND NOT ${isTransferCond} AND DATE_FORMAT(txn_date,"%Y-%m")=?`,
      [month]
    );
    const [[salaryThisMonthRow]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM salaries WHERE DATE_FORMAT(received_on,"%Y-%m")=?`,
      [month]
    );
    const [[budgetTotalRow]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM budgets WHERE month=?`,
      [month]
    );

    // Pay cycle specific spending & income
    const [[spentThisCycleRow]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE type='expense' AND NOT ${isTransferCond} AND txn_date >= ? AND txn_date <= ?`,
      [cycleInfo.cycle_start, cycleInfo.cycle_end]
    );
    const [[incomeThisCycleRow]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE type='income' AND NOT ${isTransferCond} AND txn_date >= ? AND txn_date <= ?`,
      [cycleInfo.cycle_start, cycleInfo.cycle_end]
    );
    const [[salaryThisCycleRow]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM salaries WHERE received_on >= ? AND received_on <= ?`,
      [cycleInfo.cycle_start, cycleInfo.cycle_end]
    );

    const spentThisMonth = Number(spentThisMonthRow.total);
    const budgetTotal = Number(budgetTotalRow.total);
    const budgetRemaining = budgetTotal - spentThisMonth;
    const safeDailySpend = Math.max(Math.min(availableCash, budgetRemaining > 0 ? budgetRemaining : availableCash) / daysLeft, 0);

    const [[todayRow]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE type='expense' AND NOT ${isTransferCond} AND txn_date = CURDATE()`
    );

    res.json({
      total_balance: Number(totalBalance.toFixed(2)),
      reserve_cap: reserveCap,
      available_cash: Number(availableCash.toFixed(2)),
      accounts: perAccount.map((a) => ({
        id: a.id, name: a.name, bank_name: a.bank_name,
        currency: a.currency, balance: a.current_balance,
        balance_in_base: a.balance_in_base
      })),
      month,
      spent_this_month: spentThisMonth,
      income_this_month: Number(incomeThisMonthRow.total) + Number(salaryThisMonthRow.total),
      budget_total: budgetTotal,
      budget_remaining: Number(budgetRemaining.toFixed(2)),
      days_left_in_month: daysLeft,
      days_left_in_cycle: daysLeft,
      cycle_label: cycleInfo.cycle_label,
      cycle_start: cycleInfo.cycle_start,
      cycle_end: cycleInfo.cycle_end,
      next_payday: cycleInfo.next_payday,
      pay_cycle_mode: payCycleMode,
      spent_this_cycle: Number(spentThisCycleRow.total),
      income_this_cycle: Number(incomeThisCycleRow.total) + Number(salaryThisCycleRow.total),
      safe_daily_spend: Number(safeDailySpend.toFixed(2)),
      spent_today: Number(todayRow.total)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute dashboard summary' });
  }
});

// Category-wise spend breakdown for pie chart (defaults to current month)
router.get('/by-category', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [rows] = await pool.query(
      `SELECT c.id, c.name, c.icon, c.color, COALESCE(SUM(t.amount),0) AS total
       FROM categories c
       LEFT JOIN transactions t ON t.category_id = c.id AND t.type='expense' AND DATE_FORMAT(t.txn_date,"%Y-%m") = ?
       WHERE c.type='expense'
       GROUP BY c.id
       HAVING total > 0
       ORDER BY total DESC`,
      [month]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch category breakdown' });
  }
});

// Monthly trend (income vs expense) for last N months, bar/line chart
router.get('/trend', async (req, res) => {
  try {
    const months = Number(req.query.months) || 6;
    const [expenseRows] = await pool.query(
      `SELECT DATE_FORMAT(txn_date,"%Y-%m") AS ym, COALESCE(SUM(amount),0) AS total
       FROM transactions WHERE type='expense'
       GROUP BY ym ORDER BY ym DESC LIMIT ?`,
      [months]
    );
    const [incomeRows] = await pool.query(
      `SELECT ym, SUM(total) AS total FROM (
          SELECT DATE_FORMAT(txn_date,"%Y-%m") AS ym, amount AS total FROM transactions WHERE type='income'
          UNION ALL
          SELECT DATE_FORMAT(received_on,"%Y-%m") AS ym, amount AS total FROM salaries
       ) x GROUP BY ym ORDER BY ym DESC LIMIT ?`,
      [months]
    );
    const map = {};
    expenseRows.forEach((r) => { map[r.ym] = map[r.ym] || {}; map[r.ym].expense = Number(r.total); });
    incomeRows.forEach((r) => { map[r.ym] = map[r.ym] || {}; map[r.ym].income = Number(r.total); });
    const result = Object.entries(map)
      .map(([ym, v]) => ({ month: ym, income: v.income || 0, expense: v.expense || 0 }))
      .sort((a, b) => a.month.localeCompare(b.month));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch trend data' });
  }
});

// ---------- Net worth over time ----------
// Computes total net worth as of the last day of each of the last N months
// using aggregate queries instead of per-account per-month loops.
router.get('/net-worth', async (req, res) => {
  try {
    const months = Math.min(Number(req.query.months) || 12, 36);
    const [accounts] = await pool.query(
      'SELECT id, opening_balance, fx_rate_to_base FROM accounts WHERE is_active = 1'
    );
    if (accounts.length === 0) return res.json([]);

    const today = new Date();
    // Build the list of month-end dates we need
    const monthEnds = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
      monthEnds.push(d.toISOString().slice(0, 10));
    }
    const latestDate = monthEnds[monthEnds.length - 1];

    // Two aggregate queries for ALL accounts up to the latest date
    const [txnRows] = await pool.query(
      `SELECT account_id, type,
              DATE_FORMAT(LAST_DAY(txn_date), "%Y-%m-%d") AS month_end,
              SUM(amount) AS total
       FROM transactions
       WHERE txn_date <= ?
       GROUP BY account_id, type, month_end`,
      [latestDate]
    );
    const [salRows] = await pool.query(
      `SELECT account_id,
              DATE_FORMAT(LAST_DAY(received_on), "%Y-%m-%d") AS month_end,
              SUM(amount) AS total
       FROM salaries
       WHERE received_on <= ?
       GROUP BY account_id, month_end`,
      [latestDate]
    );

    // Build cumulative lookup: { accountId: { monthEnd: { income, expense, salary } } }
    const data = {};
    for (const r of txnRows) {
      if (!data[r.account_id]) data[r.account_id] = {};
      if (!data[r.account_id][r.month_end]) data[r.account_id][r.month_end] = { income: 0, expense: 0, salary: 0 };
      if (r.type === 'income') data[r.account_id][r.month_end].income = Number(r.total);
      else if (r.type === 'expense') data[r.account_id][r.month_end].expense = Number(r.total);
    }
    for (const r of salRows) {
      if (!data[r.account_id]) data[r.account_id] = {};
      if (!data[r.account_id][r.month_end]) data[r.account_id][r.month_end] = { income: 0, expense: 0, salary: 0 };
      data[r.account_id][r.month_end].salary = Number(r.total);
    }

    // For each target month-end, compute cumulative balance per account
    const results = monthEnds.map((asOf) => {
      let total = 0;
      for (const acc of accounts) {
        let income = 0, expense = 0, salary = 0;
        const accData = data[acc.id] || {};
        for (const [me, vals] of Object.entries(accData)) {
          if (me <= asOf) {
            income += vals.income;
            expense += vals.expense;
            salary += vals.salary;
          }
        }
        const balance = Number(acc.opening_balance) + salary + income - expense;
        total += balance * (Number(acc.fx_rate_to_base) || 1);
      }
      return { month: asOf.slice(0, 7), net_worth: Number(total.toFixed(2)) };
    });

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute net worth history' });
  }
});

// ---------- Month-over-month comparison ----------
router.get('/compare', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [y, m] = month.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    async function byCat(mo) {
      const [rows] = await pool.query(
        `SELECT c.id, c.name, c.icon, c.color, COALESCE(SUM(t.amount),0) total
         FROM categories c LEFT JOIN transactions t ON t.category_id = c.id AND t.type = 'expense' AND DATE_FORMAT(t.txn_date,"%Y-%m") = ?
         WHERE c.type = 'expense' GROUP BY c.id`,
        [mo]
      );
      return rows;
    }
    const current = await byCat(month);
    const previous = await byCat(prevMonth);
    const prevMap = Object.fromEntries(previous.map((r) => [r.id, Number(r.total)]));
    const deltas = current
      .map((c) => {
        const prevTotal = prevMap[c.id] || 0;
        const curTotal = Number(c.total);
        const pct = prevTotal > 0 ? ((curTotal - prevTotal) / prevTotal) * 100 : curTotal > 0 ? 100 : 0;
        return { id: c.id, name: c.name, icon: c.icon, color: c.color, total: curTotal, previous_total: prevTotal, pct_change: Number(pct.toFixed(1)) };
      })
      .filter((d) => d.total > 0 || d.previous_total > 0)
      .sort((a, b) => Math.abs(b.pct_change) - Math.abs(a.pct_change));

    const currentTotalSpend = current.reduce((s, c) => s + Number(c.total), 0);
    const prevTotalSpend = previous.reduce((s, c) => s + Number(c.total), 0);

    res.json({
      month,
      prev_month: prevMonth,
      current_total_spend: Number(currentTotalSpend.toFixed(2)),
      prev_total_spend: Number(prevTotalSpend.toFixed(2)),
      deltas
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compare months' });
  }
});

// ---------- Daily spend heatmap ----------
router.get('/heatmap', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(txn_date,"%Y-%m-%d") d, COALESCE(SUM(amount),0) total
       FROM transactions WHERE type = 'expense' AND DATE_FORMAT(txn_date,"%Y-%m") = ?
       GROUP BY d`,
      [month]
    );
    res.json(rows.map((r) => ({ date: r.d, total: Number(r.total) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build heatmap' });
  }
});

module.exports = router;
