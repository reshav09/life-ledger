import { useEffect } from 'react';

/**
 * Universal Modern Editorial Drawer (Slide-Over Inspector)
 */
export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  children,
  footer,
  width = 520
}) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        className="drawer-panel"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Sticky Header */}
        <div className="drawer-header">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
                {title}
              </h2>
              {badge}
            </div>
            {subtitle && (
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 4 }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Close drawer"
            style={{ fontSize: 18, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="drawer-body">
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="drawer-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

