import {
  AgentJobItem,
  NormalizedFetchResult,
  NormalizedSearchResult,
} from '../tinyfish/types';
import {
  EmploymentType,
  JobListing,
  SeniorityLevel,
  WorkMode,
} from './types';

// Tracking parameters to strip from URLs
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gh_src',
  'lever-source',
  'lever-origin',
  'ref',
  'referrer',
  'fbclid',
  'gclid',
  'msclkid',
  'source',
  'trk',
  'trackingid',
  'origin',
  'sub_source',
]);

/**
 * Normalizes a URL by lowercasing hostname, stripping tracking query params,
 * removing trailing slashes on non-root paths, and removing hash fragments.
 */
export function canonicalizeUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();

  try {
    const parsed = new URL(trimmed);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.hash = ''; // Remove anchor tags

    // Normalize trailing slash
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    // Filter query parameters: strip tracking parameters
    const cleanedParams = new URLSearchParams();
    const sortedKeys = Array.from(parsed.searchParams.keys()).sort();

    for (const key of sortedKeys) {
      if (!TRACKING_PARAMS.has(key.toLowerCase())) {
        const val = parsed.searchParams.get(key);
        if (val !== null) {
          cleanedParams.set(key, val);
        }
      }
    }

    const queryString = cleanedParams.toString();
    parsed.search = queryString ? `?${queryString}` : '';

    return parsed.toString();
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

/**
 * Collapses whitespace, strips surrounding noise, and normalizes casing for comparison.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes company name for fingerprint comparison by stripping corporate designations.
 */
export function normalizeCompanyForComparison(company: string): string {
  if (!company) return '';
  const cleaned = company
    .toLowerCase()
    .replace(/\b(inc|inc\.|llc|l\.l\.c\.|ltd|ltd\.|pvt|pvt\.|pvt ltd|private limited|corp|corp\.|corporation|co\.|company|technologies|software)\b/gi, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || normalizeText(company);
}

/**
 * Formats a clean display company name.
 */
export function cleanDisplayCompany(company: string, fallbackDomain?: string): string {
  const trimmed = company.trim();
  if (trimmed) {
    return trimmed.replace(/\s+(inc|llc|pvt ltd|private limited)\.?$/i, '').trim();
  }

  if (fallbackDomain) {
    const parts = fallbackDomain.replace(/^www\./, '').split('.');
    if (parts.length > 0 && parts[0]) {
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
  }

  return 'Unknown Company';
}

/**
 * Normalizes job titles by stripping noisy prefixes and formatting artifacts.
 */
export function cleanDisplayTitle(rawTitle: string): string {
  if (!rawTitle) return 'Untitled Role';

  return rawTitle
    .replace(/^(hiring for|urgent requirement|job opening|wanted|seeking|open role):?\s*/i, '')
    .replace(/\s*[\(\[](remote|hybrid|on-site|full-time|f\/m\/d|m\/f\/d)[\)\]]/gi, '')
    .replace(/\s+at\s+[\w\s\.-]+$/i, '') // e.g. "Product Manager at Sarvam AI" -> "Product Manager"
    .replace(/\s*\|\s*.*$/, '') // e.g. "Product Manager | Careers" -> "Product Manager"
    .replace(/\s*[-–—]\s*.*?\b(careers|jobs|job board|openings|ashby|greenhouse|lever)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes location into location string and recognized country.
 */
export function normalizeLocation(rawLocation: string): { location: string; country: string | null } {
  if (!rawLocation) {
    return { location: 'Undisclosed', country: null };
  }

  const cleaned = rawLocation.replace(/\s+/g, ' ').trim();
  const lower = cleaned.toLowerCase();

  let country: string | null = null;

  if (lower.includes('india') || lower.includes('bengaluru') || lower.includes('bangalore') || lower.includes('mumbai') || lower.includes('delhi') || lower.includes('pune') || lower.includes('hyderabad')) {
    country = 'India';
  } else if (lower.includes('united states') || lower.includes('usa') || lower.includes('u.s.') || lower.includes('california') || lower.includes('san francisco') || lower.includes('new york')) {
    country = 'United States';
  } else if (lower.includes('united kingdom') || lower.includes('uk') || lower.includes('london')) {
    country = 'United Kingdom';
  } else if (lower.includes('germany') || lower.includes('berlin') || lower.includes('munich')) {
    country = 'Germany';
  } else if (lower.includes('singapore')) {
    country = 'Singapore';
  } else if (lower.includes('canada') || lower.includes('toronto') || lower.includes('vancouver')) {
    country = 'Canada';
  }

  return { location: cleaned, country };
}

/**
 * Normalizes employment type.
 */
export function normalizeEmploymentType(val: string | null | undefined): EmploymentType | null {
  if (!val) return null;
  const lower = val.toLowerCase().trim();

  if (lower.includes('full') || lower === 'ft') return 'Full-time';
  if (lower.includes('part') || lower === 'pt') return 'Part-time';
  if (lower.includes('contract') || lower.includes('freelance') || lower.includes('consultant')) return 'Contract';
  if (lower.includes('intern') || lower.includes('trainee') || lower.includes('co-op')) return 'Internship';

  return null;
}

/**
 * Normalizes work mode (Remote / Hybrid / On-site).
 */
export function normalizeWorkMode(val: string | null | undefined, extraText?: string): WorkMode | null {
  const combined = `${val || ''} ${extraText || ''}`.toLowerCase();

  if (combined.includes('remote') || combined.includes('work from home') || combined.includes('wfh')) {
    return 'Remote';
  }
  if (combined.includes('hybrid') || combined.includes('flexible')) {
    return 'Hybrid';
  }
  if (combined.includes('on-site') || combined.includes('onsite') || combined.includes('in-office') || combined.includes('office')) {
    return 'On-site';
  }

  return null;
}

/**
 * Detects seniority level from title and description.
 */
export function detectSeniority(title: string, description?: string): SeniorityLevel | null {
  const titleLower = title.toLowerCase();
  const descLower = (description || '').toLowerCase();

  if (titleLower.includes('intern') || titleLower.includes('internship') || titleLower.includes('co-op')) {
    return 'Intern';
  }
  if (titleLower.includes('entry') || titleLower.includes('junior') || titleLower.includes('jr.') || titleLower.includes('associate')) {
    return 'Junior';
  }
  if (titleLower.includes('director') || titleLower.includes('vp') || titleLower.includes('vice president')) {
    return 'Director';
  }
  if (titleLower.includes('lead') || titleLower.includes('principal') || titleLower.includes('staff')) {
    return 'Lead';
  }
  if (titleLower.includes('senior') || titleLower.includes('sr.') || titleLower.includes('sr ')) {
    return 'Senior';
  }
  if (titleLower.includes('chief') || titleLower.includes('cto') || titleLower.includes('cpo') || titleLower.includes('ceo')) {
    return 'Executive';
  }

  // Fallback to description indicators if title is generic
  if (descLower.includes('5+') || descLower.includes('5-') || descLower.includes('6+') || descLower.includes('7+')) {
    return 'Senior';
  }
  if (descLower.includes('0-2 years') || descLower.includes('0 to 2 years') || descLower.includes('entry-level')) {
    return 'Junior';
  }

  return 'Mid';
}

/**
 * Extracts key domain / skill terms from job text.
 */
export function extractKeywords(title: string, description: string, requirements?: string[]): string[] {
  const text = `${title} ${description} ${(requirements || []).join(' ')}`.toLowerCase();
  const candidates = [
    'AI',
    'Machine Learning',
    'Deep Learning',
    'LLMs',
    'Generative AI',
    'Agents',
    'SaaS',
    'B2B',
    'B2C',
    'Product Management',
    'TypeScript',
    'JavaScript',
    'Python',
    'React',
    'Next.js',
    'Node.js',
    'SQL',
    'APIs',
    'Cloud',
    'AWS',
    'Docker',
    'Kubernetes',
    'Analytics',
    'Growth',
    'Strategy',
  ];

  const found = new Set<string>();
  for (const c of candidates) {
    const pattern = new RegExp(`\\b${c.toLowerCase()}\\b`, 'i');
    if (pattern.test(text)) {
      found.add(c);
    }
  }

  return Array.from(found).sort();
}

/**
 * Generates a stable deterministic ID for a job listing based on canonical fields.
 */
export function generateJobId(company: string, title: string, location: string, applyUrl: string): string {
  const comp = normalizeCompanyForComparison(company);
  const tit = normalizeText(title);
  const loc = normalizeText(location);
  const url = canonicalizeUrl(applyUrl);

  const rawKey = `${comp}::${tit}::${loc}::${url}`;
  let hash = 0;
  for (let i = 0; i < rawKey.length; i++) {
    hash = (hash << 5) - hash + rawKey.charCodeAt(i);
    hash |= 0;
  }
  return `job_${Math.abs(hash).toString(36)}`;
}

// -------------------------------------------------------------
// SOURCE NORMALIZATION FUNCTIONS
// -------------------------------------------------------------

/**
 * Normalizes a TinyFish Search result into a JobListing.
 */
export function normalizeSearchResult(item: NormalizedSearchResult): JobListing | null {
  if (!item || !item.title || !item.url) return null;

  const rawTitle = item.title;
  const canonicalUrl = canonicalizeUrl(item.url);
  if (!canonicalUrl) return null;

  // Extract company: check for "at Company" or "| Company" or domain
  let company = '';
  const atMatch = rawTitle.match(/\bat\s+([^|\-–]+)/i);
  if (atMatch && atMatch[1]) {
    company = atMatch[1].trim();
  } else {
    company = cleanDisplayCompany('', item.domain);
  }

  const title = cleanDisplayTitle(rawTitle);
  const { location, country } = normalizeLocation(item.snippet || rawTitle);
  const workMode = normalizeWorkMode(null, `${rawTitle} ${item.snippet}`);
  const seniority = detectSeniority(rawTitle, item.snippet);
  const keywords = extractKeywords(title, item.snippet);
  const checkedAt = new Date().toISOString();

  const id = generateJobId(company, title, location, canonicalUrl);

  return {
    id,
    title,
    company,
    location,
    country,
    employmentType: normalizeEmploymentType(item.snippet),
    seniority,
    workMode,
    description: item.snippet || '',
    requirements: [],
    keywords,
    source: 'search',
    sourceUrl: canonicalUrl,
    applyUrl: canonicalUrl,
    checkedAt,
    provenance: [
      {
        source: 'search',
        url: canonicalUrl,
        timestamp: checkedAt,
        details: `Discovered via Search rank #${item.position}`,
      },
    ],
  };
}

/**
 * Normalizes a TinyFish Fetch result into a JobListing.
 */
export function normalizeFetchedJob(item: NormalizedFetchResult): JobListing | null {
  if (!item || !item.title || (!item.url && !item.finalUrl)) return null;

  const canonicalApplyUrl = canonicalizeUrl(item.finalUrl || item.url);
  const canonicalSourceUrl = canonicalizeUrl(item.url || item.finalUrl);
  if (!canonicalApplyUrl) return null;

  const title = cleanDisplayTitle(item.title);
  const company = cleanDisplayCompany('', item.domain);

  // Parse lines for bullet points/requirements
  const content = item.content || '';
  const lines = content.split('\n');
  const extractedRequirements: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      const bulletText = trimmed.replace(/^[\*\-•]\s*/, '').trim();
      if (bulletText.length > 10 && bulletText.length < 300) {
        extractedRequirements.push(bulletText);
      }
    }
  }

  const { location, country } = normalizeLocation(content.slice(0, 1000) || item.title);
  const workMode = normalizeWorkMode(null, `${item.title} ${content.slice(0, 500)}`);
  const employmentType = normalizeEmploymentType(content.slice(0, 500));
  const seniority = detectSeniority(title, content);
  const keywords = extractKeywords(title, content, extractedRequirements);
  const checkedAt = item.checkedAt || new Date().toISOString();

  const id = generateJobId(company, title, location, canonicalApplyUrl);

  return {
    id,
    title,
    company,
    location,
    country,
    employmentType,
    seniority,
    workMode,
    description: item.description || content.slice(0, 600),
    requirements: extractedRequirements.slice(0, 10),
    keywords,
    source: 'fetch',
    sourceUrl: canonicalSourceUrl,
    applyUrl: canonicalApplyUrl,
    checkedAt,
    provenance: [
      {
        source: 'fetch',
        url: canonicalApplyUrl,
        timestamp: checkedAt,
        details: `Verified page content (${item.contentLength} chars, ${item.latencyMs ?? 0}ms)`,
      },
    ],
  };
}

/**
 * Normalizes a TinyFish Agent extracted job item into a JobListing.
 */
export function normalizeAgentJob(item: AgentJobItem): JobListing | null {
  if (!item || !item.title) return null;

  const title = cleanDisplayTitle(item.title);
  const canonicalApplyUrl = canonicalizeUrl(item.apply_url || item.source_url);
  const canonicalSourceUrl = canonicalizeUrl(item.source_url || item.apply_url);
  if (!canonicalApplyUrl) return null;

  const company = cleanDisplayCompany(item.company || 'Unknown Company');
  const { location, country } = normalizeLocation(item.location || 'Undisclosed');
  const employmentType = normalizeEmploymentType(item.employment_type);
  const workMode = normalizeWorkMode(item.work_mode, item.location);
  const seniority = detectSeniority(title, item.description);
  const requirements = Array.isArray(item.requirements)
    ? item.requirements.map((r) => String(r).trim()).filter(Boolean)
    : [];
  const keywords = extractKeywords(title, item.description, requirements);
  const checkedAt = new Date().toISOString();

  const id = generateJobId(company, title, location, canonicalApplyUrl);

  return {
    id,
    title,
    company,
    location,
    country,
    employmentType,
    seniority,
    workMode,
    description: item.description || '',
    requirements,
    keywords,
    source: 'agent',
    sourceUrl: canonicalSourceUrl,
    applyUrl: canonicalApplyUrl,
    checkedAt,
    provenance: [
      {
        source: 'agent',
        url: canonicalApplyUrl,
        timestamp: checkedAt,
        details: 'Extracted via autonomous browser navigation',
      },
    ],
  };
}
