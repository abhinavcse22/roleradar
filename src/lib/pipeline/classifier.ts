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
      (host.includes('linkedin.com') && pathname.includes('/jobs/search')) ||
      (host.includes('indeed.') && (pathname.includes('/q-') || pathname.includes('/jobs'))) ||
      (host.includes('glassdoor.') && pathname.includes('/Job/')) ||
      (host.includes('naukri.com') && pathname.includes('-jobs'))
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
