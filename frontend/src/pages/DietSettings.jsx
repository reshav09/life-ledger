import { Link } from 'react-router-dom';
import { useTheme } from '../ThemeContext.jsx';

export default function DietSettings() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Preferences</div>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Appearance is shared across every ledger — change it here or in Money/Routine, it applies everywhere.</p>
      </div>

      <div className="two-col">
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Appearance</div>
            <div className="theme-toggle-row">
              <span style={{ fontSize: 13.5 }}>{theme === 'dark' ? '🌙 Dark mode' : '☀️ Light mode'}</span>
              <button className={`theme-switch ${theme === 'dark' ? 'on' : ''}`} onClick={toggleTheme} aria-label="Toggle dark mode" />
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">About this ledger</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              Diet &amp; Health is a personal decision-support tool, not a substitute for medical advice. Categories, targets,
              and AI provider keys live under <strong>Health Profile</strong> and <strong>AI Analyzer</strong> in the sidebar.
            </p>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Quick Links</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link to="/health" className="btn" style={{ textDecoration: 'none', justifyContent: 'flex-start' }}>
                ⚖️ Health Profile — weight, goals, measurements
              </Link>
              <Link to="/ai" className="btn" style={{ textDecoration: 'none', justifyContent: 'flex-start' }}>
                🤖 AI Analyzer — configure API keys, chat with data
              </Link>
              <Link to="/food" className="btn" style={{ textDecoration: 'none', justifyContent: 'flex-start' }}>
                🍽️ Food Log — daily meal tracking
              </Link>
              <Link to="/spending" className="btn" style={{ textDecoration: 'none', justifyContent: 'flex-start' }}>
                💰 Diet & Gym Spending — classify gym purchases
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="section-title">Data & Privacy</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
              All health, nutrition, and financial data stays on your local machine. AI requests send only a controlled context
              summary — never your raw database. API keys are stored locally and never logged or shown back in full.
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>
              Backups can be managed from the Money or Routine Settings page — they include Diet & Health data automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
