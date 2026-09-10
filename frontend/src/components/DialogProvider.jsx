import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const DialogContext = createContext(null);

/**
 * Provides themed confirm/alert dialogs matching the app's dark UI.
 * 
 * Usage in any component:
 *   const { confirm, alert } = useDialog();
 *   const ok = await confirm('Delete this entry?', { ledger: 'food' });
 *   await alert('Something failed', { ledger: 'money' });
 * 
 * Ledger options: 'food', 'routine', 'money', 'health', 'ai', 'settings', 'general'
 */

const LEDGER_META = {
  food:     { label: '🍽️ Food Ledger',     color: 'var(--green)' },
  routine:  { label: '📋 Routine Ledger',   color: 'var(--brass)' },
  money:    { label: '💰 Money Ledger',     color: '#5B7FBA' },
  health:   { label: '🏥 Health Ledger',    color: '#D97757' },
  ai:       { label: '🤖 AI Analyzer',      color: '#7A6FB0' },
  settings: { label: '⚙️ Settings',         color: 'var(--ink-soft)' },
  general:  { label: '📒 Ledger',           color: 'var(--green)' },
};

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const confirm = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      setDialog({
        type: 'confirm',
        message,
        ledger: opts.ledger || 'general',
        confirmLabel: opts.confirmLabel || 'Confirm',
        cancelLabel: opts.cancelLabel || 'Cancel',
        danger: opts.danger ?? false,
        resolve,
      });
    });
  }, []);

  const alert = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      setDialog({
        type: 'alert',
        message,
        ledger: opts.ledger || 'general',
        confirmLabel: opts.confirmLabel || 'OK',
        resolve,
      });
    });
  }, []);

  function handleClose(result) {
    if (dialog?.resolve) dialog.resolve(result);
    setDialog(null);
  }

  useEffect(() => {
    if (!dialog) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        handleClose(dialog.type === 'confirm' ? false : undefined);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialog]);

  const meta = dialog ? (LEDGER_META[dialog.ledger] || LEDGER_META.general) : LEDGER_META.general;

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}

      {dialog && (
        <div
          className="dialog-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClose(dialog.type === 'confirm' ? false : undefined);
            }
          }}
        >
          <div className="dialog-card" role="alertdialog" aria-modal="true">
            {/* Header */}
            <div className="dialog-header" style={{ borderBottomColor: meta.color }}>
              <span className="dialog-ledger-label" style={{ color: meta.color }}>
                {meta.label} says
              </span>
            </div>

            {/* Body */}
            <div className="dialog-body">
              <p className="dialog-message">{dialog.message}</p>
            </div>

            {/* Actions */}
            <div className="dialog-actions">
              {dialog.type === 'confirm' && (
                <button
                  type="button"
                  className="btn dialog-btn-cancel"
                  onClick={() => handleClose(false)}
                  autoFocus={!dialog.danger}
                >
                  {dialog.cancelLabel}
                </button>
              )}
              <button
                type="button"
                className={`btn ${dialog.danger ? 'dialog-btn-danger' : 'dialog-btn-confirm'}`}
                onClick={() => handleClose(true)}
                autoFocus={dialog.type === 'alert' || dialog.danger}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within a <DialogProvider>');
  return ctx;
}
