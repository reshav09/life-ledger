import { useState } from 'react';
import { useAppMode } from '../AppContext.jsx';

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { mode, clearMode } = useAppMode();

  async function submit(e) {
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
        setError(data.error || 'Login failed');
        return;
      }
      onSuccess(data.expires_at);
    } catch (err) {
      setError('Could not reach the server. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  const subtitle = mode === 'routine'
    ? 'Sign in to your routine & schedule tracker'
    : 'Sign in to your personal money tracker';

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">Ledger</div>
        <div className="login-sub">{subtitle}</div>
        <form onSubmit={submit}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Username</label>
            <input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 18 }}>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div style={{ color: 'var(--rust)', fontSize: 13, marginBottom: 14 }}>{error}</div>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="login-note">Session automatically ends after a few hours for safety.</div>
        <button className="login-back-btn" onClick={clearMode}>
          ← Back to mode selection
        </button>
      </div>
    </div>
  );
}
