import React from 'react';

// Helper to parse inline styles: bold **text**, inline `code`, italic *text*
function parseInline(text) {
  if (!text) return null;

  // Split by markdown bold, inline code, and italic
  const tokens = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);

  return tokens.map((tok, i) => {
    if (tok.startsWith('**') && tok.endsWith('**')) {
      return (
        <strong key={i} style={{ fontWeight: 650, color: 'var(--ink)' }}>
          {tok.slice(2, -2)}
        </strong>
      );
    }
    if (tok.startsWith('`') && tok.endsWith('`')) {
      return (
        <code
          key={i}
          style={{
            background: 'var(--input-bg)',
            border: '1px solid var(--hairline)',
            padding: '2px 6px',
            borderRadius: 5,
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--green)'
          }}
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    if (tok.startsWith('*') && tok.endsWith('*') && tok.length > 2) {
      return (
        <em key={i} style={{ fontStyle: 'italic', color: 'var(--ink-soft)' }}>
          {tok.slice(1, -1)}
        </em>
      );
    }
    return tok;
  });
}

export default function FormattedAIContent({ content }) {
  if (!content) return null;

  const lines = String(content).split('\n');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '13.5px', lineHeight: 1.65 }}>
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return <div key={idx} style={{ height: 4 }} />;

        // Horizontal rule ---
        if (line === '---' || line === '***') {
          return (
            <hr
              key={idx}
              style={{
                border: 'none',
                borderTop: '1px dashed var(--hairline)',
                margin: '10px 0'
              }}
            />
          );
        }

        // Heading 3: ### Title
        if (line.startsWith('### ')) {
          return (
            <div
              key={idx}
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--ink)',
                marginTop: idx === 0 ? 0 : 12,
                marginBottom: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span style={{ color: 'var(--green)', fontSize: 13 }}>✦</span>
              <span>{parseInline(line.replace(/^###\s+/, ''))}</span>
            </div>
          );
        }

        // Heading 4: #### Title
        if (line.startsWith('#### ')) {
          return (
            <div
              key={idx}
              style={{
                fontSize: '13.8px',
                fontWeight: 650,
                color: 'var(--ink)',
                marginTop: 8,
                marginBottom: 2
              }}
            >
              {parseInline(line.replace(/^####\s+/, ''))}
            </div>
          );
        }

        // Numbered item: 1. **Title**: Description
        const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          const num = numMatch[1];
          const rest = numMatch[2];
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                marginTop: 4,
                padding: '6px 10px',
                background: 'var(--paper-hover)',
                borderRadius: 8,
                border: '1px solid var(--hairline)'
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'var(--green-soft)',
                  color: 'var(--green)',
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0
                }}
              >
                {num}
              </span>
              <div style={{ flex: 1 }}>{parseInline(rest)}</div>
            </div>
          );
        }

        // Bullet item: * or - or •
        const bulletMatch = line.match(/^([*•\-]|(\*\s+))\s*(.*)$/);
        if (bulletMatch && !line.startsWith('***')) {
          const rest = bulletMatch[3];
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: 9,
                alignItems: 'flex-start',
                paddingLeft: 6
              }}
            >
              <span style={{ color: 'var(--green)', fontSize: 14, lineHeight: '21px', flexShrink: 0 }}>•</span>
              <div style={{ flex: 1 }}>{parseInline(rest)}</div>
            </div>
          );
        }

        // Regular paragraph
        return <div key={idx}>{parseInline(line)}</div>;
      })}
    </div>
  );
}
