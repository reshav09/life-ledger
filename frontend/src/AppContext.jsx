import { createContext, useContext, useState, useCallback } from 'react';

const AppModeContext = createContext(null);

const MODE_KEY = 'ledger_app_mode';

export function AppModeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    try {
      return sessionStorage.getItem(MODE_KEY) || null; // null = not yet chosen
    } catch {
      return null;
    }
  });

  const setMode = useCallback((m) => {
    setModeState(m);
    try { sessionStorage.setItem(MODE_KEY, m); } catch { /* ignore */ }
  }, []);

  const clearMode = useCallback(() => {
    setModeState(null);
    try { sessionStorage.removeItem(MODE_KEY); } catch { /* ignore */ }
  }, []);

  return (
    <AppModeContext.Provider value={{ mode, setMode, clearMode }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error('useAppMode must be used within AppModeProvider');
  return ctx;
}
