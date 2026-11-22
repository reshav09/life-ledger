const express = require('express');
const router = express.Router();
const pool = require('../db/db');

// List all organizations (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { sector, org_type, is_active, parent_id, q, category_group, country, visa_sponsored } = req.query;
    let sql = `
      SELECT o.*,
        COALESCE(ch.child_count, 0) AS child_count,
        COALESCE(opp.active_opps_count, 0) AS active_opps_count,
        opp.opportunity_categories,
        opp.opportunity_countries
      FROM jobhunt_organizations o
      LEFT JOIN (
        SELECT parent_org_id, COUNT(*) AS child_count
        FROM jobhunt_organizations
        WHERE parent_org_id IS NOT NULL
        GROUP BY parent_org_id
      ) ch ON ch.parent_org_id = o.id
      LEFT JOIN (
        SELECT org_id,
          COUNT(*) AS active_opps_count,
          GROUP_CONCAT(DISTINCT category_group) AS opportunity_categories,
          GROUP_CONCAT(DISTINCT country) AS opportunity_countries
        FROM jobhunt_opportunities
        WHERE is_archived = 0
        GROUP BY org_id
      ) opp ON opp.org_id = o.id
    `;
    const conditions = [];
    const params = [];

    if (category_group) {
      if (category_group.includes(',')) {
        const groups = category_group.split(',').map((s) => s.trim()).filter(Boolean);
        if (groups.length > 0) {
          conditions.push(`(o.category_group IN (${groups.map(() => '?').join(',')}) OR EXISTS (SELECT 1 FROM jobhunt_opportunities op WHERE op.org_id = o.id AND op.category_group IN (${groups.map(() => '?').join(',')}) AND op.is_archived = 0))`);
          params.push(...groups, ...groups);
        }
      } else if (category_group === 'private_eu') {
        conditions.push('(o.category_group = "private_eu" OR (o.visa_sponsored = 1 AND o.region = "European Union") OR EXISTS (SELECT 1 FROM jobhunt_opportunities op WHERE op.org_id = o.id AND op.category_group = "private_eu" AND op.is_archived = 0))');
      } else {
        conditions.push('(o.category_group = ? OR EXISTS (SELECT 1 FROM jobhunt_opportunities op WHERE op.org_id = o.id AND op.category_group = ? AND op.is_archived = 0))');
        params.push(category_group, category_group);
      }
    }
    if (country) { conditions.push('o.country = ?'); params.push(country); }
    if (visa_sponsored != null && visa_sponsored !== '') { conditions.push('(o.visa_sponsored = ? OR EXISTS (SELECT 1 FROM jobhunt_opportunities op WHERE op.org_id = o.id AND op.visa_sponsored = ? AND op.is_archived = 0))'); params.push(Number(visa_sponsored), Number(visa_sponsored)); }
    if (sector) { conditions.push('o.sector = ?'); params.push(sector); }
    if (org_type) { conditions.push('o.org_type = ?'); params.push(org_type); }
    if (is_active != null) {
      conditions.push('o.is_active = ?');
      params.push(is_active === 'true' || is_active === '1' || is_active === 1 ? 1 : 0);
    } else {
      conditions.push('o.is_active = 1');
    }
    if (parent_id) { conditions.push('o.parent_org_id = ?'); params.push(parent_id); }
    if (q) { conditions.push('(o.name LIKE ? OR o.short_name LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }

    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ` ORDER BY 
      CASE 
        WHEN o.category_group IN ('psu', 'govt', 'research') THEN 1
        WHEN o.category_group IN ('startup') THEN 2
        WHEN o.category_group IN ('private_in', 'service_tech') THEN 3
        ELSE 10
      END ASC,
      o.name ASC`;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get distinct sectors for filter UI
router.get('/sectors', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT DISTINCT sector FROM jobhunt_organizations WHERE sector != "" AND is_active = 1 ORDER BY sector');
    res.json(rows.map(r => r.sector));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single org with children
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM jobhunt_organizations WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Organization not found' });

    const [children] = await pool.query(
      'SELECT id, name, short_name, sector, org_type, careers_url, is_active FROM jobhunt_organizations WHERE parent_org_id = ? ORDER BY name',
      [req.params.id]
    );

    res.json({ ...rows[0], children });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create
router.post('/', async (req, res) => {
  try {
    const {
      name, short_name = '', sector = '', org_type = '', parent_org_id = null,
      careers_url = '', notification_url = '', pdf_page_url = '', website = '',
      notes = '', quality_score = null, poll_frequency_days = 7,
      category_group = 'psu', country = 'India', region = 'India',
      visa_sponsored = 0, currency = 'INR', min_ctc_threshold = null,
      ats_type = 'custom_scrape', ats_id = null
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Organization name is required' });

    const [result] = await pool.query(
      `INSERT INTO jobhunt_organizations
        (name, short_name, sector, org_type, parent_org_id, careers_url,
         notification_url, pdf_page_url, website, notes, quality_score, poll_frequency_days,
         category_group, country, region, visa_sponsored, currency, min_ctc_threshold,
         ats_type, ats_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, short_name, sector, org_type, parent_org_id || null,
       careers_url, notification_url, pdf_page_url, website,
       notes, quality_score, poll_frequency_days,
       category_group || 'psu', country || 'India', region || 'India',
       visa_sponsored ? 1 : 0, currency || 'INR', min_ctc_threshold || null,
       ats_type || 'custom_scrape', ats_id || null]
    );
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update
router.put('/:id', async (req, res) => {
  try {
    const {
      name, short_name, sector, org_type, parent_org_id,
      careers_url, notification_url, pdf_page_url, website,
      notes, quality_score, poll_frequency_days, is_active,
      category_group, country, region, visa_sponsored, currency, min_ctc_threshold,
      ats_type, ats_id
    } = req.body;

    await pool.query(
      `UPDATE jobhunt_organizations SET
        name = ?, short_name = ?, sector = ?, org_type = ?, parent_org_id = ?,
        careers_url = ?, notification_url = ?, pdf_page_url = ?, website = ?,
        notes = ?, quality_score = ?, poll_frequency_days = ?, is_active = ?,
        category_group = COALESCE(?, category_group),
        country = COALESCE(?, country),
        region = COALESCE(?, region),
        visa_sponsored = COALESCE(?, visa_sponsored),
        currency = COALESCE(?, currency),
        min_ctc_threshold = COALESCE(?, min_ctc_threshold),
        ats_type = COALESCE(?, ats_type),
        ats_id = COALESCE(?, ats_id)
       WHERE id = ?`,
      [name, short_name || '', sector || '', org_type || '', parent_org_id || null,
       careers_url || '', notification_url || '', pdf_page_url || '', website || '',
       notes || '', quality_score, poll_frequency_days || 7, is_active != null ? is_active : 1,
       category_group != null ? category_group : null,
       country != null ? country : null,
       region != null ? region : null,
       visa_sponsored != null ? (visa_sponsored ? 1 : 0) : null,
       currency != null ? currency : null,
       min_ctc_threshold != null ? min_ctc_threshold : null,
       ats_type != null ? ats_type : null,
       ats_id != null ? ats_id : null,
       req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Soft-delete (archive)
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE jobhunt_organizations SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
