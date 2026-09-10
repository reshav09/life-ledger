import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useDialog } from '../components/DialogProvider.jsx';

const PURCHASE_TYPES = ['protein', 'supplement', 'membership', 'equipment', 'clothing', 'food', 'other'];

function fmt(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function thisMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function DietSpending() {
  const { confirm } = useDialog();
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [classifyingId, setClassifyingId] = useState(null);
  const [classifyForm, setClassifyForm] = useState({ purchase_type: 'protein', amount_allocated: '', notes: '' });

  useEffect(() => { load(); }, [month]);

  async function load() {
    setLoading(true);
    try {
      const d = await api.get(`/gym-spending?month=${month}`);
      setData(d);
    } finally {
      setLoading(false);
    }
  }

  function openClassify(txn) {
    setClassifyingId(txn.id);
    setClassifyForm({ purchase_type: 'protein', amount_allocated: fmt(txn.remaining_to_classify).replace(/[₹,]/g, ''), notes: '' });
  }

  async function submitClassify(e, txnId) {
    e.preventDefault();
    await api.post('/gym-spending/classify', {
      transaction_id: txnId,
      purchase_type: classifyForm.purchase_type,
      amount_allocated: Number(classifyForm.amount_allocated),
      notes: classifyForm.notes
    });
    setClassifyingId(null);
    load();
  }

  async function removeClassification(id) {
    if (!await confirm('Remove this classification?', { ledger: 'food', danger: true })) return;
    await api.del(`/gym-spending/classify/${id}`);
    load();
  }

  if (loading) return <div className="empty-state">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Read-only view into the Money Ledger's "Gym" category</div>
        <h1 className="page-title">Diet &amp; Gym Spending</h1>
        <p className="page-sub">This never edits your actual transactions — it just labels what a gym-tagged purchase was actually for, so you understand where the money went.</p>
      </div>

      <div className="field" style={{ maxWidth: 200, marginBottom: 20 }}>
        <label>Month</label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-label">Gym spending this month</div>
          <div className="stat-value">{fmt(data.total)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Classified</div>
          <div className="stat-value positive">{fmt(data.classified)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Needs classification</div>
          <div className={`stat-value ${data.unclassified > 0 ? 'negative' : ''}`}>{fmt(data.unclassified)}</div>
        </div>
      </div>

      {data.transactions.length === 0 ? (
        <div className="card empty-state">No "Gym" category transactions in the Money Ledger for this month.</div>
      ) : (
        data.transactions.map((t) => (
          <div className="card" key={t.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{t.description || 'Gym'} — {fmt(t.amount)}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>{t.txn_date.slice(0, 10)} · {t.account_name} · Money Ledger transaction #{t.id}</div>
              </div>
              {t.remaining_to_classify > 0 && (
                <button className="btn btn-sm btn-primary" onClick={() => openClassify(t)}>Classify {fmt(t.remaining_to_classify)}</button>
              )}
            </div>

            {t.classifications.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--hairline)' }}>
                {t.classifications.map((c) => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                    <span style={{ textTransform: 'capitalize' }}>{c.purchase_type} — {fmt(c.amount_allocated)} {c.notes && `(${c.notes})`}</span>
                    <button className="icon-btn" onClick={() => removeClassification(c.id)}>Remove</button>
                  </div>
                ))}
              </div>
            )}

            {classifyingId === t.id && (
              <form onSubmit={(e) => submitClassify(e, t.id)} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--hairline)' }}>
                <div className="form-grid">
                  <div className="field"><label>What was this for?</label>
                    <select value={classifyForm.purchase_type} onChange={(e) => setClassifyForm({ ...classifyForm, purchase_type: e.target.value })}>
                      {PURCHASE_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Amount (₹)</label>
                    <input required type="number" step="0.01" value={classifyForm.amount_allocated} onChange={(e) => setClassifyForm({ ...classifyForm, amount_allocated: e.target.value })} />
                  </div>
                  <div className="field"><label>Notes (optional)</label>
                    <input value={classifyForm.notes} onChange={(e) => setClassifyForm({ ...classifyForm, notes: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn btn-primary">Save classification</button>
                  <button type="button" className="btn" onClick={() => setClassifyingId(null)}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        ))
      )}
    </div>
  );
}
