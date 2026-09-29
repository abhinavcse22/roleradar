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

export const GENERIC_COMPANY_BLOCKLIST = new Set([
  'jobs',
  'careers',
  'job',
  'apply',
  'boards',
  'join',
  'positions',
  'openings',
  'work',
  'workday',
  'myworkdayjobs',
  'employment',
  'unknown',
  'unknown company',
  'lever',
  'ashby',
  'greenhouse',
  'ats',
  'hiring',
  'example',
  'sample',
  'test',
  'localhost',
  'domain',
]);

/**
 * Formats a slugified or hyphenated company name into title case (e.g. "go-high-level" -> "Go High Level").
 */
export function formatCompanyName(slug: string): string {
  if (!slug) return '';
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Deterministically extracts the company name from known ATS and career portal URL patterns:
 * - jobs.ashbyhq.com/<company>/...
 * - boards.greenhouse.io/<company>/...
 * - jobs.lever.co/<company>/...
 * - careers.<company>.com
 * - <company>.com/careers
 */
export function extractCompanyFromUrl(rawUrl: string): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = parsed.pathname.replace(/\/+$/, '');
    const segments = pathname.split('/').filter(Boolean);

    // 1. Ashby ATS: jobs.ashbyhq.com/<company>/...
    if (host.includes('jobs.ashbyhq.com') && segments.length >= 1) {
      const candidate = segments[0].toLowerCase();
      if (!GENERIC_COMPANY_BLOCKLIST.has(candidate)) {
        return formatCompanyName(candidate);
      }
    }

    // 2. Greenhouse ATS: boards.greenhouse.io/<company>/... or boards.greenhouse.io/embed/job_app?for=<company>
    if (host.includes('boards.greenhouse.io')) {
      const forParam = parsed.searchParams.get('for')?.toLowerCase();
      if (forParam && !GENERIC_COMPANY_BLOCKLIST.has(forParam)) {
        return formatCompanyName(forParam);
      }
      if (segments.length >= 1) {
        const seg = segments[0] === 'embed' && segments.length >= 2 ? segments[1] : segments[0];
        const candidate = seg.toLowerCase();
        if (!GENERIC_COMPANY_BLOCKLIST.has(candidate)) {
          return formatCompanyName(candidate);
        }
      }
    }

    // 3. Lever ATS: jobs.lever.co/<company>/...
    if (host.includes('jobs.lever.co') && segments.length >= 1) {
      const candidate = segments[0].toLowerCase();
      if (!GENERIC_COMPANY_BLOCKLIST.has(candidate)) {
        return formatCompanyName(candidate);
      }
    }

    // 4. Subdomains: careers.<company>.com, jobs.<company>.com
    const hostParts = host.split('.');
    if (hostParts.length >= 3 && (hostParts[0] === 'careers' || hostParts[0] === 'jobs')) {
      const candidate = hostParts[1].toLowerCase();
      if (!GENERIC_COMPANY_BLOCKLIST.has(candidate)) {
        return formatCompanyName(candidate);
      }
    }

    // 5. Main company domain with explicit careers path (e.g. sarvam.ai/careers/...)
    const hasCareersPath = /^\/(careers|jobs|join-us|work-with-us)\b/i.test(pathname);
    if (hasCareersPath) {
      if (hostParts.length === 2) {
        const candidate = hostParts[0].toLowerCase();
        if (!GENERIC_COMPANY_BLOCKLIST.has(candidate)) {
          return formatCompanyName(candidate);
        }
      }
    }

    return null;
  } catch {
    return null;
  }
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
 * Formats a clean display company name with robust fallback hierarchy.
 * Guarantees that generic names like "Jobs", "Careers", "Boards" are rejected.
 */
