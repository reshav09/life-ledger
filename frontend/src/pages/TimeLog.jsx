import { useEffect, useState, useMemo } from 'react';
import { api, todayISO } from '../api.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

function nDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function shortDate(dateStr) {
  if (!dateStr) return '';
  // Handle ISO strings or YYYY-MM-DD
  const clean = String(dateStr).slice(0, 10);
  const d = new Date(clean + 'T12:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function fullDate(dateStr) {
  if (!dateStr) return '';
  const clean = String(dateStr).slice(0, 10);
  const d = new Date(clean + 'T12:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Custom tooltip styled for dark theme
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={{
      background: 'var(--surface, #1e1e1e)',
      border: '1px solid var(--hairline)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12.5,
      color: 'var(--ink)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      maxWidth: 220
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--ink-soft)', fontSize: 11.5 }}>
        {fullDate(label)}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.fill || p.color, display: 'inline-block', flexShrink: 0 }} />
            {p.name}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{Number(p.value).toFixed(1)}h</span>
        </div>
      ))}
    </div>
  );
}

// Custom pie tooltip
function PieTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0];
  return (
    <div style={{
      background: 'var(--surface, #1e1e1e)',
      border: '1px solid var(--hairline)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 13,
      color: 'var(--ink)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.payload?.color || d.color, display: 'inline-block' }} />
        <strong>{d.name}</strong>
      </div>
      <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)' }}>
        {Number(d.value).toFixed(1)}h ({((d.payload?.percent || 0) * 100).toFixed(0)}%)
      </div>
    </div>
  );
}

export default function TimeLog() {
  const [range, setRange] = useState('7');
  const [summary, setSummary] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const from = nDaysAgo(Number(range));
  const to = todayISO();

  useEffect(() => { load(); }, [range]);

  async function load() {
    setLoading(true);
    const [sum, lg] = await Promise.all([
      api.get(`/routine/summary?from=${from}&to=${to}`),
      api.get(`/routine/logs?from=${from}&to=${to}`)
    ]);
    setSummary(sum);
    setLogs(lg);
    setLoading(false);
  }

  const totalHours = summary.reduce((s, r) => s + Number(r.total_hours), 0);
  const pieData = summary.filter((r) => Number(r.total_hours) > 0).map((r) => ({
    name: r.name, value: Number(r.total_hours), color: r.color, icon: r.icon
  }));

  // Group logs by date for the bar chart — normalize date keys to YYYY-MM-DD
  const barData = useMemo(() => {
    const byDate = {};
    logs.forEach((l) => {
      const dateKey = String(l.log_date).slice(0, 10);
      if (!byDate[dateKey]) byDate[dateKey] = { date: dateKey };
      byDate[dateKey][l.activity_name] = Number(l.hours);
    });
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [logs]);

  const activityNames = [...new Set(logs.map((l) => l.activity_name))];

  // Build a color map
  const colorMap = {};
  summary.forEach((r) => { colorMap[r.name] = r.color; });

  if (loading) return <div className="empty-state">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Where did the time go?</div>
        <h1 className="page-title">Time Log</h1>
        <p className="page-sub">See how you've been spending your hours over the past days.</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Show last</span>
        {['7', '14', '30'].map((r) => (
          <button key={r} className={`btn btn-sm ${range === r ? 'btn-primary' : ''}`}
            onClick={() => setRange(r)}>
            {r} days
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-label">Total Hours Logged</div>
          <div className="stat-value">{totalHours.toFixed(1)}h</div>
          <div className="stat-note">Across {Number(range)} days</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Daily Average</div>
          <div className="stat-value">{(totalHours / Number(range)).toFixed(1)}h</div>
          <div className="stat-note">Per day average</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Activities Tracked</div>
          <div className="stat-value">{pieData.length}</div>
          <div className="stat-note">With logged hours</div>
        </div>
      </div>

      <div className="two-col">
        {/* Stacked bar chart */}
        <div>
          <div className="section-title">📊 Daily Breakdown</div>
          <div className="card" style={{ padding: '16px 8px' }}>
            {barData.length === 0 ? (
              <div className="empty-state">No logged data in this range. Start logging on the Today page!</div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={barData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'var(--ink-soft)' }}
                    tickFormatter={shortDate}
                    axisLine={{ stroke: 'var(--hairline)' }}
                    tickLine={{ stroke: 'var(--hairline)' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--ink-soft)' }}
                    unit="h"
                    axisLine={{ stroke: 'var(--hairline)' }}
                    tickLine={{ stroke: 'var(--hairline)' }}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  {activityNames.map((name) => (
                    <Bar key={name} dataKey={name} stackId="a" fill={colorMap[name] || '#8B8578'} radius={[2, 2, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Pie + breakdown table */}
        <div>
          <div className="section-title">🥧 Time Distribution</div>
          <div className="card">
            {pieData.length === 0 ? (
              <div className="empty-state">No data yet.</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={40}
                      paddingAngle={2}
                      label={false}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="var(--surface, #1e1e1e)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11.5, color: 'var(--ink-soft)', paddingTop: 8 }}
                      formatter={(value) => {
                        // Truncate long names in legend
                        return value.length > 14 ? value.slice(0, 12) + '…' : value;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ marginTop: 12 }}>
                  {summary.filter((r) => Number(r.total_hours) > 0).map((r) => (
                    <div className="delta-row" key={r.id}>
                      <span>{r.icon} {r.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {Number(r.total_hours).toFixed(1)}h
                        <span style={{ fontSize: 11, color: 'var(--ink-faint)', marginLeft: 6 }}>
                          ({r.days_logged}d)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
