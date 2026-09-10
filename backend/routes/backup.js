const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { runBackup, listBackups, restoreBackup, BACKUP_DIR } = require('../services/backup');

router.get('/list', (req, res) => {
  res.json(listBackups());
});

router.post('/run', async (req, res) => {
  try {
    const filename = await runBackup();
    res.json({ success: true, filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Backup failed' });
  }
});

router.get('/download/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename); // no path traversal
  const filePath = path.join(BACKUP_DIR, safeName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup file not found' });
  res.download(filePath);
});

// Destructive — replaces ALL current data with the uploaded backup's contents.
// The frontend is expected to confirm with the user before calling this.
router.post('/restore', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid backup file' });
    }
    await restoreBackup(req.body);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Restore failed: ' + err.message });
  }
});

module.exports = router;
