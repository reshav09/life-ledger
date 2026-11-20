const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const { testProviderConnection } = require('../services/aiProvider');
const { encrypt, decrypt, maskApiKey } = require('../services/crypto');

async function getAISettings() {
  const [[row]] = await pool.query('SELECT * FROM ai_settings WHERE id = 1');
  if (!row) return {};
  return {
    ...row,
    anthropic_api_key: decrypt(row.anthropic_api_key),
    openai_api_key: decrypt(row.openai_api_key),
    gemini_api_key: decrypt(row.gemini_api_key)
  };
}

const AVAILABLE_MODELS = {
  gemini: [
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Recommended · Fast)' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Deep Intelligence)' },
    { id: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash' }
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Recommended · Fast)' },
    { id: 'gpt-4o', label: 'GPT-4o (Flagship Multimodal)' }
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Recommended)' },
    { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)' }
  ]
};

// ---------- Models ----------
router.get('/models', (req, res) => {
  res.json(AVAILABLE_MODELS);
});

// ---------- Settings ----------
router.get('/settings', async (req, res) => {
  try {
    const s = await getAISettings();
    res.json({
      active_provider: s.active_provider,
      anthropic: { configured: !!s.anthropic_api_key, masked_key: maskApiKey(s.anthropic_api_key), model: s.anthropic_model },
      openai: { configured: !!s.openai_api_key, masked_key: maskApiKey(s.openai_api_key), model: s.openai_model },
      gemini: { configured: !!s.gemini_api_key, masked_key: maskApiKey(s.gemini_api_key), model: s.gemini_model }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch AI settings' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const { active_provider, anthropic_api_key, anthropic_model, openai_api_key, openai_model, gemini_api_key, gemini_model } = req.body;
    const current = await getAISettings();
    
    let resolvedActive = active_provider ?? current.active_provider;
    if (!resolvedActive) {
      if (gemini_api_key) resolvedActive = 'gemini';
      else if (openai_api_key) resolvedActive = 'openai';
      else if (anthropic_api_key) resolvedActive = 'anthropic';
    }

    const encAnthropic = anthropic_api_key ? encrypt(anthropic_api_key.trim()) : (current.anthropic_api_key ? encrypt(current.anthropic_api_key) : null);
    const encOpenAI = openai_api_key ? encrypt(openai_api_key.trim()) : (current.openai_api_key ? encrypt(current.openai_api_key) : null);
    const encGemini = gemini_api_key ? encrypt(gemini_api_key.trim()) : (current.gemini_api_key ? encrypt(current.gemini_api_key) : null);

    await pool.query(
      `UPDATE ai_settings SET
        active_provider = ?,
        anthropic_api_key = ?, anthropic_model = ?,
        openai_api_key = ?, openai_model = ?,
        gemini_api_key = ?, gemini_model = ?
       WHERE id = 1`,
      [
        resolvedActive,
        encAnthropic,
        anthropic_model || current.anthropic_model,
        encOpenAI,
        openai_model || current.openai_model,
        encGemini,
        gemini_model || current.gemini_model
      ]
    );
    res.json({ success: true, active_provider: resolvedActive });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update AI settings' });
  }
});

router.delete('/settings/:provider', async (req, res) => {
  try {
    const provider = req.params.provider;
    const columnMap = { anthropic: 'anthropic_api_key', openai: 'openai_api_key', gemini: 'gemini_api_key' };
    const column = columnMap[provider];
    if (!column) return res.status(400).json({ error: 'Unknown provider' });
    
    const current = await getAISettings();
    const clearActive = current.active_provider === provider ? ', active_provider = NULL' : '';
    await pool.query(`UPDATE ai_settings SET ${column} = NULL ${clearActive} WHERE id = 1`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove API key' });
  }
});

// ---------- Connection Diagnostic Test ----------
router.post('/test-connection', async (req, res) => {
  try {
    const { provider, apiKey, model } = req.body;
    const current = await getAISettings();
    
    const targetProvider = provider || current.active_provider;
    if (!targetProvider) {
      return res.json({ ok: false, error: 'No provider specified or active.' });
    }

    const keyMap = { anthropic: 'anthropic_api_key', openai: 'openai_api_key', gemini: 'gemini_api_key' };
    const resolvedKey = apiKey ? apiKey.trim() : current[keyMap[targetProvider]];
    if (!resolvedKey) {
      return res.json({ ok: false, error: `No API key found for ${targetProvider}.` });
    }

    const testSettings = {
      active_provider: targetProvider,
      [`${targetProvider}_api_key`]: resolvedKey,
      [`${targetProvider}_model`]: model || current[`${targetProvider}_model`]
    };

    const result = await testProviderConnection(testSettings, targetProvider);
    res.json(result);
  } catch (err) {
    console.error('Connection test error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Connection test failed' });
  }
});

module.exports = router;
