import React from 'react';

/**
 * Polished EmptyState component for lists, tables, or charts with no data.
 */
export default function EmptyState({ icon = '📂', title = 'No data yet', description = 'Get started by adding your first entry.', action, style = {} }) {
  return (
    <div
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        background: 'var(--paper-raised)',
        border: '1px dashed var(--hairline)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <h4 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{title}</h4>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--ink-soft)', maxWidth: 360 }}>{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
