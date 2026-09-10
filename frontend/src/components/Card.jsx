import React from 'react';

/**
 * Reusable Card component matching the paper-raised ledger aesthetic.
 */
export default function Card({ title, subtitle, action, children, className = '', style = {} }) {
  return (
    <div className={`card ${className}`} style={{ background: 'var(--paper-raised)', border: '1px solid var(--hairline)', borderRadius: 8, padding: '18px 20px', ...style }}>
      {(title || subtitle || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, borderBottom: '1px solid var(--hairline)', paddingBottom: 10 }}>
          <div>
            {title && <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{title}</h3>}
            {subtitle && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ink-soft)' }}>{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
