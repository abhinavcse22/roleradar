export type UrlCategory = 'directJob' | 'careerHub' | 'other';

/**
 * Classifies a discovered URL into:
 * - 'directJob': points to a specific open job posting with full description/apply flow
 * - 'careerHub': company career landing page or portal suitable for Agent navigation
 * - 'other': general aggregators, search result pages, or directories
 */
export function classifyUrl(rawUrl: string): UrlCategory {
  if (!rawUrl) return 'other';

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = parsed.pathname.replace(/\/+$/, '');
    const segments = pathname.split('/').filter(Boolean);

    // Filter out obvious aggregator listing / search pages
    if (
      host.includes('google.') ||
      host.includes('bing.') ||
      host.includes('yahoo.') ||
      (host.includes('linkedin.com') && !pathname.includes('/jobs/view/')) ||
      (host.includes('indeed.') && !pathname.includes('/viewjob') && !parsed.searchParams.has('vjk')) ||
      (host.includes('glassdoor.') && !pathname.includes('/job-listing/')) ||
      (host.includes('naukri.com') && !pathname.includes('/job-listings-')) ||
      host.includes('ziprecruiter.com') ||
      host.includes('simplyhired.') ||
      host.includes('monster.com') ||
      host.includes('talent.com') ||
      host.includes('jooble.org') ||
      host.includes('jobgether.com') ||
      host.includes('un.org')
    ) {
      return 'other';
    }

    // 1. Ashby ATS patterns
    if (host.includes('jobs.ashbyhq.com')) {
      // Direct job has company + job UUID/slug (>= 2 segments)
      // e.g. jobs.ashbyhq.com/sarvam/c4bb3b2c-7608-4d57-8761-650b4222ac13
      if (segments.length >= 2) {
        return 'directJob';
      }
      return 'careerHub'; // e.g. jobs.ashbyhq.com/sarvam
    }

    // 2. Greenhouse ATS patterns
    if (host.includes('boards.greenhouse.io')) {
      if (pathname.includes('/jobs/') || pathname.includes('/embed/job_app')) {
        return 'directJob';
      }
      return 'careerHub';
    }

    // 3. Lever ATS patterns
    if (host.includes('jobs.lever.co')) {
      if (segments.length >= 2) {
        return 'directJob';
      }
      return 'careerHub';
    }

    // 4. Workday patterns
    if (host.includes('myworkdayjobs.com')) {
      if (pathname.includes('/job/') || segments.some((s) => /^(JR|R-|\d+)/i.test(s))) {
        return 'directJob';
      }
      return 'careerHub';
    }

    // 5. Generic Company Direct Job patterns
    // e.g. /careers/jobs/123, /jobs/product-manager-456, /apply/abc
    const hasJobIdPattern =
      /\/careers\/jobs\/[a-zA-Z0-9_-]+/i.test(pathname) ||
      /\/jobs\/[a-zA-Z0-9_-]+/i.test(pathname) ||
      /\/job\/[a-zA-Z0-9_-]+/i.test(pathname) ||
      /\/positions\/[a-zA-Z0-9_-]+/i.test(pathname) ||
      /\/openings\/[a-zA-Z0-9_-]+/i.test(pathname) ||
      /\/apply\b/i.test(pathname);

    if (hasJobIdPattern) {
      return 'directJob';
    }

    // 6. Generic Company Career Hub patterns
    // e.g. /careers, /jobs, /open-positions, /join-us, /work-with-us
    const isCareerHub =
      pathname === '/careers' ||
      pathname === '/jobs' ||
      pathname.endsWith('/careers') ||
      pathname.endsWith('/jobs') ||
      pathname.includes('/open-positions') ||
      pathname.includes('/join-us') ||
      pathname.includes('/work-with-us') ||
      pathname.includes('/life-at-') ||
      host.startsWith('careers.') ||
      host.startsWith('jobs.');

    if (isCareerHub) {
      return 'careerHub';
    }

    return 'other';
  } catch {
    return 'other';
  }
}

/**
 * Extracts a normalized, canonical identity string for a career hub / portal.
 * Ignores filtering/tracking query parameters (e.g. department, team, location, commitment, utm_*),
 * trailing slashes, protocol, and www prefixes.
 *
 * Normalizes ATS subdomains and company root domains so duplicate portal URLs
 * (e.g. jobs.lever.co/gohighlevel, jobs.lever.co/gohighlevel/, jobs.lever.co/gohighlevel?department=Product)
 * resolve to the identical hub identity.
 */
