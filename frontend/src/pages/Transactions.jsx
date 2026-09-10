import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, formatMoney, todayISO, thisMonth } from '../api.js';
import PrivateAmount from '../components/PrivateAmount.jsx';
import { useDialog } from '../components/DialogProvider.jsx';

const emptyForm = { account_id: '', category_id: '', amount: '', type: 'expense', description: '', txn_date: todayISO() };
const emptySalaryForm = { account_id: '', amount: '', label: 'Salary', received_on: todayISO() };
const emptyTemplateForm = { name: '', account_id: '', category_id: '', amount: '', description: '' };

function shiftMonth(monthStr, delta) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export default function Transactions() {
  const { confirm } = useDialog();
  const [searchParams] = useSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categorySpend, setCategorySpend] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [form, setForm] = useState(emptyForm);
  const [salaryForm, setSalaryForm] = useState(emptySalaryForm);
  const [showSalary, setShowSalary] = useState(false);
  const [month, setMonth] = useState(thisMonth());
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState('');

  // Inline row editing — no more scrolling up to a separate form
  const [editingKey, setEditingKey] = useState(null);
  const [rowForm, setRowForm] = useState(null);

  const amountInputRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => { loadStatic(); }, []);
  useEffect(() => { loadTransactions(); }, [month, filterCategory]);
  useEffect(() => {
    const t = setTimeout(() => loadTransactions(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  useEffect(() => {
    if (searchParams.get('focus') === 'search') searchInputRef.current?.focus();
  }, [searchParams]);

  async function loadStatic() {
    const [a, c, tpl] = await Promise.all([api.get('/accounts'), api.get('/categories'), api.get('/templates')]);
    setAccounts(a);
    setCategories(c);
    setTemplates(tpl);
    // Accounts come back pinned-first from the API, so this naturally
    // defaults new entries to whichever bank you use most.
    if (a.length) {
      setForm((f) => ({ ...f, account_id: a[0].id }));
      setSalaryForm((f) => ({ ...f, account_id: a[0].id }));
      setTemplateForm((f) => ({ ...f, account_id: a[0].id }));
    }
    const expenseCats = c.filter((cat) => cat.type === 'expense');
    if (expenseCats.length) {
      setForm((f) => ({ ...f, category_id: expenseCats[0].id }));
      setTemplateForm((f) => ({ ...f, category_id: expenseCats[0].id }));
    }
  }

  async function loadTransactions() {
    setLoading(true);
    let q = `/transactions?month=${month}`;
    if (filterCategory) q += `&category_id=${filterCategory}`;
    if (search.trim()) q += `&search=${encodeURIComponent(search.trim())}`;
    const [txns, sals, catSpend] = await Promise.all([
      api.get(q),
      filterCategory || search.trim() ? Promise.resolve([]) : api.get(`/salary?month=${month}`),
      api.get(`/dashboard/by-category?month=${month}`)
    ]);
    setTransactions(txns);
    setSalaries(sals);
    setCategorySpend(catSpend);
    setLoading(false);
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/transactions', { ...form, amount: Number(form.amount) });
      // Keep account, category and date exactly as they were — only the
      // amount and note clear. This is what makes back-filling a whole
      // day (or a whole month) of expenses fast instead of tedious.
      setForm((f) => ({ ...f, amount: '', description: '' }));
      amountInputRef.current?.focus();
      loadTransactions();
    } catch (err) {
      setError(err.message);
    }
  }

  function startInlineEdit(t) {
    setEditingKey(`${t.kind}-${t.id}`);
    setRowForm({
      account_id: t.account_id,
      category_id: t.category_id,
      amount: t.amount,
      type: t.type,
      description: t.description,
      txn_date: t.txn_date.slice(0, 10)
    });
  }

  function cancelInlineEdit() {
    setEditingKey(null);
    setRowForm(null);
  }

  async function saveInlineEdit(id) {
    await api.put(`/transactions/${id}`, { ...rowForm, amount: Number(rowForm.amount) });
    cancelInlineEdit();
    loadTransactions();
  }

  async function remove(id) {
    if (!await confirm('Delete this entry?', { ledger: 'money', danger: true })) return;
    await api.del(`/transactions/${id}`);
    loadTransactions();
  }

  async function removeSalary(id) {
    if (!await confirm('Delete this salary credit?', { ledger: 'money', danger: true })) return;
    await api.del(`/salary/${id}`);
    loadTransactions();
  }

  async function duplicateEntry(t) {
    await api.post('/transactions', {
      account_id: t.account_id,
      category_id: t.category_id,
      amount: t.amount,
      type: t.type,
      description: t.description,
      txn_date: t.txn_date.slice(0, 10)
    });
    loadTransactions();
  }

  async function submitSalary(e) {
    e.preventDefault();
    await api.post('/salary', { ...salaryForm, amount: Number(salaryForm.amount) });
    setSalaryForm({ ...emptySalaryForm, account_id: accounts[0]?.id || '' });
    setShowSalary(false);
    loadTransactions();
  }

  async function useTemplate(tpl) {
    await api.post(`/templates/${tpl.id}/use`, {});
    loadTransactions();
  }

  async function createTemplate(e) {
    e.preventDefault();
    await api.post('/templates', { ...templateForm, amount: Number(templateForm.amount) });
    setTemplateForm({ ...emptyTemplateForm, account_id: accounts[0]?.id || '', category_id: categories.find((c) => c.type === 'expense')?.id || '' });
    setShowTemplateForm(false);
    const tpl = await api.get('/templates');
    setTemplates(tpl);
  }

  async function deleteTemplate(id) {
    if (!await confirm('Remove this quick-add template?', { ledger: 'money' })) return;
    await api.del(`/templates/${id}`);
    setTemplates(templates.filter((t) => t.id !== id));
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const allIds = transactions.map((t) => t.id);
    setSelectedIds((prev) => (prev.size === allIds.length ? new Set() : new Set(allIds)));
  }

  async function bulkDelete() {
    if (!await confirm(`Delete ${selectedIds.size} selected entr${selectedIds.size === 1 ? 'y' : 'ies'}? This can't be undone.`, { ledger: 'money', danger: true })) return;
    await api.post('/transactions/bulk-delete', { ids: [...selectedIds] });
    setSelectedIds(new Set());
    loadTransactions();
  }

  async function bulkRecategorize() {
    if (!bulkCategoryId) return;
    await api.post('/transactions/bulk-recategorize', { ids: [...selectedIds], category_id: bulkCategoryId });
    setSelectedIds(new Set());
    setBulkCategoryId('');
    loadTransactions();
  }

  const relevantCategories = categories.filter((c) => c.type === form.type || form.type === 'transfer');
  const quickCategories = categories.filter((c) => c.type === 'expense').slice(0, 8);
  const rowEditCategories = categories.filter((c) => c.type === (rowForm?.type || 'expense'));

  const combinedEntries = [
    ...transactions.map((t) => ({ kind: 'transaction', ...t })),
    ...salaries.map((s) => ({
      kind: 'salary',
      id: s.id,
      type: 'income',
      amount: s.amount,
      description: s.label,
      txn_date: s.received_on,
      account_name: s.account_name,
      category_name: 'Salary',
      category_icon: '💰',
      category_color: '#2F6F4E'
    }))
  ].sort((a, b) => new Date(b.txn_date) - new Date(a.txn_date));

  const total =
    transactions.reduce((acc, t) => acc + (t.type === 'expense' ? -Number(t.amount) : Number(t.amount)), 0) +
    salaries.reduce((acc, s) => acc + Number(s.amount), 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Down to the last rupee</div>
        <h1 className="page-title">Transactions</h1>
        <p className="page-sub">Log every expense and every bit of income — food, ebill, a ₹10 auto ride, all of it. Salary goes in separately so your planner can average it.</p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title" style={{ fontSize: 15 }}>
          Quick-add templates
          <button className="btn btn-sm" onClick={() => setShowTemplateForm(!showTemplateForm)}>{showTemplateForm ? 'Cancel' : '+ New template'}</button>
        </div>
        {templates.length === 0 && !showTemplateForm ? (
          <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>No templates yet — save one for anything you log often, like "Morning coffee ₹40".</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {templates.map((t) => (
              <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <button type="button" className="template-chip" onClick={() => useTemplate(t)} title={`Log ${formatMoney(t.amount)} to ${t.account_name}, dated today`}>
                  {t.category_icon} {t.name} · {formatMoney(t.amount)}
                </button>
                <button className="icon-btn" onClick={() => deleteTemplate(t.id)} title="Remove template">✕</button>
              </span>
            ))}
          </div>
        )}
        {showTemplateForm && (
          <form onSubmit={createTemplate} style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--hairline)' }}>
            <div className="form-grid">
              <div className="field">
                <label>Template name</label>
                <input required placeholder="e.g. Morning coffee" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} />
              </div>
              <div className="field">
                <label>Amount (₹)</label>
                <input required type="number" step="0.01" value={templateForm.amount} onChange={(e) => setTemplateForm({ ...templateForm, amount: e.target.value })} />
              </div>
              <div className="field">
                <label>Account</label>
                <select required value={templateForm.account_id} onChange={(e) => setTemplateForm({ ...templateForm, account_id: e.target.value })}>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Category</label>
                <select required value={templateForm.category_id} onChange={(e) => setTemplateForm({ ...templateForm, category_id: e.target.value })}>
                  {categories.filter((c) => c.type === 'expense').map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Note (optional)</label>
                <input value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Save template</button>
          </form>
        )}
      </div>

      <div className="two-col">
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Add entry</div>
            <form onSubmit={submit}>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Quick category</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {quickCategories.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setForm({ ...form, type: 'expense', category_id: c.id })}
                      className="badge"
                      style={{
                        background: form.category_id === c.id ? c.color : (c.color || '#ddd') + '18',
                        color: form.category_id === c.id ? '#fff' : c.color,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 12.5
                      }}
                    >
                      {c.icon} {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, category_id: '' })}>
                    <option value="expense">Expense</option>
                    <option value="income">Other income</option>
                  </select>
                </div>
                <div className="field">
                  <label>Amount (₹)</label>
                  <input
                    ref={amountInputRef}
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="e.g. 10"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Account</label>
                  <select required value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.is_pinned ? '★ ' : ''}{a.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Category</label>
                  <select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                    <option value="">Select category</option>
                    {relevantCategories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Date</label>
                  <input required type="date" value={form.txn_date} onChange={(e) => setForm({ ...form, txn_date: e.target.value })} />
                </div>
                <div className="field">
                  <label>Note</label>
                  <input placeholder="e.g. Rapido to office" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: -6, marginBottom: 14 }}>
                Account and date stay put after you add one, so back-filling a whole day is quick.
              </div>
              {error && <div style={{ color: 'var(--rust)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn-primary">Add entry</button>
                <button type="button" className="btn" style={{ marginLeft: 'auto' }} onClick={() => setShowSalary(!showSalary)}>
                  {showSalary ? 'Hide salary form' : '💰 Log salary instead'}
                </button>
              </div>
            </form>

            {showSalary && (
              <form onSubmit={submitSalary} style={{ marginTop: 18, paddingTop: 18, borderTop: '1px dashed var(--hairline)' }}>
                <div className="form-grid">
                  <div className="field">
                    <label>Amount (₹)</label>
                    <input required type="number" step="0.01" value={salaryForm.amount} onChange={(e) => setSalaryForm({ ...salaryForm, amount: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Credited to</label>
                    <select required value={salaryForm.account_id} onChange={(e) => setSalaryForm({ ...salaryForm, account_id: e.target.value })}>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.is_pinned ? '★ ' : ''}{a.name}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Label</label>
                    <input value={salaryForm.label} onChange={(e) => setSalaryForm({ ...salaryForm, label: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Received on</label>
                    <input required type="date" value={salaryForm.received_on} onChange={(e) => setSalaryForm({ ...salaryForm, received_on: e.target.value })} />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary">Log salary credit</button>
              </form>
            )}
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">Filter</div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Month</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" className="btn btn-sm" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ flex: 1, textAlign: 'center' }} />
                <button type="button" className="btn btn-sm" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
              </div>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Search notes</label>
              <input ref={searchInputRef} placeholder="e.g. Rapido, groceries…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Category</label>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, paddingTop: 8, borderTop: '1px solid var(--hairline)' }}>
              <span style={{ color: 'var(--ink-soft)' }}>Net for period</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: total >= 0 ? 'var(--green)' : 'var(--rust)' }}>
                <PrivateAmount id="txns-net-period">{formatMoney(total)}</PrivateAmount>
              </span>
            </div>
          </div>

          {categorySpend.length > 0 && (
            <div className="card">
              <div className="section-title" style={{ fontSize: 15 }}>Spent this month</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {categorySpend.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setFilterCategory(String(c.id))}
                    className="badge"
                    style={{ background: (c.color || '#ddd') + '18', color: c.color, border: 'none', cursor: 'pointer' }}
                    title="Click to filter the list to this category"
                  >
                    {c.icon} {c.name} · <PrivateAmount id={`txns-catstrip-${c.id}`}>{formatMoney(c.total)}</PrivateAmount>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <div className="section-title">Entries — {monthLabel(month)}</div>

        {selectedIds.size > 0 && (
          <div className="bulk-bar">
            <span>{selectedIds.size} selected</span>
            <select value={bulkCategoryId} onChange={(e) => setBulkCategoryId(e.target.value)}>
              <option value="">Recategorize to…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
            <button className="btn btn-sm" onClick={bulkRecategorize} disabled={!bulkCategoryId}>Apply</button>
            <button className="btn btn-sm btn-danger" style={{ marginLeft: 'auto' }} onClick={bulkDelete}>Delete selected</button>
            <button className="btn btn-sm" onClick={() => setSelectedIds(new Set())}>Clear</button>
          </div>
        )}

        {transactions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12.5, color: 'var(--ink-soft)' }}>
            <input
              type="checkbox"
              className="row-checkbox"
              checked={selectedIds.size === transactions.length && transactions.length > 0}
              onChange={toggleSelectAll}
            />
            Select all {transactions.length} transaction{transactions.length === 1 ? '' : 's'} this month
          </div>
        )}

        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : combinedEntries.length === 0 ? (
          <div className="card empty-state">No entries for this filter yet.</div>
        ) : (
          <div className="ledger">
            {combinedEntries.map((t) => {
              const key = `${t.kind}-${t.id}`;
              if (editingKey === key && rowForm) {
                return (
                  <div className="ledger-row inline-edit-row" key={key}>
                    <div className="form-grid" style={{ flex: 1, marginBottom: 10 }}>
                      <div className="field">
                        <label>Amount</label>
                        <input autoFocus type="number" step="0.01" value={rowForm.amount} onChange={(e) => setRowForm({ ...rowForm, amount: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>Type</label>
                        <select value={rowForm.type} onChange={(e) => setRowForm({ ...rowForm, type: e.target.value, category_id: '' })}>
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>Account</label>
                        <select value={rowForm.account_id} onChange={(e) => setRowForm({ ...rowForm, account_id: e.target.value })}>
                          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label>Category</label>
                        <select value={rowForm.category_id} onChange={(e) => setRowForm({ ...rowForm, category_id: e.target.value })}>
                          {rowEditCategories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label>Date</label>
                        <input type="date" value={rowForm.txn_date} onChange={(e) => setRowForm({ ...rowForm, txn_date: e.target.value })} />
                      </div>
                      <div className="field">
                        <label>Note</label>
                        <input value={rowForm.description} onChange={(e) => setRowForm({ ...rowForm, description: e.target.value })} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => saveInlineEdit(t.id)}>Save</button>
                      <button className="btn btn-sm" onClick={cancelInlineEdit}>Cancel</button>
                    </div>
                  </div>
                );
              }
              return (
                <div className="ledger-row" key={key}>
                  {t.kind === 'transaction' ? (
                    <input
                      type="checkbox"
                      className="row-checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleSelect(t.id)}
                    />
                  ) : (
                    <span style={{ width: 16, flexShrink: 0 }} />
                  )}
                  <div className="ledger-icon">{t.category_icon}</div>
                  <div className="ledger-desc">
                    <div className="ledger-title">
                      {t.description || t.category_name}
                      {t.kind === 'salary' && <span className="badge green" style={{ marginLeft: 8 }}>salary</span>}
                    </div>
                    <div className="ledger-meta">{t.category_name} · {t.account_name} · {new Date(t.txn_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <div className="ledger-leader" />
                  <div className={`ledger-amount ${t.type}`}>
                    <PrivateAmount id={`txn-${t.kind}-${t.id}`}>{t.type === 'expense' ? '−' : '+'}{formatMoney(t.amount)}</PrivateAmount>
                  </div>
                  <div className="ledger-actions">
                    {t.kind === 'transaction' ? (
                      <>
                        <button className="icon-btn" onClick={() => duplicateEntry(t)} title="Log another entry just like this one">Duplicate</button>
                        <button className="icon-btn" onClick={() => startInlineEdit(t)}>Edit</button>
                        <button className="icon-btn" onClick={() => remove(t.id)}>Delete</button>
                      </>
                    ) : (
                      <button className="icon-btn" onClick={() => removeSalary(t.id)}>Delete</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