export function cleanDisplayCompany(
  company: string,
  fallbackDomain?: string,
  fallbackUrl?: string
): string {
  const trimmed = (company || '').trim();
  const lower = trimmed.toLowerCase();

  // If explicit non-generic company name is provided
  if (trimmed && !GENERIC_COMPANY_BLOCKLIST.has(lower)) {
    const cleaned = trimmed.replace(/\s+(inc|llc|pvt ltd|private limited)\.?$/i, '').trim();
    if (cleaned && !GENERIC_COMPANY_BLOCKLIST.has(cleaned.toLowerCase())) {
      return cleaned;
    }
  }

  // Fallback 1: Extract company deterministically from URL
  if (fallbackUrl) {
    const fromUrl = extractCompanyFromUrl(fallbackUrl);
    if (fromUrl && !GENERIC_COMPANY_BLOCKLIST.has(fromUrl.toLowerCase())) {
      return fromUrl;
    }
  }

  // Fallback 2: Domain parsing (excluding generic parts)
  if (fallbackDomain) {
    const parts = fallbackDomain.replace(/^www\./, '').split('.');
    for (const part of parts) {
      const pLower = part.toLowerCase();
      if (pLower.length > 2 && !GENERIC_COMPANY_BLOCKLIST.has(pLower) && pLower !== 'com' && pLower !== 'org' && pLower !== 'net' && pLower !== 'io' && pLower !== 'ai') {
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }
    }
  }

  return 'Unknown Company';
}

const ROLE_KEYWORDS_REGEX =
  /\b(pm|swe|sde|qa|engineer|engineering|developer|manager|lead|designer|analyst|intern|internship|director|vp|vice president|specialist|associate|consultant|architect|scientist|head of|officer|coordinator|administrator)\b/i;

const LOCATION_OR_WORKMODE_REGEX =
  /^(remote|hybrid|on-site|onsite|india|usa|us|uk|united states|united kingdom|bengaluru|bangalore|san francisco|sf|new york|nyc|london|singapore|berlin|toronto|canada|europe|emea|apac|latam)$/i;

/**
 * Parses raw title to extract company if embedded (e.g. "Product Manager @ Weave", "HighLevel - Staff PM", "PM - Sarvam").
 */
export function extractCompanyAndTitle(rawTitle: string): { title: string; company?: string } {
  if (!rawTitle) return { title: 'Untitled Role' };

  let title = rawTitle.trim();
  let company: string | undefined;

  // Pattern 1: "Role @ Company" (e.g. "Product Manager @ Weave")
  const atSignMatch = title.match(/^(.*?)\s+@\s+([^|\-–]+)/i);
  if (atSignMatch) {
    title = atSignMatch[1].trim();
    const candidateComp = atSignMatch[2].trim();
    if (!GENERIC_COMPANY_BLOCKLIST.has(candidateComp.toLowerCase())) {
      company = candidateComp;
    }
  }

  // Pattern 2: "Role at Company" (e.g. "Product Manager at Sarvam AI")
  if (!company) {
    const atWordMatch = title.match(/^(.*?)\s+at\s+([^|\-–]+)/i);
    if (atWordMatch) {
      title = atWordMatch[1].trim();
      const candidateComp = atWordMatch[2].trim();
      if (!GENERIC_COMPANY_BLOCKLIST.has(candidateComp.toLowerCase())) {
        company = candidateComp;
      }
    }
  }

  // Pattern 3: Separators " - ", " – ", " — "
  if (!company) {
    const dashMatch = title.match(/^([^-–—]+)\s*[-–—]\s*(.+)$/);
    if (dashMatch) {
      const part1 = dashMatch[1].trim();
      const part2 = dashMatch[2].trim();

      const part1IsRole = ROLE_KEYWORDS_REGEX.test(part1);
      const part2IsRole = ROLE_KEYWORDS_REGEX.test(part2);

      // Subcase 3a: Part 1 is Role, Part 2 is Company / "Company Careers" (e.g. "PM - Sarvam", "Product Manager - Sarvam AI Careers")
      if (part1IsRole && !part2IsRole) {
        title = part1;
        const cleanedComp = part2.replace(/\s*[-–—|]?\s*\b(careers|jobs|job board|openings|recruitment)\b.*$/i, '').trim();
        if (
          cleanedComp &&
          !GENERIC_COMPANY_BLOCKLIST.has(cleanedComp.toLowerCase()) &&
          !LOCATION_OR_WORKMODE_REGEX.test(cleanedComp)
        ) {
          company = cleanedComp;
        }
      }
      // Subcase 3b: Part 1 is Company, Part 2 is Role (e.g. "HighLevel - Staff Product Manager")
      else if (!part1IsRole && part2IsRole) {
        const cleanedComp = part1.trim();
        if (
          cleanedComp &&
          !GENERIC_COMPANY_BLOCKLIST.has(cleanedComp.toLowerCase()) &&
          !LOCATION_OR_WORKMODE_REGEX.test(cleanedComp)
        ) {
          company = cleanedComp;
          title = part2;
        }
      }
    }
  }

  return { title: cleanDisplayTitle(title), company };
}

