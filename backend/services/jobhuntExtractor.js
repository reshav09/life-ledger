const pool = require('../db/db');
const { callAI, callAIMultimodal } = require('./aiProvider');
const { decrypt } = require('./crypto');

let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch {
  // Optional fallback
}

/**
 * Fetch and decrypt AI settings for Job Hunt.
 */
async function getAISettings() {
  const [[row]] = await pool.query('SELECT * FROM ai_settings WHERE id = 1');
  if (!row) return null;
  return {
    ...row,
    anthropic_api_key: decrypt(row.anthropic_api_key),
    openai_api_key: decrypt(row.openai_api_key),
    gemini_api_key: decrypt(row.gemini_api_key)
  };
}

const EXTRACTION_SYSTEM_PROMPT = `You are a recruitment intelligence and career data extraction engine.
Your task is to parse unstructured job descriptions, hiring notifications, careers page listings, or government/PSU recruitment notices and extract a strictly valid JSON array of job opportunities.

Schema for each opportunity object:
[
  {
    "title": "Exact job title (e.g. Project Engineer - Cloud & DevOps, Scientist 'SC', Software Engineer)",
    "org_name": "Name of the hiring organization/company (e.g. C-DAC, ISRO, Google)",
    "role_category": "Short classification e.g. DevOps / Cloud, Software Engineering, Data Science, Core Engineering",
    "job_type": "private" | "psu" | "govt" | "research" | "defence" | "other",
    "category": "job" | "internship" | "fellowship" | "exam",
    "required_degree": "Degrees mentioned, e.g. B.Tech / B.E. / M.Tech / BS / MCA",
    "required_branch": "Branches or disciplines, e.g. Computer Science, IT, Electronics, Data Science",
    "min_experience_years": Number (minimum years of experience required, or 0 if fresher eligible, or null if unspecified),
    "min_age": Number or null,
    "max_age": Number or null (general unreserved upper age limit),
    "vacancies": Number or null (total number of vacancies if stated),
    "location": "Job location(s) or City/State/Remote",
    "pay_scale": "Government pay level, scale, or stipend string if mentioned, e.g. Level 10 (₹56,100 - ₹1,77,500)",
    "ctc_min": Number in INR (annual minimum CTC, e.g. 1200000) or null,
    "ctc_max": Number in INR (annual maximum CTC, e.g. 1800000) or null,
    "application_deadline": "YYYY-MM-DD" or null,
    "exam_date": "YYYY-MM-DD" or null,
    "apply_url": "Direct application URL or careers link if found in text",
    "required_skills": ["Skill1", "Skill2", "Skill3"],
    "requires_gate": Boolean (true if this job requires a GATE score/qualification, false otherwise),
    "highlights": "Key highlights: bond details, eligibility caveats, reservation rules, selection process",
    "raw_summary": "Concise 2-3 sentence overview of the role and employer"
  }
]

Strict Rules:
- Output MUST be valid JSON only. Do not wrap in markdown quotes if possible, or use standard markdown \`\`\`json code blocks.
- If a document advertises multiple distinct posts (e.g. Post 1: Scientist/Engineer, Post 2: Technical Assistant), return ONE object for EACH post in the array.
- If CTC or pay is mentioned monthly, convert to annualized INR (e.g. ₹1,00,000/mo -> 1200000).
- If only a pay band is given without private CTC, put it in "pay_scale" and estimate or leave ctc_min/ctc_max as null.
- Dates must be YYYY-MM-DD format. If only a date like "15th October 2026" is given, format as 2026-10-15. If year is missing, assume 2026.
- Do not hallucinate values. If a field like max_age is not mentioned, return null.`;

/**
 * Helper to safely extract JSON from LLM response text.
 */
function parseJsonArray(text) {
  if (!text || typeof text !== 'string') return [];
  let cleaned = text.trim();

  // Strip markdown ```json ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }

  // Attempt direct parse
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // Try finding outer array brackets
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      try {
        const sub = cleaned.substring(firstBracket, lastBracket + 1);
        const parsed = JSON.parse(sub);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {}
    }

    // Try finding outer object braces
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const sub = cleaned.substring(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(sub);
        return [parsed];
      } catch {}
    }
  }

  return [];
}

/**
 * Regex patterns for high-speed deterministic extraction of compensation, GATE, and degrees.
 */
