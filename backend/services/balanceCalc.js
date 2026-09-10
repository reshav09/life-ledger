const pool = require('../db/db');

/**
 * Computes current balances for all active accounts in a SINGLE query,
 * replacing the old N+1 pattern that fired 3 queries per account.
 *
 * Returns an array of account objects with `current_balance` and
 * `balance_in_base` already computed.
 */
async function getAccountsWithBalances() {
  const [rows] = await pool.query(`
    SELECT
      a.*,
      COALESCE(inc.total, 0) AS income_total,
      COALESCE(exp.total, 0) AS expense_total,
      COALESCE(sal.total, 0) AS salary_total
    FROM accounts a
    LEFT JOIN (
      SELECT account_id, SUM(amount) AS total
      FROM transactions WHERE type = 'income'
      GROUP BY account_id
    ) inc ON inc.account_id = a.id
    LEFT JOIN (
      SELECT account_id, SUM(amount) AS total
      FROM transactions WHERE type = 'expense'
      GROUP BY account_id
    ) exp ON exp.account_id = a.id
    LEFT JOIN (
      SELECT account_id, SUM(amount) AS total
      FROM salaries
      GROUP BY account_id
    ) sal ON sal.account_id = a.id
    WHERE a.is_active = 1
    ORDER BY a.is_pinned DESC, a.id ASC
  `);

  return rows.map((acc) => {
    const balance = Number(acc.opening_balance) + Number(acc.salary_total)
                  + Number(acc.income_total) - Number(acc.expense_total);
    const fxRate = Number(acc.fx_rate_to_base) || 1;
    return {
      ...acc,
      // Remove computed join columns from the response
      income_total: undefined,
      expense_total: undefined,
      salary_total: undefined,
      current_balance: Number(balance.toFixed(2)),
      balance_in_base: Number((balance * fxRate).toFixed(2))
    };
  });
}

/**
 * Total balance across all active accounts (in base currency).
 * Used by dashboard summary, wishlist affordability, and AI context.
 */
async function getTotalBalance() {
  const accounts = await getAccountsWithBalances();
  const total = accounts.reduce((sum, acc) => sum + acc.balance_in_base, 0);
  return { total: Number(total.toFixed(2)), accounts };
}

/**
 * Finance snapshot for wishlist affordability and AI context.
 * Replaces the duplicated implementation in wishlist.js.
 */
async function getFinanceSnapshot() {
  const { total: totalBalance, accounts } = await getTotalBalance();

  const [[settingRow]] = await pool.query(
    "SELECT `value` FROM settings WHERE `key` = 'reserve_cap'"
  );
  const reserveCap = Number(settingRow ? settingRow.value : 0);

  // Average monthly income from last 6 salary entries
  const [salaryRows] = await pool.query(
    'SELECT amount FROM salaries ORDER BY received_on DESC LIMIT 6'
  );
  const avgMonthlyIncome = salaryRows.length
    ? salaryRows.reduce((s, r) => s + Number(r.amount), 0) / salaryRows.length
    : 0;

  // Average monthly expense over last 3 calendar months that have data
  const [expenseRows] = await pool.query(
    `SELECT DATE_FORMAT(txn_date, "%Y-%m") AS ym, COALESCE(SUM(amount),0) AS total
     FROM transactions WHERE type = 'expense'
     GROUP BY ym ORDER BY ym DESC LIMIT 3`
  );
  const avgMonthlyExpense = expenseRows.length
    ? expenseRows.reduce((s, r) => s + Number(r.total), 0) / expenseRows.length
    : 0;

  const monthlySurplus = avgMonthlyIncome - avgMonthlyExpense;
  const availableCash = totalBalance - reserveCap;

  return { totalBalance, reserveCap, availableCash, avgMonthlyIncome, avgMonthlyExpense, monthlySurplus, accounts };
}

module.exports = { getAccountsWithBalances, getTotalBalance, getFinanceSnapshot };
