import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const PROVIDERS = [
  { id: 'anthropic', label: 'Claude (Anthropic)', emoji: '🟣' },
  { id: 'openai', label: 'ChatGPT (OpenAI)', emoji: '🟢' },
  { id: 'gemini', label: 'Gemini (Google)', emoji: '🔵' }
];

const SUGGESTED_QUESTIONS = [
  { text: 'What should I eat today?', icon: '🍽️' },
  { text: 'How much protein did I consume this week?', icon: '📊' },
  { text: 'What should I eat before my gym session today?', icon: '🏋️' },
  { text: 'How much have I spent on gym-related things?', icon: '💰' },
  { text: 'Can I afford to buy protein this month?', icon: '🛒' },
  { text: 'Why is my weight changing?', icon: '⚖️' },
  { text: 'How am I doing compared with last month?', icon: '📈' },
  { text: 'Why have my recommendations changed?', icon: '🔄' }
];

const INSIGHT_TABS = [
  { kind: 'daily_analysis', label: 'Daily Analysis', icon: '📋' },
  { kind: 'weekly_insight', label: 'Weekly Insight', icon: '📊' },
  { kind: 'prediction', label: 'Predictions', icon: '🔮' },
  { kind: 'suggestion', label: 'Suggestions', icon: '💡' }
];

import FormattedAIContent from '../components/FormattedAIContent.jsx';
import { useSpeechRecognition } from '../useSpeechRecognition.js';
import { useDialog } from '../components/DialogProvider.jsx';

