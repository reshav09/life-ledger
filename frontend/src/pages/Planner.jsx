import { useEffect, useState } from 'react';
import { api, formatMoney } from '../api.js';
import PrivateAmount from '../components/PrivateAmount.jsx';
import { useDialog } from '../components/DialogProvider.jsx';

const emptyForm = { name: '', cost: '', category_id: '', payment_mode: 'cash', emi_months: 6, priority: 'medium', notes: '' };

export default function Planner() {
  const { confirm } = useDialog();
  const [items, setItems] = useState([]);
  const [snapshot, setSnapshot] = useState(null);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCategories(); load(); }, []);

  async function loadCategories() {
    const c = await api.get('/categories');
    setCategories(c.filter((cat) => cat.type === 'expense'));
  }

  async function load() {
    setLoading(true);
    const data = await api.get('/wishlist');
    setItems(data.items);
    setSnapshot(data.snapshot);
    setLoading(false);
  }

  async function submit(e) {
    e.preventDefault();
    await api.post('/wishlist', { ...form, cost: Number(form.cost), emi_months: form.payment_mode === 'emi' ? Number(form.emi_months) : null });
    setForm(emptyForm);
    load();
  }

  async function setStatus(item, status) {
    await api.put(`/wishlist/${item.id}`, { ...item, status });
    load();
  }

  async function remove(id) {
    if (!await confirm('Remove this item from your planner?', { ledger: 'money', danger: true })) return;
    await api.del(`/wishlist/${id}`);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Can I actually afford this?</div>
        <h1 className="page-title">Planner</h1>
        <p className="page-sub">List what you want to buy. This checks it against your real available money — your reserve cap is never touched — and tells you if cash or EMI makes sense.</p>
      </div>

      {snapshot && (
        <div className="card-grid">
          <div className="stat-card">
            <div className="stat-label">Available cash</div>
            <div className="stat-value positive"><PrivateAmount id="planner-available-cash">{formatMoney(snapshot.availableCash)}</PrivateAmount></div>
            <div className="stat-note">Total balance minus your <PrivateAmount id="planner-reserve-cap">{formatMoney(snapshot.reserveCap)}</PrivateAmount> reserve cap</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg. monthly income</div>
            <div className="stat-value"><PrivateAmount id="planner-avg-income">{formatMoney(snapshot.avgMonthlyIncome)}</PrivateAmount></div>
            <div className="stat-note">Based on your logged salary credits</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg. monthly expense</div>
            <div className="stat-value negative"><PrivateAmount id="planner-avg-expense">{formatMoney(snapshot.avgMonthlyExpense)}</PrivateAmount></div>
            <div className="stat-note">Last 3 months of spending</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Monthly surplus</div>
            <div className={`stat-value ${snapshot.monthlySurplus >= 0 ? 'positive' : 'negative'}`}>
              <PrivateAmount id="planner-monthly-surplus">{formatMoney(snapshot.monthlySurplus)}</PrivateAmount>
            </div>
            <div className="stat-note">What's free each month for EMIs</div>
          </div>
        </div>
      )}

      <div className="two-col">
        <div>
          <div className="section-title">Your list</div>
          {loading ? (
            <div className="empty-state">Loading…</div>
          ) : items.length === 0 ? (
            <div className="card empty-state">Nothing on your planner yet. Add something you want to buy on the right.</div>
          ) : (
            items.map((item) => (
              <div className="card" key={item.id} style={{ marginBottom: 12, opacity: item.status === 'dropped' ? 0.5 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>
                      {item.category_icon} {item.name}
                      <span className={`badge ${item.priority === 'high' ? 'rust' : item.priority === 'medium' ? 'brass' : 'green'}`} style={{ marginLeft: 8 }}>
                        {item.priority}
                      </span>
                      {item.status !== 'planned' && <span className="badge green" style={{ marginLeft: 6 }}>{item.status}</span>}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, marginTop: 4 }}>
                      <PrivateAmount id={`wish-${item.id}-cost`}>{formatMoney(item.cost)}</PrivateAmount>
                    </div>
                    {item.notes && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 4 }}>{item.notes}</div>}
                  </div>
                  <div className="ledger-actions">
                    {item.status === 'planned' && <button className="icon-btn" onClick={() => setStatus(item, 'bought')}>Mark bought</button>}
                    <button className="icon-btn" onClick={() => remove(item.id)}>Remove</button>
                  </div>
                </div>

                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--hairline)', fontSize: 13.5 }}>
                  {item.verdict.mode === 'cash' ? (
                    <>
                      <div>
                        Paying cash: {item.verdict.affordable_alone
                          ? <span className="verdict-yes">✓ Yes, fits within your available cash</span>
                          : <span className="verdict-no">✗ Short by <PrivateAmount id={`wish-${item.id}-shortfall`}>{formatMoney(item.verdict.shortfall_alone)}</PrivateAmount></span>}
                      </div>
                      {items.filter((i) => i.status === 'planned' && i.payment_mode === 'cash').length > 1 && (
                        <div style={{ marginTop: 4, color: 'var(--ink-soft)' }}>
                          Alongside your other planned cash purchases:{' '}
                          {item.verdict.affordable_with_other_plans
                            ? <span className="verdict-yes">still fits</span>
                            : <span className="verdict-no">won't fit — something has to give</span>}
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      On EMI over {item.emi_months} months: <PrivateAmount id={`wish-${item.id}-emi`}>{formatMoney(item.verdict.monthly_emi)}</PrivateAmount>/month —{' '}
                      {item.verdict.affordable
                        ? <span className="verdict-yes">✓ within your <PrivateAmount id={`wish-${item.id}-surplus-yes`}>{formatMoney(item.verdict.monthly_surplus)}</PrivateAmount> monthly surplus</span>
                        : <span className="verdict-no">✗ exceeds your <PrivateAmount id={`wish-${item.id}-surplus-no`}>{formatMoney(item.verdict.monthly_surplus)}</PrivateAmount> monthly surplus</span>}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div>
          <div className="card">
            <div className="section-title">Add something you want</div>
            <form onSubmit={submit}>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>What is it</label>
                <input required placeholder="e.g. New laptop" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Cost (₹)</label>
                <input required type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
              </div>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Category</label>
                <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">Uncategorised</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Payment mode</label>
                <div className="pill-toggle">
                  <button type="button" className={form.payment_mode === 'cash' ? 'active' : ''} onClick={() => setForm({ ...form, payment_mode: 'cash' })}>Cash</button>
                  <button type="button" className={form.payment_mode === 'emi' ? 'active' : ''} onClick={() => setForm({ ...form, payment_mode: 'emi' })}>Finance / EMI</button>
                </div>
              </div>
              {form.payment_mode === 'emi' && (
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>EMI tenure (months)</label>
                  <input type="number" min="1" value={form.emi_months} onChange={(e) => setForm({ ...form, emi_months: e.target.value })} />
                </div>
              )}
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Priority</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>Notes</label>
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Check affordability</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
