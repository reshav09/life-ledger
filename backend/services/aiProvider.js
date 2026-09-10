// Thin, provider-agnostic wrapper. Uses Node 20's built-in global fetch —
// no SDK dependency added. Never logs API keys or raw prompts.

// Helper to sanitize and format messages for Anthropic Claude (strict alternating user/assistant turns)
function formatAnthropicMessages(messages) {
  const result = [];
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const content = (m.content || '').trim();
    if (!content) continue;

    if (result.length > 0 && result[result.length - 1].role === role) {
      result[result.length - 1].content += `\n\n${content}`;
    } else {
      result.push({ role, content });
    }
  }

  // Anthropic requires first message to be 'user'
  while (result.length > 0 && result[0].role === 'assistant') {
    result.shift();
  }

  // Anthropic requires last message to be 'user'
  while (result.length > 0 && result[result.length - 1].role === 'assistant') {
    result.pop();
  }

  if (result.length === 0) {
    result.push({ role: 'user', content: 'Hello' });
  }

  return result;
}

// Helper to sanitize and format contents for Google Gemini (alternating user/model roles)
function formatGeminiContents(messages) {
  const contents = [];
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    const text = (m.content || '').trim();
    if (!text) continue;

    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts.push({ text });
    } else {
      contents.push({
        role,
        parts: [{ text }]
      });
    }
  }

  // Gemini requires the first turn to be 'user'
  while (contents.length > 0 && contents[0].role === 'model') {
    contents.shift();
  }

  // Gemini requires the last turn to be 'user'
  while (contents.length > 0 && contents[contents.length - 1].role === 'model') {
    contents.pop();
  }

  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
  }

  return contents;
}

async function callAnthropic({ apiKey, model, system, messages }) {
  const formattedMessages = formatAnthropicMessages(messages);
  const selectedModel = model || 'claude-3-5-sonnet-20241022';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: selectedModel,
      max_tokens: 2048,
      system: system || undefined,
      messages: formattedMessages
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Anthropic API error (${res.status})`);
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  return text || '(empty response)';
}

async function callOpenAI({ apiKey, model, system, messages }) {
  const selectedModel = model || 'gpt-4o-mini';
  const isReasoningModel = selectedModel.startsWith('o1') || selectedModel.startsWith('o3');

  const formattedMessages = [];
  if (system) {
    formattedMessages.push({ role: isReasoningModel ? 'developer' : 'system', content: system });
  }
  for (const m of messages) {
    formattedMessages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content || '' });
  }

  const payload = {
    model: selectedModel,
    messages: formattedMessages
  };

  if (isReasoningModel) {
    payload.max_completion_tokens = 2048;
  } else {
    payload.max_tokens = 2048;
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI API error (${res.status})`);
  return data.choices?.[0]?.message?.content || '(empty response)';
}

async function callGemini({ apiKey, model, system, messages }) {
  const selectedModel = model || 'gemini-3.5-flash';
  const contents = formatGeminiContents(messages);

  const payload = {
    contents,
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7
    }
  };

  if (system) {
    payload.systemInstruction = {
      parts: [{ text: system }]
    };
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    const errMsg = data?.error?.message || `Gemini API error (${res.status})`;
    throw new Error(errMsg);
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    if (data.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked prompt: ${data.promptFeedback.blockReason}`);
    }
    return '(empty response)';
  }

  const parts = candidate.content?.parts || [];
  const textParts = parts.filter((p) => p.text).map((p) => p.text);
  return textParts.join('\n') || candidate.finishReason || '(empty response)';
}

async function callGeminiMultimodal({ apiKey, model, system, prompt, file }) {
  const selectedModel = model || 'gemini-3.5-flash';

  // If text file (csv, txt, json, etc), pass as plain text prompt
  if (file.mimeType.startsWith('text/') || file.mimeType === 'application/json') {
    const textContent = Buffer.from(file.base64Data, 'base64').toString('utf8');
    return callGemini({
      apiKey,
      model: selectedModel,
      system,
      messages: [{ role: 'user', content: `${prompt}\n\nFile Content (${file.fileName}):\n${textContent}` }]
    });
  }

  // Multimodal generateContent call for images, PDFs, etc.
  const parts = [
    { text: prompt },
    {
      inline_data: {
        mime_type: file.mimeType,
        data: file.base64Data
      }
    }
  ];

  const payload = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      maxOutputTokens: 2048
    }
  };

  if (system) {
    payload.systemInstruction = {
      parts: [{ text: system }]
    };
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Gemini multimodal error (${res.status})`);
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n') || '(empty response)';
}

