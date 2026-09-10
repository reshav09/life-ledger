const express = require('express');
const router = express.Router();
const pool = require('../db/db');

// ---------- Current Diet Plan ----------

router.get('/current', async (req, res) => {
  try {
    const [items] = await pool.query(
      `SELECT * FROM diet_plan_items WHERE plan_name = 'current' AND is_active = 1 ORDER BY sort_order`
    );
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch diet plan' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { meal_slot, meal_time, foods, purpose, targets_deficiency } = req.body;
    await pool.query(
      `UPDATE diet_plan_items SET meal_slot=?, meal_time=?, foods=?, purpose=?, targets_deficiency=? WHERE id=?`,
      [meal_slot, meal_time, foods, purpose, targets_deficiency || '', req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update diet plan item' });
  }
});

router.post('/item', async (req, res) => {
  try {
    const { meal_slot, meal_time, foods, purpose, targets_deficiency } = req.body;
    if (!meal_slot || !foods) return res.status(400).json({ error: 'meal_slot and foods required' });
    const [maxOrder] = await pool.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM diet_plan_items WHERE plan_name = 'current'`
    );
    const [result] = await pool.query(
      `INSERT INTO diet_plan_items (plan_name, meal_slot, meal_time, foods, purpose, targets_deficiency, sort_order)
       VALUES ('current', ?, ?, ?, ?, ?, ?)`,
      [meal_slot, meal_time || '', foods, purpose || '', targets_deficiency || '', maxOrder[0].next]
    );
    res.json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add diet plan item' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM diet_plan_items WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete diet plan item' });
  }
});

// ---------- Health Report Markers Summary ----------

router.get('/health-summary', async (req, res) => {
  try {
    const [markers] = await pool.query(
      `SELECT * FROM health_report_markers ORDER BY
        CASE status
          WHEN 'critical_low' THEN 1
          WHEN 'critical_high' THEN 2
          WHEN 'low' THEN 3
          WHEN 'high' THEN 4
          ELSE 5
        END, marker_name`
    );

    // Separate into flagged and normal
    const flagged = markers.filter(m => m.status !== 'normal');
    const normal = markers.filter(m => m.status === 'normal');

    res.json({ flagged, normal, all: markers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch health summary' });
  }
});

module.exports = router;