function extractCTCWithRegex(text) {
  if (!text) return null;
  
  // 1. Indian Rupee / LPA patterns: e.g. "₹24 LPA", "20-35 Lakhs", "CTC: Rs. 28,00,000", "30 LPA"
  const lpaRegex = /(?:(?:₹|rs\.?|inr|ctc[:\s]*)\s*)?(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|lac|cr)\b/i;
  const singleLpaRegex = /(?:(?:₹|rs\.?|inr|ctc[:\s]*)\s*)(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|lac)\b/i;
  const rawInrRegex = /(?:₹|rs\.?|inr)\s*(\d{1,2}(?:,\d{2})*,\d{3})/i;

  // 2. USD / EUR / GBP patterns: e.g. "$120,000 - $180,000", "$140k - $200k", "€100,000+"
  const usdRangeRegex = /\$(\d{2,3}(?:,\d{3})*|\d{2,3}k)\s*(?:-|to)\s*\$?(\d{2,3}(?:,\d{3})*|\d{2,3}k)/i;
  const usdSingleRegex = /\$(\d{2,3}(?:,\d{3})*|\d{2,3}k)\b/i;

  let match = text.match(lpaRegex);
  if (match) {
    const minVal = parseFloat(match[1]);
    const maxVal = parseFloat(match[2]);
    const multiplier = text.toLowerCase().includes('cr') ? 10000000 : 100000;
    return {
      ctc_min: minVal * multiplier,
      ctc_max: maxVal * multiplier,
      currency: 'INR',
      display: `₹${minVal} - ₹${maxVal} LPA`,
      confidence: 'medium',
      source: 'regex_range'
    };
  }

  match = text.match(singleLpaRegex);
  if (match) {
    const val = parseFloat(match[1]);
    return {
      ctc_min: val * 100000,
      ctc_max: val * 100000,
      currency: 'INR',
      display: `₹${val} LPA`,
      confidence: 'medium',
      source: 'regex_single'
    };
  }

  match = text.match(usdRangeRegex);
  if (match) {
    const parseUsd = str => {
      let s = str.toLowerCase().replace(/[$,]/g, '');
      if (s.endsWith('k')) return parseFloat(s) * 1000;
      return parseFloat(s);
    };
    const minVal = parseUsd(match[1]);
    const maxVal = parseUsd(match[2]);
    return {
      ctc_min: minVal,
      ctc_max: maxVal,
      currency: 'USD',
      display: `$${(minVal / 1000).toFixed(0)}k - $${(maxVal / 1000).toFixed(0)}k`,
      confidence: 'medium',
      source: 'regex_usd_range'
    };
  }

  match = text.match(usdSingleRegex);
  if (match) {
    let s = match[1].toLowerCase().replace(/[$,]/g, '');
    const val = s.endsWith('k') ? parseFloat(s) * 1000 : parseFloat(s);
    if (val >= 40000) {
      return {
        ctc_min: val,
        ctc_max: val,
        currency: 'USD',
        display: `$${(val / 1000).toFixed(0)}k`,
        confidence: 'medium',
        source: 'regex_usd_single'
      };
    }
  }

  return null;
}

function extractGATEWithRegex(text) {
  if (!text) return false;
  return /\bgate[-\s]?(202\d|score|qualified|examination|mandatory)\b/i.test(text) ||
         /\bvalid gate score\b/i.test(text) ||
         /\bthrough gate\b/i.test(text);
}

/**
 * Sanitize and normalize an extracted opportunity item with confidence metadata.
 */
