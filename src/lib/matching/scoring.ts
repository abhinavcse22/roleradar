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
 * Distinguishes exact role phrases, specializations, seniority variants, and adjacent disciplines.
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

  // 1. Exact match (e.g. "Product Manager" === "Product Manager")
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

  // Seniority modifier regex
  const hasSeniorityModifier =
    /\b(senior|sr\.?|lead|principal|staff|director|head of|vp|associate|junior|jr\.?|intern|entry)\b/i.test(
      jobTitle
    );

  // Weak/adjacent discipline indicator
  const hasAdjacentDiscipline =
    /\b(analyst|operations|ops|marketing|designer|architect|coordinator|specialist|assistant)\b/i.test(
      jobTitle
    );

  // Check if jobTitle contains the exact role phrase
  const escapedUserRole = normUserRole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exactPhraseContained = new RegExp(`\\b${escapedUserRole}\\b`, 'i').test(normTitle);

  if (exactPhraseContained) {
    if (hasAdjacentDiscipline) {
      return {
        score: 14,
        warning: `Weak role alignment: "${jobTitle}" is adjacent to requested "${userRole}"`,
        isMismatch: false,
      };
    }

    if (hasSeniorityModifier) {
      const tokensWithoutSeniorityOrRole = titleTokens.filter(
        (t) =>
          !userTokens.includes(t) &&
          !/^(senior|sr|lead|principal|staff|director|head|vp|associate|junior|jr|intern|entry)$/i.test(t)
      );

      if (tokensWithoutSeniorityOrRole.length > 0) {
        return {
          score: 23,
          reason: `Role matches "${userRole}" with seniority & specialization "${jobTitle}"`,
          isMismatch: false,
        };
      }

      return {
        score: 24,
        reason: `Role matches "${userRole}" with seniority level "${jobTitle}"`,
        isMismatch: false,
      };
    }

    return {
      score: 27,
      reason: `Role matches "${userRole}" with specialization "${jobTitle}"`,
      isMismatch: false,
    };
  }

  // All tokens matched, but phrase wasn't contiguous or was formatted differently
  if (overlapRatio === 1) {
    if (hasAdjacentDiscipline) {
      return {
        score: 14,
        warning: `Weak role alignment: "${jobTitle}" is adjacent to requested "${userRole}"`,
        isMismatch: false,
      };
    }
    return {
      score: 26,
      reason: `Role aligns with "${userRole}" in "${jobTitle}"`,
      isMismatch: false,
    };
  }

  // Check for strong related product titles, e.g. "Product Owner", "Product Lead"
  if (normUserRole.includes('product') && normTitle.includes('product')) {
    if (/\b(owner|lead|head)\b/i.test(jobTitle) && !hasAdjacentDiscipline) {
      return {
        score: 18,
        reason: `Related role "${jobTitle}" aligns with "${userRole}"`,
        isMismatch: false,
      };
    }
  }

  if (hasAdjacentDiscipline && overlapRatio >= 0.5) {
    return {
      score: 12,
      warning: `Weak role alignment: "${jobTitle}" is adjacent to requested "${userRole}"`,
      isMismatch: false,
    };
  }

  if (overlapRatio >= 0.6) {
    return {
      score: 18,
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

  // 0 overlap -> Ineligible
  return {
    score: 0,
    warning: `Job title "${jobTitle}" does not match requested role "${userRole}"`,
    isMismatch: true,
  };
}

/**
 * 2. Location Match (Max 20 Points)
 * Distinguishes requested city, requested country, remote compatibility, and unknown locations.
 */
export function scoreLocation(
  jobLocation: string,
  jobCountry: string | null,
  jobWorkMode: WorkMode | null,
  userLocation: string
): { score: number; reason?: string; warning?: string; isMismatch: boolean } {
  const normUserLoc = normalizeText(userLocation);
  const normJobLoc = normalizeText(jobLocation);

  // If user has no specific location or asks for remote/any
  if (!normUserLoc || normUserLoc === 'any' || normUserLoc === 'remote') {
    return { score: 20, reason: 'Location open / flexible', isMismatch: false };
  }

  // If location is unknown/undisclosed
  if (!normJobLoc || normJobLoc === 'undisclosed' || normJobLoc === 'unknown') {
    return {
      score: 6,
      warning: 'Location not specified in posting',
      isMismatch: false,
    };
  }

  const displayLoc =
    jobLocation.length > 50 ? `${jobLocation.slice(0, 50).trim()}...` : jobLocation;

  // Is the job explicitly remote?
  const isJobRemote = jobWorkMode === 'Remote' || normJobLoc.includes('remote');

  // Parse user requested parts before punctuation stripping
  const userParts = (userLocation || '')
    .split(',')
    .map((p) => normalizeText(p))
    .filter(Boolean);
  const knownCountries = new Set([
    'india',
    'us',
    'usa',
    'united states',
    'uk',
    'united kingdom',
    'germany',
    'canada',
    'australia',
    'singapore',
  ]);
  const hasSpecificCityRequested =
    userParts.length > 1 || (userParts.length === 1 && !knownCountries.has(userParts[0]));

  const requestedCity = hasSpecificCityRequested ? userParts[0] : null;
  const requestedCountry =
    userParts.length > 1
      ? userParts[1]
      : !hasSpecificCityRequested
      ? userParts[0]
      : (jobCountry ? normalizeText(jobCountry) : null);

  // Check city match
  const cityMatched = requestedCity ? normJobLoc.includes(requestedCity) : false;

  // Check country match
  const normJobCountry = jobCountry ? normalizeText(jobCountry) : '';
  const countryMatched =
    (requestedCountry && normJobCountry === requestedCountry) ||
    (requestedCountry ? normJobLoc.includes(requestedCountry) : false);

  // Case A: User specified a city (e.g. "Bengaluru" or "Bengaluru, India")
  if (requestedCity) {
    if (cityMatched) {
      return {
        score: 20,
        reason: `Location matches requested city: "${displayLoc}"`,
        isMismatch: false,
      };
    }

    // Job is remote
    if (isJobRemote) {
      if (countryMatched || !jobCountry || jobCountry === 'Remote' || jobCountry === 'Worldwide') {
        return {
          score: 18,
          reason: 'Role is remote and compatible with your location',
          isMismatch: false,
        };
      }
    }

    // If country matches, but city does not match or is country-wide
    if (countryMatched) {
      const jobParts = (jobLocation || '')
        .split(',')
        .map((p) => normalizeText(p))
        .filter(Boolean);
      const isJobCountryWide =
        jobParts.length === 1 &&
        (jobParts[0] === requestedCountry || (requestedCountry && jobParts[0].includes(requestedCountry)));

      if (isJobCountryWide) {
        return {
          score: 18,
          reason: `Location matches requested country (${jobCountry || requestedCountry}), but specific city was requested`,
          isMismatch: false,
        };
      }

      // Different city in the same country -> Incompatible with specific city request
      return {
        score: 0,
        warning: `Location "${displayLoc}" does not match requested city "${userLocation}"`,
        isMismatch: true,
      };
    }

    // Neither city nor country matched
    return {
      score: 0,
      warning: `Location "${displayLoc}" does not match requested "${userLocation}"`,
      isMismatch: true,
    };
  }

  // Case B: User specified a country (e.g. "India")
  if (requestedCountry) {
    if (countryMatched || normJobLoc.includes(requestedCountry)) {
      return {
        score: 20,
        reason: `Location matches requested country: ${jobCountry || displayLoc}`,
        isMismatch: false,
      };
    }

    if (isJobRemote) {
      return {
        score: 18,
        reason: 'Role is remote and compatible with your location',
        isMismatch: false,
      };
    }

    // Geographic mismatch
    return {
      score: 0,
      warning: `Location "${displayLoc}" does not match requested "${userLocation}"`,
      isMismatch: true,
    };
  }

  // Fallback: direct substring match
  if (normJobLoc.includes(normUserLoc) || normUserLoc.includes(normJobLoc)) {
    return {
      score: 20,
      reason: `Location matches "${displayLoc}"`,
      isMismatch: false,
    };
  }

  if (isJobRemote) {
    return {
      score: 18,
      reason: 'Role is remote and compatible with your location',
      isMismatch: false,
    };
  }

  return {
    score: 0,
    warning: `Location "${displayLoc}" does not match requested "${userLocation}"`,
    isMismatch: true,
  };
}

/**
 * 3. Keyword Match (Max 20 Points)
 * Evidence-based search across title, description, requirements, and keywords.
 * Neutral when no user keywords are specified.
 */
export function scoreKeywords(
  job: JobListing,
  userKeywords?: string[]
): { score: number; reason?: string; warning?: string; isNeutral: boolean } {
  if (!userKeywords || userKeywords.length === 0) {
    return { score: 0, isNeutral: true };
  }

  const validKeywords = userKeywords.map((k) => k.trim()).filter((k) => k.length > 0);
  if (validKeywords.length === 0) {
    return { score: 0, isNeutral: true };
  }

  const combinedJobText = `
    ${job.title}
    ${job.description}
    ${job.requirements.join(' ')}
    ${job.keywords.join(' ')}
  `.toLowerCase();

  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const kw of validKeywords) {
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

  const ratio = matchedKeywords.length / validKeywords.length;
  const score = Math.round(ratio * 20);

  let reason: string | undefined;
  let warning: string | undefined;

  if (matchedKeywords.length > 0) {
    reason = `Keywords matched: ${matchedKeywords.join(', ')}`;
  }
  if (missingKeywords.length > 0) {
    warning = `Keywords not found: ${missingKeywords.join(', ')}`;
  }

  return { score, reason, warning, isNeutral: false };
}

/**
 * 4. Seniority Match (Max 10 Points)
 * Neutral when user prefers 'Any' or unspecified.
 */
export function scoreSeniority(
  jobSeniority: SeniorityLevel | null,
  preferredSeniority?: SeniorityLevel | 'Any' | null,
  requirements?: string[]
): { score: number; reason?: string; warning?: string; isNeutral: boolean } {
  if (!preferredSeniority || preferredSeniority === 'Any') {
    return { score: 0, isNeutral: true };
  }

  if (jobSeniority === preferredSeniority) {
    return {
      score: 10,
      reason: `Seniority aligns with requested ${preferredSeniority}`,
      isNeutral: false,
    };
  }

  // Check requirements for experience years to provide informative warnings
  const reqText = (requirements || []).join(' ');
  const expMatch = reqText.match(/(\d+[\s–-]+(?:\d+)?\s*(?:\+)?\s*years?)/i);
  const expSnippet = expMatch ? expMatch[0] : null;

  // Junior requesting Senior/Lead/Executive/Director
  if (
    (preferredSeniority === 'Intern' || preferredSeniority === 'Junior') &&
    (jobSeniority === 'Senior' || jobSeniority === 'Lead' || jobSeniority === 'Executive' || jobSeniority === 'Director')
  ) {
    return {
      score: 3,
      warning: expSnippet
        ? `Job requests ${expSnippet} of experience (${jobSeniority})`
        : `Job requests ${jobSeniority} level experience`,
      isNeutral: false,
    };
  }

  // Senior requesting Junior/Intern
  if (
    (preferredSeniority === 'Senior' || preferredSeniority === 'Lead') &&
    (jobSeniority === 'Intern' || jobSeniority === 'Junior')
  ) {
    return {
      score: 4,
      warning: `Job is entry-level (${jobSeniority}), but ${preferredSeniority} was requested`,
      isNeutral: false,
    };
  }

  if (!jobSeniority) {
    return {
      score: 6,
      warning: 'Seniority level not specified in posting',
      isNeutral: false,
    };
  }

  // Adjacent level (e.g. Mid vs Junior, or Mid vs Senior)
  return {
    score: 8,
    reason: `Seniority is reasonably close (${jobSeniority})`,
    isNeutral: false,
  };
}

/**
 * 5. Work Mode Match (Max 10 Points)
 * Neutral when user prefers 'Any' or unspecified.
 */
export function scoreWorkMode(
  jobWorkMode: WorkMode | null,
  preferredWorkMode?: WorkMode | 'Any' | null
): { score: number; reason?: string; warning?: string; isNeutral: boolean } {
  if (!preferredWorkMode || preferredWorkMode === 'Any') {
    return { score: 0, isNeutral: true };
  }

  if (jobWorkMode === preferredWorkMode) {
    return {
      score: 10,
      reason: `Work mode matches preferred policy (${preferredWorkMode})`,
      isNeutral: false,
    };
  }

  if (!jobWorkMode) {
    return {
      score: 5,
      warning: 'Work mode not specified in listing',
      isNeutral: false,
    };
  }

  if (preferredWorkMode === 'Remote') {
    if (jobWorkMode === 'Hybrid') {
      return {
        score: 5,
        warning: 'Role is Hybrid, but Remote was preferred',
        isNeutral: false,
      };
    }
    if (jobWorkMode === 'On-site') {
      return {
        score: 2,
        warning: 'Role is On-site, but Remote was preferred',
        isNeutral: false,
      };
    }
  }

  if (preferredWorkMode === 'Hybrid') {
    if (jobWorkMode === 'Remote') {
      return {
        score: 7,
        reason: 'Role is Remote, flexible with Hybrid preference',
        isNeutral: false,
      };
    }
    if (jobWorkMode === 'On-site') {
      return {
        score: 4,
        warning: 'Role is On-site, but Hybrid was preferred',
        isNeutral: false,
      };
    }
  }

  if (preferredWorkMode === 'On-site') {
    if (jobWorkMode === 'Hybrid') {
      return {
        score: 6,
        reason: 'Role is Hybrid, includes on-site office presence',
        isNeutral: false,
      };
    }
    if (jobWorkMode === 'Remote') {
      return {
        score: 3,
        warning: 'Role is Remote, but On-site was preferred',
        isNeutral: false,
      };
    }
  }

  return {
    score: 5,
    warning: `Work mode is ${jobWorkMode}, but ${preferredWorkMode} was requested`,
    isNeutral: false,
  };
}

/**
 * 6. Visa Sponsorship Match (Max 5 Points)
 * Neutral when user prefers 'Any', 'No sponsorship required', or unspecified.
 */
export function scoreVisa(
  jobDescription: string,
  visaPreference?: VisaPreference
): { score: number; reason?: string; warning?: string; isNeutral: boolean } {
  if (
    !visaPreference ||
    visaPreference === 'Any' ||
    visaPreference === 'No sponsorship required'
  ) {
    return { score: 0, isNeutral: true };
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
      isNeutral: false,
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
      isNeutral: false,
    };
  }

  return {
    score: 2,
    warning: 'Visa sponsorship not specified in listing',
    isNeutral: false,
  };
}

