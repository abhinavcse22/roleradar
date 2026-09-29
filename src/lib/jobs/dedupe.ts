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
  // Source authority: Agent > Fetch > Search
  const sourceWeight = (s: string) => {
    if (s === 'agent') return 3;
    if (s === 'fetch') return 2;
    if (s === 'search') return 1;
    return 0;
  };

  const incomingHigherAuthority = sourceWeight(incoming.source) > sourceWeight(existing.source);

  // Title: prefer higher authority, then longer non-empty
  const title = incomingHigherAuthority && incoming.title ? incoming.title : existing.title || incoming.title;

  // Company: prefer non-empty, longer, or higher-authority name
  let company = existing.company || incoming.company;
  if (!existing.company || existing.company === 'Unknown Company') {
    company = incoming.company;
  } else if (incoming.company && incoming.company !== 'Unknown Company') {
    if (incoming.company.length > existing.company.length || incomingHigherAuthority) {
      company = incoming.company;
    }
  }

  // Location: prefer more detailed location
  const location =
    (incoming.location?.length ?? 0) > (existing.location?.length ?? 0)
      ? incoming.location
      : existing.location || incoming.location;

  const country = existing.country || incoming.country;
  const employmentType = existing.employmentType || incoming.employmentType;
  const seniority = existing.seniority || incoming.seniority;
  const workMode = existing.workMode || incoming.workMode;

  // Description: prefer longest, richest content
  const description =
    (incoming.description?.length ?? 0) > (existing.description?.length ?? 0)
      ? incoming.description
      : existing.description || incoming.description;

  // Requirements: union of distinct items
  const reqSet = new Set<string>();
  const normalizedReqKeys = new Set<string>();

  for (const req of [...existing.requirements, ...incoming.requirements]) {
    const trimmed = req.trim();
    const key = normalizeText(trimmed);
    if (key && !normalizedReqKeys.has(key)) {
      normalizedReqKeys.add(key);
      reqSet.add(trimmed);
    }
  }

  // Keywords: union
  const keywordSet = new Set<string>([...existing.keywords, ...incoming.keywords]);

  // Apply URL: prefer specific direct application URL (e.g. ashby, greenhouse, lever, /application)
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
    requirements: Array.from(reqSet),
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
