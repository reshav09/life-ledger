const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const { callAI, callAIMultimodal, testProviderConnection, transcribeAudio } = require('../services/aiProvider');
const { buildUserContext } = require('../services/dietContext');
const rules = require('../services/ruleBasedInsights');
const { encrypt, decrypt, maskApiKey } = require('../services/crypto');

const SYSTEM_PROMPT = `You are a personal decision-support assistant inside a self-hosted Diet & Health ledger.
You will be given a JSON "context" object built from the user's own logged data (health measurements, food entries,
nutrition targets, weight history, schedule, and relevant money-ledger summaries).

Rules you must follow strictly:
- Only use the data given to you in the context. Never invent a weight, measurement, meal, or amount that isn't present.
- If something needed to answer well is missing from the context, say so plainly and name what's missing, rather than guessing.
- If there are fewer than 3 historical data points for a trend, say there isn't enough data yet rather than projecting one.
- Never diagnose a medical condition. If a measurement is outside its stated reference range, note that plainly and
  suggest discussing it with a qualified healthcare professional — do not name a disease or condition.
- Clearly distinguish confirmed/logged data from any estimate you make.
- Keep answers concise, concrete, and specific to the numbers in the context — avoid generic advice like "eat healthy".
- When you make a recommendation, briefly say which data points led you to it.`;

async function getAISettings() {
  const [[row]] = await pool.query('SELECT * FROM ai_settings WHERE id = 1');
  if (!row) return null;
  return {
    ...row,
    anthropic_api_key: decrypt(row.anthropic_api_key),
    openai_api_key: decrypt(row.openai_api_key),
    gemini_api_key: decrypt(row.gemini_api_key)
  };
}

const AVAILABLE_MODELS = {
  gemini: [
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Recommended · Fast)' },
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (High Intelligence)' },
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite (Ultra Fast)' },
    { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
    { id: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite Latest' },
    { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' }
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Recommended)' },
    { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)' },
    { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Deep Analysis)' },
    { id: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' }
  ],
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Recommended · Fast)' },
    { id: 'gpt-4o', label: 'GPT-4o (Flagship Multimodal)' },
    { id: 'o3-mini', label: 'o3-mini (Reasoning)' },
    { id: 'o1-mini', label: 'o1-mini (Reasoning)' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' }
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
    
    // If no provider was active and a key is provided, auto-set that provider as active
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
    const modelMap = { anthropic: 'anthropic_model', openai: 'openai_model', gemini: 'gemini_model' };

    const resolvedKey = (apiKey && apiKey.trim()) || current[keyMap[targetProvider]];
    const resolvedModel = (model && model.trim()) || current[modelMap[targetProvider]];

    if (!resolvedKey) {
      return res.json({ ok: false, error: `No API key saved or provided for ${targetProvider}.` });
    }

    const testResult = await testProviderConnection({
      provider: targetProvider,
      apiKey: resolvedKey,
      model: resolvedModel
    });

    res.json(testResult);
  } catch (err) {
    console.error('Test connection error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Connection test failed' });
  }
});

