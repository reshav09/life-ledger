import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from './api.js';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('ledger_theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      if (!localStorage.getItem('ledger_theme')) {
        api.get('/settings').then(res => {
          if (res?.theme && (res.theme === 'light' || res.theme === 'dark')) {
            setTheme(res.theme);
          }
        }).catch(() => {});
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('ledger_theme', theme); } catch { /* ignore */ }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      // Best-effort sync to backend settings so it's consistent if you ever
      // clear browser storage; failure here shouldn't block the toggle.
      api.post('/settings', { theme: next }).catch(() => {});
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
