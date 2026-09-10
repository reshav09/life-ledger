const pool = require('../db/db');
const { calculateNutritionTargets } = require('./nutritionCalc');
const { getFinanceSnapshot } = require('../services/balanceCalc');

function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// mysql2 returns DATE columns as JS Date objects by default; normalize to
// plain YYYY-MM-DD everywhere a date flows into the AI context or rule text,
// so neither ever renders a full "Sat Jul 18 2026 00:00:00 GMT..." string.
function toDateStr(d) {
  if (d == null) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

async function getHealthProfile() {
  const [[profile]] = await pool.query('SELECT * FROM health_profile WHERE id = 1');
  return profile;
}

async function getCurrentGoal() {
  const [[goal]] = await pool.query('SELECT * FROM diet_goals ORDER BY created_at DESC LIMIT 1');
  return goal || null;
}

async function getWeightTrend(limit = 10) {
  const [rows] = await pool.query(
    `SELECT value, unit, measurement_date, source FROM health_measurements
     WHERE measurement_type = 'weight' ORDER BY measurement_date DESC, id DESC LIMIT ?`,
    [limit]
  );
  return rows.reverse().map((r) => ({ ...r, measurement_date: toDateStr(r.measurement_date) }));
}

async function getLatestWeight() {
  const [[row]] = await pool.query(
    `SELECT value, measurement_date FROM health_measurements
     WHERE measurement_type = 'weight' ORDER BY measurement_date DESC, id DESC LIMIT 1`
  );
  return row ? Number(row.value) : null;
}

async function getOutOfRangeMeasurements(limit = 15) {
  // We don't parse every reference_range format server-side; instead we
  // surface the most recent per-marker reading with its stated range and
  // let the AI/UI read them together — no silent "in range" inference.
  const [rows] = await pool.query(
    `SELECT m1.measurement_type, m1.value, m1.unit, m1.reference_range, m1.measurement_date, m1.source
     FROM health_measurements m1
     INNER JOIN (
       SELECT measurement_type, MAX(measurement_date) AS max_date
       FROM health_measurements WHERE measurement_type != 'weight'
       GROUP BY measurement_type
     ) latest ON latest.measurement_type = m1.measurement_type AND latest.max_date = m1.measurement_date
     ORDER BY m1.measurement_date DESC LIMIT ?`,
    [limit]
  );
  return rows.map((r) => ({ ...r, measurement_date: toDateStr(r.measurement_date) }));
}

async function getNutritionTargets() {
  const profile = await getHealthProfile();
  const goal = await getCurrentGoal();
  const weight = await getLatestWeight();
  const age = profile.birth_year ? new Date().getFullYear() - profile.birth_year : null;
  return calculateNutritionTargets({
    weightKg: weight,
    heightCm: profile.height_cm ? Number(profile.height_cm) : null,
    age,
    sex: profile.sex,
    activityLevel: profile.activity_level,
    goalType: goal?.goal_type,
    overrides: profile
  });
}

async function getTodayFoodTotals(date = todayISO()) {
  const [rows] = await pool.query('SELECT * FROM food_entries WHERE entry_date = ? ORDER BY created_at', [date]);
  const totals = rows.reduce(
    (acc, r) => ({
      calories: acc.calories + Number(r.calories || 0),
      protein_g: acc.protein_g + Number(r.protein_g || 0),
      carbs_g: acc.carbs_g + Number(r.carbs_g || 0),
      fat_g: acc.fat_g + Number(r.fat_g || 0),
      fiber_g: acc.fiber_g + Number(r.fiber_g || 0)
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
  );
  const [waterRows] = await pool.query(
    'SELECT id, amount_ml, created_at FROM water_intake_logs WHERE entry_date = ? ORDER BY created_at DESC, id DESC',
    [date]
  );
  const totalWater = waterRows.reduce((s, w) => s + Number(w.amount_ml || 0), 0);
  return { entries: rows, totals, water_ml: totalWater, water_logs: waterRows };
}

async function getWeeklyNutritionAverage(days = 7) {
  const [rows] = await pool.query(
    `SELECT entry_date, SUM(protein_g) protein, SUM(calories) calories
     FROM food_entries WHERE entry_date >= ? GROUP BY entry_date`,
    [daysAgoISO(days)]
  );
  if (rows.length === 0) return null;
  const avgProtein = rows.reduce((s, r) => s + Number(r.protein || 0), 0) / rows.length;
  const avgCalories = rows.reduce((s, r) => s + Number(r.calories || 0), 0) / rows.length;
  return { days_logged: rows.length, avg_protein_g: Math.round(avgProtein), avg_calories: Math.round(avgCalories) };
}

async function getTodaysSchedule() {
  const dayOfWeek = new Date().getDay(); // 0=Sunday, matches routine_templates.day_of_week
  const [rows] = await pool.query(
    `SELECT rt.start_time, rt.end_time, rt.notes, ra.name AS activity_name, ra.icon
     FROM routine_templates rt JOIN routine_activities ra ON ra.id = rt.activity_id
     WHERE rt.day_of_week = ? ORDER BY rt.sort_order, rt.start_time`,
    [dayOfWeek]
  );
  return rows;
}

async function getGymMoneySummary() {
  const month = todayISO().slice(0, 7);
  const [[category]] = await pool.query(`SELECT id FROM categories WHERE name = 'Gym' LIMIT 1`);
  if (!category) return { total_this_month: 0, classified: 0, unclassified: 0 };
  const [[spend]] = await pool.query(
    `SELECT COALESCE(SUM(amount),0) total FROM transactions
     WHERE category_id = ? AND type = 'expense' AND DATE_FORMAT(txn_date,"%Y-%m") = ?`,
    [category.id, month]
  );
  const [[classified]] = await pool.query(
    `SELECT COALESCE(SUM(gpc.amount_allocated),0) total
     FROM gym_purchase_classifications gpc
     JOIN transactions t ON t.id = gpc.transaction_id
     WHERE t.category_id = ? AND DATE_FORMAT(t.txn_date,"%Y-%m") = ?`,
    [category.id, month]
  );
  const total = Number(spend.total);
  const classifiedTotal = Number(classified.total);
  return { total_this_month: total, classified: classifiedTotal, unclassified: Math.max(total - classifiedTotal, 0) };
}

/**
 * Last 2 calendar months of spending broken down by category.
 * Enables AI to say "you spent ₹X on fast food last month — consider
 * shifting that toward healthier options like eggs or cashews."
 */
async function getMonthlySpendingBreakdown() {
  const [rows] = await pool.query(`
    SELECT DATE_FORMAT(t.txn_date, "%Y-%m") AS month,
           c.name AS category,
           COALESCE(SUM(t.amount), 0) AS total
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE t.type = 'expense'
      AND t.txn_date >= DATE_SUB(CURDATE(), INTERVAL 2 MONTH)
    GROUP BY month, c.name
    ORDER BY month DESC, total DESC
  `);
  // Group into { "2026-07": [{category, total}, ...], "2026-08": [...] }
  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.month]) grouped[r.month] = [];
    grouped[r.month].push({ category: r.category, total: Number(r.total) });
  }
  return grouped;
}

