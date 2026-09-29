import { JobListing, JobProvenance } from './types';
import {
  canonicalizeUrl,
  normalizeCompanyForComparison,
  normalizeText,
} from './normalize';

/**
 * Checks if a URL represents a specific job posting rather than a generic domain root.
 */
function isSpecificJobUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const path = parsed.pathname.replace(/\/+$/, '');
    // Paths longer than root with segments like /jobs, /careers, /apply, or job IDs
    return path.length > 1 && path !== '/careers' && path !== '/jobs';
  } catch {
    return false;
  }
}

/**
 * Checks whether two job listings represent the same physical job opening.
 */
export function areJobsDuplicates(a: JobListing, b: JobListing): boolean {
  if (!a || !b) return false;

  const aApply = canonicalizeUrl(a.applyUrl);
  const bApply = canonicalizeUrl(b.applyUrl);
  const aSource = canonicalizeUrl(a.sourceUrl);
  const bSource = canonicalizeUrl(b.sourceUrl);

  // Signal 1: Identical specific apply URL
  if (aApply && bApply && aApply === bApply && isSpecificJobUrl(aApply)) {
    return true;
  }

  // Signal 1b: Apply URL matches source URL across different stages
  if (aApply && bSource && aApply === bSource && isSpecificJobUrl(aApply)) {
    return true;
  }
  if (bApply && aSource && bApply === aSource && isSpecificJobUrl(bApply)) {
    return true;
  }

  // Signal 2: Company + Title + Location match
  const compA = normalizeCompanyForComparison(a.company);
  const compB = normalizeCompanyForComparison(b.company);

  if (!compA || !compB) return false;

  const companyMatches =
    compA === compB ||
    (compA.length > 3 && compB.length > 3 && (compA.includes(compB) || compB.includes(compA)));

  if (!companyMatches) return false;

  const titleA = normalizeText(a.title);
  const titleB = normalizeText(b.title);

  if (!titleA || !titleB) return false;

  // Exact normalized title match required (distinguishes Senior PM vs PM)
  if (titleA !== titleB) {
    return false;
  }

  // Location match: must be compatible (distinguishes Bengaluru vs London)
  const locA = normalizeText(a.location);
  const locB = normalizeText(b.location);

  if (locA && locB && locA !== 'undisclosed' && locB !== 'undisclosed') {
    const locationCompatible =
      locA === locB || locA.includes(locB) || locB.includes(locA);
    if (!locationCompatible) {
      return false;
    }
  }

  return true;
}

/**
 * Merges two duplicate JobListing records, keeping the most authoritative, complete data.
 */
