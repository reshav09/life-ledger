/**
 * Job Hunt Scoring Engine
 * 
 * Pure-function module — no DB access, no side effects.
 * Takes a profile, opportunity, and org, and returns a scored breakdown.
 * 
 * All scores are 0-100. The composite opportunity_score is a weighted sum.
 * "competition_signal" is explicitly labeled as an ESTIMATE — we never
 * pretend to know actual applicant counts for govt/PSU recruitments.
 */

// ── Scoring weights (sum = 1.0) ──
const WEIGHTS = {
  eligibility:            0.25,
  profile_match:          0.20,
  compensation:           0.15,
  career_potential:       0.10,
  competition_signal:     0.05,
  application_difficulty: 0.05,
  org_quality:            0.10,
  deadline_urgency:       0.10
};

// ── Recommendation thresholds ──
const THRESHOLDS = {
  apply_now:       75,
  worth_applying:  55,
  investigate:     35
  // below 35 = ignore
};

/**
 * Parse a JSON array string safely, returning [] on failure.
 */
function parseJsonArray(str) {
  if (!str) return [];
  if (Array.isArray(str)) return str;
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Normalize strings for fuzzy matching (lowercase, trim, collapse whitespace).
 */
function norm(s) {
  return (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if string a "contains" or "matches" string b (fuzzy).
 */
function fuzzyMatch(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

// ── Conceptual semantic matching & vectorizer ──
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will',
  'with', 'this', 'but', 'they', 'have', 'had', 'what', 'when', 'where', 'who',
  'which', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'can', 'just', 'should', 'now', 'role', 'team', 'work', 'working', 'job', 'opportunity'
]);

const SEMANTIC_CLUSTERS = [
  ['microservices', 'distributed systems', 'service oriented architecture', 'soa', 'grpc', 'event driven', 'kafka', 'message queue'],
  ['devops', 'sre', 'site reliability', 'platform engineering', 'infrastructure', 'ci/cd', 'continuous integration', 'github actions'],
  ['cloud', 'aws', 'gcp', 'google cloud', 'azure', 'cloud native', 'terraform', 'iac'],
  ['container', 'docker', 'kubernetes', 'k8s', 'orchestration', 'helm'],
  ['finops', 'cloud financial', 'cost optimization', 'cloud economics', 'infrastructure spend'],
  ['database', 'sql', 'postgresql', 'postgres', 'mysql', 'nosql', 'mongodb', 'redis'],
  ['python', 'fastapi', 'flask', 'django', 'backend', 'api development'],
  ['machine learning', 'ml', 'deep learning', 'artificial intelligence', 'ai', 'data science', 'llm', 'nlp'],
  ['monitoring', 'observability', 'prometheus', 'grafana', 'datadog', 'opentelemetry'],
  ['systems', 'low latency', 'concurrency', 'multithreading', 'performance', 'linux', 'unix']
];

function tokenize(text) {
  if (!text) return [];
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));

  const tokens = [...words];
  for (let i = 0; i < words.length - 1; i++) {
    tokens.push(`${words[i]} ${words[i + 1]}`);
  }
  return tokens;
}

function expandTokens(tokens) {
  const tokenSet = new Set(tokens);
  const expanded = [...tokens];
  for (const cluster of SEMANTIC_CLUSTERS) {
    const hasClusterMember = cluster.some(term => tokenSet.has(term));
    if (hasClusterMember) {
      for (const term of cluster) {
        if (!tokenSet.has(term)) {
          expanded.push(term);
          tokenSet.add(term);
        }
      }
    }
  }
  return expanded;
}

/**
 * Computes semantic similarity (0-100) between candidate profile and opportunity description.
 * Bridges terminology gaps like "microservices" <-> "distributed systems".
 */
