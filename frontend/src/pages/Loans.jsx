import { useEffect, useState } from 'react';
import { api, formatMoney, todayISO } from '../api.js';
import PrivateAmount from '../components/PrivateAmount.jsx';
import { useDialog } from '../components/DialogProvider.jsx';

const emptyLoanForm = { name: '', principal: '', interest_rate: '', emi_amount: '', tenure_months: '', start_date: todayISO(), notes: '' };
const emptyPayForm = { account_id: '', amount: '', paid_on: todayISO() };

export default function Loans() {
  const { confirm } = useDialog();
  const [loans, setLoans] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewLoan, setShowNewLoan] = useState(false);
  const [loanForm, setLoanForm] = useState(emptyLoanForm);
  const [payingFor, setPayingFor] = useState(null);
  const [payForm, setPayForm] = useState(emptyPayForm);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [l, a] = await Promise.all([api.get('/loans'), api.get('/accounts')]);
    setLoans(l);
    setAccounts(a);
    if (a.length) setPayForm((f) => ({ ...f, account_id: a[0].id }));
    setLoading(false);
  }

  async function createLoan(e) {
    e.preventDefault();
    await api.post('/loans', {
      ...loanForm,
      principal: Number(loanForm.principal),
      interest_rate: loanForm.interest_rate ? Number(loanForm.interest_rate) : null,
      emi_amount: loanForm.emi_amount ? Number(loanForm.emi_amount) : null,
      tenure_months: loanForm.tenure_months ? Number(loanForm.tenure_months) : null
    });
    setLoanForm(emptyLoanForm);
    setShowNewLoan(false);
    load();
  }

  async function removeLoan(id) {
    if (!await confirm('Remove this loan? Its payment history stays in your transactions.', { ledger: 'money', danger: true })) return;
    await api.del(`/loans/${id}`);
    load();
  }

  function openPay(loan) {
    setPayingFor(loan.id);
    setPayForm({ account_id: accounts[0]?.id || '', amount: loan.emi_amount || '', paid_on: todayISO() });
  }

  async function submitPayment(e) {
    e.preventDefault();
    await api.post(`/loans/${payingFor}/pay`, { ...payForm, amount: Number(payForm.amount) });
    setPayingFor(null);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">What you still owe</div>
        <h1 className="page-title">Loans & Debt</h1>
        <p className="page-sub">Track a loan's remaining balance and estimated payoff. Payments log as real expenses (category "EMI/Loan"), so they reduce your balance like any other spend.</p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => setShowNewLoan(!showNewLoan)}>
          {showNewLoan ? 'Cancel' : '+ New loan'}
        </button>
      </div>

      {showNewLoan && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title">New loan</div>
          <form onSubmit={createLoan}>
            <div className="form-grid">
              <div className="field">
                <label>Loan name</label>
                <input required placeholder="e.g. Bike Loan" value={loanForm.name} onChange={(e) => setLoanForm({ ...loanForm, name: e.target.value })} />
              </div>
              <div className="field">
                <label>Principal (₹)</label>
                <input required type="number" step="0.01" value={loanForm.principal} onChange={(e) => setLoanForm({ ...loanForm, principal: e.target.value })} />
              </div>
              <div className="field">
                <label>Interest rate % (optional)</label>
                <input type="number" step="0.01" value={loanForm.interest_rate} onChange={(e) => setLoanForm({ ...loanForm, interest_rate: e.target.value })} />
              </div>
              <div className="field">
                <label>EMI amount (₹)</label>
                <input type="number" step="0.01" value={loanForm.emi_amount} onChange={(e) => setLoanForm({ ...loanForm, emi_amount: e.target.value })} />
              </div>
              <div className="field">
                <label>Tenure (months)</label>
                <input type="number" value={loanForm.tenure_months} onChange={(e) => setLoanForm({ ...loanForm, tenure_months: e.target.value })} />
              </div>
              <div className="field">
                <label>Start date</label>
                <input required type="date" value={loanForm.start_date} onChange={(e) => setLoanForm({ ...loanForm, start_date: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Create loan</button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : loans.length === 0 ? (
        <div className="card empty-state">No loans tracked yet. Add one above.</div>
      ) : (
        loans.map((l) => {
          const paidPct = l.principal > 0 ? Math.min(100, (l.paid_so_far / l.principal) * 100) : 0;
          return (
            <div className="card" key={l.id} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{l.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>
                    <PrivateAmount id={`loan-${l.id}-remaining`}>{formatMoney(l.remaining_balance)}</PrivateAmount> remaining of <PrivateAmount id={`loan-${l.id}-principal`}>{formatMoney(l.principal)}</PrivateAmount>
                    {l.estimated_months_left !== null && l.remaining_balance > 0 && ` · ~${l.estimated_months_left} month${l.estimated_months_left === 1 ? '' : 's'} left`}
                    {l.remaining_balance <= 0 && ' · Paid off 🎉'}
                  </div>
                </div>
                <div className="ledger-actions">
                  {l.remaining_balance > 0 && <button className="btn btn-sm btn-primary" onClick={() => openPay(l)}>+ Log payment</button>}
                  <button className="icon-btn" onClick={() => removeLoan(l.id)}>Remove</button>
                </div>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${paidPct}%`, background: 'var(--brass)' }} />
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>{paidPct.toFixed(0)}% paid off · {l.payments_made} payment{l.payments_made === 1 ? '' : 's'} made</div>

              {payingFor === l.id && (
                <form onSubmit={submitPayment} style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--hairline)' }}>
                  <div className="form-grid">
                    <div className="field">
                      <label>Amount (₹)</label>
                      <input required autoFocus type="number" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
                    </div>
                    <div className="field">
                      <label>From account</label>
                      <select required value={payForm.account_id} onChange={(e) => setPayForm({ ...payForm, account_id: e.target.value })}>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Date</label>
                      <input required type="date" value={payForm.paid_on} onChange={(e) => setPayForm({ ...payForm, paid_on: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" className="btn btn-primary">Log payment</button>
                    <button type="button" className="btn" onClick={() => setPayingFor(null)}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
