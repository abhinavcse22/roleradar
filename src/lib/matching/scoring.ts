import { JobListing, SeniorityLevel, WorkMode } from '../jobs/types';
import { normalizeText } from '../jobs/normalize';
import {
  MatchBreakdown,
  MatchResult,
  UserPreferences,
  VisaPreference,
} from './types';

// Stopwords to exclude during title tokenization
const STOPWORDS = new Set(['and', 'or', 'the', 'for', 'of', 'in', 'at', 'to', 'a', 'an', '&', '/', '-']);

function tokenizeRole(role: string): string[] {
  return normalizeText(role)
    .split(' ')
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/**
 * 1. Role Match (Max 30 Points)
 */
export function scoreRole(
  jobTitle: string,
  userRole: string
): { score: number; reason?: string; warning?: string; isMismatch: boolean } {
  if (!jobTitle || !userRole) {
    return { score: 0, warning: 'Role or job title missing', isMismatch: true };
  }

  const normTitle = normalizeText(jobTitle);
  const normUserRole = normalizeText(userRole);

  // Exact match
  if (normTitle === normUserRole) {
    return {
      score: 30,
      reason: `Exact role match for "${userRole}"`,
      isMismatch: false,
    };
  }

  const userTokens = tokenizeRole(userRole);
  const titleTokens = tokenizeRole(jobTitle);

  if (userTokens.length === 0 || titleTokens.length === 0) {
    return { score: 10, warning: 'Could not extract role keywords', isMismatch: false };
  }

  // Count how many user role tokens appear in job title
  const matchedTokens = userTokens.filter((token) =>
    titleTokens.some((t) => t === token || t.includes(token) || token.includes(t))
  );

  const overlapRatio = matchedTokens.length / userTokens.length;

  if (overlapRatio === 1) {
    // All user role words found (e.g. "Product Manager" in "Product Manager, Growth")
    return {
      score: 28,
      reason: `Role matches "${userRole}" in "${jobTitle}"`,
      isMismatch: false,
    };
  } else if (overlapRatio >= 0.6) {
    return {
      score: 20,
      reason: `Role partially matches "${userRole}" (${matchedTokens.join(', ')})`,
      isMismatch: false,
    };
  } else if (overlapRatio > 0) {
    return {
      score: 8,
      warning: `Weak role alignment: only "${matchedTokens.join(', ')}" matched`,
      isMismatch: false,
    };
  }

  return {
    score: 0,
    warning: `Job title "${jobTitle}" does not match requested role "${userRole}"`,
    isMismatch: true,
  };
}

/**
 * 2. Location Match (Max 20 Points)
 */
export function scoreLocation(
  jobLocation: string,
  jobCountry: string | null,
  jobWorkMode: WorkMode | null,
  userLocation: string
): { score: number; reason?: string; warning?: string; isMismatch: boolean } {
  const normUserLoc = normalizeText(userLocation);
  const normJobLoc = normalizeText(jobLocation);

  // If user has no specific location or asks for remote
  if (!normUserLoc || normUserLoc === 'any' || normUserLoc === 'remote') {
    return { score: 20, reason: 'Location open / flexible', isMismatch: false };
  }

  // If job is explicitly Remote
  if (jobWorkMode === 'Remote' || normJobLoc.includes('remote')) {
    return {
      score: 20,
      reason: 'Role is remote and compatible with your location',
      isMismatch: false,
    };
  }

  // If location is unknown/undisclosed
  if (!normJobLoc || normJobLoc === 'undisclosed' || normJobLoc === 'unknown') {
    return {
      score: 8,
      warning: 'Location not specified in posting',
      isMismatch: false,
    };
  }

  // Geographic comparison
  const countryMatches =
    jobCountry && normalizeText(jobCountry) === normUserLoc;
  const directMatch =
    normJobLoc.includes(normUserLoc) || normUserLoc.includes(normJobLoc);

  if (directMatch || countryMatches) {
    return {
      score: 20,
      reason: `Location matches "${jobLocation}"`,
      isMismatch: false,
    };
  }

  // Geographic mismatch
  return {
    score: 0,
    warning: `Location "${jobLocation}" does not match requested "${userLocation}"`,
    isMismatch: true,
  };
}

/**
 * 3. Keyword Match (Max 20 Points)
 */
export function scoreKeywords(
  job: JobListing,
  userKeywords?: string[]
): { score: number; reason?: string; warning?: string } {
  if (!userKeywords || userKeywords.length === 0) {
    return { score: 20, reason: 'No specific keywords required' };
  }

  const combinedJobText = `
    ${job.title}
    ${job.description}
    ${job.requirements.join(' ')}
    ${job.keywords.join(' ')}
  `.toLowerCase();

  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const rawKw of userKeywords) {
    const kw = rawKw.trim();
    if (!kw) continue;

    const lowerKw = kw.toLowerCase();
    let isMatched = false;

    // Word boundary regex
    if (lowerKw === 'ai') {
      isMatched = /\b(ai|artificial intelligence|genai|machine learning)\b/i.test(combinedJobText);
    } else if (lowerKw === 'saas') {
      isMatched = /\b(saas|software as a service|cloud software)\b/i.test(combinedJobText);
    } else if (lowerKw === 'ml') {
      isMatched = /\b(ml|machine learning)\b/i.test(combinedJobText);
    } else {
      const escaped = lowerKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(`\\b${escaped}\\b`, 'i');
      isMatched = reg.test(combinedJobText);
    }

    if (isMatched) {
      matchedKeywords.push(kw);
    } else {
      missingKeywords.push(kw);
    }
  }

  const validCount = matchedKeywords.length + missingKeywords.length;
  if (validCount === 0) {
    return { score: 20, reason: 'No valid keywords specified' };
  }

  const ratio = matchedKeywords.length / validCount;
  const score = Math.round(ratio * 20);

  let reason: string | undefined;
  let warning: string | undefined;

  if (matchedKeywords.length > 0) {
    reason = `Keywords matched: ${matchedKeywords.join(', ')}`;
  }
  if (missingKeywords.length > 0) {
    warning = `Keywords not found: ${missingKeywords.join(', ')}`;
  }

  return { score, reason, warning };
}