/**
 * Normalizes job titles by stripping noisy prefixes and formatting artifacts.
 */
export function cleanDisplayTitle(rawTitle: string): string {
  if (!rawTitle) return 'Untitled Role';

  return rawTitle
    .replace(/^#{1,6}\s+/, '') // Remove leading markdown header syntax
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

  if (lower.includes('india') || lower.includes('bengaluru') || lower.includes('bangalore') || lower.includes('mumbai') || lower.includes('delhi') || lower.includes('pune') || lower.includes('hyderabad') || lower.includes('noida') || lower.includes('gurgaon') || lower.includes('gurugram')) {
    country = 'India';
  } else if (lower.includes('united states') || lower.includes('usa') || lower.includes('u.s.') || lower.includes('california') || lower.includes('san francisco') || lower.includes('new york') || lower.includes('austin') || lower.includes('seattle')) {
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
 * Extracts a concise, explicit location from text or structured fields.
 * NEVER returns raw multi-line page bodies or paragraphs.
 */
export function extractCleanLocation(
  locationCandidate?: string | null,
  bodySnippet?: string,
  title?: string
): { location: string; country: string | null } {
  // 1. If explicit location candidate is provided, clean and validate
  if (locationCandidate && typeof locationCandidate === 'string') {
    const trimmed = locationCandidate.replace(/\s+/g, ' ').trim();
    if (
      trimmed.length > 0 &&
      trimmed.length <= 80 &&
      !trimmed.startsWith('#') &&
      !trimmed.includes('\n') &&
      !GENERIC_COMPANY_BLOCKLIST.has(trimmed.toLowerCase())
    ) {
      return normalizeLocation(trimmed);
    }
  }

  const searchableText = `${title || ''}\n${(bodySnippet || '').slice(0, 1500)}`;

  // 2. Check for explicit labeled metadata patterns (e.g. "Location: Bengaluru, India")
  const labeledPatterns = [
    /(?:Location|Office location|Job location|Based in)\s*[:|-]\s*([A-Za-z\s,.-]+?)(?:\n|\r|\||#|\.\s|$)/i,
    /(?:Locations?)\s*[:|-]\s*([A-Za-z\s,.-]+?)(?:\n|\r|\||#|\.\s|$)/i,
  ];

  for (const pattern of labeledPatterns) {
    const match = searchableText.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].replace(/\s+/g, ' ').trim();
      if (
        candidate.length >= 2 &&
        candidate.length <= 60 &&
        !candidate.startsWith('#') &&
        !GENERIC_COMPANY_BLOCKLIST.has(candidate.toLowerCase())
      ) {
        return normalizeLocation(candidate);
      }
    }
  }

  // 3. Check for well-known city / region matches
  const knownCitiesRegex =
    /\b(Bengaluru|Bangalore|Mumbai|Delhi|New Delhi|Hyderabad|Pune|Chennai|Gurugram|Gurgaon|Noida|San Francisco|New York|London|Berlin|Singapore|Toronto|Seattle|Austin)\b(?:,\s*([A-Za-z\s]+))?/i;
  const cityMatch = searchableText.match(knownCitiesRegex);
  if (cityMatch) {
    const city = cityMatch[1].trim();
    const stateOrCountry = cityMatch[2] ? `, ${cityMatch[2].trim()}` : '';
    const locStr = `${city}${stateOrCountry}`;
    if (locStr.length <= 60) {
      return normalizeLocation(locStr);
    }
  }

  // 4. Check for Remote indicator
  if (/\b(remote|work from home|anywhere)\b/i.test(searchableText)) {
    if (/\b(india)\b/i.test(searchableText)) {
      return normalizeLocation('Remote, India');
    }
    return normalizeLocation('Remote');
  }

  // 5. Check for country-only match
  if (/\b(India)\b/i.test(searchableText)) {
    return normalizeLocation('India');
  }
  if (/\b(United States|USA)\b/i.test(searchableText)) {
    return normalizeLocation('United States');
  }
  if (/\b(United Kingdom|UK)\b/i.test(searchableText)) {
    return normalizeLocation('United Kingdom');
  }

  return { location: 'Undisclosed', country: null };
}

/**
 * Strips markdown headers, navigation noise, and boilerplate from job descriptions.
 * Produces clean, readable plain text.
 */
export function cleanJobDescription(rawContent: string, title?: string, company?: string): string {
  if (!rawContent) return '';

  let text = rawContent;

  // 1. Remove markdown links: [Link text](http://...) -> Link text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 2. Remove image tags: ![Alt text](http://...) -> empty
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '');

  // 3. Remove markdown headers syntax (#, ##, ###)
  text = text.replace(/^#{1,6}\s+/gm, '');

  // 4. Remove bold/italics
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');

  // 5. Remove common noise lines
  const noiseLinePatterns = [
    /^(apply for this job|apply now|share this job|back to all jobs|view all jobs)/i,
    /^(powered by ashby|powered by greenhouse|powered by lever)/i,
    /^(follow us on|connect with us|privacy policy|terms of service)/i,
    /^©\s*\d{4}/i,
  ];

  const lines = text.split('\n');
  const cleanedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== '') {
        cleanedLines.push('');
      }
      continue;
    }

    if (noiseLinePatterns.some((p) => p.test(trimmed))) {
      continue;
    }

    // Skip redundant title/company repetition in initial lines
    if (cleanedLines.length <= 2) {
      if (title && normalizeText(trimmed) === normalizeText(title)) continue;
      if (company && normalizeText(trimmed) === normalizeText(company)) continue;
    }

    cleanedLines.push(trimmed);
  }

  return cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 800);
}