// ---------- Insights (always works via rules; LLM enhances if configured) ----------
router.post('/insights/generate', async (req, res) => {
  try {
    const kind = req.body.kind || 'daily_analysis';
    const context = await buildUserContext();
    const settings = await getAISettings();

    let ruleText;
    if (kind === 'daily_analysis') ruleText = rules.dailyAnalysis(context);
    else if (kind === 'weekly_insight') ruleText = rules.weeklyInsight(context);
    else if (kind === 'prediction') ruleText = rules.weightTrendPrediction(context).text;
    else if (kind === 'suggestion') ruleText = rules.suggestions(context).map((s) => `• ${s.text}`).join('\n');
    else return res.status(400).json({ error: 'Unknown insight kind' });

    let finalText = ruleText;
    let source = 'rules';
    let providerUsed = null;
    let modelUsed = null;

    if (settings.active_provider) {
      const aiResult = await callAI(settings, {
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Generate a "${kind}" insight for me. Here is my current context as JSON:\n${JSON.stringify(context)}\n\nA rule-based baseline analysis (for reference, you may improve on it but must stay consistent with the same underlying numbers): ${ruleText}`
          }
        ]
      });
      if (aiResult.ok) {
        finalText = aiResult.text;
        source = 'ai';
        providerUsed = aiResult.provider;
        modelUsed = aiResult.model;
      }
      // if AI call fails, we silently keep the rule-based text — app stays usable (§41)
    }

    await pool.query(
      'INSERT INTO ai_insights (kind, context_date, content, provider_used, model_used) VALUES (?, CURDATE(), ?, ?, ?)',
      [kind, finalText, providerUsed, modelUsed]
    );

    res.json({ kind, content: finalText, source, provider_used: providerUsed, model_used: modelUsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate insight' });
  }
});

router.get('/insights', async (req, res) => {
  try {
    const { kind, limit } = req.query;
    let sql = 'SELECT * FROM ai_insights WHERE 1=1';
    const params = [];
    if (kind) { sql += ' AND kind = ?'; params.push(kind); }
    sql += ' ORDER BY created_at DESC';
    if (limit) { sql += ' LIMIT ?'; params.push(Number(limit)); }
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

// ---------- Food Nutrition Estimate (Stateless — does NOT save to chat history) ----------
router.post('/estimate-food', async (req, res) => {
  try {
    const { description } = req.body;
    if (!description || !description.trim()) return res.status(400).json({ error: 'description is required' });

    const settings = await getAISettings();
    if (!settings.active_provider) {
      return res.status(200).json({
        reply: 'No AI provider is configured yet.',
        unavailable: true
      });
    }

    const aiResult = await callAI(settings, {
      system: 'You are a precise nutrition estimator. Given a food description, reply with ONLY a single JSON object containing numeric estimated macros: {"calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number}. Do not include markdown codeblocks, explanations, or any extra text.',
      messages: [
        {
          role: 'user',
          content: `Estimate nutrition for this food only: "${description}"`
        }
      ]
    });

    if (!aiResult.ok) {
      return res.json({ reply: `AI request failed: ${aiResult.error}`, unavailable: true });
    }

    res.json({ reply: aiResult.text, provider_used: aiResult.provider, model_used: aiResult.model });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Food estimation failed' });
  }
});

// ---------- Multi-Ledger Daily Quick-Dump Intent Parser ----------
const { parseQuickDump } = require('../services/quickDumpParser');

router.post('/quick-dump', async (req, res, next) => {
  try {
    const { text, date } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }

    const settings = await getAISettings();
    const result = await parseQuickDump(text.trim(), settings, date);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---------- Document & Image File Analysis ----------
router.post('/analyze-file', async (req, res) => {
  try {
    const { fileName, fileType, fileBase64, userPrompt, mode } = req.body;
    if (!fileBase64) return res.status(400).json({ error: 'file data is required' });

    const settings = await getAISettings();
    if (!settings.active_provider) {
      return res.status(200).json({
        reply: 'No AI provider is configured yet. Configure an API key in AI Settings to analyze files.',
        unavailable: true
      });
    }

    const context = await buildUserContext();
    const defaultPrompt = mode === 'nutrition'
      ? `Analyze this file/image (${fileName}) for food, meals, grocery items, or nutrition tables. Extract all identified foods with estimated calories, protein (g), carbs (g), fat (g), fiber (g). Format the output cleanly with bold headers and structured bullet points.`
      : mode === 'health_report'
      ? `Analyze this health/medical report (${fileName}). Extract key test markers, values, units, and stated reference ranges. Compare with the user profile in context. Highlight any markers out of range. Note: Do not diagnose medical conditions; provide objective data summaries.`
      : `Analyze this uploaded document/file (${fileName}) in the context of the user's diet, health, routine, and finances. Extract key insights, numbers, and actionable suggestions.`;

    const prompt = userPrompt && userPrompt.trim() ? `${userPrompt}\n\nFile: ${fileName}` : defaultPrompt;

    const aiResult = await callAIMultimodal(settings, {
      system: `${SYSTEM_PROMPT}\n\nCurrent user context:\n${JSON.stringify(context)}`,
      prompt,
      file: {
        fileName: fileName || 'uploaded_document',
        mimeType: fileType || 'application/octet-stream',
        base64Data: fileBase64
      }
    });

    if (!aiResult.ok) {
      return res.json({ reply: `Document analysis failed: ${aiResult.error}`, unavailable: true });
    }

    res.json({
      reply: aiResult.text,
      fileName,
      provider_used: aiResult.provider,
      model_used: aiResult.model
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'File analysis request failed' });
  }
});

// ---------- Chat ----------
router.get('/chat', async (req, res) => {
  try {
    // Exclude any internal food estimation prompts if previously logged
    const [rows] = await pool.query(`
      SELECT * FROM ai_chat_messages
      WHERE content NOT LIKE '%Estimate nutrition for this food%'
        AND content NOT LIKE '{"calories"%'
      ORDER BY created_at ASC LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'message is required' });

    const settings = await getAISettings();
    if (!settings.active_provider) {
      return res.status(200).json({
        reply: 'No AI provider is configured yet. Add an API key for Claude, ChatGPT, or Gemini in AI Settings to use the chat.',
        unavailable: true
      });
    }

    await pool.query("INSERT INTO ai_chat_messages (role, content) VALUES ('user', ?)", [message]);
    const [history] = await pool.query(`
      SELECT role, content FROM (
        SELECT id, role, content, created_at FROM ai_chat_messages
        WHERE content NOT LIKE '%Estimate nutrition for this food%'
          AND content NOT LIKE '{"calories"%'
        ORDER BY created_at DESC, id DESC LIMIT 20
      ) AS recent
      ORDER BY created_at ASC, id ASC
    `);
    const context = await buildUserContext();

    const aiResult = await callAI(settings, {
      system: `${SYSTEM_PROMPT}\n\nCurrent user context as JSON:\n${JSON.stringify(context)}`,
      messages: history
    });

    if (!aiResult.ok) {
      return res.json({ reply: `AI request failed: ${aiResult.error}`, unavailable: true });
    }

    await pool.query("INSERT INTO ai_chat_messages (role, content) VALUES ('assistant', ?)", [aiResult.text]);
    res.json({ reply: aiResult.text, provider_used: aiResult.provider, model_used: aiResult.model });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Chat request failed' });
  }
});

// ---------- Audio Transcription (Direct Mic / MediaRecorder) ----------
router.post('/transcribe-audio', async (req, res) => {
  try {
    const { audioBase64, mimeType, lang } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ ok: false, error: 'audioBase64 is required' });
    }

    const settings = await getAISettings();
    const result = await transcribeAudio(settings, {
      audio: {
        base64Data: audioBase64,
        mimeType: mimeType || 'audio/webm'
      },
      lang
    });

    res.json(result);
  } catch (err) {
    console.error('Audio transcription route error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Audio transcription failed' });
  }
});

module.exports = router;
