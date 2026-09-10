import { useEffect, useState } from 'react';
import { api, formatMoney } from '../api.js';
import PrivateAmount from '../components/PrivateAmount.jsx';
import { useDialog } from '../components/DialogProvider.jsx';

const emptyForm = { name: '', bank_name: '', account_type: 'bank', opening_balance: '', currency: 'INR', fx_rate_to_base: '1' };
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'];

export default function Accounts() {
  const { confirm } = useDialog();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const data = await api.get('/accounts');
    setAccounts(data);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(acc) {
    setEditing(acc);
    setForm({
      name: acc.name,
      bank_name: acc.bank_name || '',
      account_type: acc.account_type,
      opening_balance: acc.opening_balance,
      currency: acc.currency || 'INR',
      fx_rate_to_base: acc.fx_rate_to_base || '1'
    });
    setShowModal(true);
  }

  async function save(e) {
    e.preventDefault();
    const payload = { ...form, opening_balance: Number(form.opening_balance || 0), fx_rate_to_base: Number(form.fx_rate_to_base || 1) };
    if (editing) {
      await api.put(`/accounts/${editing.id}`, payload);
    } else {
      await api.post('/accounts', payload);
    }
    setShowModal(false);
    load();
  }

  async function remove(id) {
    if (!await confirm('Remove this account? Its transaction history stays in the database but the account will be hidden.', { ledger: 'money', danger: true })) return;
    await api.del(`/accounts/${id}`);
    load();
  }

  async function togglePin(id) {
    await api.post(`/accounts/${id}/pin`, {});
    load();
  }

  const total = accounts.reduce((s, a) => s + Number(a.balance_in_base ?? a.current_balance), 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Multiple banks, one view</div>
        <h1 className="page-title">Accounts</h1>
        <p className="page-sub">Every bank account, wallet, or cash-in-hand you track, with a live balance computed from its transactions. Pin the ones you use most so they always show up first.</p>
      </div>

      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-label">Combined balance</div>
          <div className="stat-value"><PrivateAmount id="accounts-combined-balance">{formatMoney(total)}</PrivateAmount></div>
          <div className="stat-note">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="stat-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={openNew}>+ Add account</button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading accounts…</div>
      ) : accounts.length === 0 ? (
        <div className="card empty-state">No accounts yet. Add your salary account, savings account, or cash wallet to get started.</div>
      ) : (
        <div className="ledger">
          {accounts.map((a) => (
            <div className="ledger-row" key={a.id}>
              <div className="ledger-icon">
                {a.account_type === 'cash' ? '💵' : a.account_type === 'wallet' ? '📱' : '🏦'}
              </div>
              <div className="ledger-desc">
                <div className="ledger-title">
                  {a.name}
                  {a.is_pinned === 1 && <span className="badge brass" style={{ marginLeft: 8 }}>pinned</span>}
                </div>
                <div className="ledger-meta">
                  {a.bank_name || a.account_type} · opening <PrivateAmount id={`acc-${a.id}-opening`}>{formatMoney(a.opening_balance)}</PrivateAmount>
                  {a.currency && a.currency !== 'INR' && ` · ${a.currency}`}
                </div>
              </div>
              <div className="ledger-leader" />
              <div style={{ textAlign: 'right' }}>
                <div className="ledger-amount" style={{ color: a.current_balance < 0 ? 'var(--rust)' : 'var(--ink)' }}>
                  <PrivateAmount id={`acc-${a.id}-balance`}>
                    {a.currency && a.currency !== 'INR' ? `${a.currency} ${Number(a.current_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : formatMoney(a.current_balance)}
                  </PrivateAmount>
                </div>
                {a.currency && a.currency !== 'INR' && (
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                    ≈ <PrivateAmount id={`acc-${a.id}-base`}>{formatMoney(a.balance_in_base)}</PrivateAmount>
                  </div>
                )}
              </div>
              <div className="ledger-actions">
                <button className="icon-btn" onClick={() => togglePin(a.id)} title={a.is_pinned ? 'Unpin — stop showing this first' : 'Pin — always show this account first'}>
                  {a.is_pinned ? '★ Unpin' : '☆ Pin'}
                </button>
                <button className="icon-btn" onClick={() => openEdit(a)}>Edit</button>
                <button className="icon-btn" onClick={() => remove(a.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{editing ? 'Edit account' : 'Add account'}</h3>
            <form onSubmit={save}>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="field">
                  <label>Account name</label>
                  <input required placeholder="e.g. HDFC Salary Account" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="field">
                  <label>Bank / provider</label>
                  <input placeholder="e.g. HDFC Bank" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
                </div>
                <div className="field">
                  <label>Type</label>
                  <select value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })}>
                    <option value="bank">Bank</option>
                    <option value="cash">Cash in hand</option>
                    <option value="wallet">Wallet (Paytm/GPay etc.)</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="field">
                  <label>Opening balance</label>
                  <input required type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
                </div>
                <div className="field">
                  <label>Currency</label>
                  <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value, fx_rate_to_base: e.target.value === 'INR' ? '1' : form.fx_rate_to_base })}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {form.currency !== 'INR' && (
                  <div className="field">
                    <label>1 {form.currency} = how many ₹?</label>
                    <input required type="number" step="0.0001" value={form.fx_rate_to_base} onChange={(e) => setForm({ ...form, fx_rate_to_base: e.target.value })} />
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 4 }}>Set this yourself and update it whenever you like — rates aren't fetched automatically.</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save account</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
