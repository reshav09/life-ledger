import React, { useState } from 'react';
import { api, todayISO } from '../api.js';
import { useDialog } from './DialogProvider.jsx';

function formatTime(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

function formatDateLabel(dateStr) {
  const today = todayISO();
  const d = new Date(dateStr + 'T12:00:00');
  const dToday = new Date(today + 'T12:00:00');
  const diffDays = Math.round((d - dToday) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function WaterTrackerModal({
  isOpen,
  onClose,
  date = todayISO(),
  waterMl = 0,
  waterLogs = [],
  targetMl = 2500,
  onUpdated
}) {
  const { confirm } = useDialog();
  const [customAmount, setCustomAmount] = useState('250');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  if (!isOpen) return null;

  function showMsg(text) {
    setMsg(text);
    setTimeout(() => setMsg(null), 2500);
  }

  async function addWater(amount) {
    const ml = Number(amount || customAmount);
    if (!ml || ml <= 0 || isNaN(ml)) {
      setError('Please enter a valid water amount in ml');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post('/diet/water', { amount_ml: Math.round(ml), entry_date: date });
      showMsg(`💧 Added +${Math.round(ml)}ml water!`);
      if (onUpdated) await onUpdated();
    } catch (err) {
      setError(err.message || 'Failed to log water');
    } finally {
      setLoading(false);
    }
  }

  async function deleteSingleWaterLog(id) {
    if (!await confirm('Delete this water entry?', { ledger: 'food', danger: true })) return;
    setLoading(true);
    setError(null);
    try {
      await api.del(`/diet/water/${id}`);
      showMsg('Water entry deleted.');
      if (onUpdated) await onUpdated();
    } catch (err) {
      setError(err.message || 'Failed to delete water log');
    } finally {
      setLoading(false);
    }
  }

  async function clearAllWaterForDate() {
    if (!await confirm(`Delete all water logs for ${formatDateLabel(date)} (${date})? This will reset water to 0 ml.`, { ledger: 'food', danger: true })) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.del(`/diet/water?date=${date}`);
      showMsg(`🗑️ Reset all water logs for ${formatDateLabel(date)}.`);
      if (onUpdated) await onUpdated();
    } catch (err) {
      setError(err.message || 'Failed to clear water logs');
    } finally {
      setLoading(false);
    }
  }

  const percent = targetMl ? Math.min(Math.round((waterMl / targetMl) * 100), 150) : 0;
  const isTargetMet = targetMl ? waterMl >= targetMl : false;

  return (
    <div
      className="quick-dump-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="quick-dump-modal-card" style={{ maxWidth: 520 }}>
        {/* Header */}
        <div className="quick-dump-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>💧</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Water Intake Manager</h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-soft)' }}>
                {formatDateLabel(date)} · {date}
              </p>
            </div>
          </div>
          <button
            type="button"
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

        {/* Body */}
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Notifications */}
          {error && (
            <div style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--rust-soft)', color: 'var(--rust)', fontSize: 12.5 }}>
              ⚠️ {error}
            </div>
          )}
          {msg && (
            <div style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--green-soft)', color: 'var(--green)', fontSize: 12.5, fontWeight: 600 }}>
              ✨ {msg}
            </div>
          )}

          {/* Current Total & Progress */}
          <div style={{ background: 'var(--paper)', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--hairline)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Total Consumed</span>
                <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-mono)', color: isTargetMet ? 'var(--green)' : '#326CE5' }}>
                  {waterMl} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-soft)' }}>ml ({fmtLiters(waterMl)} L)</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Target</span>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
                  {targetMl} ml <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>({fmtLiters(targetMl)} L)</span>
                </div>
              </div>
            </div>

            <div className="progress-track" style={{ height: 10, background: 'var(--hairline)' }}>
              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(percent, 100)}%`,
                  background: isTargetMet ? 'var(--green)' : '#326CE5',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 4 }}>
              <span>{percent}% of daily goal</span>
              <span>{isTargetMet ? '🎉 Goal achieved!' : `${Math.max(0, targetMl - waterMl)} ml remaining`}</span>
            </div>
          </div>

          {/* 1-Tap Quick Add Buttons */}
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', marginBottom: 8 }}>
              ⚡ 1-Tap Quick Add:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => addWater(250)}
                disabled={loading}
                style={{ background: 'var(--paper)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px', gap: 2 }}
              >
                <span style={{ fontSize: 18 }}>🥛</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>+250 ml</span>
                <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>Glass</span>
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => addWater(500)}
                disabled={loading}
                style={{ background: 'var(--paper)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px', gap: 2 }}
              >
                <span style={{ fontSize: 18 }}>🍶</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>+500 ml</span>
                <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>Bottle</span>
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => addWater(1000)}
                disabled={loading}
                style={{ background: 'var(--paper)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px', gap: 2 }}
              >
                <span style={{ fontSize: 18 }}>💧</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>+1000 ml</span>
                <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>1 Liter</span>
              </button>
            </div>
          </div>

          {/* Custom Add Row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              min="10"
              step="50"
              placeholder="e.g. 350"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              style={{
                flex: 1,
                padding: '7px 10px',
                border: '1px solid var(--hairline)',
                borderRadius: 6,
                background: 'var(--paper)',
                color: 'var(--ink)',
                fontSize: 13.5
              }}
            />
            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>ml</span>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => addWater(customAmount)}
              disabled={loading || !customAmount}
              style={{ padding: '7px 14px' }}
            >
              + Log
            </button>
          </div>

          {/* History / Logged Entries List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
                📋 Logged Entries ({waterLogs.length})
              </span>
              {waterLogs.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllWaterForDate}
                  disabled={loading}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--rust)',
                    fontSize: 11.5,
                    cursor: 'pointer',
                    fontWeight: 600,
                    textDecoration: 'underline'
                  }}
                  title="Delete all water entries for this date"
                >
                  🗑️ Reset All ({formatDateLabel(date)})
                </button>
              )}
            </div>

            {waterLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '14px', background: 'var(--paper)', borderRadius: 6, border: '1px dashed var(--hairline)', color: 'var(--ink-faint)', fontSize: 12.5 }}>
                No water entries logged for this date.
              </div>
            ) : (
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {waterLogs.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--paper)',
                      padding: '7px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--hairline)',
                      fontSize: 13
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>💧</span>
                      <strong style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>+{entry.amount_ml} ml</strong>
                      {entry.created_at && (
                        <span style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
                          at {formatTime(entry.created_at)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteSingleWaterLog(entry.id)}
                      disabled={loading}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--rust)',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: 13,
                        fontWeight: 700
                      }}
                      title="Delete this water entry"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--hairline)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function fmtLiters(ml) {
  return ((Number(ml) || 0) / 1000).toFixed(1);
}
