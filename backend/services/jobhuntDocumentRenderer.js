/**
 * jobhuntDocumentRenderer.js - Clean ATS-Compliant Document Renderer
 * Generates printer-ready, ATS-optimized HTML for resumes and cover letters.
 */

function renderAtsHtml({ title, contentMarkdown, type = 'resume' }) {
  const htmlContent = markdownToSimpleHtml(contentMarkdown);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @page {
      size: letter;
      margin: 0.6in 0.7in;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #111827;
      background: #ffffff;
      line-height: 1.45;
      font-size: 11pt;
      margin: 0;
      padding: 24px;
      max-width: 8.5in;
      margin: 0 auto;
    }
    h1 {
      font-size: 20pt;
      font-weight: 700;
      margin: 0 0 4px 0;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    h2 {
      font-size: 12.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #1e293b;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 3px;
      margin: 14px 0 8px 0;
    }
    h3 {
      font-size: 11.5pt;
      font-weight: 600;
      margin: 10px 0 2px 0;
      color: #0f172a;
    }
    p {
      margin: 4px 0 8px 0;
    }
    ul {
      margin: 4px 0 10px 0;
      padding-left: 20px;
    }
    li {
      margin-bottom: 3px;
    }
    a {
      color: #1e40af;
      text-decoration: none;
    }
    hr {
      border: none;
      border-top: 1px solid #cbd5e1;
      margin: 10px 0;
    }
    strong {
      font-weight: 600;
      color: #0f172a;
    }
    .print-bar {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 10px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .print-btn {
      background: #0f172a;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    @media print {
      body {
        padding: 0;
      }
      .print-bar {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <div>
      <strong>ATS Printable Preview:</strong> ${escapeHtml(title)}
    </div>
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
  ${htmlContent}
</body>
</html>`;
}

function markdownToSimpleHtml(md) {
  if (!md) return '';

  return md
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank">$1</a>')
    .replace(/^---$/gim, '<hr>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gims, (match) => `<ul>${match}</ul>`)
    .replace(/<\/ul>\s*<ul>/gim, '')
    .split('\n\n')
    .map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<hr')) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = {
  renderAtsHtml
};
