import { useState, useRef, useEffect, Children } from 'react';

/**
 * LuxurySelect — Modern Frosted Glass Dropdown
 * Drop-in replacement for native <select> elements.
 * 
 * Supports both:
 * <LuxurySelect value={val} onChange={e => setVal(e.target.value)}>
 *   <option value="1">Option 1</option>
 * </LuxurySelect>
 * 
 * And:
 * <LuxurySelect options={[{ value: '1', label: 'Option 1', icon: '💰' }]} ... />
 */
export default function LuxurySelect({
  value,
  onChange,
  options: directOptions,
  children,
  placeholder = 'Select…',
  disabled = false,
  required = false,
  searchable = undefined,
  name,
  id,
  className = '',
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Extract options from direct array or from <option> children
  const parsedOptions = [];
  if (Array.isArray(directOptions)) {
    parsedOptions.push(...directOptions);
  } else if (children) {
    Children.forEach(children, (child) => {
      if (!child) return;
      if (child.type === 'option') {
        const val = child.props.value !== undefined ? child.props.value : '';
        parsedOptions.push({
          value: String(val),
          label: child.props.children,
          disabled: !!child.props.disabled,
          icon: child.props['data-icon']
        });
      }
    });
  }

  // Selected option
  const selectedStr = value !== undefined && value !== null ? String(value) : '';
  const selectedOption = parsedOptions.find((o) => String(o.value) === selectedStr);

  // Auto-enable search if there are 8 or more items
  const shouldSearch = searchable !== undefined ? searchable : parsedOptions.length >= 8;

  // Filter options based on search query
  const filteredOptions = searchQuery.trim()
    ? parsedOptions.filter((o) => {
        const text = typeof o.label === 'string' ? o.label : String(o.label || '');
        return text.toLowerCase().includes(searchQuery.toLowerCase().trim());
      })
    : parsedOptions;

  // Position calculation (open up vs down)
  function toggleDropdown() {
    if (disabled) return;
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Prefer opening downward if there's reasonable room (>= 260px)
      setOpenUpward(spaceBelow < 260 && spaceAbove > spaceBelow);
      setSearchQuery('');
    }
    setIsOpen((prev) => !prev);
  }

  // Ensure parent card allows overflow and elevates z-index while open
  useEffect(() => {
    if (!containerRef.current) return;
    const parentCard = containerRef.current.closest('.card');
    if (parentCard) {
      if (isOpen) {
        parentCard.classList.add('has-open-dropdown');
      } else {
        parentCard.classList.remove('has-open-dropdown');
      }
    }
    return () => {
      if (parentCard) parentCard.classList.remove('has-open-dropdown');
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && shouldSearch && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 40);
    }
  }, [isOpen, shouldSearch]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  function handleSelect(option) {
    if (option.disabled) return;
    setIsOpen(false);
    if (onChange) {
      // Fire synthetic event compatible with e.target.value
      const syntheticEvent = {
        target: { value: option.value, name: name || id },
        currentTarget: { value: option.value, name: name || id }
      };
      onChange(syntheticEvent);
    }
  }

  return (
    <div
      ref={containerRef}
      className={`luxury-select-wrapper ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''} ${className}`}
      style={style}
    >
      {/* Hidden input for native form accessibility and requirement validation */}
      <input
        type="hidden"
        name={name}
        id={id}
        value={selectedStr}
        required={required}
      />

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        className={`luxury-select-trigger ${selectedOption ? 'has-value' : 'placeholder'}`}
        onClick={toggleDropdown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="luxury-select-content">
          {selectedOption ? (
            <>
              {selectedOption.icon && <span className="luxury-select-icon">{selectedOption.icon}</span>}
              <span className="luxury-select-text">{selectedOption.label}</span>
            </>
          ) : (
            <span className="luxury-select-placeholder">{placeholder}</span>
          )}
        </span>
        <span className={`luxury-select-chevron ${isOpen ? 'open' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {/* Floating Glassmorphic Menu */}
      {isOpen && (
        <div className={`luxury-select-menu ${openUpward ? 'upward' : 'downward'}`} role="listbox">
          {shouldSearch && (
            <div className="luxury-select-search-box">
              <span className="search-glyph">🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                className="luxury-select-search-input"
                placeholder="Type to filter…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  title="Clear"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          <div className="luxury-select-options-list">
            {filteredOptions.length === 0 ? (
              <div className="luxury-select-empty">No options found</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === selectedStr;
                return (
                  <div
                    key={String(opt.value)}
                    className={`luxury-select-option ${isSelected ? 'selected' : ''} ${opt.disabled ? 'disabled' : ''}`}
                    onClick={() => handleSelect(opt)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="luxury-option-left">
                      {opt.icon && <span className="luxury-option-icon">{opt.icon}</span>}
                      <span className="luxury-option-label">{opt.label}</span>
                    </div>
                    {isSelected && (
                      <span className="luxury-option-check">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
