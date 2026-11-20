import React from 'react';

/**
 * Modern Editorial StatCard component with interactive filter state,
 * metric values, icon, label, and trend indicators.
 */
export default function StatCard({
  label,
  value,
  subtext,
  icon,
  trend,
  color = 'var(--ink)',
  active = false,
  onClick,
  style
}) {
  return (
    <div
      onClick={onClick}
      className={`kpi-card ${active ? 'active' : ''}`}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: active ? 'var(--green)' : 'var(--ink-soft)' }}>
          {label}
        </span>
        {icon && <span style={{ fontSize: 17, opacity: active ? 1 : 0.75 }}>{icon}</span>}
      </div>

      <div style={{ fontSize: 24, fontWeight: 700, color: active ? 'var(--green)' : color, fontFamily: 'var(--font-mono, inherit)', margin: '2px 0 6px 0' }}>
        {value}
      </div>

      {(subtext || trend !== undefined) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-faint)' }}>
          {trend !== undefined && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '1px 5px',
                borderRadius: 4,
                fontWeight: 600,
                fontSize: 10.5,
                background: trend > 0 ? 'var(--green-soft)' : trend < 0 ? 'var(--rust-soft)' : 'var(--hairline)',
                color: trend > 0 ? 'var(--green)' : trend < 0 ? 'var(--rust)' : 'var(--ink-soft)'
              }}
            >
              {trend > 0 ? `+${trend}%` : `${trend}%`}
            </span>
          )}
          {subtext && <span>{subtext}</span>}
        </div>
      )}
    </div>
  );
}
