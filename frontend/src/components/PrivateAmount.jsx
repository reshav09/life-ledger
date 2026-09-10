import { usePrivacy } from '../PrivacyContext.jsx';

/**
 * Wrap any sensitive amount with <PrivateAmount id="unique-key">{formatMoney(x)}</PrivateAmount>.
 * When the master privacy switch is off, renders the value plainly.
 * When on, the value is blurred until this specific one is tapped — same
 * font, same color, same layout, just out of focus. Tap again to re-hide it.
 */
export default function PrivateAmount({ id, children, className = '', style = {} }) {
  const { hiddenMode, revealed, toggleReveal } = usePrivacy();

  if (!hiddenMode) {
    return <span className={className} style={style}>{children}</span>;
  }

  const isRevealed = revealed.has(id);

  return (
    <span
      className={`private-amount ${isRevealed ? 'is-revealed' : 'is-blurred'} ${className}`}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        toggleReveal(id);
      }}
      title={isRevealed ? 'Tap to hide' : 'Tap to reveal'}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleReveal(id);
        }
      }}
    >
      {children}
    </span>
  );
}
