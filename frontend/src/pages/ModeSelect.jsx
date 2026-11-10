import { useNavigate } from 'react-router-dom';
import { useAppMode } from '../AppContext.jsx';

export default function ModeSelect() {
  const { setMode } = useAppMode();
  const navigate = useNavigate();

  function chooseMode(m) {
    setMode(m);
    navigate('/');
  }

  return (
    <div className="mode-select-shell">
      <div className="mode-select-inner">
        <div className="mode-select-brand">Ledger</div>
        <div className="mode-select-sub">Your universal personal tracker</div>

        <div className="mode-select-cards">
          <button className="mode-card" onClick={() => chooseMode('money')}>
            <div className="mode-card-icon">💰</div>
            <div className="mode-card-title">Money Ledger</div>
            <div className="mode-card-desc">Track every rupee — accounts, budgets, transactions, savings, and loans</div>
            <div className="mode-card-cta">Open →</div>
          </button>

          <button className="mode-card" onClick={() => chooseMode('routine')}>
            <div className="mode-card-icon">⏱️</div>
            <div className="mode-card-title">Routine & Schedule</div>
            <div className="mode-card-desc">Own your 24 hours — daily routine, time tracking, and deep work blocks</div>
            <div className="mode-card-cta">Open →</div>
          </button>

          <button className="mode-card" onClick={() => chooseMode('diet')}>
            <div className="mode-card-icon">🥗</div>
            <div className="mode-card-title">Diet & Health</div>
            <div className="mode-card-desc">Food, fitness & health intelligence — meals, weight, gym, and reports</div>
            <div className="mode-card-cta">Open →</div>
          </button>

          <button className="mode-card" onClick={() => chooseMode('jobhunt')}>
            <div className="mode-card-icon">🎯</div>
            <div className="mode-card-title">Job Hunt</div>
            <div className="mode-card-desc">Your opportunity radar — organization registry, eligibility scoring, and application pipeline</div>
            <div className="mode-card-cta">Open →</div>
          </button>
        </div>

        <div className="mode-select-note">
          Choose what you'd like to manage right now. You can switch anytime after logging in.
        </div>
      </div>
    </div>
  );
}
