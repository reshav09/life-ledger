import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import Login from './pages/Login.jsx';
import { setUnauthorizedHandler } from './api.js';
import { useTheme } from './ThemeContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// ── Lazy-loaded Job Hunt pages ──
const JobHuntDashboard = lazy(() => import('./pages/JobHuntDashboard.jsx'));
const Applications = lazy(() => import('./pages/Applications.jsx'));
const JobHuntApplicationWorkspace = lazy(() => import('./pages/JobHuntApplicationWorkspace.jsx'));
const JobHuntOpportunities = lazy(() => import('./pages/JobHuntOpportunities.jsx'));
const JobHuntOrgs = lazy(() => import('./pages/JobHuntOrgs.jsx'));
const JobHuntProfile = lazy(() => import('./pages/JobHuntProfile.jsx'));
const JobHuntPrep = lazy(() => import('./pages/JobHuntPrep.jsx'));
const JobHuntSettings = lazy(() => import('./pages/JobHuntSettings.jsx'));

const JOBHUNT_NAV = [
  { to: '/', label: 'Radar', num: '01', end: true },
  { to: '/applications', label: 'My Applications', num: '02' },
  { to: '/workspace', label: 'Workspace', num: '03' },
  { to: '/opportunities', label: 'Opportunities', num: '04' },
  { to: '/orgs', label: 'Organizations', num: '05' },
  { to: '/profile', label: 'My Profile', num: '06' },
  { to: '/prep', label: 'Prep Hub', num: '07' },
  { to: '/settings', label: 'Settings', num: '08' }
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
  const logoutTimerRef = useRef(null);
  const bezelRef = useRef(null);
  const mainRef = useRef(null);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Enforce zero scroll lock on window/body
  useEffect(() => {
    const enforceZeroScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
      if (document.documentElement.scrollTop !== 0) document.documentElement.scrollTop = 0;
      if (document.body.scrollTop !== 0) document.body.scrollTop = 0;
      if (bezelRef.current && bezelRef.current.scrollTop !== 0) bezelRef.current.scrollTop = 0;
    };

    window.addEventListener('scroll', enforceZeroScroll, { passive: true });
    const frameEl = bezelRef.current;
    if (frameEl) frameEl.addEventListener('scroll', enforceZeroScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', enforceZeroScroll);
      if (frameEl) frameEl.removeEventListener('scroll', enforceZeroScroll);
    };
  }, [authState]);

  // Reset viewport scroll to top on route transition
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [location.pathname]);

  const handleHeaderWheel = useCallback((e) => {
    if (mainRef.current) mainRef.current.scrollTop += e.deltaY;
  }, []);

  const goToLogin = useCallback(() => {
    setAuthState('out');
    setExpiresAt(null);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(goToLogin);
  }, [goToLogin]);

  useEffect(() => {
    checkStatus();
  }, []);

  // Live countdown ticker
  useEffect(() => {
    if (authState !== 'in' || !expiresAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [authState, expiresAt]);

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
    goToLogin();
    navigate('/');
  }

  if (authState === 'checking') {
    return (
      <div className="empty-state" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Connecting to Job Radar OS…
      </div>
    );
  }

  if (authState === 'out') {
    return <Login onSuccess={handleLoginSuccess} />;
  }

  const msLeft = expiresAt ? expiresAt - now : 0;

  return (
    <div
      className="sanctuary-outer-canvas sanctuary-app-canvas"
      style={{
        '--mode-accent': '#7c3aed',
        '--mode-glow': 'rgba(124, 58, 237, 0.35)'
      }}
    >
      <div className="sanctuary-blurred-backdrop" />

      <div ref={bezelRef} className="sanctuary-bezel-frame sanctuary-app-frame">
        <div className="sanctuary-bg-layer" />
        <div className="sanctuary-cabin-natural-warmth" />
        <div className="sanctuary-mist-layer" />
        <div className="sanctuary-vignette" />
        <div className="sanctuary-app-veil" />

        {/* Topbar: Brand, System Meta, Theme, Logout */}
        <header onWheel={handleHeaderWheel} className="sanctuary-topbar sanctuary-app-topbar anim-fade-down">
          <div
            className="sanctuary-brand"
            onClick={() => navigate('/')}
            title="Job Radar OS Dashboard"
            style={{ cursor: 'pointer' }}
          >
            <span className="sanctuary-logo">JOB RADAR</span>
            <span className="sanctuary-badge">CAREER INTELLIGENCE OS</span>
          </div>

          <div className="sanctuary-app-actions">
            {/* Session countdown */}
            <div className="sanctuary-action-pill session-pill" title={`Session expires in ${formatCountdown(msLeft)}`}>
              <span className="session-icon">⏳</span>
              <span className="session-text">{formatCountdown(msLeft)}</span>
            </div>

            {/* Logout button */}
            <button
              type="button"
              className="sanctuary-action-pill logout-pill"
              onClick={logout}
              title="Log Out of Job Radar"
            >
              <span className="action-pill-glyph">⎋</span>
              <span className="action-pill-label">Exit</span>
            </button>

            {/* Dark / Light Theme Toggle */}
            <button
              type="button"
              className={`sanctuary-action-pill theme-toggle-pill ${theme === 'dark' ? 'is-dark' : 'is-light'}`}
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle light or dark theme"
            >
              <span className="theme-toggle-glyph">{theme === 'dark' ? '🌙' : '☀️'}</span>
              <span className="action-pill-label">{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </header>

        {/* Sub-Navigation Pill Bar */}
        <nav onWheel={handleHeaderWheel} className="sanctuary-subnav-bar anim-fade-down" style={{ animationDelay: '0.06s' }}>
          <div className="subnav-pill-track">
            {JOBHUNT_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `subnav-pill ${isActive ? 'active' : ''}`}
              >
                <span className="subnav-pill-num">{item.num}</span>
                <span className="subnav-pill-label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Main Viewport */}
        <main ref={mainRef} className="sanctuary-main">
          <ErrorBoundary>
            <Suspense fallback={<div className="empty-state" style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading…</div>}>
              <div key={location.pathname} className="money-page-transition-wrapper">
                <Routes>
                  <Route path="/" element={<JobHuntDashboard />} />
                  <Route path="/applications" element={<Applications />} />
                  <Route path="/workspace" element={<JobHuntApplicationWorkspace />} />
                  <Route path="/opportunities" element={<JobHuntOpportunities />} />
                  <Route path="/orgs" element={<JobHuntOrgs />} />
                  <Route path="/profile" element={<JobHuntProfile />} />
                  <Route path="/prep" element={<JobHuntPrep />} />
                  <Route path="/settings" element={<JobHuntSettings />} />
                </Routes>
              </div>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