/**
 * 7. Freshness Match (Max 5 Points)
 * Small recency contribution based on verification timestamp.
 */
export function scoreFreshness(checkedAt: string): { score: number; reason?: string } {
  if (!checkedAt) {
    return { score: 1, reason: 'Verification timestamp unavailable' };
  }

  try {
    const checkedTime = new Date(checkedAt).getTime();
    if (isNaN(checkedTime)) {
      return { score: 1, reason: 'Verification timestamp invalid' };
    }

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
 * and returns a deterministic, fully explainable 0-100 normalized match result.
 * Unspecified preferences are treated as neutral and excluded from the denominator.
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

  let applicableMax = 0;
  let totalEarned = 0;

  // 1. Role Score (Max 30) - Always applicable
  applicableMax += 30;
  const roleRes = scoreRole(job.title, preferences?.role || '');
  totalEarned += roleRes.score;
  if (roleRes.reason) reasons.push(roleRes.reason);
  if (roleRes.warning) warnings.push(roleRes.warning);

  // 2. Location Score (Max 20) - Always applicable
  applicableMax += 20;
  const locRes = scoreLocation(
    job.location,
    job.country,
    job.workMode,
    preferences?.location || ''
  );
  totalEarned += locRes.score;
  if (locRes.reason) reasons.push(locRes.reason);
  if (locRes.warning) warnings.push(locRes.warning);

  // 3. Keywords Score (Max 20 if specified)
  const kwRes = scoreKeywords(job, preferences?.keywords);
  if (!kwRes.isNeutral) {
    applicableMax += 20;
    totalEarned += kwRes.score;
    if (kwRes.reason) reasons.push(kwRes.reason);
    if (kwRes.warning) warnings.push(kwRes.warning);
  }

  // 4. Seniority Score (Max 10 if specified)
  const senRes = scoreSeniority(
    job.seniority,
    preferences?.seniority,
    job.requirements
  );
  if (!senRes.isNeutral) {
    applicableMax += 10;
    totalEarned += senRes.score;
    if (senRes.reason) reasons.push(senRes.reason);
    if (senRes.warning) warnings.push(senRes.warning);
  }

  // 5. Work Mode Score (Max 10 if specified)
  const wmRes = scoreWorkMode(job.workMode, preferences?.workMode);
  if (!wmRes.isNeutral) {
    applicableMax += 10;
    totalEarned += wmRes.score;
    if (wmRes.reason) reasons.push(wmRes.reason);
    if (wmRes.warning) warnings.push(wmRes.warning);
  }

  // 6. Visa Score (Max 5 if specified)
  const visaRes = scoreVisa(
    `${job.title} ${job.description} ${job.requirements.join(' ')}`,
    preferences?.visaPreference
  );
  if (!visaRes.isNeutral) {
    applicableMax += 5;
    totalEarned += visaRes.score;
    if (visaRes.reason) reasons.push(visaRes.reason);
    if (visaRes.warning) warnings.push(visaRes.warning);
  }

  // 7. Freshness Score (Max 5) - Always applicable
  applicableMax += 5;
  const freshRes = scoreFreshness(job.checkedAt);
  totalEarned += freshRes.score;
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

  const safeDenominator = Math.max(1, applicableMax);
  const normalizedScore = Math.min(
    100,
    Math.max(0, Math.round((totalEarned / safeDenominator) * 100))
  );

  // Hard Filter Evaluations:
  let eligible = true;

  if (roleRes.isMismatch) {
    eligible = false;
  }

  if (locRes.isMismatch) {
    eligible = false;
  }

  if (isJobExpiredOrClosed(job.description, job.title)) {
    eligible = false;
    warnings.unshift('Job posting is closed or no longer accepting applications');
  }

  return {
    score: normalizedScore,
    eligible,
    reasons,
    warnings,
    breakdown,
  };
}
