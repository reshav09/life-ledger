import { useState } from 'react';

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'radial-gradient(ellipse at 50% 20%, #171d2b 0%, #0a0d14 100%)',
        color: '#e2e8f0',
        fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)'
      }}
    >
      <div
        className="card anim-scale-in"
        style={{
          width: '100%',
          maxWidth: 420,
          padding: '36px 32px',
          background: 'rgba(23, 29, 43, 0.75)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(124, 58, 237, 0.15)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 54,
              height: 54,
              borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.3), rgba(79, 70, 229, 0.15))',
              border: '1px solid rgba(124, 58, 237, 0.4)',
              fontSize: 26,
              marginBottom: 16
            }}
          >
            🎯
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: '#fff' }}>
            Job Radar OS
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-soft, #94a3b8)', marginTop: 6, lineHeight: 1.5 }}>
            Autonomous opportunity discovery, ATS ingestion, and algorithmic career matching.
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: 13,
              marginBottom: 18,
              textAlign: 'center'
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Username
            </label>
            <input
              type="text"
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 8,
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div className="field">
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 8,
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              width: '100%',
              padding: '12px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              border: 'none',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.2s',
              boxShadow: '0 4px 14px rgba(124, 58, 237, 0.4)'
            }}
          >
            {loading ? 'Authenticating…' : 'Unlock Workspace →'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11.5, color: '#64748b' }}>
          Configured with automated 12-hour background feeds & verified career scoring.
        </div>
      </div>
    </div>
  );
}