function normalizeExtractedItem(item, fallbackMeta = {}) {
  const safeNumber = (val) => {
    if (val == null || val === '') return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  };

  const safeDate = (val) => {
    if (!val || typeof val !== 'string') return null;
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return null;
  };

  const skills = Array.isArray(item.required_skills)
    ? item.required_skills.filter(s => s && typeof s === 'string')
    : (typeof item.required_skills === 'string' && item.required_skills ? [item.required_skills] : []);

  const rawCombined = [item.raw_text, fallbackMeta.raw_text, item.highlights, item.title].filter(Boolean).join(' ');

  // ── Confidence Chain Evaluation ──
  // Step 1: ATS structured data
  const isAts = fallbackMeta.source_type && fallbackMeta.source_type.includes('api');
  let compConfidence = isAts ? 'high' : 'low';
  let eligConfidence = isAts ? 'high' : 'low';
  let isLlmDerived = fallbackMeta.is_llm_derived || false;

  let ctcMin = safeNumber(item.ctc_min);
  let ctcMax = safeNumber(item.ctc_max);
  let compDisplay = item.compensation_display || item.pay_scale || '';

  // Step 2: Regex check for compensation if not already provided with high confidence
  if (!ctcMin && !ctcMax) {
    const regexCtc = extractCTCWithRegex(rawCombined);
    if (regexCtc) {
      ctcMin = regexCtc.ctc_min;
      ctcMax = regexCtc.ctc_max;
      compDisplay = regexCtc.display;
      compConfidence = 'medium';
    }
  } else if (!isAts) {
    compConfidence = isLlmDerived ? 'medium' : 'high';
  }

  // GATE extraction
  const requiresGate = item.requires_gate === true || item.requires_gate === 1 || String(item.requires_gate).toLowerCase() === 'true'
    ? 1
    : (extractGATEWithRegex(rawCombined) ? 1 : 0);

  if (requiresGate) eligConfidence = 'high';

  const overallConfidence = (compConfidence === 'high' && eligConfidence === 'high')
    ? 'high'
    : ((compConfidence === 'low' && eligConfidence === 'low') ? 'low' : 'medium');

  const confidenceMetadata = {
    compensation: compConfidence,
    eligibility: eligConfidence,
    overall: overallConfidence,
    is_llm_derived: isLlmDerived,
    source: isAts ? (fallbackMeta.source_type || 'ats_api') : (isLlmDerived ? 'llm_schema' : 'regex_heuristic')
  };

  let minExp = safeNumber(item.min_experience_years);
  if (minExp === null) {
    const normTitle = (item.title || fallbackMeta.title || '').toLowerCase();
    if (/\b(intern|internship|university graduate|early career|entry level|graduate engineer|associate engineer|associate software|sde[- ]?1|software engineer 1|junior)\b/i.test(normTitle)) {
      minExp = 0;
    } else if (/\b(sde[- ]?2|software engineer 2|software engineer ii|mid[- ]?level)\b/i.test(normTitle)) {
      minExp = 2;
    } else if (/\b(senior|sr\.?|lead)\b/i.test(normTitle)) {
      minExp = 5;
    } else if (/\b(staff)\b/i.test(normTitle)) {
      minExp = 7;
    } else if (/\b(principal|architect)\b/i.test(normTitle)) {
      minExp = 8;
    } else if (/\b(director|vice president|\bvp\b|head of|engineering manager)\b/i.test(normTitle)) {
      minExp = 8;
    } else if (rawCombined) {
      const match = rawCombined.match(/(\d+)\+?\s*years(?:\s+of)?\s+(?:relevant\s+|professional\s+|software\s+)?experience/i);
      if (match && match[1]) {
        const parsed = parseInt(match[1], 10);
        if (parsed >= 0 && parsed <= 20) minExp = parsed;
      }
    }
  }

  let reqBranch = (item.required_branch || '').trim();
  const titleToCheck = (item.title || fallbackMeta.title || '').toLowerCase();
  if (!reqBranch && /\b(software|developer|devops|sre|cloud|infrastructure|backend|front[\s-]?end|full[\s-]?stack|systems|data|ml|ai|machine learning|security|finops|quant)\b/i.test(titleToCheck)) {
    reqBranch = 'Computer Science, Information Technology, Software Engineering, Data Science';
  }

  return {
    title: (item.title || fallbackMeta.title || 'Untitled Opportunity').trim(),
    org_name: (item.org_name || fallbackMeta.org_name || '').trim(),
    role_category: (item.role_category || 'General').trim(),
    job_type: ['private', 'psu', 'govt', 'research', 'defence'].includes((item.job_type || '').toLowerCase())
      ? item.job_type.toLowerCase()
      : 'other',
    category: ['job', 'internship', 'fellowship', 'exam'].includes((item.category || '').toLowerCase())
      ? item.category.toLowerCase()
      : 'job',
    required_degree: (item.required_degree || '').trim(),
    required_branch: reqBranch,
    min_experience_years: minExp,
    min_age: safeNumber(item.min_age),
    max_age: safeNumber(item.max_age),
    vacancies: safeNumber(item.vacancies),
    location: (item.location || '').trim(),
    pay_scale: (item.pay_scale || '').trim(),
    ctc_min: ctcMin,
    ctc_max: ctcMax,
    compensation_display: compDisplay,
    application_deadline: safeDate(item.application_deadline),
    exam_date: safeDate(item.exam_date),
    apply_url: (item.apply_url || fallbackMeta.source_url || '').trim(),
    source_url: (fallbackMeta.source_url || item.apply_url || '').trim(),
    source_type: fallbackMeta.source_type || 'ai_ingest',
    required_skills: skills,
    requires_gate: requiresGate,
    highlights: (item.highlights || '').trim(),
    raw_summary: (item.raw_summary || '').trim(),
    raw_text: (fallbackMeta.raw_text || '').substring(0, 10000),
    confidence_metadata: confidenceMetadata,
    is_active_link: 1
  };
}