function computeSemanticSimilarity(profile, opp) {
  const profileParts = [
    profile.summary || '',
    (parseJsonArray(profile.skills) || []).join(' '),
    (parseJsonArray(profile.projects) || []).map(p => `${p.title || ''} ${p.tech_stack || ''} ${p.description || ''}`).join(' '),
    (parseJsonArray(profile.experience) || []).map(e => `${e.role || ''} ${e.company || ''} ${e.highlights || ''}`).join(' '),
    (parseJsonArray(profile.achievements) || []).map(a => `${a.title || ''} ${a.description || ''}`).join(' ')
  ];
  const profileText = profileParts.join(' ');

  const oppParts = [
    opp.title || '',
    opp.role_category || '',
    (parseJsonArray(opp.required_skills) || []).join(' '),
    opp.highlights || '',
    opp.raw_summary || '',
    (opp.raw_text || '').slice(0, 5000)
  ];
  const oppText = oppParts.join(' ');

  if (!profileText.trim() || !oppText.trim()) return 60;

  const profTokens = expandTokens(tokenize(profileText));
  const oppTokens = expandTokens(tokenize(oppText));

  const profFreq = {};
  for (const t of profTokens) profFreq[t] = (profFreq[t] || 0) + 1;
  const oppFreq = {};
  for (const t of oppTokens) oppFreq[t] = (oppFreq[t] || 0) + 1;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const term in profFreq) {
    normA += profFreq[term] * profFreq[term];
    if (oppFreq[term]) {
      dotProduct += profFreq[term] * oppFreq[term];
    }
  }
  for (const term in oppFreq) {
    normB += oppFreq[term] * oppFreq[term];
  }

  if (normA === 0 || normB === 0) return 50;
  const cosine = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  const scaledScore = Math.min(100, Math.max(20, Math.round(cosine * 160)));
  return scaledScore;
}

// ────────────────────────────────────────────────────────────────
// Individual dimension scorers
// ────────────────────────────────────────────────────────────────

/**
 * Detect if an opportunity requires a GATE score.
 */
function isGateMandatory(opp) {
  if (opp.requires_gate === 1 || opp.requires_gate === true || String(opp.requires_gate) === '1') return true;
  
  const textToCheck = [
    opp.title || '',
    opp.raw_text || '',
    opp.notes || '',
    opp.required_skills || '',
    opp.highlights || ''
  ].join(' ').toLowerCase();

  // Explicit GATE mentions
  if (
    /\bgate[-\s]?(202\d|score|qualified|examination|exam)\b/i.test(textToCheck) ||
    /\bthrough gate\b/i.test(textToCheck) ||
    /\bvalid gate score\b/i.test(textToCheck) ||
    /\bgraduate aptitude test in engineering\b/i.test(textToCheck)
  ) {
    return true;
  }


  return false;
}

/**
 * Eligibility: Can you even apply? (degree, branch, age, experience, GATE)
 * Returns 0-100 where 100 = fully eligible, 0 = clearly ineligible.
 */