/**
 * Average sleep hours from routine_logs over the last 14 days.
 * Uses activity_id from routine_activities where name = 'Sleep'.
 */
async function getSleepAverage() {
  const [[sleepActivity]] = await pool.query(
    `SELECT id FROM routine_activities WHERE LOWER(name) = 'sleep' LIMIT 1`
  );
  if (!sleepActivity) return null;

  const [rows] = await pool.query(
    `SELECT log_date, hours FROM routine_logs
     WHERE activity_id = ? AND log_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
     ORDER BY log_date DESC`,
    [sleepActivity.id]
  );
  if (rows.length === 0) return null;

  const avgHours = rows.reduce((s, r) => s + Number(r.hours), 0) / rows.length;
  return {
    avg_hours: Math.round(avgHours * 10) / 10,
    days_logged: rows.length,
    entries: rows.map((r) => ({ date: toDateStr(r.log_date), hours: Number(r.hours) }))
  };
}

/**
 * Monthly average macros over the last 3 calendar months.
 * Gives the AI a trend line for nutrition adherence.
 */
async function getMultiMonthNutrition() {
  const [rows] = await pool.query(`
    SELECT DATE_FORMAT(entry_date, "%Y-%m") AS month,
           COUNT(DISTINCT entry_date) AS days_logged,
           ROUND(AVG(daily_cals)) AS avg_calories,
           ROUND(AVG(daily_protein)) AS avg_protein_g,
           ROUND(AVG(daily_carbs)) AS avg_carbs_g,
           ROUND(AVG(daily_fat)) AS avg_fat_g
    FROM (
      SELECT entry_date,
             SUM(calories) AS daily_cals,
             SUM(protein_g) AS daily_protein,
             SUM(carbs_g) AS daily_carbs,
             SUM(fat_g) AS daily_fat
      FROM food_entries
      WHERE entry_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
      GROUP BY entry_date
    ) daily
    GROUP BY month
    ORDER BY month DESC
  `);
  return rows.length > 0 ? rows : null;
}