export default function AIAnalyzer() {
  const { confirm } = useDialog();
  const [settings, setSettings] = useState(null);
  const [availableModels, setAvailableModels] = useState({});
  const [keyInputs, setKeyInputs] = useState({ anthropic: '', openai: '', gemini: '' });
  const [modelInputs, setModelInputs] = useState({ anthropic: '', openai: '', gemini: '' });
  const [savingProvider, setSavingProvider] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [activeInsightTab, setActiveInsightTab] = useState('daily_analysis');
  const [insightResult, setInsightResult] = useState(null);
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [testingProvider, setTestingProvider] = useState('');
  const [testResults, setTestResults] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileMode, setFileMode] = useState('nutrition');
  const [filePrompt, setFilePrompt] = useState('');
  const [analyzingFile, setAnalyzingFile] = useState(false);
  const [fileAnalysisResult, setFileAnalysisResult] = useState(null);
  const chatBottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const {
    isSupported: isSpeechSupported,
    isListening: isSpeechListening,
    toggleListening: toggleSpeechListening,
    stopListening: stopSpeechListening
  } = useSpeechRecognition();

  const handleVoiceInput = () => {
    toggleSpeechListening({
      initialText: chatInput,
      onUpdate: (val) => setChatInput(val)
    });
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  async function load() {
    const [s, h, m] = await Promise.all([
      api.get('/ai/settings'),
      api.get('/ai/chat'),
      api.get('/ai/models').catch(() => ({}))
    ]);
    setSettings(s);
    setMessages(h);
    setAvailableModels(m);
    setModelInputs({ anthropic: s.anthropic.model, openai: s.openai.model, gemini: s.gemini.model });
  }

  async function saveKey(provider) {
    setSavingProvider(provider);
    try {
      const body = { [`${provider}_model`]: modelInputs[provider] };
      if (keyInputs[provider]) body[`${provider}_api_key`] = keyInputs[provider];
      const res = await api.put('/ai/settings', body);
      setKeyInputs({ ...keyInputs, [provider]: '' });
      await load();
      // Clear previous test result
      setTestResults((prev) => ({ ...prev, [provider]: null }));
    } finally {
      setSavingProvider('');
    }
  }

  async function testConnection(provider) {
    setTestingProvider(provider);
    setTestResults((prev) => ({ ...prev, [provider]: { loading: true } }));
    try {
      const res = await api.post('/ai/test-connection', {
        provider,
        apiKey: keyInputs[provider] || undefined,
        model: modelInputs[provider] || undefined
      });
      setTestResults((prev) => ({ ...prev, [provider]: res }));
    } catch (err) {
      setTestResults((prev) => ({ ...prev, [provider]: { ok: false, error: err.message || 'Test failed' } }));
    } finally {
      setTestingProvider('');
    }
  }

  async function removeKey(provider) {
    if (!await confirm(`Remove the saved ${provider} API key?`, { ledger: 'ai', danger: true })) return;
    await api.del(`/ai/settings/${provider}`);
    setTestResults((prev) => ({ ...prev, [provider]: null }));
    load();
  }

  async function activate(provider) {
    await api.put('/ai/settings', { active_provider: provider });
    load();
  }

  async function sendMessage(e, directText) {
    if (e) e.preventDefault();
    stopSpeechListening();
    const text = (directText || chatInput).trim();
    if (!text || sending) return;

    setChatInput('');
    const userMsgId = `temp-${Date.now()}`;
    setMessages((m) => [...m, { role: 'user', content: text, id: userMsgId }]);
    setSending(true);

    try {
      const res = await api.post('/ai/chat', { message: text });
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: res.reply,
          id: `temp-a-${Date.now()}`,
          provider_used: res.provider_used,
          model_used: res.model_used
        }
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: `Error: ${err.message || 'Request failed'}`,
          id: `temp-err-${Date.now()}`
        }
      ]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function clearChat() {
    if (!await confirm('Clear chat history?', { ledger: 'ai', danger: true })) return;
    await api.del('/ai/chat');
    setMessages([]);
  }

  async function copyToClipboard(text, id) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
    }
  }

  async function generateInsight() {
    setGeneratingInsight(true);
    setInsightResult(null);
    try {
      const res = await api.post('/ai/insights/generate', { kind: activeInsightTab });
      setInsightResult(res);
    } catch (e) {
      setInsightResult({ content: `Failed: ${e.message}`, source: 'error' });
    } finally {
      setGeneratingInsight(false);
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target.result.split(',')[1];
      setSelectedFile({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        base64
      });
      setFileAnalysisResult(null);
    };
    reader.readAsDataURL(file);
  }

  async function analyzeUploadedFile() {
    if (!selectedFile || analyzingFile) return;
    setAnalyzingFile(true);
    try {
      const res = await api.post('/ai/analyze-file', {
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileBase64: selectedFile.base64,
        userPrompt: filePrompt,
        mode: fileMode
      });
      setFileAnalysisResult(res);
    } catch (err) {
      setFileAnalysisResult({ reply: `Error: ${err.message || 'File analysis failed'}` });
    } finally {
      setAnalyzingFile(false);
    }
  }

  function clearSelectedFile() {
    setSelectedFile(null);
    setFileAnalysisResult(null);
    setFilePrompt('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  if (!settings) return <div className="empty-state">Loading AI workspace…</div>;

  const activeProviderObj = PROVIDERS.find((p) => p.id === settings.active_provider);

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Personal AI Intelligence Layer</div>
        <h1 className="page-title">AI Analyzer</h1>
        <p className="page-sub">
          Ask questions across your entire ledger. AI reads a controlled, structured context of your health, food, schedule, and gym finances — never your raw database.
        </p>
      </div>

      {/* ---- Insights Section ---- */}
      <div className="ai-glass-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="section-title" style={{ margin: 0 }}>
            ✨ On-Demand Analysis &amp; Predictions
          </div>
          {settings.active_provider ? (
            <div className="ai-header-status">
              <span className="ai-pulse-dot" />
              <span>{activeProviderObj?.emoji} {activeProviderObj?.label.split(' ')[0]} active</span>
            </div>
          ) : (
            <span className="badge brass">Rule-based mode</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {INSIGHT_TABS.map((tab) => (
            <button
              key={tab.kind}
              type="button"
              className="ai-suggest-chip"
              onClick={() => { setActiveInsightTab(tab.kind); setInsightResult(null); }}
              style={{
                background: activeInsightTab === tab.kind ? 'var(--green)' : 'var(--paper-hover)',
                color: activeInsightTab === tab.kind ? '#FFFFFF' : 'var(--ink)',
                borderColor: activeInsightTab === tab.kind ? 'var(--green)' : 'var(--hairline)'
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <button className="btn btn-primary" onClick={generateInsight} disabled={generatingInsight}>
          {generatingInsight ? 'Generating analysis…' : `Generate ${INSIGHT_TABS.find((t) => t.kind === activeInsightTab)?.label}`}
        </button>

        {insightResult && (
          <div className="ai-insight-box">
            <FormattedAIContent content={insightResult.content} />
            {insightResult.source && insightResult.source !== 'error' && (
              <div
                className="ai-insight-badge"
                style={{
                  background: insightResult.source === 'ai' ? 'var(--green-soft)' : 'var(--brass-soft)',
                  color: insightResult.source === 'ai' ? 'var(--green)' : 'var(--brass)'
                }}
              >
                {insightResult.source === 'ai'
                  ? `AI Enhanced (${insightResult.provider_used || settings.active_provider})`
                  : 'Deterministic Rule Analysis'}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="two-col">
        <div>
          {/* ---- Chat Section ---- */}
          <div className="ai-glass-card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="section-title" style={{ margin: 0 }}>
                💬 Chat with your data
              </div>
              {messages.length > 0 && (
                <button className="icon-btn" onClick={clearChat} style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                  Clear history
                </button>
              )}
            </div>

            {/* Message Viewport */}
            <div className="ai-chat-viewport">
              {messages.length === 0 ? (
                <div className="empty-state" style={{ padding: '36px 16px' }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🤖</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Ask anything about your data</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                    Click any suggested question below or ask a custom question about your food, routine, gym, or budget.
                  </div>
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`ai-msg-row ${m.role === 'user' ? 'user' : 'assistant'}`}>
                    {m.role === 'user' ? (
                      <div className="ai-bubble-user">
                        {m.content}
                      </div>
                    ) : (
                      <div className="ai-bubble-assistant">
                        <div className="ai-bubble-header">
                          <span className="ai-bubble-tag">
                            <span>🤖</span>
                            <span>{m.provider_used || settings.active_provider || 'Assistant'}</span>
                          </span>
                          <button
                            type="button"
                            className="ai-copy-btn"
                            onClick={() => copyToClipboard(m.content, m.id)}
                            title="Copy to clipboard"
                          >
                            {copiedId === m.id ? 'Copied ✓' : 'Copy'}
                          </button>
                        </div>
                        <FormattedAIContent content={m.content} />
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Animated typing indicator while awaiting reply */}
              {sending && (
                <div className="ai-msg-row assistant">
                  <div className="ai-typing-box">
                    <span style={{ fontSize: 14 }}>🤖</span>
                    <span>Analyzing your ledger context</span>
                    <div className="ai-typing-dots">
                      <span className="ai-typing-dot" />
                      <span className="ai-typing-dot" />
                      <span className="ai-typing-dot" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Toggleable Suggested Prompt Chips */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showSuggestions ? 8 : 0 }}>
                <button
                  type="button"
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  style={{
                    background: showSuggestions ? 'var(--green-soft)' : 'var(--paper-hover)',
                    border: '1px solid ' + (showSuggestions ? 'var(--green)' : 'var(--hairline)'),
                    color: showSuggestions ? 'var(--green)' : 'var(--ink-soft)',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    padding: '5px 12px',
                    borderRadius: 20,
                    transition: 'all 0.2s ease'
                  }}
                  title={showSuggestions ? 'Hide suggested questions' : 'Show suggested questions'}
                >
                  <span>💡 Suggested questions</span>
                  <span style={{ fontSize: 10, transition: 'transform 0.2s ease', transform: showSuggestions ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                </button>
                {showSuggestions && (
                  <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Tap any question to ask immediately</span>
                )}
              </div>

              {showSuggestions && (
                <div className="ai-chips-wrap" style={{ marginTop: 8, animation: 'aiMsgFadeIn 0.25s ease' }}>
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q.text}
                      type="button"
                      className="ai-suggest-chip"
                      onClick={() => sendMessage(null, q.text)}
                      disabled={sending || !settings.active_provider}
                      title="Click to ask this question immediately"
                    >
                      <span>{q.icon}</span>
                      <span>{q.text}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Modern Search/Prompt Input Bar */}
            <form onSubmit={sendMessage} className="ai-prompt-container">
              <div className="ai-prompt-bar">
                <span className="ai-prompt-icon">🪄</span>
                <input
                  ref={inputRef}
                  className="ai-prompt-input"
                  placeholder={settings.active_provider ? "Ask a question about your food, routine, gym, or budget…" : "Configure an API key on the right to start chatting…"}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending || !settings.active_provider}
                />
                <div className="ai-prompt-actions">
                  {isSpeechSupported && (
                    <button
                      type="button"
                      className={`ai-mic-btn ${isSpeechListening ? 'listening' : ''}`}
                      onClick={handleVoiceInput}
                      title={isSpeechListening ? "Stop listening" : "Speak to AI (Voice to text)"}
                      aria-label="Voice input"
                    >
                      {isSpeechListening ? '🛑' : '🎙️'}
                    </button>
                  )}
                  <button
                    type="submit"
                    className="ai-send-btn"
                    disabled={sending || !chatInput.trim() || !settings.active_provider}
                    title="Send (Enter)"
                    aria-label="Send message"
                  >
                    ➔
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* ---- Document & Image AI Analyzer Card ---- */}
          <div className="ai-glass-card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="section-title" style={{ margin: 0 }}>
                📄 Document &amp; Image AI Analyzer
              </div>
              <span className="badge green" style={{ fontSize: 11 }}>PDF · Image · Sheets · Docx</span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 0, marginBottom: 14 }}>
              Upload meal photos, blood test reports, diet plan PDFs, spreadsheets, or doctor prescriptions for intelligent AI extraction and cross-ledger analysis.
            </p>

            {/* Mode selection tabs */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {[
                { id: 'nutrition', label: 'Meal & Nutrition', icon: '🍽️' },
                { id: 'health_report', label: 'Lab & Health Report', icon: '🩺' },
                { id: 'general', label: 'Diet & Routine Doc', icon: '📋' }
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="ai-suggest-chip"
                  onClick={() => setFileMode(m.id)}
                  style={{
                    background: fileMode === m.id ? 'var(--green)' : 'var(--paper-hover)',
                    color: fileMode === m.id ? '#FFFFFF' : 'var(--ink)',
                    borderColor: fileMode === m.id ? 'var(--green)' : 'var(--hairline)'
                  }}
                >
                  <span>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            {/* Hidden native input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.docx,.txt"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />

            {!selectedFile ? (
              <div className="ai-file-dropzone" onClick={() => fileInputRef.current?.click()}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>📤</div>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', marginBottom: 2 }}>
                  Click to choose or drag &amp; drop file
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                  Supports PDF, PNG, JPG, WEBP, CSV, XLSX, DOCX, TXT (up to 10MB)
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="ai-file-preview-pill">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                    <span style={{ fontSize: 24 }}>
                      {selectedFile.type.includes('image') ? '🖼️' : selectedFile.type.includes('pdf') ? '📕' : selectedFile.name.endsWith('.csv') || selectedFile.name.endsWith('.xlsx') ? '📊' : '📄'}
                    </span>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {selectedFile.name}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
                        {(selectedFile.size / 1024).toFixed(1)} KB · {selectedFile.type || 'Document'}
                      </div>
                    </div>
                  </div>
                  <button className="icon-btn" onClick={clearSelectedFile} title="Remove file" style={{ fontSize: 14 }}>✕</button>
                </div>

                <div className="field" style={{ margin: 0 }}>
                  <input
                    placeholder="Custom instructions (optional e.g., 'Extract calorie and macro totals' or 'List out-of-range markers')..."
                    value={filePrompt}
                    onChange={(e) => setFilePrompt(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                </div>

                <button
                  className="btn btn-primary"
                  onClick={analyzeUploadedFile}
                  disabled={analyzingFile || !settings.active_provider}
                  style={{ justifyContent: 'center' }}
                >
                  {analyzingFile ? 'Analyzing document…' : '✨ Analyze File with AI'}
                </button>
              </div>
            )}

            {analyzingFile && (
              <div style={{ marginTop: 14 }}>
                <div className="ai-typing-box" style={{ width: '100%' }}>
                  <span style={{ fontSize: 14 }}>🔍</span>
                  <span>Scanning and extracting data from {selectedFile?.name}...</span>
                  <div className="ai-typing-dots">
                    <span className="ai-typing-dot" />
                    <span className="ai-typing-dot" />
                    <span className="ai-typing-dot" />
                  </div>
                </div>
              </div>
            )}

            {fileAnalysisResult && (
              <div className="ai-insight-box" style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '1px dashed var(--hairline)' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>
                    📄 Analysis of {fileAnalysisResult.fileName || selectedFile?.name}
                  </span>
                  <button
                    type="button"
                    className="ai-copy-btn"
                    onClick={() => copyToClipboard(fileAnalysisResult.reply, 'file-res')}
                  >
                    {copiedId === 'file-res' ? 'Copied ✓' : 'Copy'}
                  </button>
                </div>
                <FormattedAIContent content={fileAnalysisResult.reply} />
                {fileAnalysisResult.provider_used && (
                  <div className="ai-insight-badge" style={{ marginTop: 10, background: 'var(--green-soft)', color: 'var(--green)' }}>
                    Processed with {fileAnalysisResult.provider_used} ({fileAnalysisResult.model_used || 'Active model'})
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          {/* ---- Provider Configuration Card ---- */}
          <div className="ai-glass-card">
            <div className="section-title">AI Provider Keys</div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 0 }}>
              Keys are stored securely in your local database and never logged or exposed. Select an active provider to enable live AI responses.
            </p>
            {PROVIDERS.map((p) => {
              const models = availableModels[p.id] || [];
              const isConfigured = settings[p.id]?.configured;
              const isActive = settings.active_provider === p.id;

              return (
                <div key={p.id} style={{ marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid var(--hairline)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <strong style={{ fontSize: 14 }}>{p.emoji} {p.label}</strong>
                    {isConfigured && (
                      isActive ? (
                        <span className="ai-header-status">
                          <span className="ai-pulse-dot" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <button className="btn btn-sm" onClick={() => activate(p.id)}>Use this provider</button>
                      )
                    )}
                  </div>
                  <div className="field" style={{ marginBottom: 10 }}>
                    <label>API Key {isConfigured && '(Saved — leave blank to keep)'}</label>
                    <input
                      type="password"
                      placeholder={isConfigured ? '••••••••••••••••' : 'Paste API key'}
                      value={keyInputs[p.id]}
                      onChange={(e) => setKeyInputs({ ...keyInputs, [p.id]: e.target.value })}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 10 }}>
                    <label>Model</label>
                    {models.length > 0 ? (
                      <select
                        value={models.some((m) => m.id === modelInputs[p.id]) ? modelInputs[p.id] : '_custom'}
                        onChange={(e) => {
                          if (e.target.value !== '_custom') setModelInputs({ ...modelInputs, [p.id]: e.target.value });
                        }}
                      >
                        {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                        {!models.some((m) => m.id === modelInputs[p.id]) && (
                          <option value="_custom">Custom: {modelInputs[p.id]}</option>
                        )}
                        <option value="_custom">— or type custom model ID —</option>
                      </select>
                    ) : (
                      <input
                        value={modelInputs[p.id]}
                        onChange={(e) => setModelInputs({ ...modelInputs, [p.id]: e.target.value })}
                        placeholder="model ID"
                      />
                    )}
                    {models.length > 0 && !models.some((m) => m.id === modelInputs[p.id]) && (
                      <input
                        style={{ marginTop: 6 }}
                        placeholder="Type custom model ID"
                        value={modelInputs[p.id]}
                        onChange={(e) => setModelInputs({ ...modelInputs, [p.id]: e.target.value })}
                      />
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button className="btn btn-sm btn-primary" onClick={() => saveKey(p.id)} disabled={savingProvider === p.id}>
                      {savingProvider === p.id ? 'Saving…' : 'Save'}
                    </button>
                    {(isConfigured || keyInputs[p.id]) && (
                      <button
                        className="btn btn-sm"
                        onClick={() => testConnection(p.id)}
                        disabled={testingProvider === p.id}
                        title="Test if the API key and selected model work"
                      >
                        {testingProvider === p.id ? 'Testing…' : '⚡ Test Connection'}
                      </button>
                    )}
                    {isConfigured && <button className="btn btn-sm" onClick={() => removeKey(p.id)}>Remove key</button>}
                  </div>

                  {testResults[p.id] && (
                    <div style={{ marginTop: 10 }}>
                      {testResults[p.id].loading ? (
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Testing API connection...</div>
                      ) : testResults[p.id].ok ? (
                        <div
                          style={{
                            fontSize: 12,
                            padding: '6px 10px',
                            background: 'var(--green-soft)',
                            color: 'var(--green)',
                            borderRadius: 6,
                            border: '1px solid var(--green)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <span>✓</span>
                          <span><strong>Connected!</strong> Model active ({testResults[p.id].latencyMs}ms)</span>
                        </div>
                      ) : (
                        <div
                          style={{
                            fontSize: 12,
                            padding: '6px 10px',
                            background: 'var(--rust-soft)',
                            color: 'var(--rust)',
                            borderRadius: 6,
                            border: '1px solid var(--rust)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>✕ Connection Error:</div>
                          <div style={{ wordBreak: 'break-word' }}>{testResults[p.id].error}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
