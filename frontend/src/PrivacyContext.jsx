import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const PrivacyContext = createContext(null);

const MODE_KEY = 'ledger_privacy_hidden';
const REVEALED_KEY = 'ledger_privacy_revealed';

export function PrivacyProvider({ children }) {
  // hiddenMode is the master switch. Defaults to ON (blurred) so a fresh
  // session is always private-by-default, even before you've touched anything.
  const [hiddenMode, setHiddenMode] = useState(() => {
    try {
      return sessionStorage.getItem(MODE_KEY) !== 'false';
    } catch {
      return true;
    }
  });

  // Which individual amounts have been tapped open, Telegram-spoiler style.
  // Lives in sessionStorage so it survives page navigation but not a closed tab.
  const [revealed, setRevealed] = useState(() => {
    try {
      const stored = sessionStorage.getItem(REVEALED_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try { sessionStorage.setItem(MODE_KEY, String(hiddenMode)); } catch { /* ignore */ }
  }, [hiddenMode]);

  useEffect(() => {
    try { sessionStorage.setItem(REVEALED_KEY, JSON.stringify([...revealed])); } catch { /* ignore */ }
  }, [revealed]);

  const toggleReveal = useCallback((id) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleHiddenMode = useCallback(() => setHiddenMode((v) => !v), []);

  // Called on logout / session expiry so the next login starts fully hidden again.
  const resetPrivacy = useCallback(() => {
    setRevealed(new Set());
    setHiddenMode(true);
    try {
      sessionStorage.removeItem(REVEALED_KEY);
      sessionStorage.removeItem(MODE_KEY);
    } catch { /* ignore */ }
  }, []);

  return (
    <PrivacyContext.Provider value={{ hiddenMode, toggleHiddenMode, revealed, toggleReveal, resetPrivacy }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error('usePrivacy must be used within PrivacyProvider');
  return ctx;
}
