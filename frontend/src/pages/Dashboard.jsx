import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatMoney, thisMonth } from '../api.js';
import PrivateAmount from '../components/PrivateAmount.jsx';

const CARD_DEFS = {
  total_balance: {
    label: 'Total balance',
    render: (s) => (
      <>
        <div className="stat-label">Total balance</div>
        <div className="stat-value"><PrivateAmount id="dash-total-balance">{formatMoney(s.total_balance)}</PrivateAmount></div>
        <div className="stat-note">Across all active accounts</div>
      </>
    )
  },
  available_cash: {
    label: 'Available to spend',
    render: (s) => (
      <>
        <div className="stat-label">Available to spend</div>
        <div className="stat-value positive"><PrivateAmount id="dash-available-cash">{formatMoney(s.available_cash)}</PrivateAmount></div>
        <div className="stat-note">After keeping aside <PrivateAmount id="dash-reserve-cap">{formatMoney(s.reserve_cap)}</PrivateAmount> you said not to touch</div>
      </>
    )
  },
  safe_daily: {
    label: 'Safe to spend / day',
    render: (s) => (
      <>
        <div className="stat-label">Safe to spend / day</div>
        <div className="stat-value"><PrivateAmount id="dash-safe-daily">{formatMoney(s.safe_daily_spend)}</PrivateAmount></div>
        <div className="stat-note">
          {s.days_left_in_cycle ?? s.days_left_in_month} day{(s.days_left_in_cycle ?? s.days_left_in_month) === 1 ? '' : 's'} left {s.cycle_label || 'this month'}
        </div>
      </>
    )
  },
  spent_today: {
    label: 'Spent today',
    render: (s) => (
      <>
        <div className="stat-label">Spent today</div>
        <div className="stat-value negative"><PrivateAmount id="dash-spent-today">{formatMoney(s.spent_today)}</PrivateAmount></div>
        <div className="stat-note">Logged against today's date</div>
      </>
    )
  }
};

const DEFAULT_CARD_ORDER = ['total_balance', 'available_cash', 'safe_daily', 'spent_today'];

function loadCardPrefs() {
  try {
    const stored = JSON.parse(localStorage.getItem('ledger_dashboard_cards'));
    if (Array.isArray(stored) && stored.length) return stored;
  } catch { /* ignore */ }
  return DEFAULT_CARD_ORDER.map((id) => ({ id, visible: true }));
}