/**
 * 4. Seniority Match (Max 10 Points)
 */
export function scoreSeniority(
  jobSeniority: SeniorityLevel | null,
  preferredSeniority?: SeniorityLevel | 'Any' | null,
  requirements?: string[]
): { score: number; reason?: string; warning?: string } {
  if (!preferredSeniority || preferredSeniority === 'Any') {
    return { score: 10, reason: 'Seniority preference open / any' };
  }

  if (jobSeniority === preferredSeniority) {
    return {
      score: 10,
      reason: `Seniority aligns with requested ${preferredSeniority}`,
    };
  }

  // Check requirements for experience years to provide informative warnings
  const reqText = (requirements || []).join(' ');
  const expMatch = reqText.match(/(\d+[\s–-]+(?:\d+)?\s*(?:\+)?\s*years?)/i);
  const expSnippet = expMatch ? expMatch[0] : null;

  // Junior requesting Senior
  if (
    (preferredSeniority === 'Intern' || preferredSeniority === 'Junior') &&
    (jobSeniority === 'Senior' || jobSeniority === 'Lead' || jobSeniority === 'Executive' || jobSeniority === 'Director')
  ) {
    return {
      score: 3,
      warning: expSnippet
        ? `Job requests ${expSnippet} of experience (${jobSeniority})`
        : `Job requests ${jobSeniority} level experience`,
    };
  }

  // Senior requesting Junior
  if (
    (preferredSeniority === 'Senior' || preferredSeniority === 'Lead') &&
    (jobSeniority === 'Intern' || jobSeniority === 'Junior')
  ) {
    return {
      score: 5,
      warning: `Job is entry-level (${jobSeniority}), but ${preferredSeniority} was requested`,
    };
  }

  if (!jobSeniority) {
    return {
      score: 6,
      warning: 'Seniority level not specified in posting',
    };
  }

  // Adjacent level (e.g. Mid vs Junior, or Mid vs Senior)
  return {
    score: 8,
    reason: `Seniority is reasonably close (${jobSeniority})`,
  };
}

