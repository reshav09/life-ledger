/**
 * Job Hunt ATS API Service
 * High-speed direct ingestion connector for public applicant tracking systems
 * (Greenhouse, Lever, Ashby, SmartRecruiters).
 *
 * Bypasses HTML scraping & JS-rendering bottlenecks by consuming official unauthenticated JSON APIs.
 * Automatically marks closed roles as inactive when they drop off the API feed.
 */

const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/**
 * Strips HTML tags and normalizes whitespace for clean raw text indexing.
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Determines if a role title matches tech/engineering/software profiles.
 */
function isRelevantTechRole(title) {
  if (!title) return false;
  const lower = title.toLowerCase();

  // 1. Strict Exclusion: Non-technical domains, retail, audit, legal, people/HR, sales, etc.
  const negativePattern = /\b(retail|merchandise|sales representative|account executive|account manager|commercial|business development|growth manager|marketing|social media|community manager|community support|recruiter|recruiting|talent acquisition|human resources|\bhr\b|people business|people operations|people science|learning & development|workplace experience|office manager|legal ops|legal counsel|paralegal|compliance officer|liaison|internal audit|auditor|payroll|tax|accounting|accountant|procurement|facilities|nurse|cook|chef|driver|janitor|warehouse|teller|customer service|customer support|support representative|fraud analyst|fraud investigator|risk analyst|credit risk|inventory operations|market associate|event coordinator|executive assistant|receptionist)\b/i;

  if (negativePattern.test(lower) && !/\b(software engineer|devops|cloud infrastructure|sre|systems engineer|data engineer|ml engineer|machine learning engineer)\b/i.test(lower)) {
    return false;
  }

  // 2. Reject Executive/Director/Management roles that are not IC engineering
  const executivePattern = /\b(director|vice president|\bvp\b|head of|engineering manager|group product manager|general manager|partner engineering manager)\b/i;
  if (executivePattern.test(lower)) {
    return false;
  }

  // 3. Technical keywords must be genuine engineering/data/security/devops/quant
  const positivePattern = /\b(software|developer|devops|sre|site reliability|cloud|infrastructure|backend|front[\s-]?end|full[\s-]?stack|distributed systems|platform engineer|systems engineer|firmware|embedded|data engineer|data scientist|data science|machine learning|ml engineer|ai engineer|applied scientist|deep learning|security engineer|cyber security|cloud security|application security|appsec|infosec|finops|quant developer|quantitative developer|quant trader|quantitative researcher|algorithmic)\b/i;

  if (positivePattern.test(lower)) {
    return true;
  }

  // 4. Handle internships and university graduate roles with tech context
  const internGradPattern = /\b(intern|internship|graduate|university|early career|trainee|apprentice)\b/i;
  const techContextPattern = /\b(software|developer|engineer|engineering|data|ai|ml|cloud|devops|systems|tech|compute|coding|python|c\+\+|java)\b/i;
  if (internGradPattern.test(lower) && techContextPattern.test(lower)) {
    return true;
  }

  return false;
}

/**
 * Fetches postings from Greenhouse Job Board API.
 * Endpoint: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
 */
async function fetchGreenhousePostings(slug) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      // Fallback without content=true if large board timed out or errored
      const fallbackRes = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }
      });
      if (!fallbackRes.ok) throw new Error(`Greenhouse API returned HTTP ${res.status}`);
      const fallbackData = await fallbackRes.json();
      return (fallbackData.jobs || []).map(j => normalizeGreenhouseJob(j, slug));
    }

    const data = await res.json();
    return (data.jobs || []).map(j => normalizeGreenhouseJob(j, slug));
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function normalizeGreenhouseJob(j, slug) {
  const cleanBody = stripHtml(j.content || '');
  const locationName = j.location?.name || '';
  const departments = (j.departments || []).map(d => d.name).filter(Boolean).join(', ');

  let postedDate = null;
  if (j.updated_at) {
    postedDate = j.updated_at.split('T')[0];
  }

  return {
    external_id: `greenhouse_${slug}_${j.id}`,
    title: j.title || 'Untitled Role',
    apply_url: j.absolute_url || `https://boards.greenhouse.io/${slug}/jobs/${j.id}`,
    location: locationName,
    department: departments,
    raw_text: `${j.title} - ${departments} - ${locationName}\n${cleanBody}`.slice(0, 15000),
    posted_date: postedDate,
    source_type: 'greenhouse_api',
    is_remote: /remote|virtual|anywhere/i.test(locationName) ? 1 : 0,
    confidence_metadata: {
      compensation: 'medium',
      eligibility: 'high',
      is_llm_derived: false,
      source: 'greenhouse_official_api'
    }
  };
}

