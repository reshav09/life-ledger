import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
// Login and ModeSelect are eagerly loaded (critical path — shown before anything else)
import Login from './pages/Login.jsx';
import ModeSelect from './pages/ModeSelect.jsx';
import { setUnauthorizedHandler } from './api.js';
import { usePrivacy } from './PrivacyContext.jsx';
import { useAppMode } from './AppContext.jsx';
import QuickDumpModal from './components/QuickDumpModal.jsx';

// ── Lazy-loaded pages (code-split per route) ──
// These only download when the user navigates to them, shrinking the initial bundle.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Accounts = lazy(() => import('./pages/Accounts.jsx'));
const Transactions = lazy(() => import('./pages/Transactions.jsx'));
const Budgets = lazy(() => import('./pages/Budgets.jsx'));
const ChartsPage = lazy(() => import('./pages/Charts.jsx'));
const Planner = lazy(() => import('./pages/Planner.jsx'));
const Savings = lazy(() => import('./pages/Savings.jsx'));
const Loans = lazy(() => import('./pages/Loans.jsx'));
const CategoryDetail = lazy(() => import('./pages/CategoryDetail.jsx'));
const SettingsPage = lazy(() => import('./pages/Settings.jsx'));
const RoutineToday = lazy(() => import('./pages/RoutineToday.jsx'));
const RoutineTemplate = lazy(() => import('./pages/RoutineTemplate.jsx'));
const TimeLog = lazy(() => import('./pages/TimeLog.jsx'));
const Applications = lazy(() => import('./pages/Applications.jsx'));
const DietDashboard = lazy(() => import('./pages/DietDashboard.jsx'));
const FoodLog = lazy(() => import('./pages/FoodLog.jsx'));
const HealthProfile = lazy(() => import('./pages/HealthProfile.jsx'));
const DietSpending = lazy(() => import('./pages/DietSpending.jsx'));
const AIAnalyzer = lazy(() => import('./pages/AIAnalyzer.jsx'));
const DietSettings = lazy(() => import('./pages/DietSettings.jsx'));
const CurrentDiet = lazy(() => import('./pages/CurrentDiet.jsx'));


const MONEY_NAV = [
  { to: '/', label: 'Dashboard', num: '01', end: true },
  { to: '/transactions', label: 'Transactions', num: '02' },
  { to: '/accounts', label: 'Accounts', num: '03' },
  { to: '/budgets', label: 'Budgets', num: '04' },
  { to: '/charts', label: 'Charts', num: '05' },
  { to: '/planner', label: 'Planner', num: '06' },
  { to: '/savings', label: 'Savings', num: '07' },
  { to: '/loans', label: 'Loans', num: '08' },
  { to: '/settings', label: 'Settings', num: '09' }
];

const ROUTINE_NAV = [
  { to: '/', label: 'Today', num: '01', end: true },
  { to: '/routine', label: 'My Routine', num: '02' },
  { to: '/timelog', label: 'Time Log', num: '03' },
  { to: '/applications', label: 'Applications', num: '04' },
  { to: '/settings', label: 'Settings', num: '05' }
];

const DIET_NAV = [
  { to: '/', label: 'Dashboard', num: '01', end: true },
  { to: '/diet-plan', label: 'Current Diet', num: '02' },
  { to: '/food', label: 'Food Log', num: '03' },
  { to: '/health', label: 'Health Profile', num: '04' },
  { to: '/spending', label: 'Diet & Gym Spending', num: '05' },
  { to: '/ai', label: 'AI Analyzer', num: '06' },
  { to: '/settings', label: 'Settings', num: '07' }
];