export function mergeJobs(existing: JobListing, incoming: JobListing): JobListing {
  // Source authority weights: Agent (3) > Fetch (2) > Search (1)
  const sourceWeight = (s: string) => {
    if (s === 'agent') return 3;
    if (s === 'fetch') return 2;
    if (s === 'search') return 1;
    return 0;
  };

  const incomingHigher = sourceWeight(incoming.source) > sourceWeight(existing.source);

  // 1. TITLE: Agent > Fetch > Search
  let title = existing.title;
  if (incomingHigher && incoming.title && incoming.title !== 'Untitled Role') {
    title = incoming.title;
  } else if (!title || title === 'Untitled Role') {
    title = incoming.title || title;
  }

  // 2. COMPANY: Reliable structured metadata > deterministic ATS URL fallback > Search (never "Jobs")
  const isBadCompany = (c: string) =>
    !c ||
    c === 'Unknown Company' ||
    c.toLowerCase() === 'jobs' ||
    c.toLowerCase() === 'boards' ||
    c.toLowerCase() === 'careers';

  let company = existing.company;
  if (isBadCompany(company) && !isBadCompany(incoming.company)) {
    company = incoming.company;
  } else if (!isBadCompany(incoming.company) && !isBadCompany(company)) {
    if (incomingHigher) {
      company = incoming.company;
    }
  }

  // 3. LOCATION: Reliable structured metadata (non-undisclosed, <= 80 chars) > Search
  const isGoodLocation = (loc: string) =>
    loc && loc !== 'Undisclosed' && loc.length <= 80 && !loc.includes('\n');

  let location = existing.location;
  let country = existing.country || incoming.country;
  if (!isGoodLocation(location) && isGoodLocation(incoming.location)) {
    location = incoming.location;
    country = incoming.country || country;
  } else if (isGoodLocation(incoming.location) && incomingHigher) {
    location = incoming.location;
    country = incoming.country || country;
  }

  // 4. DESCRIPTION: Fetch > Agent > Search (cleaned plain text)
  // Fetch reads the full direct job page, so its description is most authoritative
  let description = existing.description;
  if (existing.source === 'search' && (incoming.source === 'fetch' || incoming.source === 'agent')) {
    description = incoming.description;
  } else if (incoming.source === 'fetch' && existing.source === 'agent' && incoming.description) {
    description = incoming.description;
  } else if (!description && incoming.description) {
    description = incoming.description;
  }

  // 5. REQUIREMENTS: Merge union of Agent + Fetch > Search
  const reqSet = new Set<string>();
  const normalizedReqKeys = new Set<string>();

  for (const req of [...incoming.requirements, ...existing.requirements]) {
    const trimmed = req.trim();
    const key = normalizeText(trimmed);
    if (key && !normalizedReqKeys.has(key)) {
      normalizedReqKeys.add(key);
      reqSet.add(trimmed);
    }
  }

  // 6. WORK MODE & EMPLOYMENT TYPE: Prefer non-null
  const workMode = existing.workMode || incoming.workMode;
  const employmentType = existing.employmentType || incoming.employmentType;
  const seniority = existing.seniority || incoming.seniority;

  // 7. KEYWORDS: Union of distinct keywords
  const keywordSet = new Set<string>([...existing.keywords, ...incoming.keywords]);

  // 8. APPLY URL: Explicit direct ATS application URL > Search URL
  const isDirectApply = (url: string) =>
    url.includes('ashbyhq.com') ||
    url.includes('greenhouse.io') ||
    url.includes('lever.co') ||
    url.includes('/apply') ||
    url.includes('/application');

  let applyUrl = existing.applyUrl;
  if (isDirectApply(incoming.applyUrl) && !isDirectApply(existing.applyUrl)) {
    applyUrl = incoming.applyUrl;
  } else if (!applyUrl && incoming.applyUrl) {
    applyUrl = incoming.applyUrl;
  }

  // Source & provenance
  const source = existing.source === incoming.source ? existing.source : 'merged';
  const checkedAt =
    new Date(incoming.checkedAt) > new Date(existing.checkedAt)
      ? incoming.checkedAt
      : existing.checkedAt;

  // Deduplicate provenance items by url + source
  const provMap = new Map<string, JobProvenance>();
  for (const p of [...existing.provenance, ...incoming.provenance]) {
    const key = `${p.source}::${p.url}`;
    if (!provMap.has(key)) {
      provMap.set(key, p);
    }
  }

  return {
    id: existing.id,
    title,
    company,
    location,
    country,
    employmentType,
    seniority,
    workMode,
    description,
    requirements: Array.from(reqSet).slice(0, 10),
    keywords: Array.from(keywordSet).sort(),
    source,
    sourceUrl: canonicalizeUrl(existing.sourceUrl || incoming.sourceUrl),
    applyUrl: canonicalizeUrl(applyUrl),
    checkedAt,
    provenance: Array.from(provMap.values()),
  };
}

/**
 * Deduplicates a list of JobListing records using canonical URLs and company/title/location fingerprints.
 */
export function deduplicateJobs(listings: (JobListing | null | undefined)[]): JobListing[] {
  const result: JobListing[] = [];

  for (const item of listings) {
    if (!item || !item.title || (!item.applyUrl && !item.sourceUrl)) {
      continue;
    }

    let matchedIndex = -1;
    for (let i = 0; i < result.length; i++) {
      if (areJobsDuplicates(result[i], item)) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex >= 0) {
      result[matchedIndex] = mergeJobs(result[matchedIndex], item);
    } else {
      result.push({
        ...item,
        applyUrl: canonicalizeUrl(item.applyUrl),
        sourceUrl: canonicalizeUrl(item.sourceUrl),
      });
    }
  }

  return result;
}