/**
 * Fetches postings from Lever Job Board API.
 * Endpoint: https://api.lever.co/v0/postings/{slug}?mode=json
 */
async function fetchLeverPostings(slug) {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Lever API returned HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map(j => normalizeLeverJob(j, slug));
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function normalizeLeverJob(j, slug) {
  const locationName = j.categories?.location || '';
  const team = j.categories?.team || j.categories?.department || '';
  const commitment = j.categories?.commitment || '';
  const cleanBody = stripHtml(j.descriptionPlain || j.description || '');

  let postedDate = null;
  if (j.createdAt) {
    postedDate = new Date(j.createdAt).toISOString().split('T')[0];
  }

  return {
    external_id: `lever_${slug}_${j.id}`,
    title: j.text || 'Untitled Role',
    apply_url: j.applyUrl || j.hostedUrl || `https://jobs.lever.co/${slug}/${j.id}`,
    location: locationName,
    department: team,
    job_type: commitment.toLowerCase().includes('contract') ? 'contractual' : 'private',
    raw_text: `${j.text} - ${team} - ${locationName}\n${cleanBody}`.slice(0, 15000),
    posted_date: postedDate,
    source_type: 'lever_api',
    is_remote: /remote|virtual|anywhere/i.test(locationName) ? 1 : 0,
    confidence_metadata: {
      compensation: 'medium',
      eligibility: 'high',
      is_llm_derived: false,
      source: 'lever_official_api'
    }
  };
}

/**
 * Fetches postings from Ashby Job Board API.
 * Endpoint: https://api.ashbyhq.com/posting-api/job-board/{slug}
 */
async function fetchAshbyPostings(slug) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Ashby API returned HTTP ${res.status}`);
    const data = await res.json();
    return (data.jobs || []).map(j => normalizeAshbyJob(j, slug));
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function normalizeAshbyJob(j, slug) {
  const locationName = j.location || '';
  const cleanBody = stripHtml(j.descriptionPlain || j.descriptionHtml || '');

  let postedDate = null;
  if (j.publishedAt) {
    postedDate = j.publishedAt.split('T')[0];
  }

  return {
    external_id: `ashby_${slug}_${j.id}`,
    title: j.title || 'Untitled Role',
    apply_url: j.jobUrl || j.applyUrl || `https://jobs.ashbyhq.com/${slug}/${j.id}`,
    location: locationName,
    department: j.department || '',
    raw_text: `${j.title} - ${j.department || ''} - ${locationName}\n${cleanBody}`.slice(0, 15000),
    posted_date: postedDate,
    source_type: 'ashby_api',
    is_remote: j.isRemote ? 1 : (/remote/i.test(locationName) ? 1 : 0),
    confidence_metadata: {
      compensation: 'medium',
      eligibility: 'high',
      is_llm_derived: false,
      source: 'ashby_official_api'
    }
  };
}

/**
 * Fetches postings from SmartRecruiters API.
 * Endpoint: https://api.smartrecruiters.com/v1/companies/{slug}/postings
 */