function scoreEligibility(profile, opp) {
  const normTitle = norm(opp.title);

  const candExp = Number(profile.experience_years) || 0;
  // 3. Strict GATE Check: If role mandates GATE and candidate has not given GATE, eligibility = 0!
  if (isGateMandatory(opp) && (!profile.has_gate || profile.has_gate === 0 || profile.has_gate === '0')) {
    return 0;
  }

  // 4. Strict Branch Knockout:
  // If the job explicitly mandates non-CS disciplines (Civil, Mechanical, Chemical, etc.) without CS/IT/Data/Software,
  // the candidate is NOT eligible (eligibility = 0).
  if (opp.required_branch && norm(opp.required_branch).length > 2) {
    const reqBranch = norm(opp.required_branch);
    const isExclusivelyNonCS = /\b(civil|mechanical|chemical|metallurgy|mining|petroleum|marine|biotechnology|textile|architecture|law|accounting|medical|nursing)\b/i.test(reqBranch) &&
      !/\b(computer|cs|it|information technology|software|data|artificial intelligence|ai|machine learning|electronics|ece)\b/i.test(reqBranch);

    if (isExclusivelyNonCS) {
      return 0; // Hard knockout
    }
  }

  // 5. Strict Experience Knockout:
  // If role asks for > candExp + 1.5 years (e.g. requires 3, 4, 5+ yrs and candidate has 0-1 yr),
  // candidate cannot apply.
  const minExp = opp.min_experience_years != null ? Number(opp.min_experience_years) : null;
  if (minExp !== null && minExp > candExp + 1.5) {
    return 0; // Hard knockout
  }

  let checks = 0;
  let passes = 0;

  // Extract all degrees and branches across profile.degree, profile.branch, and education array
  const eduList = parseJsonArray(profile.education);
  const allDegrees = [profile.degree, ...eduList.map(e => e.degree || '')].filter(Boolean);
  const allBranches = [profile.branch, ...eduList.map(e => e.branch || '')].filter(Boolean);

  // Degree match
  if (opp.required_degree && norm(opp.required_degree).length > 2) {
    checks++;
    const reqDeg = norm(opp.required_degree);
    const matchesAny = allDegrees.some(d => fuzzyMatch(d, reqDeg)) ||
      reqDeg.includes('any') ||
      reqDeg.includes('b.tech') ||
      reqDeg.includes('b.e') ||
      reqDeg.includes('b.sc') ||
      reqDeg.includes('bachelor') ||
      reqDeg.includes('graduation') ||
      reqDeg.includes('degree');
    if (matchesAny) {
      passes++;
    }
  }

  // Branch match (DO NOT check generic 'engineering' - must match CS/IT/Data/Software/Electronics)
  if (opp.required_branch && norm(opp.required_branch).length > 2) {
    checks++;
    const reqBranch = norm(opp.required_branch);
    const matchesAny = allBranches.some(b => fuzzyMatch(b, reqBranch)) ||
      reqBranch.includes('any') ||
      reqBranch.includes('cs') ||
      reqBranch.includes('computer') ||
      reqBranch.includes('data') ||
      reqBranch.includes('it') ||
      reqBranch.includes('information') ||
      reqBranch.includes('software');
    if (matchesAny) {
      passes++;
    }
  }

  // Experience tolerance
  if (minExp !== null && minExp > 0) {
    checks++;
    if (candExp >= minExp) {
      passes++;
    } else if (candExp >= minExp - 1) {
      // Borderline (e.g. asks for 2 yrs, user has 1 yr)
      passes += 0.5;
    }
  }

  // Age
  if (opp.max_age != null && opp.max_age > 0) {
    checks++;
    if (!profile.age || profile.age <= opp.max_age) {
      passes++;
    }
  }
  if (opp.min_age != null && opp.min_age > 0) {
    checks++;
    if (!profile.age || profile.age >= opp.min_age) {
      passes++;
    }
  }

  if (checks === 0) {
    // If no eligibility criteria given, infer based on title seniority
    if (/\b(senior|sr\.?|lead|staff)\b/i.test(normTitle)) return 40;
    if (/\b(intern|internship|graduate|early career|entry level|junior|associate)\b/i.test(normTitle)) return 95;
    return 75;
  }
  score = Math.round((passes / checks) * 100);
  return score;
}

/**
 * Profile match: How well does this opportunity align with your skills and preferences?
 */
function scoreProfileMatch(profile, opp) {
  let totalPoints = 0;
  let earnedPoints = 0;

  // Skills overlap
  const profileSkills = parseJsonArray(profile.skills).map(norm);
  const requiredSkills = parseJsonArray(opp.required_skills).map(norm);

  if (requiredSkills.length > 0) {
    totalPoints += 40;
    const matchCount = requiredSkills.filter(rs =>
      profileSkills.some(ps => fuzzyMatch(ps, rs))
    ).length;
    earnedPoints += Math.round((matchCount / requiredSkills.length) * 40);
  } else {
    // No skills listed — give partial credit
    totalPoints += 40;
    earnedPoints += 25;
  }

  // Sector preference alignment
  const prefSectors = parseJsonArray(profile.pref_sectors).map(norm);
  if (prefSectors.length > 0 && opp.job_type) {
    totalPoints += 30;
    if (prefSectors.some(s => fuzzyMatch(s, opp.job_type))) {
      earnedPoints += 30;
    } else if (prefSectors.some(s => fuzzyMatch(s, opp.category))) {
      earnedPoints += 20;
    }
  }

  // Location preference
  const prefLocations = parseJsonArray(profile.pref_locations).map(norm);
  if (prefLocations.length > 0 && opp.location) {
    totalPoints += 30;
    const oppLoc = norm(opp.location);
    if (oppLoc.includes('remote') || oppLoc.includes('anywhere') || oppLoc.includes('pan india')) {
      earnedPoints += 30;
    } else if (prefLocations.some(l => fuzzyMatch(l, oppLoc))) {
      earnedPoints += 30;
    } else {
      earnedPoints += 10; // Different location but still a job
    }
  }

  // Work experience & projects role alignment
  const expList = parseJsonArray(profile.experience);
  const projList = parseJsonArray(profile.projects);
  const expKeywords = [
    ...expList.map(e => norm(e.role)),
    ...projList.map(p => norm(p.title)),
    ...projList.map(p => norm(p.tech_stack))
  ].filter(Boolean);

  const oppTitle = norm(opp.title);
  if (oppTitle && expKeywords.length > 0) {
    totalPoints += 15;
    if (expKeywords.some(k => fuzzyMatch(k, oppTitle) || fuzzyMatch(oppTitle, k))) {
      earnedPoints += 15;
    } else {
      earnedPoints += 5;
    }
  }

  const ruleScore = totalPoints === 0 ? 70 : Math.min(100, Math.round((earnedPoints / totalPoints) * 100));
  const semanticScore = computeSemanticSimilarity(profile, opp);

  // 65% rule-based (skills, sector, location, experience) + 35% semantic embedding similarity
  return Math.min(100, Math.max(10, Math.round(ruleScore * 0.65 + semanticScore * 0.35)));
}

