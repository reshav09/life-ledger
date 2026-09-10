import React from 'react';

/**
 * Modern StatCard component with metric values, icon, label, and percentage changes.
 */
export default function StatCard({ label, value, subtext, icon, trend, color = 'var(--ink)', onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--paper-raised)',
        border: '1px solid var(--hairline)',
        borderRadius: 8,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease'
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px var(--shadow)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-soft)' }}>
          {label}
        </span>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      </div>

      <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: 'var(--font-display, inherit)', margin: '4px 0' }}>
        {value}
      </div>

      {(subtext || trend !== undefined) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-faint)', marginTop: 4 }}>
          {trend !== undefined && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 6px',
                borderRadius: 4,
                fontWeight: 600,
                fontSize: 11,
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
