import { useEffect, useState } from 'react';
import { api, formatMoney, thisMonth } from '../api.js';
import PrivateAmount from '../components/PrivateAmount.jsx';
import { useDialog } from '../components/DialogProvider.jsx';

export default function Budgets() {
  const { confirm, alert } = useDialog();
  const [month, setMonth] = useState(thisMonth());
  const [budgets, setBudgets] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ category_id: '', amount: '' });
  const [transferForm, setTransferForm] = useState({ from_category_id: '', to_category_id: '', amount: '', note: '' });
  const [showTransfer, setShowTransfer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { load(); }, [month]);

  async function loadCategories() {
    const c = await api.get('/categories');
    const expenseCats = c.filter((cat) => cat.type === 'expense');
    setCategories(expenseCats);
    if (expenseCats.length) {
      setForm((f) => ({ ...f, category_id: expenseCats[0].id }));
      setTransferForm((f) => ({ ...f, from_category_id: expenseCats[0].id, to_category_id: expenseCats[1]?.id || expenseCats[0].id }));
    }
  }

  async function load() {
    setLoading(true);
    const [b, t] = await Promise.all([api.get(`/budgets?month=${month}`), api.get(`/budgets/transfers?month=${month}`)]);
    setBudgets(b);
    setTransfers(t);
    setLoading(false);
  }

  async function save(e) {
    e.preventDefault();
    await api.post('/budgets', { category_id: form.category_id, month, amount: Number(form.amount) });
    setForm({ ...form, amount: '' });
    load();
  }

  async function remove(id) {
    if (!await confirm('Remove this budget cap?', { ledger: 'money', danger: true })) return;
    await api.del(`/budgets/${id}`);
    load();
  }

  async function submitTransfer(e) {
    e.preventDefault();
    if (transferForm.from_category_id === transferForm.to_category_id) {
      await alert('Pick two different categories to move money between.', { ledger: 'money' });
      return;
    }
    await api.post('/budgets/transfer', { ...transferForm, month, amount: Number(transferForm.amount) });
    setTransferForm({ ...transferForm, amount: '', note: '' });
    setShowTransfer(false);
    load();
  }

  const totalBudget = budgets.reduce((s, b) => s + Number(b.effective_amount), 0);
  const totalSpent = budgets.reduce((s, b) => s + Number(b.spent), 0);
  const budgetedCategoryIds = new Set(budgets.map((b) => b.category_id));

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Plan the month before it plans you</div>
        <h1 className="page-title">Monthly budgets</h1>
        <p className="page-sub">Set a spend cap per category, watch it fill up, and move money between envelopes if one category runs tight and another has room.</p>
      </div>

      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-label">Budgeted this month</div>
          <div className="stat-value"><PrivateAmount id="budgets-total-budgeted">{formatMoney(totalBudget)}</PrivateAmount></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Spent so far</div>
          <div className="stat-value negative"><PrivateAmount id="budgets-total-spent">{formatMoney(totalSpent)}</PrivateAmount></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Remaining</div>
          <div className={`stat-value ${totalBudget - totalSpent < 0 ? 'negative' : 'positive'}`}>
            <PrivateAmount id="budgets-total-remaining">{formatMoney(totalBudget - totalSpent)}</PrivateAmount>
          </div>
        </div>
      </div>

      <div className="two-col">
        <div>
          <div className="section-title">Category caps — {month}</div>
          {loading ? (
            <div className="empty-state">Loading…</div>
          ) : budgets.length === 0 ? (
            <div className="card empty-state">No budgets set for this month yet. Add one on the right.</div>
          ) : (
            budgets.map((b) => {
              const effective = Number(b.effective_amount);
              const pct = effective > 0 ? (Number(b.spent) / effective) * 100 : 0;
              const over = Number(b.spent) > effective;
              const warning = !over && pct >= 80;
              return (
                <div className="card" key={b.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>{b.category_icon} {b.category_name}</div>
                    <button className="icon-btn" onClick={() => remove(b.id)}>Remove</button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-soft)', marginTop: 6 }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}><PrivateAmount id={`budget-${b.id}-spent`}>{formatMoney(b.spent)}</PrivateAmount> spent</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>of <PrivateAmount id={`budget-${b.id}-amount`}>{formatMoney(effective)}</PrivateAmount></span>
                  </div>
                  {(b.transferred_in > 0 || b.transferred_out > 0) && (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2 }}>
                      Base <PrivateAmount id={`budget-${b.id}-base`}>{formatMoney(b.amount)}</PrivateAmount>
                      {b.transferred_in > 0 && <> · +<PrivateAmount id={`budget-${b.id}-in`}>{formatMoney(b.transferred_in)}</PrivateAmount> moved in</>}
                      {b.transferred_out > 0 && <> · −<PrivateAmount id={`budget-${b.id}-out`}>{formatMoney(b.transferred_out)}</PrivateAmount> moved out</>}
                    </div>
                  )}
                  <div className="budget-bar-track">
                    <div className={`budget-bar-fill${over ? ' over' : warning ? ' warning' : ''}`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  {over && <div style={{ fontSize: 12, color: 'var(--rust)', marginTop: 6 }}>Over by <PrivateAmount id={`budget-${b.id}-over`}>{formatMoney(Number(b.spent) - effective)}</PrivateAmount></div>}
                  {warning && <div style={{ fontSize: 12, color: 'var(--brass)', marginTop: 6 }}>{pct.toFixed(0)}% used — getting close</div>}
                </div>
              );
            })
          )}

          {transfers.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-title" style={{ fontSize: 15 }}>Moves this month</div>
              {transfers.map((t) => (
                <div key={t.id} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--hairline)' }}>
                  {t.from_icon} {t.from_name} → {t.to_icon} {t.to_name}: <PrivateAmount id={`transfer-${t.id}`}>{formatMoney(t.amount)}</PrivateAmount>
                  {t.note && <span style={{ color: 'var(--ink-faint)' }}> · {t.note}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">Set a cap</div>
            <form onSubmit={save}>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Month</label>
                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Category</label>
                <select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}{budgetedCategoryIds.has(c.id) ? ' (already set)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>Monthly cap (₹)</label>
                <input required type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Save budget</button>
            </form>
          </div>

          <div className="card">
            <div className="section-title">
              Envelope budgeting
              <button className="btn btn-sm" onClick={() => setShowTransfer(!showTransfer)}>{showTransfer ? 'Cancel' : 'Move money'}</button>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 0 }}>
              Ran over on one category and have room on another? Move some of that cap over — it won't touch your actual account balance, just the caps.
            </p>
            {showTransfer && (
              <form onSubmit={submitTransfer}>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>From category</label>
                  <select value={transferForm.from_category_id} onChange={(e) => setTransferForm({ ...transferForm, from_category_id: e.target.value })}>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>To category</label>
                  <select value={transferForm.to_category_id} onChange={(e) => setTransferForm({ ...transferForm, to_category_id: e.target.value })}>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>Amount (₹)</label>
                  <input required type="number" step="0.01" value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} />
                </div>
                <div className="field" style={{ marginBottom: 14 }}>
                  <label>Note (optional)</label>
                  <input value={transferForm.note} onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })} />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Move budget</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