async function fetchSmartRecruitersPostings(slug) {
  const url = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?limit=100`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`SmartRecruiters API returned HTTP ${res.status}`);
    const data = await res.json();
    return (data.content || []).map(j => normalizeSmartRecruitersJob(j, slug));
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function normalizeSmartRecruitersJob(j, slug) {
  const locParts = [j.location?.city, j.location?.region, j.location?.country].filter(Boolean);
  const locationName = locParts.join(', ');

  let postedDate = null;
  if (j.releasedDate) {
    postedDate = j.releasedDate.split('T')[0];
  }

  return {
    external_id: `smartrecruiters_${slug}_${j.id}`,
    title: j.name || 'Untitled Role',
    apply_url: `https://jobs.smartrecruiters.com/${slug}/${j.id}`,
    location: locationName,
    department: j.department?.label || '',
    raw_text: `${j.name} - ${j.department?.label || ''} - ${locationName}`,
    posted_date: postedDate,
    source_type: 'smartrecruiters_api',
    is_remote: j.location?.remote ? 1 : (/remote/i.test(locationName) ? 1 : 0),
    confidence_metadata: {
      compensation: 'medium',
      eligibility: 'high',
      is_llm_derived: false,
      source: 'smartrecruiters_official_api'
    }
  };
}

/**
 * Fetches postings from Workday CXS (Candidate Experience Services) Public REST API.
 * Slug format: "host/tenant/careerSite"
 * e.g., "adobe.wd5.myworkdayjobs.com/adobe/external_experienced"
 * e.g., "salesforce.wd12.myworkdayjobs.com/salesforce/External_Career_Site"
 * e.g., "nvidia.wd5.myworkdayjobs.com/nvidia/NVIDIAExternalCareerSite"
 */
async function fetchWorkdayPostings(slug) {
  const parts = slug.split('/');
  if (parts.length < 3) {
    throw new Error(`Invalid Workday slug format "${slug}". Expected "host/tenant/careerSite"`);
  }
  const host = parts[0];
  const tenant = parts[1];
  const careerSite = parts.slice(2).join('/');
  const url = `https://${host}/wday/cxs/${tenant}/${careerSite}/jobs`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': USER_AGENT
      },
      body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: '' })
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Workday CXS API returned HTTP ${res.status}`);
    const data = await res.json();
    return (data.jobPostings || []).map(j => normalizeWorkdayJob(j, host, tenant, careerSite));
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function normalizeWorkdayJob(j, host, tenant, careerSite) {
  const jobId = j.bulletFields?.[0] || (j.externalPath ? j.externalPath.split('/').pop() : Math.random().toString(36).slice(2));
  const locationName = j.locationsText || '';
  const cleanBody = j.bulletFields?.join(' | ') || '';

  // Calculate posted date from "Posted Today", "Posted 2 Days Ago", etc.
  let postedDate = new Date().toISOString().split('T')[0];
  if (j.postedOn) {
    const daysMatch = j.postedOn.match(/(\d+)\s+days?\s+ago/i);
    if (daysMatch) {
      const d = new Date();
      d.setDate(d.getDate() - parseInt(daysMatch[1], 10));
      postedDate = d.toISOString().split('T')[0];
    }
  }

  return {
    external_id: `workday_${tenant}_${jobId}`,
    title: j.title || 'Untitled Role',
    apply_url: `https://${host}/en-US/${careerSite}${j.externalPath}`,
    location: locationName,
    department: '',
    raw_text: `${j.title} - ${locationName}\n${cleanBody}`,
    posted_date: postedDate,
    source_type: 'workday_api',
    is_remote: /remote/i.test(locationName) ? 1 : 0,
    confidence_metadata: {
      compensation: 'medium',
      eligibility: 'high',
      is_llm_derived: false,
      source: 'workday_official_api'
    }
  };
}

/**
 * Fetches postings from PyjamaHR Career API.
 * Endpoint: https://api.pyjamahr.com/api/career/jobs/?company_slug={slug}&page={page}
 */