/**
 * Compensation: How does the pay compare to your expectations?
 * Rules:
 * - Indian Private: Cap is 20 LPA (₹20,00,000)
 * - Foreign / Global: Cap is $100k+ USD / €100k / S$135k
 * - PSU / Govt: Standard E-1/E-2/Level 10 comparison
 */
function scoreCompensation(profile, opp) {
  const prefMin = Number(profile.pref_min_ctc) || 0;
  const ctcMax = Number(opp.ctc_max) || 0;
  const ctcMin = Number(opp.ctc_min) || 0;
  const bestCtc = ctcMax || ctcMin;
  const curr = (opp.currency || 'INR').toUpperCase();

  const isIndianPrivate = opp.category_group === 'private_in' || (opp.job_type === 'private' && (opp.country === 'India' || !opp.country));
  const isForeign = ['private_eu', 'private_sg', 'private_global'].includes(opp.category_group) || (opp.country && opp.country !== 'India');

  if (!bestCtc && !opp.pay_scale && !opp.compensation_display) return 50;

  // 1. Indian Private / Tech (Strictly enforces candidate minimum CTC threshold, e.g. >= 5 LPA)
  const minThreshold = prefMin > 0 ? prefMin : 500000;
  if (isIndianPrivate && bestCtc > 0) {
    if (bestCtc < minThreshold) return 0; // Knockout: strictly below minimum package
    // Ideal entry engineering sweet spot for 2026 CS graduate: ₹6 LPA - ₹15 LPA
    if (bestCtc >= 600000 && bestCtc <= 1500000) return 100;
    if (bestCtc > 1500000 && bestCtc <= 2400000) return 90;
    if (bestCtc > 2400000) return 75; // Demote ultra-high CTC roles so realistic Indian tech/PSU roles rank first
    return 85; // 5 LPA - 6 LPA
  }

  // 2. Foreign / Global Private (Hard Cap: $100k+ / €100k / S$135k)
  if (isForeign && bestCtc > 0) {
    if (curr === 'INR') {
      if (bestCtc < 8000000) return 10;
      if (bestCtc >= 12000000) return 100;
      return 95;
    } else if (['USD', 'EUR', 'GBP'].includes(curr)) {
      if (bestCtc < 100000) return 10;
      if (bestCtc >= 130000) return 100;
      return 95;
    } else if (curr === 'SGD') {
      if (bestCtc < 135000) return 10;
      if (bestCtc >= 160000) return 100;
      return 95;
    }
  }

  // 3. PSU / Govt / Other
  if (prefMin > 0 && bestCtc > 0) {
    const ratio = bestCtc / prefMin;
    if (ratio >= 1.5) return 100;
    if (ratio >= 1.2) return 92;
    if (ratio >= 1.0) return 85;
    if (ratio >= 0.85) return 70;
    if (ratio >= 0.7) return 55;
    if (ratio < 0.6) return 10; // Sub-preference
    return 30;
  }

  // Has pay_scale string but no numeric CTC — give moderate score
  if (opp.pay_scale || opp.compensation_display) return 65;
  return 50;
}