export function normalizeCareerHubIdentity(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';

  try {
    const trimmed = rawUrl.trim();
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = parsed.pathname.replace(/\/+$/, '').toLowerCase();
    const segments = pathname.split('/').filter(Boolean);

    // 1. Ashby ATS: jobs.ashbyhq.com/{companySlug}
    if (host.includes('jobs.ashbyhq.com') || host.includes('ashbyhq.com')) {
      const company = segments[0] || '';
      return `ashby:${company}`;
    }

    // 2. Greenhouse ATS:
    // - boards.greenhouse.io/{companySlug}
    // - boards.greenhouse.io/embed/job_board?for={companySlug}
    if (host.includes('greenhouse.io')) {
      if (parsed.searchParams.has('for')) {
        const company = parsed.searchParams.get('for')!.toLowerCase();
        return `greenhouse:${company}`;
      }
      const company = segments.find((s) => s !== 'embed' && s !== 'job_board') || segments[0] || '';
      return `greenhouse:${company}`;
    }

    // 3. Lever ATS: jobs.lever.co/{companySlug}
    if (host.includes('jobs.lever.co') || host.includes('lever.co')) {
      const company = segments[0] || '';
      return `lever:${company}`;
    }

    // 4. Workday ATS: {company}.myworkdayjobs.com/...
    if (host.includes('myworkdayjobs.com')) {
      const company = host.split('.')[0] || '';
      return `workday:${company}`;
    }

    // 5. Native Company Career Sites:
    // e.g. careers.sarvam.ai, jobs.sarvam.ai, sarvam.ai/careers, www.sarvam.ai/careers
    // Normalize root domain by stripping 'careers.' or 'jobs.' prefixes
    const rootDomain = host.replace(/^(careers|jobs|join|work)\./, '');

    // For generic subpaths like /careers, /jobs, /open-positions, /join-us, normalize to root
    const isGenericCareerPath =
      segments.length === 0 ||
      (segments.length === 1 &&
        ['careers', 'jobs', 'open-positions', 'join-us', 'work-with-us', 'positions'].includes(segments[0]));

    if (isGenericCareerPath) {
      return `company:${rootDomain}`;
    }

    // If subpath has specific department or section, e.g. /careers/engineering
    return `company:${rootDomain}:${segments[0]}`;
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/+$/, '');
  }
}

function formatSlug(slug: string): string {
  if (!slug) return '';
  if (slug !== slug.toLowerCase() && slug !== slug.toUpperCase()) {
    return slug;
  }
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Derives a human-readable display label for a career hub portal.
 * e.g. "https://jobs.lever.co/gohighlevel" -> "GoHighLevel · Lever"
 * e.g. "https://jobs.ashbyhq.com/sarvam" -> "Sarvam · Ashby"
 * e.g. "https://boards.greenhouse.io/stripe" -> "Stripe · Greenhouse"
 */
export function formatHubDisplayName(rawUrl: string): string {
  if (!rawUrl) return '';

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = parsed.pathname.replace(/\/+$/, '');
    const segments = pathname.split('/').filter(Boolean);

    if (host.includes('lever.co')) {
      const company = segments[0] || 'Company';
      return `${formatSlug(company)} · Lever`;
    }

    if (host.includes('ashbyhq.com')) {
      const company = segments[0] || 'Company';
      return `${formatSlug(company)} · Ashby`;
    }

    if (host.includes('greenhouse.io')) {
      const company =
        parsed.searchParams.get('for') ||
        segments.find((s) => s !== 'embed' && s !== 'job_board') ||
        segments[0] ||
        'Company';
      return `${formatSlug(company)} · Greenhouse`;
    }

    if (host.includes('myworkdayjobs.com')) {
      const company = host.split('.')[0] || 'Company';
      return `${formatSlug(company)} · Workday`;
    }

    const rootDomain = host.replace(/^(careers|jobs|join|work)\./, '');
    const cleanDomainName = rootDomain.split('.')[0];
    return `${formatSlug(cleanDomainName)} · Careers`;
  } catch {
    return rawUrl.slice(0, 30);
  }
}