/**
 * The single entry point every AI-facing route should use. Returns a
 * compact, labeled context object — never a raw DB dump — so the AI only
 * ever sees what's relevant, and every number is traceable to a source.
 */
async function buildUserContext() {
  const [
    profile, goal, weightTrend, outOfRange, nutritionTargets,
    todayFood, weeklyAvg, schedule, gymMoney, financeSnapshot,
    spendingBreakdown, sleepAvg, monthlyNutrition
  ] = await Promise.all([
    getHealthProfile(),
    getCurrentGoal(),
    getWeightTrend(),
    getOutOfRangeMeasurements(),
    getNutritionTargets(),
    getTodayFoodTotals(),
    getWeeklyNutritionAverage(),
    getTodaysSchedule(),
    getGymMoneySummary(),
    getFinanceSnapshot().catch(() => null),
    getMonthlySpendingBreakdown().catch(() => null),
    getSleepAverage().catch(() => null),
    getMultiMonthNutrition().catch(() => null)
  ]);

  return {
    profile: {
      height_cm: profile.height_cm,
      birth_year: profile.birth_year,
      sex: profile.sex,
      activity_level: profile.activity_level,
      gym_status: profile.gym_status,
      training_days: profile.training_days,
      training_goal: profile.training_goal
    },
    current_goal: goal ? { goal_type: goal.goal_type, set_on: goal.created_at, notes: goal.notes } : null,
    weight_trend: weightTrend.map((w) => ({ value: w.value, date: w.measurement_date, source: w.source })),
    latest_health_measurements: outOfRange,
    nutrition_targets: nutritionTargets,
    today: {
      date: todayISO(),
      food_entries: todayFood.entries.map((e) => ({
        meal_type: e.meal_type,
        description: e.description,
        calories: e.calories,
        protein_g: e.protein_g,
        data_source: e.data_source
      })),
      totals: todayFood.totals,
      water_ml: todayFood.water_ml,
      schedule: schedule
    },
    weekly_nutrition_average: weeklyAvg,
    monthly_nutrition_trends: monthlyNutrition,
    sleep_average_14d: sleepAvg,
    gym_money_this_month: gymMoney,
    spending_by_category_last_2_months: spendingBreakdown,
    finance_snapshot: financeSnapshot
      ? {
          available_cash: financeSnapshot.availableCash,
          reserve_cap: financeSnapshot.reserveCap,
          avg_monthly_income: financeSnapshot.avgMonthlyIncome,
          avg_monthly_expense: financeSnapshot.avgMonthlyExpense,
          monthly_surplus: financeSnapshot.monthlySurplus
        }
      : null
  };
}

module.exports = {
  buildUserContext,
  getHealthProfile,
  getCurrentGoal,
  getWeightTrend,
  getLatestWeight,
  getNutritionTargets,
  getTodayFoodTotals,
  getWeeklyNutritionAverage,
  getGymMoneySummary,
  getMonthlySpendingBreakdown,
  getSleepAverage,
  getMultiMonthNutrition,
  todayISO
};

