import { useEffect, useState } from 'react';
import { api, formatMoney, todayISO } from '../api.js';
import PrivateAmount from '../components/PrivateAmount.jsx';
import { useDialog } from '../components/DialogProvider.jsx';

const emptyGoalForm = { name: '', target_amount: '', target_date: '' };
const emptyContribForm = { account_id: '', amount: '', contributed_on: todayISO(), note: '' };

export default function Savings() {
  const { confirm, alert } = useDialog();
  const [goals, setGoals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [goalForm, setGoalForm] = useState(emptyGoalForm);
  const [contributingTo, setContributingTo] = useState(null);
  const [contribForm, setContribForm] = useState(emptyContribForm);

  // Surplus action state
  const [surplusModal, setSurplusModal] = useState(null); // 'reserve' | 'goal' | null
  const [surplusAmount, setSurplusAmount] = useState('');
  const [surplusGoalId, setSurplusGoalId] = useState('');
  const [surplusAccountId, setSurplusAccountId] = useState('');
  const [surplusSuccessMsg, setSurplusSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState('cycles'); // 'cycles' | 'monthly'

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [g, a, anal] = await Promise.all([
        api.get('/savings'),
        api.get('/accounts'),
        api.get('/savings/analytics')
      ]);
      setGoals(g);
      setAccounts(a);
      setAnalytics(anal);
      if (a.length) {
        setContribForm((f) => ({ ...f, account_id: a[0].id }));
        setSurplusAccountId(a[0].id);
      }
      if (g.length) {
        setSurplusGoalId(g[0].id);
      }
      if (anal && anal.available_cash > 0) {
        setSurplusAmount(String(anal.available_cash));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function createGoal(e) {
    e.preventDefault();
    await api.post('/savings', { ...goalForm, target_amount: Number(goalForm.target_amount) });
    setGoalForm(emptyGoalForm);
    setShowNewGoal(false);
    load();
  }

  async function removeGoal(id) {
    if (!await confirm('Remove this goal? Its contribution history stays in your transactions.', { ledger: 'money', danger: true })) return;
    await api.del(`/savings/${id}`);
    load();
  }

  function openContribute(goal) {
    setContributingTo(goal.id);
    setContribForm({ ...emptyContribForm, account_id: accounts[0]?.id || '' });
  }

  async function submitContribution(e) {
    e.preventDefault();
    await api.post(`/savings/${contributingTo}/contribute`, { ...contribForm, amount: Number(contribForm.amount) });
    setContributingTo(null);
    load();
  }

  async function handleSurplusAction(action) {
    try {
      const payload = {
        action,
        amount: Number(surplusAmount),
        goal_id: surplusGoalId || (goals[0]?.id || null),
        account_id: surplusAccountId || (accounts[0]?.id || null)
      };
      await api.post('/savings/allocate-surplus', payload);
      setSurplusSuccessMsg(action === 'reserve' ? '✨ Surplus successfully locked into Reserve Cap!' : '✨ Surplus contributed to your Savings Goal!');
      setSurplusModal(null);
      setTimeout(() => setSurplusSuccessMsg(''), 3000);
      load();
    } catch (err) {
      await alert(`Surplus allocation failed: ${err.message}`, { ledger: 'money' });
    }
  }

  if (loading) return <div className="empty-state">Loading your savings analytics…</div>;

  const cycleList = analytics?.cycle_history || [];
  const monthlyList = analytics?.monthly_history || [];
  const activeHistory = activeTab === 'cycles' ? cycleList : monthlyList;
  const maxInflow = Math.max(...activeHistory.map((h) => Math.max(h.inflows, h.expenses)), 1000);

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Wealth & Growth Tracking</div>
        <h1 className="page-title">Savings & Surplus Analytics</h1>
        <p className="page-sub">Track how much you save every salary cycle, analyze wealth distribution, and lock unspent surplus into your goals.</p>
      </div>

      {surplusSuccessMsg && (
        <div className="banner green" style={{ marginBottom: 20 }}>
          <div className="banner-icon">✓</div>
          <div><div className="banner-title">{surplusSuccessMsg}</div></div>
        </div>
      )}

      {/* Top Analytics KPI Cards */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Accumulated Wealth</div>
          <div className="stat-value">
            <PrivateAmount id="savings-total-wealth">{formatMoney(analytics?.total_wealth)}</PrivateAmount>
          </div>
          <div className="stat-note">Across all active accounts & cash</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Protected Reserve Cap</div>
          <div className="stat-value positive">
            <PrivateAmount id="savings-reserve-cap">{formatMoney(analytics?.reserve_cap)}</PrivateAmount>
          </div>
          <div className="stat-note">Locked emergency funds you said not to touch</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Last Cycle Savings Rate</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>
            {analytics?.latest_cycle ? `${analytics.latest_cycle.savings_rate}%` : '0%'}
          </div>
          <div className="stat-note">
            {analytics?.latest_cycle ? `+${formatMoney(analytics.latest_cycle.surplus)} saved in ${analytics.latest_cycle.label.split(' ')[0]}` : 'No active cycle data'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Available Spendable Cash</div>
          <div className="stat-value" style={{ color: 'var(--brass)' }}>
            <PrivateAmount id="savings-avail-cash">{formatMoney(analytics?.available_cash)}</PrivateAmount>
          </div>
          <div className="stat-note">Active spendable buffer before next payday</div>
        </div>
      </div>

      {/* Method 2 1-Tap Payday Surplus Banner */}
      {analytics && analytics.available_cash > 0 && (
        <div className="card" style={{ marginBottom: 24, border: '1px solid var(--green)', background: 'rgba(47, 111, 78, 0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                <span>🎯</span>
                <span>Unspent Cycle Surplus Management</span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--ink-soft)' }}>
                You have <strong style={{ color: 'var(--green)' }}>{formatMoney(analytics.available_cash)}</strong> unspent in your active pay cycle. You can lock leftover money into your Reserve Cap or allocate it to a Goal so current spendings stay disciplined.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => { setSurplusModal('reserve'); setSurplusAmount(String(analytics.available_cash)); }}
              >
                🔒 Lock in Reserve Cap
              </button>
              {goals.length > 0 && (
                <button
                  className="btn btn-sm"
                  onClick={() => { setSurplusModal('goal'); setSurplusAmount(String(analytics.available_cash)); }}
                >
                  🎯 Allocate to Goal
                </button>
              )}
            </div>
          </div>

          {/* Quick Surplus Modal / Form */}
          {surplusModal && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--hairline)', animation: 'aiMsgFadeIn 0.2s ease' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                {surplusModal === 'reserve' ? '🔒 Increase Reserve Cap with Leftover Cash' : '🎯 Contribute Leftover Cash to Savings Goal'}
              </div>
              <div className="form-grid" style={{ marginBottom: 12 }}>
                <div className="field">
                  <label>Amount to Allocate (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={surplusAmount}
                    onChange={(e) => setSurplusAmount(e.target.value)}
                    max={analytics.available_cash}
                  />
                </div>
                {surplusModal === 'goal' && (
                  <>
                    <div className="field">
                      <label>Target Savings Goal</label>
                      <select value={surplusGoalId} onChange={(e) => setSurplusGoalId(e.target.value)}>
                        {goals.map((g) => <option key={g.id} value={g.id}>{g.name} ({formatMoney(g.saved_so_far)} / {formatMoney(g.target_amount)})</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>From Account</label>
                      <select value={surplusAccountId} onChange={(e) => setSurplusAccountId(e.target.value)}>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({formatMoney(a.balance)})</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleSurplusAction(surplusModal)}
                >
                  {surplusModal === 'reserve' ? 'Confirm & Lock in Reserve' : 'Confirm & Log Contribution'}
                </button>
                <button type="button" className="btn" onClick={() => setSurplusModal(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Two Column Section: Savings Comparison Chart + Asset Distribution */}
      <div className="two-col" style={{ marginBottom: 28 }}>
        {/* Left: Cycle & Monthly Comparison Chart */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div className="section-title" style={{ margin: 0 }}>Savings Performance</div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Compare inflows, expenses, and net surplus across periods</div>
            </div>
            <div style={{ display: 'flex', gap: 4, background: 'var(--paper-raised)', padding: 3, borderRadius: 6, border: '1px solid var(--hairline)' }}>
              <button
                className={`btn btn-sm ${activeTab === 'cycles' ? 'btn-primary' : ''}`}
                style={{ padding: '2px 8px', fontSize: 11.5 }}
                onClick={() => setActiveTab('cycles')}
              >
                Pay Cycles (7th)
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'monthly' ? 'btn-primary' : ''}`}
                style={{ padding: '2px 8px', fontSize: 11.5 }}
                onClick={() => setActiveTab('monthly')}
              >
                Calendar Months
              </button>
            </div>
          </div>

          {activeHistory.length === 0 ? (
            <div className="empty-state">No transaction history found yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {activeHistory.map((item, idx) => (
                <div key={idx} style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--paper-raised)', border: '1px solid var(--hairline)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{item.label || item.month}</span>
                    <span className="badge" style={{ background: item.surplus >= 0 ? 'rgba(47, 111, 78, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: item.surplus >= 0 ? 'var(--green)' : 'var(--rust)', fontWeight: 600 }}>
                      {item.surplus >= 0 ? `+${formatMoney(item.surplus)} Saved (${item.savings_rate}%)` : `-${formatMoney(Math.abs(item.surplus))} Deficit`}
                    </span>
                  </div>

                  {/* Visual Comparison Bar */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-soft)', marginBottom: 3 }}>
                        <span>Total Inflow</span>
                        <span>{formatMoney(item.inflows)}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--hairline)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (item.inflows / maxInflow) * 100)}%`, background: 'var(--green)', borderRadius: 3 }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-soft)', marginBottom: 3 }}>
                        <span>Total Spent</span>
                        <span>{formatMoney(item.expenses)}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--hairline)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (item.expenses / maxInflow) * 100)}%`, background: 'var(--rust)', borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Where is your money saved (Asset Distribution) */}
        <div className="card">
          <div className="section-title">Where Your Wealth is Held</div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
            Breakdown of your liquid wealth across all active bank accounts and cash holdings.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {analytics?.asset_distribution?.map((acc) => (
              <div key={acc.id} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--paper-raised)', border: '1px solid var(--hairline)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div>
                    <strong style={{ fontSize: 13.5 }}>{acc.name}</strong>
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)', marginLeft: 6 }}>({acc.bank_name})</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                      <PrivateAmount id={`asset-bal-${acc.id}`}>{formatMoney(acc.balance)}</PrivateAmount>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{acc.share_pct}% of wealth</div>
                  </div>
                </div>
                <div style={{ height: 6, background: 'var(--hairline)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${acc.share_pct}%`, background: acc.color, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Savings Goals Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Savings Goals & Targets</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '2px 0 0 0' }}>
            Track progress toward specific financial milestones.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNewGoal(!showNewGoal)}>
          {showNewGoal ? 'Cancel' : '+ New Goal'}
        </button>
      </div>

      {showNewGoal && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title">New Savings Goal</div>
          <form onSubmit={createGoal}>
            <div className="form-grid">
              <div className="field">
                <label>Goal Name</label>
                <input required placeholder="e.g. Emergency Fund, Laptop, Vacation" value={goalForm.name} onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })} />
              </div>
              <div className="field">
                <label>Target Amount (₹)</label>
                <input required type="number" step="0.01" value={goalForm.target_amount} onChange={(e) => setGoalForm({ ...goalForm, target_amount: e.target.value })} />
              </div>
              <div className="field">
                <label>Target Date (Optional)</label>
                <input type="date" value={goalForm.target_date} onChange={(e) => setGoalForm({ ...goalForm, target_date: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Create Goal</button>
          </form>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="card empty-state">No savings goals created yet. Click "+ New Goal" above to create your first target!</div>
      ) : (
        goals.map((g) => (
          <div className="card" key={g.id} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{g.name}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>
                  <PrivateAmount id={`goal-${g.id}-saved`}>{formatMoney(g.saved_so_far)}</PrivateAmount> of <PrivateAmount id={`goal-${g.id}-target`}>{formatMoney(g.target_amount)}</PrivateAmount>
                  {g.target_date && ` · by ${new Date(g.target_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                </div>
              </div>
              <div className="ledger-actions">
                <button className="btn btn-sm btn-primary" onClick={() => openContribute(g)}>+ Contribute</button>
                <button className="icon-btn" onClick={() => removeGoal(g.id)}>Remove</button>
              </div>
            </div>
            <div className="progress-track" style={{ height: 8, marginTop: 12 }}>
              <div className="progress-fill" style={{ width: `${g.progress_pct}%`, background: 'var(--green)' }} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 4 }}>{g.progress_pct.toFixed(0)}% reached</div>

            {contributingTo === g.id && (
              <form onSubmit={submitContribution} style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--hairline)' }}>
                <div className="form-grid">
                  <div className="field">
                    <label>Amount (₹)</label>
                    <input required autoFocus type="number" step="0.01" value={contribForm.amount} onChange={(e) => setContribForm({ ...contribForm, amount: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>From Account</label>
                    <select required value={contribForm.account_id} onChange={(e) => setContribForm({ ...contribForm, account_id: e.target.value })}>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({formatMoney(a.balance)})</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Date</label>
                    <input required type="date" value={contribForm.contributed_on} onChange={(e) => setContribForm({ ...contribForm, contributed_on: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Note</label>
                    <input value={contribForm.note} onChange={(e) => setContribForm({ ...contribForm, note: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn btn-primary">Log contribution</button>
                  <button type="button" className="btn" onClick={() => setContributingTo(null)}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        ))
      )}
    </div>
  );
}