async function callOpenAIMultimodal({ apiKey, model, system, prompt, file }) {
  const selectedModel = model || 'gpt-4o-mini';

  if (file.mimeType.startsWith('text/') || file.mimeType === 'application/json') {
    const textContent = Buffer.from(file.base64Data, 'base64').toString('utf8');
    return callOpenAI({
      apiKey,
      model: selectedModel,
      system,
      messages: [{ role: 'user', content: `${prompt}\n\nFile Content (${file.fileName}):\n${textContent}` }]
    });
  }

  const content = [
    { type: 'text', text: prompt },
    {
      type: 'image_url',
      image_url: { url: `data:${file.mimeType};base64,${file.base64Data}` }
    }
  ];

  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: selectedModel,
      max_tokens: 2048,
      messages
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI multimodal error (${res.status})`);
  return data.choices?.[0]?.message?.content || '(empty response)';
}

async function callAnthropicMultimodal({ apiKey, model, system, prompt, file }) {
  const selectedModel = model || 'claude-3-5-sonnet-20241022';

  if (file.mimeType.startsWith('text/') || file.mimeType === 'application/json') {
    const textContent = Buffer.from(file.base64Data, 'base64').toString('utf8');
    return callAnthropic({
      apiKey,
      model: selectedModel,
      system,
      messages: [{ role: 'user', content: `${prompt}\n\nFile Content (${file.fileName}):\n${textContent}` }]
    });
  }

  const isPdf = file.mimeType === 'application/pdf';
  const content = [
    isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.base64Data } }
      : { type: 'image', source: { type: 'base64', media_type: file.mimeType, data: file.base64Data } },
    { type: 'text', text: prompt }
  ];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: selectedModel,
      max_tokens: 2048,
      system: system || undefined,
      messages: [{ role: 'user', content }]
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Anthropic multimodal error (${res.status})`);
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  return text || '(empty response)';
}

/**
 * settings: row from ai_settings (active_provider + per-provider key/model)
 * system: system prompt string
 * messages: [{role:'user'|'assistant', content:string}, ...]
 * Returns { ok:true, text, provider, model } or { ok:false, error }.
 * Never throws — callers can always render a graceful fallback.
 */
async function callAI(settings, { system, messages }) {
  const provider = settings?.active_provider;
  if (!provider) {
    return { ok: false, error: 'No AI provider is configured yet. Add an API key in AI Settings.' };
  }
  try {
    let text;
    let model;
    if (provider === 'anthropic') {
      if (!settings.anthropic_api_key) return { ok: false, error: 'Anthropic is selected but no API key is saved.' };
      model = settings.anthropic_model || 'claude-3-5-sonnet-20241022';
      text = await callAnthropic({ apiKey: settings.anthropic_api_key, model, system, messages });
    } else if (provider === 'openai') {
      if (!settings.openai_api_key) return { ok: false, error: 'ChatGPT is selected but no API key is saved.' };
      model = settings.openai_model || 'gpt-4o-mini';
      text = await callOpenAI({ apiKey: settings.openai_api_key, model, system, messages });
    } else if (provider === 'gemini') {
      if (!settings.gemini_api_key) return { ok: false, error: 'Gemini is selected but no API key is saved.' };
      model = settings.gemini_model || 'gemini-3.5-flash';
      text = await callGemini({ apiKey: settings.gemini_api_key, model, system, messages });
    } else {
      return { ok: false, error: `Unknown provider: ${provider}` };
    }
    return { ok: true, text, provider, model };
  } catch (err) {
    console.error(`AI call failed (${provider}):`, err.message);
    return { ok: false, error: err.message || 'AI request failed' };
  }
}

/**
 * Multimodal document and image file analysis
 * file: { fileName, mimeType, base64Data }
 */
async function callAIMultimodal(settings, { system, prompt, file }) {
  const provider = settings?.active_provider;
  if (!provider) {
    return { ok: false, error: 'No AI provider is configured yet. Add an API key in AI Settings.' };
  }
  try {
    let text;
    let model;
    if (provider === 'anthropic') {
      if (!settings.anthropic_api_key) return { ok: false, error: 'Anthropic is selected but no API key is saved.' };
      model = settings.anthropic_model || 'claude-3-5-sonnet-20241022';
      text = await callAnthropicMultimodal({ apiKey: settings.anthropic_api_key, model, system, prompt, file });
    } else if (provider === 'openai') {
      if (!settings.openai_api_key) return { ok: false, error: 'ChatGPT is selected but no API key is saved.' };
      model = settings.openai_model || 'gpt-4o-mini';
      text = await callOpenAIMultimodal({ apiKey: settings.openai_api_key, model, system, prompt, file });
    } else if (provider === 'gemini') {
      if (!settings.gemini_api_key) return { ok: false, error: 'Gemini is selected but no API key is saved.' };
      model = settings.gemini_model || 'gemini-3.5-flash';
      text = await callGeminiMultimodal({ apiKey: settings.gemini_api_key, model, system, prompt, file });
    } else {
      return { ok: false, error: `Unknown provider: ${provider}` };
    }
    return { ok: true, text, provider, model };
  } catch (err) {
    console.error(`AI multimodal call failed (${provider}):`, err.message);
    return { ok: false, error: err.message || 'AI document analysis failed' };
  }
}