function saveCardPrefs(prefs) {
  try { localStorage.setItem('ledger_dashboard_cards', JSON.stringify(prefs)); } catch { /* ignore */ }
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [byCategory, setByCategory] = useState([]);
  const [compare, setCompare] = useState(null);
  const [upcomingBills, setUpcomingBills] = useState([]);
  const [budgetWarnings, setBudgetWarnings] = useState([]);
  const [cardPrefs, setCardPrefs] = useState(loadCardPrefs());
  const [customizing, setCustomizing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const month = thisMonth();
      const [s, r, sal, c, cmp, bills, budgets] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/transactions?limit=8'),
        api.get('/salary'),
        api.get('/dashboard/by-category'),
        api.get(`/dashboard/compare?month=${month}`),
        api.get('/reminders/upcoming'),
        api.get(`/budgets?month=${month}`)
      ]);
      setSummary(s);
      const combined = [
        ...r.map((t) => ({ kind: 'transaction', ...t })),
        ...sal.slice(0, 8).map((sEntry) => ({
          kind: 'salary',
          id: sEntry.id,
          type: 'income',
          amount: sEntry.amount,
          description: sEntry.label,
          txn_date: sEntry.received_on,
          account_name: sEntry.account_name,
          category_name: 'Salary',
          category_icon: '💰',
          category_color: '#2F6F4E'
        }))
      ]
        .sort((a, b) => new Date(b.txn_date) - new Date(a.txn_date))
        .slice(0, 8);
      setRecent(combined);
      setByCategory(c.slice(0, 5));
      setCompare(cmp);
      setUpcomingBills(bills);
      setBudgetWarnings(budgets.filter((b) => b.effective_amount > 0 && b.spent / b.effective_amount >= 0.8));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function moveCard(index, dir) {
    const next = [...cardPrefs];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setCardPrefs(next);
    saveCardPrefs(next);
  }

  function toggleCardVisible(index) {
    const next = [...cardPrefs];
    next[index] = { ...next[index], visible: !next[index].visible };
    setCardPrefs(next);
    saveCardPrefs(next);
  }

  if (loading) return <div className="empty-state">Loading your ledger…</div>;
  if (error) return <div className="empty-state">Could not load dashboard: {error}</div>;

  const overspending = summary.budget_total > 0 && summary.budget_remaining < 0;
  const topMover = compare?.deltas?.find((d) => d.previous_total > 0 && Math.abs(d.pct_change) >= 5);

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <h1 className="page-title">Today's Ledger</h1>
        <p className="page-sub">Every account, every rupee, one page. This is what you actually have to spend right now.</p>
      </div>

      {upcomingBills.length > 0 && (
        <div className="banner brass">
          <div className="banner-icon">🔔</div>
          <div>
            <div className="banner-title">
              {upcomingBills.length === 1 ? 'A bill is coming up' : `${upcomingBills.length} bills are coming up`}
            </div>
            <div className="banner-body">
              {upcomingBills.map((b, i) => (
                <span key={b.id}>
                  {i > 0 && ' · '}
                  {b.category_icon || '💳'} {b.name}{b.amount ? ` (${formatMoney(b.amount)})` : ''} — {b.days_until === 0 ? 'due today' : `due in ${b.days_until} day${b.days_until === 1 ? '' : 's'}`}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {budgetWarnings.length > 0 && (
        <div className={`banner ${budgetWarnings.some((b) => b.spent > b.effective_amount) ? 'rust' : 'brass'}`}>
          <div className="banner-icon">⚠️</div>
          <div>
            <div className="banner-title">
              {budgetWarnings.length === 1 ? '1 budget is close to its limit' : `${budgetWarnings.length} budgets are close to their limit`}
            </div>
            <div className="banner-body">
              {budgetWarnings.map((b, i) => (
                <span key={b.id}>
                  {i > 0 && ' · '}
                  {b.category_icon} {b.category_name} ({Math.round((b.spent / b.effective_amount) * 100)}%)
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {topMover && (
        <div className={`banner ${topMover.pct_change > 0 ? 'rust' : 'green'}`}>
          <div className="banner-icon">{topMover.pct_change > 0 ? '📈' : '📉'}</div>
          <div>
            <div className="banner-title">
              You spent {Math.abs(topMover.pct_change)}% {topMover.pct_change > 0 ? 'more' : 'less'} on {topMover.name} this month vs last
            </div>
            <div className="banner-body">
              <PrivateAmount id="dash-mover-current">{formatMoney(topMover.total)}</PrivateAmount> this month, was <PrivateAmount id="dash-mover-prev">{formatMoney(topMover.previous_total)}</PrivateAmount> last month
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn btn-sm" onClick={() => setCustomizing(!customizing)}>
          {customizing ? 'Done' : '⚙ Customize cards'}
        </button>
      </div>

      {customizing && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ fontSize: 15 }}>Show, hide, and reorder your stat cards</div>
          {cardPrefs.map((pref, i) => (
            <div className="customize-row" key={pref.id}>
              <span>{pref.visible ? '👁️' : '🚫'} {CARD_DEFS[pref.id]?.label || pref.id}</span>
              <div className="controls">
                <button className="icon-btn" onClick={() => moveCard(i, -1)} disabled={i === 0}>↑</button>
                <button className="icon-btn" onClick={() => moveCard(i, 1)} disabled={i === cardPrefs.length - 1}>↓</button>
                <button className="icon-btn" onClick={() => toggleCardVisible(i)}>{pref.visible ? 'Hide' : 'Show'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card-grid">
        {cardPrefs.filter((p) => p.visible && CARD_DEFS[p.id]).map((p) => (
          <div className="stat-card" key={p.id}>{CARD_DEFS[p.id].render(summary)}</div>
        ))}
      </div>

      <div className="two-col">
        <div className="card">
          <div className="section-title">
            Recent activity
            <Link to="/transactions" className="btn btn-sm">Add entry</Link>
          </div>
          {recent.length === 0 ? (
            <div className="empty-state">No transactions yet. Log your first rupee spent or earned in Transactions.</div>
          ) : (
            <div className="ledger">
              {recent.map((t) => (
                <div className="ledger-row" key={`${t.kind}-${t.id}`}>
                  <div className="ledger-icon">{t.category_icon}</div>
                  <div className="ledger-desc">
                    <div className="ledger-title">
                      {t.description || t.category_name}
                      {t.kind === 'salary' && <span className="badge green" style={{ marginLeft: 8 }}>salary</span>}
                    </div>
                    <div className="ledger-meta">{t.account_name} · {new Date(t.txn_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                  </div>
                  <div className="ledger-leader" />
                  <div className={`ledger-amount ${t.type}`}>
                    <PrivateAmount id={`dash-recent-${t.kind}-${t.id}`}>
                      {t.type === 'expense' ? '−' : '+'}{formatMoney(t.amount)}
                    </PrivateAmount>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">This month</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
              <span style={{ color: 'var(--ink-soft)' }}>Income</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)', fontWeight: 600 }}>
                <PrivateAmount id="dash-income-month">{formatMoney(summary.income_this_month)}</PrivateAmount>
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
              <span style={{ color: 'var(--ink-soft)' }}>Spent</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--rust)', fontWeight: 600 }}>
                <PrivateAmount id="dash-spent-month">{formatMoney(summary.spent_this_month)}</PrivateAmount>
              </span>
            </div>
            {summary.budget_total > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--ink-soft)' }}>Budget remaining</span>
                <span
                  className={overspending ? 'badge rust' : 'badge green'}
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  <PrivateAmount id="dash-budget-remaining">{formatMoney(summary.budget_remaining)}</PrivateAmount>
                </span>
              </div>
            )}
          </div>

          <div className="card">
            <div className="section-title">
              Top categories
              <Link to="/charts" className="btn btn-sm">Full charts</Link>
            </div>
            {byCategory.length === 0 ? (
              <div className="empty-state">Nothing spent yet this month.</div>
            ) : (
              byCategory.map((c) => (
                <Link to={`/category/${c.id}`} key={c.id} style={{ textDecoration: 'none', color: 'inherit', display: 'block', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                    <span>{c.icon} {c.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}><PrivateAmount id={`dash-cat-${c.id}`}>{formatMoney(c.total)}</PrivateAmount></span>
                  </div>
                  <div className="budget-bar-track">
                    <div
                      className="budget-bar-fill"
                      style={{
                        width: `${Math.min(100, (Number(c.total) / Number(byCategory[0].total)) * 100)}%`,
                        background: c.color
                      }}
                    />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