/**
 * 5. Work Mode Match (Max 10 Points)
 */
export function scoreWorkMode(
  jobWorkMode: WorkMode | null,
  preferredWorkMode?: WorkMode | 'Any' | null
): { score: number; reason?: string; warning?: string } {
  if (!preferredWorkMode || preferredWorkMode === 'Any') {
    return { score: 10, reason: 'Work mode preference flexible' };
  }

  if (jobWorkMode === preferredWorkMode) {
    return {
      score: 10,
      reason: `Work mode matches preferred policy (${preferredWorkMode})`,
    };
  }

  if (!jobWorkMode) {
    return {
      score: 5,
      warning: 'Work mode not specified in listing',
    };
  }

  if (preferredWorkMode === 'Remote') {
    if (jobWorkMode === 'Hybrid') {
      return {
        score: 5,
        warning: 'Role is Hybrid, but Remote was preferred',
      };
    }
    if (jobWorkMode === 'On-site') {
      return {
        score: 2,
        warning: 'Role is On-site, but Remote was preferred',
      };
    }
  }

  return {
    score: 6,
    warning: `Work mode is ${jobWorkMode}, but ${preferredWorkMode} was requested`,
  };
}

/**
 * 6. Visa Sponsorship Match (Max 5 Points)
 */
export function scoreVisa(
  jobDescription: string,
  visaPreference?: VisaPreference
): { score: number; reason?: string; warning?: string } {
  if (
    !visaPreference ||
    visaPreference === 'Any' ||
    visaPreference === 'No sponsorship required'
  ) {
    return { score: 5, reason: 'Visa requirements met' };
  }

  // User specifically requires sponsorship
  const lowerDesc = jobDescription.toLowerCase();

  const explicitAvailable =
    /\b(visa sponsorship (is )?available|sponsorship provided|will sponsor|h-?1b (transfer|sponsorship))\b/i.test(
      lowerDesc
    );
  if (explicitAvailable) {
    return {
      score: 5,
      reason: 'Visa sponsorship explicitly available',
    };
  }

  const explicitUnavailable =
    /\b(no visa sponsorship|unable to sponsor|must be authorized to work|cannot sponsor|without sponsorship)\b/i.test(
      lowerDesc
    );
  if (explicitUnavailable) {
    return {
      score: 0,
      warning: 'Visa sponsorship not supported for this role',
    };
  }

  return {
    score: 2,
    warning: 'Visa sponsorship not specified in listing',
  };
}

/**
 * 7. Freshness Match (Max 5 Points)
 */
export function scoreFreshness(checkedAt: string): { score: number; reason?: string } {
  if (!checkedAt) {
    return { score: 1, reason: 'Verification timestamp unavailable' };
  }

  try {
    const checkedTime = new Date(checkedAt).getTime();
    const now = Date.now();
    const diffHours = Math.max(0, (now - checkedTime) / (1000 * 60 * 60));

    if (diffHours <= 1) {
      return { score: 5, reason: 'Verified within the last hour' };
    }
    if (diffHours <= 24) {
      return { score: 4, reason: 'Verified within the last 24 hours' };
    }
    if (diffHours <= 72) {
      return { score: 3, reason: 'Verified within the last 3 days' };
    }
    if (diffHours <= 168) {
      return { score: 2, reason: 'Verified within the last week' };
    }
    return { score: 1, reason: 'Verified more than a week ago' };
  } catch {
    return { score: 1, reason: 'Verification timestamp invalid' };
  }
}