/**
 * Extract opportunities from raw text or job description.
 */
async function extractFromText(rawText, metadata = {}) {
  if (!rawText || !rawText.trim()) {
    throw new Error('Raw text is empty');
  }

  const settings = await getAISettings();
  if (!settings || !settings.active_provider) {
    throw new Error('No AI provider configured. Please add an API key in AI Settings.');
  }

  const userPrompt = `Extract all job opportunities from the following text into the specified JSON array:
Metadata context:
${metadata.org_name ? `Organization: ${metadata.org_name}` : ''}
${metadata.source_url ? `Source URL: ${metadata.source_url}` : ''}

--- RAW TEXT START ---
${rawText.slice(0, 40000)}
--- RAW TEXT END ---`;

  const aiResult = await callAI(settings, {
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }]
  });

  if (!aiResult.ok) {
    throw new Error(`AI extraction failed: ${aiResult.error}`);
  }

  const items = parseJsonArray(aiResult.text);
  if (items.length === 0) {
    throw new Error('Could not parse structured opportunities from the provided text.');
  }

  return items.map(item => normalizeExtractedItem(item, { ...metadata, raw_text: rawText }));
}

/**
 * Extract opportunities from an uploaded PDF or document buffer/base64.
 */
async function extractFromPDF(fileBase64, mimeType = 'application/pdf', metadata = {}) {
  if (!fileBase64) {
    throw new Error('File data is required');
  }

  const settings = await getAISettings();
  if (!settings || !settings.active_provider) {
    throw new Error('No AI provider configured. Please add an API key in AI Settings.');
  }

  // If active provider is Gemini, use multimodal inline_data which natively handles PDF tables & text
  if (settings.active_provider === 'gemini') {
    const prompt = `Carefully analyze this recruitment notification / PDF document. Extract all distinct posts/opportunities into the required JSON array adhering strictly to the schema.
${metadata.org_name ? `Organization: ${metadata.org_name}` : ''}
${metadata.source_url ? `Source URL: ${metadata.source_url}` : ''}`;

    const aiResult = await callAIMultimodal(settings, {
      system: EXTRACTION_SYSTEM_PROMPT,
      prompt,
      file: {
        fileName: metadata.fileName || 'recruitment_notification.pdf',
        mimeType: mimeType || 'application/pdf',
        base64Data: fileBase64
      }
    });

    if (!aiResult.ok) {
      throw new Error(`Gemini PDF extraction failed: ${aiResult.error}`);
    }

    const items = parseJsonArray(aiResult.text);
    if (items.length === 0) {
      throw new Error('Could not parse structured opportunities from the PDF.');
    }

    return items.map(item => normalizeExtractedItem(item, { ...metadata, source_type: 'pdf_ingest' }));
  }

  // Fallback for providers that don't support raw PDF inline (e.g. extract text first via pdf-parse)
  if (pdfParse) {
    try {
      const buffer = Buffer.from(fileBase64, 'base64');
      const parsedData = await pdfParse(buffer);
      if (parsedData.text && parsedData.text.trim()) {
        return extractFromText(parsedData.text, { ...metadata, source_type: 'pdf_ingest' });
      }
    } catch (pdfErr) {
      console.warn('Local pdf-parse failed, falling back to multimodal:', pdfErr.message);
    }
  }

  // Direct multimodal attempt
  const prompt = `Extract all job opportunities from this recruitment file into the required JSON array.`;
  const aiResult = await callAIMultimodal(settings, {
    system: EXTRACTION_SYSTEM_PROMPT,
    prompt,
    file: {
      fileName: metadata.fileName || 'document.pdf',
      mimeType: mimeType || 'application/pdf',
      base64Data: fileBase64
    }
  });

  if (!aiResult.ok) {
    throw new Error(`Document extraction failed: ${aiResult.error}`);
  }

  const items = parseJsonArray(aiResult.text);
  if (items.length === 0) {
    throw new Error('Could not parse structured opportunities from the document.');
  }

  return items.map(item => normalizeExtractedItem(item, { ...metadata, source_type: 'pdf_ingest' }));
}

module.exports = {
  extractFromText,
  extractFromPDF,
  normalizeExtractedItem,
  getAISettings,
  extractCTCWithRegex,
  extractGATEWithRegex
};
