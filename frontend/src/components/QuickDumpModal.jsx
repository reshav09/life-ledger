import React, { useState, useEffect } from 'react';
import { api, formatMoney, todayISO } from '../api';
import { useSpeechRecognition } from '../useSpeechRecognition';

export default function QuickDumpModal({ isOpen, onClose, onLogged }) {
  const [text, setText] = useState('');
  const [targetDate, setTargetDate] = useState(todayISO());
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState(null);
  const [parserType, setParserType] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const {
    isSupported,
    isListening,
    isLiveListening,
    isRecordingAudio,
    isTranscribing,
    recordingSeconds,
    interimTranscript,
    error: speechError,
    setError: setSpeechError,
    permissionBlocked,
    requestPermission,
    isNetworkBlocked,
    engineMode,
    setEngineMode,
    lang,
    setLang,
    startListening,
    stopListening,
    toggleListening
  } = useSpeechRecognition({ defaultLang: 'en-IN' });

  // Keyboard shortcut listener (ESC to close)
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        stopListening();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, stopListening]);

  // Clean state when modal opens / closes
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      setSpeechError(null);
    } else {
      stopListening();
    }
  }, [isOpen, setSpeechError, stopListening]);

  const handleVoiceToggle = () => {
    setError(null);
    if (!isSupported) {
      setError('Voice recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari.');
      return;
    }

    toggleListening({
      initialText: text,
      onUpdate: (updatedText) => {
        setText(updatedText);
      }
    });
  };

  const handleParse = async () => {
    if (!text.trim()) {
      setError('Please enter or speak a quick journal sentence first.');
      return;
    }

    setError(null);
    setIsParsing(true);
    setDraft(null);

    try {
      const res = await api.post('/ai/quick-dump', { text: text.trim(), date: targetDate });
      if (res.ok && res.draft) {
        setDraft(res.draft);
        setParserType(res.parsed_by || 'rules');
      } else {
        setError(res.error || 'Could not parse daily dump.');
      }
    } catch (err) {
      setError(err.message || 'Failed to parse text.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSaveAll = async () => {
    if (!draft) return;
    setIsSaving(true);
    setError(null);

    try {
      const promises = [];

      // 1. Log Transactions
      if (Array.isArray(draft.transactions) && draft.transactions.length > 0) {
        for (const tx of draft.transactions) {
          promises.push(
            api.post('/transactions', {
              account_id: tx.account_id,
              category_id: tx.category_id,
              amount: tx.amount,
              type: tx.type || 'expense',
              description: tx.description || 'Quick Log',
              txn_date: targetDate
            })
          );
        }
      }

      // 2. Log Food Entries
      if (Array.isArray(draft.food_entries) && draft.food_entries.length > 0) {
        for (const food of draft.food_entries) {
          const toNum = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));
          promises.push(
            api.post('/diet/food', {
              meal_type: food.meal_type || 'other',
              description: String(food.description || 'Meal').trim(),
              calories: toNum(food.calories),
              protein_g: toNum(food.protein_g),
              carbs_g: toNum(food.carbs_g),
              fat_g: toNum(food.fat_g),
              fiber_g: toNum(food.fiber_g),
              data_source: parserType === 'ai' ? 'ai_estimated' : 'user_confirmed',
              entry_date: targetDate
            })
          );
        }
      }

      // 3. Log Water Intake
      if (typeof draft.water_ml === 'number' && draft.water_ml > 0) {
        promises.push(
          api.post('/diet/water', {
            amount_ml: draft.water_ml,
            entry_date: targetDate
          })
        );
      }

      // 4. Log Routine Activities
      if (Array.isArray(draft.routine_logs) && draft.routine_logs.length > 0) {
        promises.push(
          api.post('/routine/logs', {
            log_date: targetDate,
            entries: draft.routine_logs.map((r) => ({
              activity_id: r.activity_id,
              hours: r.hours,
              notes: r.notes || ''
            }))
          })
        );
      }

      await Promise.all(promises);

      setSuccessMsg('✨ All items successfully logged across your ledgers!');
      setTimeout(() => {
        if (onLogged) onLogged();
        onClose();
        setText('');
        setDraft(null);
        setSuccessMsg(null);
      }, 1500);
    } catch (err) {
      setError(`Saving failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Item deletion / adjustment helpers
  const removeTransaction = (idx) => {
    setDraft({ ...draft, transactions: draft.transactions.filter((_, i) => i !== idx) });
  };

  const removeFood = (idx) => {
    setDraft({ ...draft, food_entries: draft.food_entries.filter((_, i) => i !== idx) });
  };

  const removeRoutine = (idx) => {
    setDraft({ ...draft, routine_logs: draft.routine_logs.filter((_, i) => i !== idx) });
  };

  const adjustWater = (delta) => {
    const current = draft.water_ml || 0;
    setDraft({ ...draft, water_ml: Math.max(0, current + delta) });
  };

  const adjustRoutineHours = (idx, delta) => {
    const logs = [...draft.routine_logs];
    logs[idx].hours = Math.max(0.25, Math.round((logs[idx].hours + delta) * 10) / 10);
    setDraft({ ...draft, routine_logs: logs });
  };

  if (!isOpen) return null;

  const hasItems = draft && (
    (draft.transactions && draft.transactions.length > 0) ||
    (draft.food_entries && draft.food_entries.length > 0) ||
    (draft.water_ml && draft.water_ml > 0) ||
    (draft.routine_logs && draft.routine_logs.length > 0)
  );

  return (
    <div
      className="quick-dump-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="quick-dump-modal-card">
        {/* Header */}
        <div className="quick-dump-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Daily Quick Log</h3>
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-soft)' }}>
                Speak or type once — AI routes across Money, Diet & Routine
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              style={{
                fontSize: 12,
                padding: '4px 8px',
                border: '1px solid var(--hairline)',
                borderRadius: 6,
                background: 'var(--paper-raised)',
                color: 'var(--ink)'
              }}
            />
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--ink-soft)',
                fontSize: 20,
                cursor: 'pointer',
                padding: '2px 6px'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="quick-dump-body">
          {/* Active Voice Listening Banner */}
          {isListening && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--rust)',
                animation: 'aiMsgFadeIn 0.25s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                <span className="voice-record-pulse" />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>
                      {isRecordingAudio
                        ? `Recording Audio (${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, '0')})`
                        : 'Live Voice Dictation…'}
                    </strong>
                    <div className="voice-waves">
                      <span className="voice-wave-bar" />
                      <span className="voice-wave-bar" />
                      <span className="voice-wave-bar" />
                      <span className="voice-wave-bar" />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                    {isRecordingAudio
                      ? 'Speak naturally, then click "Done" to transcribe'
                      : interimTranscript ? `“${interimTranscript}”` : 'Listening… speak clearly into your microphone'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {/* Mode / Language Select */}
                {!isRecordingAudio && (
                  <select
                    value={lang}
                    onChange={(e) => setLang(e.target.value)}
                    style={{
                      fontSize: 11,
                      padding: '3px 6px',
                      borderRadius: 4,
                      border: '1px solid var(--hairline)',
                      background: 'var(--paper)',
                      color: 'var(--ink)'
                    }}
                    title="Speech recognition language"
                  >
                    <option value="en-IN">English (India)</option>
                    <option value="en-US">English (US)</option>
                    <option value="en-GB">English (UK)</option>
                    <option value="hi-IN">Hindi (हिंदी)</option>
                  </select>
                )}

                <button
                  type="button"
                  onClick={stopListening}
                  className="btn btn-sm"
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
                    background: 'var(--rust)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600
                  }}
                >
                  ✓ Done
                </button>
              </div>
            </div>
          )}

          {/* AI Audio Transcribing Banner */}
          {isTranscribing && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'var(--green-soft)',
                border: '1px solid var(--green)',
                color: 'var(--green)',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                animation: 'aiMsgFadeIn 0.25s ease'
              }}
            >
              <span style={{ fontSize: 16 }}>✨</span>
              <span>Transcribing your audio recording with AI…</span>
            </div>
          )}

          {/* Speech Error Banner */}
          {speechError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--rust)',
                color: 'var(--rust)',
                fontSize: 12.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🎙️⚠️</span>
                  <span>{speechError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSpeechError(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--rust)', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ✕
                </button>
              </div>

              {permissionBlocked && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    background: 'var(--paper-raised)',
                    border: '1px dashed var(--rust)',
                    fontSize: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--rust)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🔒 How to enable Microphone in Brave / Chrome / Edge:</span>
                  </div>
                  <div style={{ lineHeight: 1.5, color: 'var(--ink)' }}>
                    1. Look at your browser URL bar at the top (next to <code>http://localhost:5000</code>).<br />
                    2. Click the <strong>🎚️ (Tune / Sliders)</strong> or <strong>🔒 (Site Settings)</strong> icon.<br />
                    3. Turn the <strong>Microphone</strong> toggle to <strong>Allow (ON)</strong>.<br />
                    4. Tap the button below to prompt permissions.
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSpeechError(null);
                        requestPermission();
                      }}
                      className="btn btn-sm btn-primary"
                      style={{ fontSize: 11.5, padding: '4px 12px' }}
                    >
                      🎙️ Ask for Mic Permission
                    </button>
                  </div>
                </div>
              )}

              {isNetworkBlocked && engineMode !== 'audio_recorder' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEngineMode('audio_recorder');
                      setSpeechError(null);
                      startListening({ initialText: text, onUpdate: setText });
                    }}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11.5,
                      borderRadius: 4,
                      background: 'var(--navy)',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    🎙️ Record Direct Audio (AI Mic)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Text Input Area */}
          <div style={{ position: 'relative' }}>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Spent 150 on rapido from HDFC, had 4 boiled eggs and 2 roti with dal for lunch, 1.5h gym, 7h sleep, 2.5L water..."
              className="quick-dump-textarea"
              style={{
                borderColor: isListening ? 'var(--rust)' : 'var(--hairline)',
                boxShadow: isListening ? '0 0 0 2px rgba(239, 68, 68, 0.2)' : 'none'
              }}
            />

            {/* Mic / Voice Button */}
            <button
              type="button"
              onClick={handleVoiceToggle}
              className="quick-dump-mic-btn"
              title={isListening ? 'Stop listening' : 'Speak your daily log (Voice to text)'}
              style={{
                background: isListening ? 'var(--rust)' : 'var(--navy)',
                color: '#FFF',
                boxShadow: isListening ? '0 0 12px var(--rust)' : 'none'
              }}
            >
              {isListening ? '🛑' : '🎙️'}
            </button>
          </div>

          {/* Quick Example Suggestions & Mic Mode Selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 600 }}>QUICK SAMPLES:</span>
              {[
                'Spent 120 on rapido from HDFC, 1.5h gym, 7h sleep',
                'Had 4 eggs & toast for breakfast, 2L water, 8h work',
                'Spent 350 on Swiggy lunch, 2h study, 7.5h sleep'
              ].map((sample, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setText(sample)}
                  style={{
                    background: 'var(--paper)',
                    border: '1px solid var(--hairline)',
                    borderRadius: 14,
                    padding: '3px 9px',
                    fontSize: 11,
                    color: 'var(--ink-soft)',
                    cursor: 'pointer'
                  }}
                >
                  {sample.slice(0, 32)}…
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Mic:</span>
              <button
                type="button"
                onClick={() => {
                  const nextMode = engineMode === 'live' ? 'audio_recorder' : 'live';
                  setEngineMode(nextMode);
                  setSpeechError(null);
                }}
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 12,
                  border: '1px solid var(--hairline)',
                  background: engineMode === 'audio_recorder' ? 'var(--green-soft)' : 'var(--paper)',
                  color: engineMode === 'audio_recorder' ? 'var(--green)' : 'var(--ink-soft)',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
                title="Toggle between Live Browser Speech and Direct Audio Mic (AI / Brave / Adblock ready)"
              >
                {engineMode === 'audio_recorder' ? '🎙️ Direct AI Mic' : '⚡ Live Speech'}
              </button>
            </div>
          </div>

          {/* Parse Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={handleParse}
              disabled={isParsing || !text.trim()}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 600
              }}
            >
              {isParsing ? 'Extracting Data…' : '✨ Parse & Preview Draft'}
            </button>
          </div>

          {/* Error / Success Notifications */}
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 6, background: 'var(--rust-soft)', color: 'var(--rust)', fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}

          {successMsg && (
            <div style={{ padding: '10px 14px', borderRadius: 6, background: 'var(--green-soft)', color: 'var(--green)', fontSize: 13, fontWeight: 600 }}>
              {successMsg}
            </div>
          )}

          {/* Parsed Draft Interactive Preview Area */}
          {draft && (
            <div
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--hairline)',
                borderRadius: 8,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink)' }}>
                  Interactive Preview
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: parserType === 'ai' ? 'var(--green-soft)' : 'var(--brass-soft)',
                    color: parserType === 'ai' ? 'var(--green)' : 'var(--brass)'
                  }}
                >
                  {parserType === 'ai' ? '✨ Extracted via AI' : '⚡ Offline Rule Engine'}
                </span>
              </div>

              {!hasItems && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)' }}>
                  No recognizable money spends, meals, or workout hours found in text. Try mentioning amounts (e.g. ₹150 cab), meals (e.g. 4 eggs), or hours (e.g. 1.5h gym).
                </p>
              )}

              {/* Money Section */}
              {draft.transactions && draft.transactions.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6 }}>
                    💰 MONEY TRANSACTIONS ({draft.transactions.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {draft.transactions.map((tx, i) => (
                      <div
                        key={i}
                        style={{
                          background: 'var(--paper-raised)',
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: '1px solid var(--hairline)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, color: 'var(--rust)' }}>
                            {formatMoney(tx.amount)}
                          </span>
                          <span style={{ fontSize: 13 }}>{tx.description}</span>
                          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--paper)', color: 'var(--ink-soft)' }}>
                            {tx.category_name || 'Category'}
                          </span>
                          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--paper)', color: 'var(--ink-faint)' }}>
                            {tx.account_name || 'Account'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTransaction(i)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--rust)', cursor: 'pointer' }}
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Diet Food Section */}
              {draft.food_entries && draft.food_entries.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6 }}>
                    🥗 DIET & MEALS ({draft.food_entries.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {draft.food_entries.map((food, i) => (
                      <div
                        key={i}
                        style={{
                          background: 'var(--paper-raised)',
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: '1px solid var(--hairline)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, textTransform: 'capitalize', fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'var(--green-soft)', color: 'var(--green)' }}>
                            {food.meal_type}
                          </span>
                          <span style={{ fontSize: 13 }}>{food.description}</span>
                          {food.calories != null && (
                            <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                              ~{food.calories} kcal
                            </span>
                          )}
                          {food.protein_g != null && (
                            <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>
                              {food.protein_g}g P
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFood(i)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--rust)', cursor: 'pointer' }}
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Water Section */}
              {typeof draft.water_ml === 'number' && draft.water_ml > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6 }}>
                    💧 WATER INTAKE
                  </div>
                  <div
                    style={{
                      background: 'var(--paper-raised)',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--hairline)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#4285F4' }}>
                      {draft.water_ml} ml ({(draft.water_ml / 1000).toFixed(1)} L)
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => adjustWater(-250)}
                        style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--hairline)', background: 'var(--paper)', cursor: 'pointer' }}
                      >
                        -250ml
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustWater(+250)}
                        style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--hairline)', background: 'var(--paper)', cursor: 'pointer' }}
                      >
                        +250ml
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Routine Activities Section */}
              {draft.routine_logs && draft.routine_logs.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6 }}>
                    ⏱️ ROUTINE & TIME LOGS ({draft.routine_logs.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {draft.routine_logs.map((r, i) => (
                      <div
                        key={i}
                        style={{
                          background: 'var(--paper-raised)',
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: '1px solid var(--hairline)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{r.activity_name}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-raised)' }}>
                            {r.hours} hrs
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => adjustRoutineHours(i, -0.5)}
                            style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid var(--hairline)', background: 'var(--paper)', cursor: 'pointer' }}
                          >
                            -0.5h
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustRoutineHours(i, +0.5)}
                            style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid var(--hairline)', background: 'var(--paper)', cursor: 'pointer' }}
                          >
                            +0.5h
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRoutine(i)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--rust)', cursor: 'pointer', marginLeft: 4 }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 1-Tap Save All Button */}
              {hasItems && (
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: 14,
                    fontWeight: 700,
                    justifyContent: 'center',
                    marginTop: 6
                  }}
                >
                  {isSaving ? 'Logging to All Ledgers…' : '🚀 Confirm & Log Everything to Ledgers (1-Tap)'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