/**
 * Career potential: Org quality + role growth + sector trajectory + Visa Sponsorship.
 */
function scoreCareerPotential(profile, opp, org) {
  let score = 50; // Baseline

  // Org quality (if rated)
  if (org && org.quality_score != null) {
    score = Math.round(org.quality_score * 0.6 + score * 0.4);
  }

  // Visa sponsorship / Relocation assistance bonus
  if (opp.visa_sponsored === 1 || opp.visa_sponsored === true || org?.visa_sponsored === 1) {
    score = Math.min(100, score + 15);
  }

  // Sector bonuses for high-growth or prestigious sectors
  const premiumTypes = ['govt', 'psu', 'defence', 'research'];
  if (premiumTypes.includes(opp.job_type)) {
    score = Math.min(100, score + 10);
  }

  // Category bonuses
  if (opp.category === 'fellowship' || opp.category === 'research') {
    score = Math.min(100, score + 5);
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Competition signal: ESTIMATE based on proxy signals.
 * THIS IS EXPLICITLY AN ESTIMATE — never presented as fact.
 */
function scoreCompetitionSignal(opp) {
  let score = 50; // Neutral baseline — we fundamentally don't know

  // More vacancies = slightly less competition per seat
  const vacancies = Number(opp.vacancies) || 0;
  if (vacancies > 100) score += 15;
  else if (vacancies > 50) score += 10;
  else if (vacancies > 20) score += 5;
  else if (vacancies > 0 && vacancies <= 5) score -= 10;

  // Specialized qualification requirements = narrower pool
  const reqSkills = parseJsonArray(opp.required_skills);
  if (reqSkills.length >= 5) score += 15;
  else if (reqSkills.length >= 3) score += 8;

  // Exam-based typically has higher competition
  if (opp.category === 'exam') score -= 10;

  // Direct recruitment / interview-only = lower pool
  if (opp.source_type === 'careers_page') score += 5;

  return Math.min(100, Math.max(0, score));
}

/**
 * Application difficulty: How complex is the application process?
 * Higher score = easier to apply.
 */
function scoreApplicationDifficulty(opp) {
  let score = 70; // Default: moderate

  // Direct URL available = easier
  if (opp.apply_url) score += 10;

  // Exam-based = harder
  if (opp.category === 'exam') score -= 20;

  // PDF/manual = harder
  if (opp.source_type === 'pdf') score -= 5;

  return Math.min(100, Math.max(0, score));
}

/**
 * Org quality: Directly from the org's quality_score if available.
 */
function scoreOrgQuality(org) {
  if (!org) return 50;
  if (org.quality_score != null && org.quality_score >= 0) {
    return Math.min(100, Math.max(0, org.quality_score));
  }
  return 50; // Unrated
}

/**
 * Deadline urgency: How soon is the deadline?
 * Higher score = more urgent (you should act NOW).
 */
function scoreDeadlineUrgency(opp) {
  if (!opp.application_deadline) return 40; // No deadline known — low urgency

  const now = new Date();
  const deadline = new Date(opp.application_deadline);
  const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return 0;    // Already passed
  if (daysLeft <= 3) return 100;  // Critical
  if (daysLeft <= 7) return 90;   // Very urgent
  if (daysLeft <= 14) return 75;  // Urgent
  if (daysLeft <= 30) return 55;  // Moderate
  if (daysLeft <= 60) return 35;  // Low urgency
  return 20;                      // Far away
}

// ────────────────────────────────────────────────────────────────
// Main scoring function
// ────────────────────────────────────────────────────────────────

/**
 * Compute the full opportunity score breakdown.
 * 
 * @param {Object} profile - From jobhunt_profile table
 * @param {Object} opp     - From jobhunt_opportunities table
 * @param {Object|null} org - From jobhunt_organizations table (optional)
 * @returns {Object} Score breakdown + composite + recommendation
 */
function computeOpportunityScore(profile, opp, org = null, customThresholds = {}) {
  const thresh = {
    apply_now: Number(customThresholds?.apply_now) || THRESHOLDS.apply_now,
    worth_applying: Number(customThresholds?.worth_applying) || THRESHOLDS.worth_applying,
    investigate: Number(customThresholds?.investigate) || THRESHOLDS.investigate
  };

  const eligibility_pct = scoreEligibility(profile, opp);
  const profile_match_pct = scoreProfileMatch(profile, opp);
  const compensation_score = scoreCompensation(profile, opp);
  const career_potential_score = scoreCareerPotential(profile, opp, org);
  const competition_signal = scoreCompetitionSignal(opp);
  const application_difficulty_score = scoreApplicationDifficulty(opp);
  const org_quality_score = scoreOrgQuality(org);
  const deadline_urgency_score = scoreDeadlineUrgency(opp);

  // Weighted composite
  let baseScore = Math.round(
    eligibility_pct * WEIGHTS.eligibility +
    profile_match_pct * WEIGHTS.profile_match +
    compensation_score * WEIGHTS.compensation +
    career_potential_score * WEIGHTS.career_potential +
    competition_signal * WEIGHTS.competition_signal +
    application_difficulty_score * WEIGHTS.application_difficulty +
    org_quality_score * WEIGHTS.org_quality +
    deadline_urgency_score * WEIGHTS.deadline_urgency
  );

  const curr = (opp.currency || 'INR').toUpperCase();
  const ctcMax = Number(opp.ctc_max) || 0;
  const ctcMin = Number(opp.ctc_min) || 0;
  const bestCtc = ctcMax || ctcMin;
  const prefMin = Number(profile.pref_min_ctc) || 500000;
  const minThreshold = prefMin > 0 ? prefMin : 500000;

  // ── STRICT USER CONSTRAINTS & KNOCKOUTS ──
  // Knockout 1: Foreign visa sponsorship or foreign non-remote location
  const isVisaOrForeign = (opp.visa_sponsored === 1 || opp.visa_sponsored === true || String(opp.visa_sponsored) === '1') ||
    (opp.country && opp.country !== 'India' && !opp.location?.toLowerCase().includes('remote') && !opp.location?.toLowerCase().includes('india'));

  // Knockout 2: High-Frequency Trading & Quant Hedge Funds (Not aligned with candidate profile)
  const isQuantHft = opp.category_group === 'quant_hft' ||
    (org?.sector && /\b(quant|high-frequency|hft|market making|automated trading|trading systems)\b/i.test(org.sector)) ||
    (org?.name && /\b(d\.?\s*e\.?\s*shaw|optiver|jane street|citadel|tower research|hudson river|jump trading|flow traders|imc trading|two sigma)\b/i.test(org.name));

  // Knockout 3: Strictly below 5 LPA minimum threshold (for known INR salaries)
  const isFellowshipOrInternship = opp.category_group === 'research_internship' || opp.category === 'internship' || opp.job_type === 'research';
  const isBelow5Lpa = !isFellowshipOrInternship && curr === 'INR' && bestCtc > 0 && bestCtc < minThreshold;

  // Gate Knockout
  const gateMandatory = isGateMandatory(opp);
  const gateDisqualified = gateMandatory && (!profile.has_gate || profile.has_gate === 0 || profile.has_gate === '0');

  // Hard Disqualification Check
  const isDisqualified = isVisaOrForeign || isQuantHft || isBelow5Lpa || gateDisqualified || eligibility_pct === 0 || eligibility_pct < 30;

  // ── TARGET ROLE PRIORITY ADJUSTMENTS FOR CANDIDATE ──
  if (!isDisqualified) {
    // 1. PSU & CPSE Boost (Top Priority)
    if (opp.job_type === 'psu' || opp.category_group === 'psu' || org?.org_type === 'psu' || /\b(psu|cpse|public sector)\b/i.test(org?.sector || '')) {
      baseScore += 16;
    }
    // 2. Government Tech & e-Governance Boost
    if (opp.job_type === 'govt' || opp.category_group === 'govt' || org?.org_type === 'govt') {
      baseScore += 16;
    }
    // 3. Research Labs & Fellowships (CSIR, IIT Labs, Project Fellow)
    if (opp.job_type === 'research' || opp.category_group === 'research' || org?.org_type === 'research') {
      baseScore += 14;
    }
    // 4. Indian Tech Startups
    if (opp.category_group === 'startup' || org?.org_type === 'startup') {
      baseScore += 12;
    }
    // 5. Madhya Pradesh & Local / Remote Tech (Bhopal, Indore, Pune, Remote India)
    if (/\b(bhopal|indore|madhya pradesh|pune|remote|pan india)\b/i.test(opp.location || '')) {
      baseScore += 8;
    }
    // 6. Realistic compensation sweet spot for 2026 CS graduate (₹6 LPA - ₹15 LPA)
    if (curr === 'INR' && bestCtc >= 600000 && bestCtc <= 1500000) {
      baseScore += 8;
    }
    // 7. Demote ultra-high corporate roles (> ₹35 LPA) so realistic Indian tech/PSU roles rank first
    if (curr === 'INR' && bestCtc > 3500000) {
      baseScore -= 12;
    }
  }

  const opportunity_score = isDisqualified
    ? Math.min(20, Math.round(baseScore * 0.2))
    : Math.min(100, Math.max(10, baseScore));

  let disqualification_reason = null;
  if (isVisaOrForeign) {
    disqualification_reason = 'Requires foreign visa sponsorship or overseas relocation (candidate targeting Indian offices & Remote)';
  } else if (isQuantHft) {
    disqualification_reason = 'Quantitative hedge fund / HFT role (candidate focusing on Indian tech, Startups, PSUs, Govt, Research)';
  } else if (isBelow5Lpa) {
    disqualification_reason = `Known compensation (₹${(bestCtc/100000).toFixed(1)} LPA) is below candidate target threshold of ₹5 LPA`;
  } else if (gateDisqualified) {
    disqualification_reason = 'Requires GATE score for freshers (candidate profile has no GATE qualification)';
  } else if (eligibility_pct === 0 || eligibility_pct < 30) {
    disqualification_reason = 'Candidate does not meet branch, experience, or domain eligibility requirements';
  }

  // Determine recommendation
  let recommendation;
  if (isDisqualified) {
    recommendation = 'ignore';
  } else if (opportunity_score >= thresh.apply_now) {
    recommendation = 'apply_now';
  } else if (opportunity_score >= thresh.worth_applying) {
    recommendation = 'worth_applying';
  } else if (opportunity_score >= thresh.investigate) {
    recommendation = 'investigate';
  } else {
    recommendation = 'ignore';
  }

  const semantic_similarity_score = computeSemanticSimilarity(profile, opp);
  const missingRequirements=[];
  if(opp.min_experience_years==null)missingRequirements.push('Experience requirement not stated');
  if(!opp.required_degree && !opp.required_branch)missingRequirements.push('Education requirements not stated');
  if(!opp.location)missingRequirements.push('Location/work authorization not established');
  const eligibility_status=eligibility_pct===0 || gateDisqualified?'ineligible':missingRequirements.length?'unknown':'eligible';

  return {
    eligibility_pct,
    profile_match_pct,
    semantic_similarity_score,
    eligibility_status,
    missing_requirements: missingRequirements,
    scoring_method: 'Keyword/synonym and explicit-requirement heuristic; not a hiring probability',
    compensation_score,
    career_potential_score,
    competition_signal,
    application_difficulty_score,
    org_quality_score,
    deadline_urgency_score,
    opportunity_score,
    recommendation,
    gate_required: gateMandatory,
    disqualification_reason
  };
}

/**
 * Creates a normalized feature snapshot to log alongside application outcomes.
 */
function captureScoringFeatures(opp, scores = {}) {
  return {
    opportunity_score: scores.opportunity_score || opp.opportunity_score,
    eligibility_pct: scores.eligibility_pct || opp.eligibility_pct,
    profile_match_pct: scores.profile_match_pct || opp.profile_match_pct,
    semantic_similarity: scores.semantic_similarity_score || null,
    compensation_score: scores.compensation_score || opp.compensation_score,
    career_potential_score: scores.career_potential_score || opp.career_potential_score,
    category_group: opp.category_group || 'other',
    captured_at: new Date().toISOString()
  };
}

module.exports = {
  computeOpportunityScore,
  isGateMandatory,
  computeSemanticSimilarity,
  captureScoringFeatures
};
