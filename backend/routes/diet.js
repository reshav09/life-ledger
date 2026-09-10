const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const {
  getTodayFoodTotals,
  getNutritionTargets,
  getWeeklyNutritionAverage,
  getLatestWeight,
  getCurrentGoal,
  todayISO
} = require('../services/dietContext');

function toNumOrNull(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

const VALID_MEALS = ['breakfast', 'lunch', 'dinner', 'snack', 'drink', 'supplement', 'other'];

// ---------- Food entries ----------
router.get('/food', async (req, res) => {
  try {
    const { date, from, to } = req.query;
    let sql = 'SELECT * FROM food_entries WHERE 1=1';
    const params = [];
    if (date) { sql += ' AND entry_date = ?'; params.push(date); }
    if (from) { sql += ' AND entry_date >= ?'; params.push(from); }
    if (to) { sql += ' AND entry_date <= ?'; params.push(to); }
    sql += ' ORDER BY entry_date DESC, created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch food entries' });
  }
});

router.post('/food', async (req, res) => {
  try {
    const { meal_type, description, calories, protein_g, carbs_g, fat_g, fiber_g, serving_note, data_source, entry_date } = req.body;
    if (!description || !String(description).trim()) {
      return res.status(400).json({ error: 'description is required' });
    }
    const cleanMeal = VALID_MEALS.includes(meal_type) ? meal_type : 'other';
    const cleanSource = data_source === 'ai_estimated' ? 'ai_estimated' : 'user_confirmed';
    const [result] = await pool.query(
      `INSERT INTO food_entries (meal_type, description, calories, protein_g, carbs_g, fat_g, fiber_g, serving_note, data_source, entry_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanMeal,
        String(description).trim(),
        toNumOrNull(calories),
        toNumOrNull(protein_g),
        toNumOrNull(carbs_g),
        toNumOrNull(fat_g),
        toNumOrNull(fiber_g),
        (serving_note || '').trim(),
        cleanSource,
        entry_date || todayISO()
      ]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('Error logging food entry:', err);
    res.status(500).json({ error: 'Failed to log food entry' });
  }
});

router.put('/food/:id', async (req, res) => {
  try {
    const { meal_type, description, calories, protein_g, carbs_g, fat_g, fiber_g, serving_note, data_source, entry_date } = req.body;
    if (!description || !String(description).trim()) {
      return res.status(400).json({ error: 'description is required' });
    }
    const cleanMeal = VALID_MEALS.includes(meal_type) ? meal_type : 'other';
    const cleanSource = data_source === 'ai_estimated' ? 'ai_estimated' : 'user_confirmed';
    await pool.query(
      `UPDATE food_entries SET meal_type=?, description=?, calories=?, protein_g=?, carbs_g=?, fat_g=?, fiber_g=?, serving_note=?, data_source=?, entry_date=?
       WHERE id=?`,
      [
        cleanMeal,
        String(description).trim(),
        toNumOrNull(calories),
        toNumOrNull(protein_g),
        toNumOrNull(carbs_g),
        toNumOrNull(fat_g),
        toNumOrNull(fiber_g),
        (serving_note || '').trim(),
        cleanSource,
        entry_date || todayISO(),
        req.params.id
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating food entry:', err);
    res.status(500).json({ error: 'Failed to update food entry' });
  }
});

router.delete('/food/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM food_entries WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete food entry' });
  }
});

// ---------- Water ----------
router.get('/water', async (req, res) => {
  try {
    const { date } = req.query;
    let sql = 'SELECT * FROM water_intake_logs WHERE 1=1';
    const params = [];
    if (date) { sql += ' AND entry_date = ?'; params.push(date); }
    sql += ' ORDER BY created_at DESC, id DESC';
    const [rows] = await pool.query(sql, params);
    const totalMl = rows.reduce((s, r) => s + Number(r.amount_ml || 0), 0);
    res.json({ logs: rows, total_ml: totalMl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch water logs' });
  }
});

router.post('/water', async (req, res) => {
  try {
    const { amount_ml, entry_date } = req.body;
    const numAmount = toNumOrNull(amount_ml);
    if (!numAmount || numAmount <= 0) return res.status(400).json({ error: 'Valid amount_ml is required' });
    const targetDate = entry_date || todayISO();
    const [result] = await pool.query('INSERT INTO water_intake_logs (entry_date, amount_ml) VALUES (?, ?)', [
      targetDate,
      Math.round(numAmount)
    ]);
    res.status(201).json({ id: result.insertId, amount_ml: Math.round(numAmount), entry_date: targetDate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log water' });
  }
});

// Bulk clear all water for a specific date
router.delete('/water', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query parameter is required' });
    await pool.query('DELETE FROM water_intake_logs WHERE entry_date = ?', [date]);
    res.json({ success: true, message: `All water logs deleted for ${date}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clear water logs' });
  }
});

router.delete('/water/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM water_intake_logs WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete water entry' });
  }
});

// ---------- Dashboard ----------
router.get('/dashboard/summary', async (req, res) => {
  try {
    const date = req.query.date || todayISO();

    // Each sub-query is individually try-caught so a failure in any one
    // (e.g. finance snapshot) doesn't take down the whole dashboard.
    const safeCall = async (fn, fallback) => {
      try { return await fn(); } catch (e) { console.error('Dashboard sub-query failed:', e.message); return fallback; }
    };

    const [today, targets, weekly, weight, goal] = await Promise.all([
      safeCall(() => getTodayFoodTotals(date), { totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }, entries: [], water_ml: 0, water_logs: [] }),
      safeCall(() => getNutritionTargets(), { ok: false, missing: ['profile data unavailable'] }),
      safeCall(() => getWeeklyNutritionAverage(), null),
      safeCall(() => getLatestWeight(), null),
      safeCall(() => getCurrentGoal(), null)
    ]);

    res.json({
      date,
      today_totals: today.totals,
      today_entries: today.entries,
      water_ml: today.water_ml,
      water_logs: today.water_logs || [],
      targets,
      weekly_average: weekly,
      current_weight: weight,
      current_goal: goal ? { goal_type: goal.goal_type, set_on: goal.created_at } : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build diet dashboard summary' });
  }
});

module.exports = router;