/**
 * Checks whether a job description contains signals that the position has expired/closed.
 */
function isJobExpiredOrClosed(description: string, title: string): boolean {
  const combined = `${title} ${description}`.toLowerCase();
  return /\b(job (has )?expired|no longer accepting applications|this position is closed|role has been filled|posting has ended)\b/i.test(
    combined
  );
}

/**
 * Main Pure Matching Function: Compares a JobListing against UserPreferences
 * and returns a deterministic, fully explainable 100-point match breakdown.
 */
export function scoreJobMatch(
  job: JobListing,
  preferences: UserPreferences
): MatchResult {
  if (!job) {
    return {
      score: 0,
      eligible: false,
      reasons: [],
      warnings: ['Invalid job record'],
      breakdown: {
        role: 0,
        location: 0,
        keywords: 0,
        seniority: 0,
        workMode: 0,
        visa: 0,
        freshness: 0,
      },
    };
  }

  const reasons: string[] = [];
  const warnings: string[] = [];

  // 1. Role Score (30 pts)
  const roleRes = scoreRole(job.title, preferences.role);
  if (roleRes.reason) reasons.push(roleRes.reason);
  if (roleRes.warning) warnings.push(roleRes.warning);

  // 2. Location Score (20 pts)
  const locRes = scoreLocation(
    job.location,
    job.country,
    job.workMode,
    preferences.location
  );
  if (locRes.reason) reasons.push(locRes.reason);
  if (locRes.warning) warnings.push(locRes.warning);

  // 3. Keywords Score (20 pts)
  const kwRes = scoreKeywords(job, preferences.keywords);
  if (kwRes.reason) reasons.push(kwRes.reason);
  if (kwRes.warning) warnings.push(kwRes.warning);

  // 4. Seniority Score (10 pts)
  const senRes = scoreSeniority(
    job.seniority,
    preferences.seniority,
    job.requirements
  );
  if (senRes.reason) reasons.push(senRes.reason);
  if (senRes.warning) warnings.push(senRes.warning);

  // 5. Work Mode Score (10 pts)
  const wmRes = scoreWorkMode(job.workMode, preferences.workMode);
  if (wmRes.reason) reasons.push(wmRes.reason);
  if (wmRes.warning) warnings.push(wmRes.warning);

  // 6. Visa Score (5 pts)
  const visaRes = scoreVisa(
    `${job.title} ${job.description} ${job.requirements.join(' ')}`,
    preferences.visaPreference
  );
  if (visaRes.reason) reasons.push(visaRes.reason);
  if (visaRes.warning) warnings.push(visaRes.warning);

  // 7. Freshness Score (5 pts)
  const freshRes = scoreFreshness(job.checkedAt);
  if (freshRes.reason) reasons.push(freshRes.reason);

  const breakdown: MatchBreakdown = {
    role: roleRes.score,
    location: locRes.score,
    keywords: kwRes.score,
    seniority: senRes.score,
    workMode: wmRes.score,
    visa: visaRes.score,
    freshness: freshRes.score,
  };

  const totalScore = Math.min(
    100,
    Math.max(
      0,
      breakdown.role +
        breakdown.location +
        breakdown.keywords +
        breakdown.seniority +
        breakdown.workMode +
        breakdown.visa +
        breakdown.freshness
    )
  );

  // Hard Filter Evaluations:
  let eligible = true;

  // Filter 1: Clearly incompatible role (0 role match)
  if (roleRes.isMismatch) {
    eligible = false;
  }

  // Filter 2: Clearly incompatible location
  if (locRes.isMismatch) {
    eligible = false;
  }

  // Filter 3: Clearly closed or expired posting
  if (isJobExpiredOrClosed(job.description, job.title)) {
    eligible = false;
    warnings.unshift('Job posting is closed or no longer accepting applications');
  }

  return {
    score: totalScore,
    eligible,
    reasons,
    warnings,
    breakdown,
  };
}