/**
 * Extracts structured requirement bullets from page content.
 * Targets actual requirement sections (e.g. Qualifications, Requirements, What you'll need).
 */
export function extractStructuredRequirements(content: string): string[] {
  if (!content) return [];

  const lines = content.split('\n');
  const requirements: string[] = [];
  let inRequirementsSection = false;

  const reqSectionHeaderRegex =
    /^(#+\s*)?(requirements|qualifications|what you('ll| will) (need|bring)|who you are|must have|skills|experience required|what we are looking for)/i;
  const otherSectionHeaderRegex =
    /^(#+\s*)?(benefits|what we offer|perks|compensation|about (the company|us)|equal opportunity|how to apply)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (reqSectionHeaderRegex.test(line)) {
      inRequirementsSection = true;
      continue;
    }

    if (otherSectionHeaderRegex.test(line)) {
      inRequirementsSection = false;
      continue;
    }

    if (inRequirementsSection) {
      if (/^[\*\-•]\s+/.test(line)) {
        const item = line.replace(/^[\*\-•]\s+/, '').trim();
        if (item.length >= 15 && item.length <= 250) {
          requirements.push(item);
        }
      }
    }
  }

  // Fallback: If no section header was found, scan for bullets with requirement indicators
  if (requirements.length === 0) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^[\*\-•]\s+/.test(trimmed)) {
        const item = trimmed.replace(/^[\*\-•]\s+/, '').trim();
        const lower = item.toLowerCase();
        const hasReqSignal =
          /\b(years?( of)? experience|experience (in|with)|proficiency in|knowledge of|ability to|responsible for|degree in|strong understanding|familiarity with|background in)\b/i.test(
            lower
          );
        const isBenefitSignal =
          /\b(health insurance|401k|paid time off|unlimited pto|free lunch|parental leave)\b/i.test(
            lower
          );
        if (hasReqSignal && !isBenefitSignal && item.length >= 10 && item.length <= 250) {
          requirements.push(item);
        }
      }
    }
  }

  // Deduplicate and cap at 8 concise items
  const uniqueReqs = Array.from(new Set(requirements));
  return uniqueReqs.slice(0, 8);
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
 * Strictly requires explicit keyword signals to avoid false inferences.
 */