function formatCountdown(ms) {
  if (ms <= 0) return '0:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function App() {
  const [authState, setAuthState] = useState('checking'); // checking | in | out
  const [expiresAt, setExpiresAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [navOpen, setNavOpen] = useState(false);
  const [quickDumpOpen, setQuickDumpOpen] = useState(false);
  const logoutTimerRef = useRef(null);
  const { hiddenMode, toggleHiddenMode, resetPrivacy } = usePrivacy();
  const { mode, clearMode } = useAppMode();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  const goToLogin = useCallback(() => {
    setAuthState('out');
    setExpiresAt(null);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    resetPrivacy();
  }, [resetPrivacy]);

  useEffect(() => {
    setUnauthorizedHandler(goToLogin);
    checkStatus();
  }, [goToLogin]);

  useEffect(() => {
    if (authState !== 'in') return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [authState]);

  // Global Keyboard shortcuts: J / Alt+D -> Quick Dump modal; N -> Add Entry, / -> search (money mode).
  useEffect(() => {
    if (authState !== 'in') return;
    function handleKeyDown(e) {
      const tag = document.activeElement?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
      
      // Quick dump shortcut (Alt+D or Ctrl+J or pressing J when not typing)
      if ((e.altKey && (e.key === 'd' || e.key === 'D')) || (e.ctrlKey && (e.key === 'j' || e.key === 'J')) || (!isTyping && (e.key === 'j' || e.key === 'J'))) {
        e.preventDefault();
        setQuickDumpOpen((prev) => !prev);
        return;
      }

      if (isTyping) return;
      if (mode === 'money') {
        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          navigate('/transactions');
        } else if (e.key === '/') {
          e.preventDefault();
          navigate('/transactions?focus=search');
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authState, navigate, mode]);

  async function checkStatus() {
    try {
      const res = await fetch('/api/auth/status', { credentials: 'include' });
      const data = await res.json();
      if (data.authenticated) {
        handleLoginSuccess(data.expires_at);
      } else {
        setAuthState('out');
      }
    } catch {
      setAuthState('out');
    }
  }

  function handleLoginSuccess(expires_at) {
    setExpiresAt(expires_at);
    setAuthState('in');
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    const msLeft = expires_at - Date.now();
    logoutTimerRef.current = setTimeout(goToLogin, Math.max(msLeft, 0));
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    clearMode();
    navigate('/');
    goToLogin();
  }

  function openModeSwitcher() {
    clearMode();
    navigate('/');
  }

  if (authState === 'checking') {
    return <div className="empty-state" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading…</div>;
  }

  // Show mode selector if no mode chosen yet
  if (!mode) {
    return <ModeSelect />;
  }

  if (authState === 'out') {
    return <Login onSuccess={handleLoginSuccess} />;
  }

  const msLeft = expiresAt ? expiresAt - now : 0;
  const NAV = mode === 'routine' ? ROUTINE_NAV : mode === 'diet' ? DIET_NAV : MONEY_NAV;
  const isMoneyMode = mode === 'money';
  const isDietMode = mode === 'diet';

  const brandSub = isMoneyMode ? 'Personal Money Tracker' : isDietMode ? 'Diet & Health' : 'Routine & Schedule';
  const modeIcon = isMoneyMode ? '💰' : isDietMode ? '🥗' : '⏱️';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-topbar">
          <div className="sidebar-brand">
            Ledger
            <span>{brandSub}</span>
          </div>

          <div className="sidebar-mobile-actions">
            {isMoneyMode && (
              <button
                className="quick-btn"
                onClick={toggleHiddenMode}
                title={hiddenMode ? 'Amounts hidden — tap to show everything' : 'Amounts visible — tap to hide again'}
              >
                {hiddenMode ? '🙈' : '👁️'}
              </button>
            )}
            <button className="quick-btn" onClick={openModeSwitcher}
              title="Switch app">
              🔀
            </button>
            <button className="quick-btn" onClick={logout} title={`Log out (session ends in ${formatCountdown(msLeft)})`}>
              ⎋
            </button>
            <button className="quick-btn nav-toggle-btn" onClick={() => setNavOpen(!navOpen)} aria-label="Toggle menu">
              {navOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        <nav className={`sidebar-nav ${navOpen ? 'nav-open' : ''}`}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="sidebar-num">{item.num}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          Runs entirely on your laptop. Nothing leaves this machine.
          {isMoneyMode && (
            <div style={{ fontSize: 11, color: '#6E7A8A', marginTop: 6 }}>Press <b>N</b> to add an entry, <b>/</b> to search</div>
          )}
          {/* Mode switcher */}
          <button
            className="sidebar-mode-switch"
            onClick={openModeSwitcher}
            title="Switch to a different ledger"
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span>{modeIcon}</span>
              Switch app
            </span>
            <span>→</span>
          </button>
          {/* Privacy toggle (money mode only) */}
          {isMoneyMode && (
            <button
              className={`sidebar-privacy-toggle ${hiddenMode ? 'hidden' : 'visible'}`}
              onClick={toggleHiddenMode}
              title={hiddenMode ? 'Amounts are blurred — tap any to peek, or click here to show everything' : 'Amounts are fully visible — click here to blur them again'}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span className="dot" />
                {hiddenMode ? 'Amounts hidden' : 'Amounts visible'}
              </span>
              <span>{hiddenMode ? '🙈' : '👁️'}</span>
            </button>
          )}
          <div className="session-timer" style={{ marginTop: 8 }}>Session ends in {formatCountdown(msLeft)}</div>
          <button className="btn btn-sm" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }} onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <main className="main">
        <Suspense fallback={<div className="empty-state" style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading…</div>}>
        {isMoneyMode ? (
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/charts" element={<ChartsPage />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/savings" element={<Savings />} />
            <Route path="/loans" element={<Loans />} />
            <Route path="/category/:id" element={<CategoryDetail />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        ) : isDietMode ? (
          <Routes>
            <Route path="/" element={<DietDashboard />} />
            <Route path="/diet-plan" element={<CurrentDiet />} />
            <Route path="/food" element={<FoodLog />} />
            <Route path="/health" element={<HealthProfile />} />
            <Route path="/spending" element={<DietSpending />} />
            <Route path="/ai" element={<AIAnalyzer />} />
            <Route path="/settings" element={<DietSettings />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/" element={<RoutineToday />} />
            <Route path="/routine" element={<RoutineTemplate />} />
            <Route path="/timelog" element={<TimeLog />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        )}
        </Suspense>
      </main>

      {/* Unified Floating Quick Log Action Button (Both PC & Mobile) */}
      <button
        type="button"
        className="app-quick-log-fab"
        onClick={() => setQuickDumpOpen(true)}
        title="⚡ Quick Log (Voice & Text) — Press 'J'"
        aria-label="Open Daily Quick Log"
      >
        <span className="app-quick-log-fab-icon">⚡</span>
        <span className="app-quick-log-fab-text">Quick Log</span>
        <span className="app-quick-log-fab-shortcut">J</span>
      </button>

      <QuickDumpModal
        isOpen={quickDumpOpen}
        onClose={() => setQuickDumpOpen(false)}
        onLogged={() => {
          // Dispatch a custom event so active pages can refresh their data
          // without losing state (e.g. selected date)
          window.dispatchEvent(new CustomEvent('quick-log-saved'));
        }}
      />
    </div>
  );
}
