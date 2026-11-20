import React from 'react';

/**
 * Universal Modern Editorial Segmented Control
 */
export default function SegmentedControl({ options, value, onChange, style }) {
  return (
    <div className="segmented-control" style={style} role="tablist">
      {options.map((opt) => {
        const id = typeof opt === 'string' ? opt : opt.value ?? opt.id;
        const label = typeof opt === 'string' ? opt : opt.label;
        const count = typeof opt === 'object' && opt.count !== undefined ? opt.count : null;
        const icon = typeof opt === 'object' && opt.icon ? opt.icon : null;
        const isActive = value === id;

        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`segmented-item ${isActive ? 'active' : ''}`}
            onClick={() => onChange(id)}
          >
            {icon && <span style={{ marginRight: 5 }}>{icon}</span>}
            <span>{label}</span>
            {count !== null && (
              <span
                style={{
                  marginLeft: 6,
                  padding: '1px 6px',
                  borderRadius: 10,
                  fontSize: 10.5,
                  background: isActive ? 'var(--hairline)' : 'rgba(0,0,0,0.06)',
                  color: isActive ? 'var(--ink)' : 'var(--ink-faint)',
                  fontWeight: 600
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