export function normalizeWorkMode(val: string | null | undefined, extraText?: string): WorkMode | null {
  const combined = `${val || ''} ${extraText || ''}`.toLowerCase();

  if (/\b(remote|work from home|wfh|fully remote|anywhere)\b/i.test(combined)) {
    return 'Remote';
  }
  if (/\b(hybrid|flexible work|hybrid work|partially remote)\b/i.test(combined)) {
    return 'Hybrid';
  }
  if (/\b(on-site|onsite|in-office|work from office|in person|in-person)\b/i.test(combined)) {
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

  // 1. Title & Company extraction
  const { title: parsedTitle, company: parsedCompany } = extractCompanyAndTitle(rawTitle);
  const companyFromUrl = extractCompanyFromUrl(canonicalUrl);
  const company = cleanDisplayCompany(parsedCompany || companyFromUrl || '', item.domain, canonicalUrl);
  const title = parsedTitle || cleanDisplayTitle(rawTitle);

  // 2. Clean Location (never full snippet)
  const { location, country } = extractCleanLocation(null, item.snippet, rawTitle);

  // 3. Work Mode & Seniority
  const workMode = normalizeWorkMode(null, `${rawTitle} ${item.snippet}`);
  const seniority = detectSeniority(rawTitle, item.snippet);
  const keywords = extractKeywords(title, item.snippet);
  const checkedAt = new Date().toISOString();

  // 4. Clean Description
  const description = cleanJobDescription(item.snippet || '', title, company);

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
    description,
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

  // 1. Title & Company extraction
  const { title: parsedTitle, company: parsedCompany } = extractCompanyAndTitle(item.title);
  const companyFromUrl = extractCompanyFromUrl(canonicalApplyUrl) || extractCompanyFromUrl(canonicalSourceUrl);
  const company = cleanDisplayCompany(parsedCompany || companyFromUrl || '', item.domain, canonicalApplyUrl);
  const title = parsedTitle || cleanDisplayTitle(item.title);

  // 2. Requirements: parse structured bullets under requirements sections
  const content = item.content || '';
  const extractedRequirements = extractStructuredRequirements(content);

  // 3. Clean Location: search for explicit metadata, not giant body
  const { location, country } = extractCleanLocation(null, content, item.title);

  // 4. Work Mode, Seniority, Employment Type
  const workMode = normalizeWorkMode(null, `${item.title} ${content.slice(0, 1000)}`);
  const employmentType = normalizeEmploymentType(content.slice(0, 1000));
  const seniority = detectSeniority(title, content);
  const keywords = extractKeywords(title, content, extractedRequirements);
  const checkedAt = item.checkedAt || new Date().toISOString();

  // 5. Clean Description: strip markdown headers, noise lines, and nav fragments
  const description = cleanJobDescription(item.description || content, title, company);

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
    description,
    requirements: extractedRequirements,
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

  const canonicalApplyUrl = canonicalizeUrl(item.apply_url || item.source_url);
  const canonicalSourceUrl = canonicalizeUrl(item.source_url || item.apply_url);
  if (!canonicalApplyUrl) return null;

  const { title: parsedTitle, company: parsedCompany } = extractCompanyAndTitle(item.title);
  const companyFromUrl = extractCompanyFromUrl(canonicalApplyUrl) || extractCompanyFromUrl(canonicalSourceUrl);
  const company = cleanDisplayCompany(
    item.company || parsedCompany || companyFromUrl || 'Unknown Company',
    undefined,
    canonicalApplyUrl
  );
  const title = parsedTitle || cleanDisplayTitle(item.title);

  const { location, country } = extractCleanLocation(item.location, item.description, title);
  const employmentType = normalizeEmploymentType(item.employment_type);
  const workMode = normalizeWorkMode(item.work_mode, item.location || undefined);
  const seniority = detectSeniority(title, item.description);

  const requirements = Array.isArray(item.requirements)
    ? item.requirements
        .map((r) => String(r).replace(/^[\*\-•]\s*/, '').trim())
        .filter((r) => r.length >= 10 && r.length <= 250)
    : [];

  const keywords = extractKeywords(title, item.description, requirements);
  const checkedAt = new Date().toISOString();
  const description = cleanJobDescription(item.description || '', title, company);

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
    description,
    requirements: requirements.slice(0, 10),
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
