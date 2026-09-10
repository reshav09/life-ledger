const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const pool = require('../db/db');

const UPLOAD_DIR = process.env.HEALTH_REPORTS_DIR || path.join(__dirname, '..', 'uploads', 'health-reports');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    cb(null, safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  }
});

function toNumOrNull(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

// ---------- Health profile (singleton) ----------
router.get('/profile', async (req, res) => {
  try {
    const [[profile]] = await pool.query('SELECT * FROM health_profile WHERE id = 1');
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch health profile' });
  }
});

router.put('/profile', async (req, res) => {
  try {
    const {
      height_cm, birth_year, sex, activity_level, gym_status, training_days, training_goal,
      calorie_target_override, protein_target_override, carb_target_override,
      fat_target_override, fiber_target_override, water_target_ml_override
    } = req.body;
    await pool.query(
      `UPDATE health_profile SET
        height_cm=?, birth_year=?, sex=?, activity_level=?, gym_status=?, training_days=?, training_goal=?,
        calorie_target_override=?, protein_target_override=?, carb_target_override=?,
        fat_target_override=?, fiber_target_override=?, water_target_ml_override=?
       WHERE id = 1`,
      [
        toNumOrNull(height_cm), toNumOrNull(birth_year), sex || 'unspecified', activity_level || 'moderate',
        gym_status || 'not_started', training_days || '', training_goal || '',
        toNumOrNull(calorie_target_override), toNumOrNull(protein_target_override), toNumOrNull(carb_target_override),
        toNumOrNull(fat_target_override), toNumOrNull(fiber_target_override), toNumOrNull(water_target_ml_override)
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update health profile' });
  }
});

// ---------- Goals (append-only history; latest = current) ----------
router.get('/goals', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM diet_goals ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

router.post('/goals', async (req, res) => {
  try {
    const { goal_type, notes } = req.body;
    if (!goal_type) return res.status(400).json({ error: 'goal_type is required' });
    const [result] = await pool.query('INSERT INTO diet_goals (goal_type, notes) VALUES (?, ?)', [goal_type, notes || '']);
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to set goal' });
  }
});

// ---------- Measurements (weight + any lab/body marker, time-series) ----------
router.get('/measurements', async (req, res) => {
  try {
    const { type } = req.query;
    let sql = 'SELECT * FROM health_measurements WHERE 1=1';
    const params = [];
    if (type) { sql += ' AND measurement_type = ?'; params.push(type); }
    sql += ' ORDER BY measurement_date DESC, id DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch measurements' });
  }
});

router.post('/measurements', async (req, res) => {
  try {
    const { measurement_type, value, unit, reference_range, measurement_date, notes, source, source_report_id } = req.body;
    if (!measurement_type || value == null || !measurement_date) {
      return res.status(400).json({ error: 'measurement_type, value and measurement_date are required' });
    }
    const validSource = source === 'health_report' ? 'health_report' : 'user_entered';
    const [result] = await pool.query(
      `INSERT INTO health_measurements (measurement_type, value, unit, reference_range, source, source_report_id, measurement_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [measurement_type, value, unit || '', reference_range || null, validSource, source_report_id || null, measurement_date, notes || '']
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log measurement' });
  }
});

router.delete('/measurements/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM health_measurements WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete measurement' });
  }
});

// ---------- Reports (source documents, kept traceable) ----------
router.get('/reports', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM health_reports ORDER BY uploaded_at DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.post('/reports', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded, or file type not allowed (pdf/jpg/png only)' });
    const { report_date, notes } = req.body;
    const [result] = await pool.query(
      'INSERT INTO health_reports (original_filename, stored_filename, report_date, notes) VALUES (?, ?, ?, ?)',
      [req.file.originalname, req.file.filename, report_date || null, notes || '']
    );
    res.status(201).json({ id: result.insertId, stored_filename: req.file.filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload report' });
  }
});

router.get('/reports/:id/file', async (req, res) => {
  try {
    const [[report]] = await pool.query('SELECT * FROM health_reports WHERE id = ?', [req.params.id]);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const filePath = path.join(UPLOAD_DIR, report.stored_filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on disk' });
    res.sendFile(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch report file' });
  }
});

router.delete('/reports/:id', async (req, res) => {
  try {
    const [[report]] = await pool.query('SELECT * FROM health_reports WHERE id = ?', [req.params.id]);
    if (report) {
      const filePath = path.join(UPLOAD_DIR, report.stored_filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    // Measurements sourced from this report are kept (ON DELETE SET NULL) —
    // deleting the document doesn't erase the historical readings it gave you.
    await pool.query('DELETE FROM health_reports WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

module.exports = router;
