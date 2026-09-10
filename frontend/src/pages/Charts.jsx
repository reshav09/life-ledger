import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line
} from 'recharts';
import { api, formatMoney, thisMonth } from '../api.js';
import PrivateAmount from '../components/PrivateAmount.jsx';
import { usePrivacy } from '../PrivacyContext.jsx';

function buildHeatmapCells(month, heatmapData) {
  const [y, m] = month.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startOffset = firstDay.getDay();
  const dataMap = Object.fromEntries(heatmapData.map((d) => [d.date, d.total]));
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ day, date: dateStr, total: dataMap[dateStr] || 0 });
  }
  return cells;
}

function heatOpacity(total, max) {
  if (!total || max <= 0) return 0;
  return 0.18 + (total / max) * 0.72;
}

export default function ChartsPage() {
  const { hiddenMode } = usePrivacy();
  const tooltipFormatter = (v) => (hiddenMode ? '•••••' : formatMoney(v));
  const [month, setMonth] = useState(thisMonth());
  const [byCategory, setByCategory] = useState([]);
  const [trend, setTrend] = useState([]);
  const [netWorth, setNetWorth] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [compare, setCompare] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [month]);

  async function load() {
    setLoading(true);
    const [c, t, nw, hm, cmp] = await Promise.all([
      api.get(`/dashboard/by-category?month=${month}`),
      api.get('/dashboard/trend?months=6'),
      api.get('/dashboard/net-worth?months=12'),
      api.get(`/dashboard/heatmap?month=${month}`),
      api.get(`/dashboard/compare?month=${month}`)
    ]);
    setByCategory(c);
    setTrend(t);
    setNetWorth(nw);
    setHeatmap(hm);
    setCompare(cmp);
    setLoading(false);
  }

  const total = byCategory.reduce((s, c) => s + Number(c.total), 0);
  const heatCells = buildHeatmapCells(month, heatmap);
  const maxDaySpend = Math.max(...heatmap.map((d) => d.total), 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Where does it actually go</div>
        <h1 className="page-title">Charts</h1>
        <p className="page-sub">A category breakdown, spending patterns, and whether you're actually getting ahead.</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14, marginBottom: 20 }}>
        <div className="field" style={{ maxWidth: 200, marginBottom: 0 }}>
          <label>Month</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <a href={`/api/reports/monthly?month=${month}`} target="_blank" rel="noreferrer" className="btn">
          📄 Download monthly report (PDF)
        </a>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title">Net worth — last 12 months</div>
        {netWorth.length === 0 ? (
          <div className="empty-state">Not enough history yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={netWorth}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
              <YAxis tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
              <Tooltip formatter={tooltipFormatter} />
              <Line type="monotone" dataKey="net_worth" name="Net worth" stroke="#2F6F4E" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="two-col">
        <div className="card">
          <div className="section-title">Spend by category — {month}</div>
          {loading ? (
            <div className="empty-state">Loading…</div>
          ) : byCategory.length === 0 ? (
            <div className="empty-state">No expenses logged for this month.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {byCategory.map((c, i) => (
                      <Cell key={i} fill={c.color || '#8B8578'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={tooltipFormatter} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 10 }}>
                {byCategory.map((c) => (
                  <Link
                    to={`/category/${c.id}`}
                    key={c.id}
                    style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderBottom: '1px solid var(--hairline)', textDecoration: 'none', color: 'inherit' }}
                  >
                    <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: c.color, marginRight: 7 }} />{c.icon} {c.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      <PrivateAmount id={`chart-cat-${c.id}`}>{formatMoney(c.total)}</PrivateAmount> <span style={{ color: 'var(--ink-faint)' }}>({total ? ((c.total / total) * 100).toFixed(0) : 0}%)</span>
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="section-title">Daily spend — {month}</div>
          {heatCells.length === 0 ? (
            <div className="empty-state">No data for this month.</div>
          ) : (
            <>
              <div className="heatmap-grid">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <div key={`h-${i}`} style={{ fontSize: 10, textAlign: 'center', color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }}>{d}</div>
                ))}
                {heatCells.map((cell, i) =>
                  cell ? (
                    <div
                      key={cell.date}
                      className="heatmap-cell"
                      title={`${cell.date}: ${formatMoney(cell.total)}`}
                      style={cell.total > 0 ? { background: 'var(--rust)', opacity: heatOpacity(cell.total, maxDaySpend), color: '#fff' } : { background: 'var(--hairline)', opacity: 0.4 }}
                    >
                      {cell.day}
                    </div>
                  ) : (
                    <div key={`empty-${i}`} className="heatmap-cell empty" />
                  )
                )}
              </div>
              <div className="heatmap-legend">
                <span>Less</span>
                <span className="heatmap-legend-swatch" style={{ background: 'var(--rust)', opacity: 0.2 }} />
                <span className="heatmap-legend-swatch" style={{ background: 'var(--rust)', opacity: 0.5 }} />
                <span className="heatmap-legend-swatch" style={{ background: 'var(--rust)', opacity: 0.9 }} />
                <span>More</span>
              </div>
            </>
          )}
        </div>
      </div>

      {compare && compare.deltas.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="section-title">This month vs last — {compare.month} vs {compare.prev_month}</div>
          {compare.deltas.map((d) => (
            <Link
              to={`/category/${d.id}`}
              key={d.id}
              className="delta-row"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <span>{d.icon} {d.name}</span>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                  <PrivateAmount id={`compare-${d.id}-prev`}>{formatMoney(d.previous_total)}</PrivateAmount> → <PrivateAmount id={`compare-${d.id}-cur`}>{formatMoney(d.total)}</PrivateAmount>
                </span>
                <span className={d.pct_change > 0 ? 'delta-up' : d.pct_change < 0 ? 'delta-down' : 'delta-flat'}>
                  {d.pct_change > 0 ? '↑' : d.pct_change < 0 ? '↓' : '–'} {Math.abs(d.pct_change)}%
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <div className="section-title">Income vs expense — last 6 months</div>
        {trend.length === 0 ? (
          <div className="empty-state">Not enough data yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fontFamily: 'IBM Plex Mono' }} />
              <YAxis tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Bar dataKey="income" fill="#2F6F4E" name="Income" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill="#B3432B" name="Expense" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
