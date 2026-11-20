import { useState } from 'react';

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      if (onSuccess) {
        onSuccess(data.expires_at);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="sanctuary-gateway-screen"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'radial-gradient(ellipse at 50% 25%, #151b28 0%, #080b11 100%)',
        color: '#e2e8f0',
        fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)'
      }}
    >
      <div
        className="sanctuary-floating-card anim-scale-in"
        style={{
          '--card-accent': '#8b5cf6',
          '--card-glow': 'rgba(139, 92, 246, 0.35)',
          width: '100%',
          maxWidth: 410,
          padding: '36px 32px',
          borderRadius: 24,
          background: 'rgba(13, 19, 29, 0.82)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 30px 70px -15px rgba(0, 0, 0, 0.75), 0 0 45px -5px rgba(139, 92, 246, 0.22)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div className="sanctuary-card-inner-view sanctuary-auth-view">
          {/* Card Header matching Sanctuary OS Domain View */}
          <div className="auth-card-header" style={{ marginBottom: 26 }}>
            <div>
              <span
                className="floating-card-category"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#a78bfa'
                }}
              >
                CAREER RADAR
              </span>
              <h1
                className="floating-card-title"
                style={{
                  margin: '4px 0 0',
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: '#ffffff'
                }}
              >
                Job Radar OS
              </h1>
              <div
                className="floating-card-tagline"
                style={{
                  color: '#94a3b8',
                  fontSize: 13,
                  marginTop: 4
                }}
              >
                Sign in to access your radar
              </div>
            </div>

            <div
              className="auth-domain-icon-bubble"
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'rgba(139, 92, 246, 0.12)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                boxShadow: '0 4px 14px rgba(139, 92, 246, 0.15)'
              }}
            >
              🎯
            </div>
          </div>

          {/* Authentication Form with Sanctuary Glass Inputs */}
          <form onSubmit={handleSubmit} className="auth-card-form" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="auth-field-group">
              <label className="auth-field-label">Username</label>
              <div className="auth-input-wrapper">
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="Enter username"
                  className="auth-glass-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="auth-field-group">
              <div className="auth-label-row">
                <label className="auth-field-label">Password</label>
                <button
                  type="button"
                  className="auth-show-pass-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="auth-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter password"
                  className="auth-glass-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="auth-error-banner">
                <span className="error-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="sanctuary-enter-btn auth-submit-btn"
              disabled={loading}
              style={{ marginTop: 8 }}
            >
              <span>{loading ? 'Authenticating…' : 'Unlock Workspace'}</span>
              <span className="btn-arrow">→</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