/**
 * Audio transcription function supporting Gemini native audio understanding and OpenAI Whisper
 * audio: { mimeType, base64Data }
 */
async function transcribeAudio(settings, { audio, lang = 'en' }) {
  if (!audio || !audio.base64Data) {
    return { ok: false, error: 'No audio data received' };
  }

  // Strip codecs parameter (e.g., "audio/webm;codecs=opus" -> "audio/webm")
  // Gemini's inline_data.mime_type requires a clean MIME type without parameters.
  const cleanMime = (audio.mimeType || 'audio/webm').split(';')[0].trim();
  let lastError = null;

  // 1. Try Gemini if configured (fast and highly accurate with audio)
  if (settings?.gemini_api_key) {
    try {
      const model = settings.gemini_model || 'gemini-3.5-flash';
      const prompt = `Transcribe the spoken audio accurately into clean, natural text for a daily journal (money expenses, meals, routine, time tracking).
Rules:
1. Pay special attention to numbers, currencies (e.g. ₹, rupees, rs), verbs (e.g. 'spent', 'paid', 'had', 'ate', 'bought'), and accounts (e.g. HDFC, UPI, Cash).
2. Strict rule: Do NOT repeat words or phrases multiple times. Do NOT output repetitive loops (like repeating words 3x-5x). If something is spoken once, transcribe it once.
3. Return ONLY the clean transcribed sentence without quotes, preamble, or conversational commentary.`;

      const payload = {
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: cleanMime,
                data: audio.base64Data
              }
            }
          ]
        }],
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.1
        }
      };

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.gemini_api_key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join(' ').trim();
        if (text) {
          return { ok: true, transcript: text, provider: 'gemini', model };
        }
      } else {
        lastError = data?.error?.message || `Gemini API error (${res.status})`;
      }
    } catch (err) {
      console.warn('Gemini audio transcription failed:', err.message);
      lastError = err.message;
    }
  }

  // 2. Try OpenAI Whisper if configured
  if (settings?.openai_api_key) {
    try {
      const buffer = Buffer.from(audio.base64Data, 'base64');
      const ext = (cleanMime.includes('wav')) ? 'wav' : (cleanMime.includes('mp3')) ? 'mp3' : 'webm';
      
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${ext}"\r\nContent-Type: ${cleanMime}\r\n\r\n`),
        buffer,
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.openai_api_key}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body
      });
      const data = await res.json();
      if (res.ok && data.text) {
        return { ok: true, transcript: data.text.trim(), provider: 'openai', model: 'whisper-1' };
      } else {
        lastError = data?.error?.message || `OpenAI Whisper API error (${res.status})`;
      }
    } catch (err) {
      console.warn('OpenAI Whisper transcription failed:', err.message);
      lastError = err.message;
    }
  }

  if (lastError) {
    return { ok: false, error: `Audio transcription error: ${lastError}` };
  }

  return {
    ok: false,
    error: 'No AI key (Gemini or OpenAI) configured for Direct Audio Transcription. Configure Gemini or OpenAI in AI Settings to enable Direct Audio recording.'
  };
}

/**
 * Quick diagnostic ping to test provider connection and API key validity
 */
async function testProviderConnection({ provider, apiKey, model }) {
  const startTime = Date.now();
  const testMessages = [{ role: 'user', content: 'Respond with exactly: Connection OK' }];
  try {
    let text;
    if (provider === 'anthropic') {
      text = await callAnthropic({ apiKey, model: model || 'claude-3-5-sonnet-20241022', messages: testMessages });
    } else if (provider === 'openai') {
      text = await callOpenAI({ apiKey, model: model || 'gpt-4o-mini', messages: testMessages });
    } else if (provider === 'gemini') {
      text = await callGemini({ apiKey, model: model || 'gemini-3.5-flash', messages: testMessages });
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }
    const latencyMs = Date.now() - startTime;
    return { ok: true, text, latencyMs, model: model || 'default' };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return { ok: false, error: err.message || 'Connection test failed', latencyMs };
  }
}

module.exports = { callAI, callAIMultimodal, testProviderConnection, transcribeAudio };

