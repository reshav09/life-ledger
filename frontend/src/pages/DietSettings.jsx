import { Link } from 'react-router-dom';
import { useTheme } from '../ThemeContext.jsx';
import BackupSection from '../components/BackupSection.jsx';

export default function DietSettings() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Diet & Health Preferences</div>
        <h1 className="page-title">Diet & Health Settings</h1>
        <p className="page-sub">Appearance is shared across every ledger — customize display modes, nutritional baselines, and database backups.</p>
      </div>

      {/* Top 2-column balanced section */}
      <div className="two-col" style={{ gridTemplateColumns: '1.08fr 1fr', marginBottom: 20 }}>
        {/* Left column */}
        <div>
          {/* Appearance card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Appearance</div>
            <div className="theme-toggle-row">
              <span style={{ fontSize: 13.5 }}>{theme === 'dark' ? '🌙 Dark mode (Default)' : '☀️ Light mode'}</span>
              <button className={`theme-switch ${theme === 'dark' ? 'on' : ''}`} onClick={toggleTheme} aria-label="Toggle dark mode" />
            </div>
          </div>

          {/* Nutritional Guidelines Card */}
          <div className="card">
            <div className="section-title">Nutritional Standards &amp; Metrics</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0, marginBottom: 12 }}>
              Default reference equations and macronutrient splits used across calculations:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--hairline)' }}>
                <span><strong>BMR Calculation</strong> (Mifflin-St Jeor formula)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>Standard</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--hairline)' }}>
                <span><strong>Protein Target</strong> (Strength &amp; muscle maintenance)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>1.6–2.0g/kg</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--hairline)' }}>
                <span><strong>Macronutrient Ratio</strong> (Carb / Protein / Fat)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>40 / 30 / 30%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                <span><strong>Daily Hydration Baseline</strong> (Water intake minimum)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>3.0 Litres</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* About this ledger card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">About Diet &amp; Health Ledger</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0, lineHeight: 1.5 }}>
              Diet &amp; Health is a personal decision-support system designed to monitor daily macronutrients, track body weight trajectories, and classify fitness-related expenditures.
            </p>
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--hairline)', fontSize: 12.5, color: 'var(--ink-soft)' }}>
              Weight milestones, target body fat percentages, and Gemini API keys are configured under <Link to="/health" style={{ color: 'var(--accent)', fontWeight: 600 }}>Health Profile</Link> and <Link to="/ai" style={{ color: 'var(--accent)', fontWeight: 600 }}>AI Analyzer</Link>.
            </div>
          </div>

          {/* Quick Links Card */}
          <div className="card">
            <div className="section-title">Diet Workspace Navigation</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0, marginBottom: 12 }}>
              Quick shortcuts across your complete nutrition and physical wellness system:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                { to: '/', icon: '📊', title: 'Dashboard', desc: 'Daily calories' },
                { to: '/diet-plan', icon: '🥗', title: 'Diet Plan', desc: 'Meal structure' },
                { to: '/food', icon: '🍽️', title: 'Food Log', desc: 'Meal tracking' },
                { to: '/health', icon: '⚖️', title: 'Health Profile', desc: 'Weight & goals' },
                { to: '/spending', icon: '💰', title: 'Spending', desc: 'Gym & nutrition' },
                { to: '/ai', icon: '🤖', title: 'AI Analyzer', desc: 'Insights & chat' },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: '7px',
                    background: 'var(--paper-hover)',
                    border: '1px solid var(--hairline)',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.background = 'var(--surface-muted)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--hairline)';
                    e.currentTarget.style.background = 'var(--paper-hover)';
                  }}
                >
                  <span style={{ fontSize: 15 }}>{link.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{link.title}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{link.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full-width Database Backups & Restore Section */}
      <BackupSection
        ledger="diet"
        title="Database Backups & Restore"
        description="Automatic weekly backups protect all your health measurements, diet logs, food entries, and goals alongside your other Life Ledgers. You can also trigger an instant backup or restore anytime."
      />
    </div>
  );
}
