const express = require('express');
const router = express.Router();
const pool = require('../db/db');

// GET — retrieve the singleton profile
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM jobhunt_profile WHERE id = 1');
    if (rows.length === 0) {
      // Auto-create if missing
      await pool.query('INSERT IGNORE INTO jobhunt_profile (id) VALUES (1)');
      const [fresh] = await pool.query('SELECT * FROM jobhunt_profile WHERE id = 1');
      return res.json(fresh[0] || {});
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT — update profile with safe merging and auto-sync
router.put('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM jobhunt_profile WHERE id = 1');
    if (rows.length === 0) {
      await pool.query('INSERT IGNORE INTO jobhunt_profile (id) VALUES (1)');
    }
    const current = rows[0] || {};
    const b = req.body || {};

    const toStr = (v, fallback) => {
      if (v === undefined) return fallback;
      if (typeof v === 'string') return v;
      return JSON.stringify(v || []);
    };

    // Safe merge: only overwrite fields that are present in the request body
    const full_name = b.full_name !== undefined ? b.full_name : (current.full_name || '');
    const phone = b.phone !== undefined ? b.phone : (current.phone || '');
    const email = b.email !== undefined ? b.email : (current.email || '');
    const linkedin = b.linkedin !== undefined ? b.linkedin : (current.linkedin || '');
    const github = b.github !== undefined ? b.github : (current.github || '');
    const summary = b.summary !== undefined ? b.summary : (current.summary || '');
    
    let degree = b.degree !== undefined ? b.degree : (current.degree || '');
    let branch = b.branch !== undefined ? b.branch : (current.branch || '');
    let graduation_year = b.graduation_year !== undefined ? (b.graduation_year ? Number(b.graduation_year) : null) : current.graduation_year;
    
    const experience_years = b.experience_years !== undefined ? (b.experience_years ? Number(b.experience_years) : 0) : (current.experience_years || 0);
    const age = b.age !== undefined ? (b.age ? Number(b.age) : null) : current.age;

    const education = toStr(b.education, current.education || '[]');
    const experience = toStr(b.experience, current.experience || '[]');
    const projects = toStr(b.projects, current.projects || '[]');
    const publications = toStr(b.publications, current.publications || '[]');
    const achievements = toStr(b.achievements, current.achievements || '[]');
    const skills = toStr(b.skills, current.skills || '[]');
    const certifications = toStr(b.certifications, current.certifications || '[]');
    
    const pref_min_ctc = b.pref_min_ctc !== undefined ? (b.pref_min_ctc ? Number(b.pref_min_ctc) : null) : current.pref_min_ctc;
    const pref_locations = toStr(b.pref_locations, current.pref_locations || '[]');
    const pref_job_types = toStr(b.pref_job_types, current.pref_job_types || '[]');
    const pref_sectors = toStr(b.pref_sectors, current.pref_sectors || '[]');
    const pref_remote_ok = b.pref_remote_ok !== undefined ? (b.pref_remote_ok ? 1 : 0) : (current.pref_remote_ok ?? 1);

    const has_gate = b.has_gate !== undefined ? (b.has_gate ? 1 : 0) : (current.has_gate ? 1 : 0);
    const gate_score = b.gate_score !== undefined ? (b.gate_score ? Number(b.gate_score) : null) : current.gate_score;
    const gate_year = b.gate_year !== undefined ? (b.gate_year ? Number(b.gate_year) : null) : current.gate_year;

    // If degree/branch are empty, auto-sync from primary education entry
    try {
      const eduArr = typeof education === 'string' ? JSON.parse(education) : education;
      if (Array.isArray(eduArr) && eduArr.length > 0) {
        if (!degree && eduArr[0].degree) degree = eduArr[0].degree;
        if (!branch && eduArr[0].branch) branch = eduArr[0].branch;
      }
    } catch {}

    await pool.query(
      `UPDATE jobhunt_profile SET
        full_name = ?, phone = ?, email = ?, linkedin = ?, github = ?, summary = ?,
        degree = ?, branch = ?, graduation_year = ?, experience_years = ?, age = ?,
        education = ?, experience = ?, projects = ?, publications = ?, achievements = ?,
        skills = ?, certifications = ?,
        pref_min_ctc = ?, pref_locations = ?, pref_job_types = ?,
        pref_sectors = ?, pref_remote_ok = ?,
        has_gate = ?, gate_score = ?, gate_year = ?
       WHERE id = 1`,
      [
        full_name, phone, email, linkedin, github, summary,
        degree, branch, graduation_year, experience_years, age,
        education, experience, projects, publications, achievements,
        skills, certifications,
        pref_min_ctc, pref_locations, pref_job_types,
        pref_sectors, pref_remote_ok,
        has_gate, gate_score, gate_year
      ]
    );

    const [updated] = await pool.query('SELECT * FROM jobhunt_profile WHERE id = 1');
    res.json(updated[0]);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