async function fetchPyjamaHRPostings(slug) {
  let page = 1;
  let allJobs = [];
  const maxPages = 5;

  while (page <= maxPages) {
    const url = `https://api.pyjamahr.com/api/career/jobs/?company_slug=${encodeURIComponent(slug)}&page=${page}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      if (!res.ok) break;
      const data = await res.json();
      if (!data.results || data.results.length === 0) break;

      allJobs = allJobs.concat(data.results.map(j => normalizePyjamaHRJob(j, slug)));
      if (!data.next) break;
      page++;
    } catch (err) {
      clearTimeout(timeoutId);
      break;
    }
  }

  return allJobs;
}

function normalizePyjamaHRJob(j, slug) {
  const jobId = j.id || j.slug;
  const locationName = j.location || 'Bengaluru, India';
  const workplaceType = j.workplace_type || '';
  const isRemote = /remote/i.test(locationName) || /remote/i.test(workplaceType) ? 1 : 0;
  const expText = (j.min_experience != null && j.max_experience != null)
    ? `Experience: ${j.min_experience}-${j.max_experience} years`
    : '';

  return {
    external_id: `pyjamahr_${slug}_${jobId}`,
    title: j.title || 'Untitled Role',
    apply_url: `https://jobs.pyjamahr.com/${slug}/${j.slug || jobId}`,
    location: locationName,
    department: j.department_name || '',
    raw_text: `${j.title} - ${locationName}\n${expText}\nWorkplace: ${workplaceType}\nDepartment: ${j.department_name || 'General'}`,
    posted_date: new Date().toISOString().split('T')[0],
    source_type: 'pyjamahr_api',
    is_remote: isRemote,
    confidence_metadata: {
      compensation: 'medium',
      eligibility: 'high',
      is_llm_derived: false,
      source: 'pyjamahr_official_api'
    }
  };
}

/**
 * Checks if an organization is configured with an ATS connector.
 */
function isATSConfigured(org) {
  if (!org) return false;
  const atsType = (org.ats_type || '').toLowerCase();
  return ['greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workday', 'pyjamahr'].includes(atsType) && Boolean(org.ats_id);
}

/**
 * Dispatches to the appropriate ATS API handler and filters for tech roles.
 */
async function fetchATSOpportunities(org, options = { techOnly: true, maxRoles: 50 }) {
  if (!isATSConfigured(org)) {
    throw new Error(`Organization ${org.name} is not configured for ATS direct ingestion`);
  }

  const atsType = org.ats_type.toLowerCase();
  const slug = org.ats_id.trim();
  let rawJobs = [];

  switch (atsType) {
    case 'greenhouse':
      rawJobs = await fetchGreenhousePostings(slug);
      break;
    case 'lever':
      rawJobs = await fetchLeverPostings(slug);
      break;
    case 'ashby':
      rawJobs = await fetchAshbyPostings(slug);
      break;
    case 'smartrecruiters':
      rawJobs = await fetchSmartRecruitersPostings(slug);
      break;
    case 'workday':
      rawJobs = await fetchWorkdayPostings(slug);
      break;
    case 'pyjamahr':
      rawJobs = await fetchPyjamaHRPostings(slug);
      break;
    default:
      throw new Error(`Unsupported ATS type: ${atsType}`);
  }

  // Filter for tech/engineering roles if techOnly is enabled
  let filteredJobs = options.techOnly ? rawJobs.filter(j => isRelevantTechRole(j.title)) : rawJobs;

  // Cap at maxRoles to keep downstream scoring fast
  if (options.maxRoles && filteredJobs.length > options.maxRoles) {
    filteredJobs = filteredJobs.slice(0, options.maxRoles);
  }

  return filteredJobs;
}

module.exports = {
  fetchGreenhousePostings,
  fetchLeverPostings,
  fetchAshbyPostings,
  fetchSmartRecruitersPostings,
  fetchWorkdayPostings,
  fetchPyjamaHRPostings,
  fetchATSOpportunities,
  isATSConfigured,
  isRelevantTechRole
};
