import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import { api, formatMoney } from '../api.js';
import PrivateAmount from '../components/PrivateAmount.jsx';
import { usePrivacy } from '../PrivacyContext.jsx';

export default function CategoryDetail() {
  const { id } = useParams();
  const { hiddenMode } = usePrivacy();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .get(`/categories/${id}/insights`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="empty-state">Loading…</div>;
  if (error) return <div className="empty-state">Could not load this category: {error}</div>;
  if (!data) return null;

  const { category, transactions, total, count, average, monthly } = data;

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow"><Link to="/charts" style={{ color: 'inherit' }}>← Back to charts</Link></div>
        <h1 className="page-title">{category.icon} {category.name}</h1>
        <p className="page-sub">Everything you've logged under this category — full history, trend, and your typical spend.</p>
      </div>

      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-label">Total spent</div>
          <div className="stat-value"><PrivateAmount id={`catdetail-${id}-total`}>{formatMoney(total)}</PrivateAmount></div>
          <div className="stat-note">Across {count} entr{count === 1 ? 'y' : 'ies'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Average per entry</div>
          <div className="stat-value"><PrivateAmount id={`catdetail-${id}-avg`}>{formatMoney(average)}</PrivateAmount></div>
          <div className="stat-note">e.g. your average {category.name.toLowerCase()} entry</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Entries logged</div>
          <div className="stat-value">{count}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title">Monthly trend</div>
        {monthly.length === 0 ? (
          <div className="empty-state">Not enough history yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fontFamily: 'IBM Plex Mono' }} />
              <YAxis tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
              <Tooltip formatter={(v) => (hiddenMode ? '•••••' : formatMoney(v))} />
              <Line type="monotone" dataKey="total" stroke={category.color || '#2F6F4E'} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="section-title">Full history</div>
      {transactions.length === 0 ? (
        <div className="card empty-state">Nothing logged under this category yet.</div>
      ) : (
        <div className="ledger">
          {transactions.map((t) => (
            <div className="ledger-row" key={t.id}>
              <div className="ledger-icon">{category.icon}</div>
              <div className="ledger-desc">
                <div className="ledger-title">{t.description || category.name}</div>
                <div className="ledger-meta">{t.account_name} · {new Date(t.txn_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              </div>
              <div className="ledger-leader" />
              <div className={`ledger-amount ${t.type}`}>
                <PrivateAmount id={`catdetail-txn-${t.id}`}>{t.type === 'expense' ? '−' : '+'}{formatMoney(t.amount)}</PrivateAmount>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
