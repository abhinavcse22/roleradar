import { AgentJobItem } from '../tinyfish/types';
import { JobListing } from '../jobs/types';
import { normalizeAgentJob } from '../jobs/normalize';
import { deduplicateJobs } from '../jobs/dedupe';
import { scoreJobMatch } from '../matching/scoring';
import { UserPreferences } from '../matching/types';
import { ScoredJobListing } from './types';

export interface MergeAgentResultsOutput {
  jobs: ScoredJobListing[];
  newJobsCount: number;
  addedNormalizedCount: number;
  totalUniqueJobs: number;
  totalEligibleJobs: number;
  totalFilteredJobs: number;
}

/**
 * Pure helper that safely merges newly arrived Agent jobs into the existing search results.
 * 
 * 1. Normalizes raw AgentJobItems into canonical JobListings.
 * 2. Deduplicates with existing jobs (using field-specific authority and provenance union).
 * 3. Recalculates explainable match scores for all positions against user preferences.
 * 4. Filters out ineligible jobs.
 * 5. Applies deterministic descending sort.
 */
export function mergeAgentResults(
  currentJobs: ScoredJobListing[],
  newAgentJobs: AgentJobItem[],
  preferences: UserPreferences
): MergeAgentResultsOutput {
  if (!newAgentJobs || newAgentJobs.length === 0) {
    return {
      jobs: currentJobs,
      newJobsCount: 0,
      addedNormalizedCount: 0,
      totalUniqueJobs: currentJobs.length,
      totalEligibleJobs: currentJobs.length,
      totalFilteredJobs: 0,
    };
  }

  // 1. Normalize newly arrived Agent jobs
  const normalizedNewJobs: JobListing[] = [];
  for (const item of newAgentJobs) {
    const job = normalizeAgentJob(item);
    if (job) {
      normalizedNewJobs.push(job);
    }
  }

  if (normalizedNewJobs.length === 0) {
    return {
      jobs: currentJobs,
      newJobsCount: 0,
      addedNormalizedCount: 0,
      totalUniqueJobs: currentJobs.length,
      totalEligibleJobs: currentJobs.length,
      totalFilteredJobs: 0,
    };
  }

  // 2. Extract base JobListings from current scored jobs
  const existingBaseJobs: JobListing[] = currentJobs.map((scored) => ({
    id: scored.id,
    title: scored.title,
    company: scored.company,
    location: scored.location,
    country: scored.country,
    employmentType: scored.employmentType,
    seniority: scored.seniority,
    workMode: scored.workMode,
    description: scored.description,
    requirements: Array.isArray(scored.requirements) ? scored.requirements : [],
    keywords: Array.isArray(scored.keywords) ? scored.keywords : [],
    source: scored.source,
    sourceUrl: scored.sourceUrl,
    applyUrl: scored.applyUrl,
    checkedAt: scored.checkedAt,
    provenance: Array.isArray(scored.provenance) ? scored.provenance : [],
  }));

  // 3. Combine and deduplicate
  const combined = [...existingBaseJobs, ...normalizedNewJobs];
  const deduplicated = deduplicateJobs(combined);

  // 4. Score and filter eligible positions
  const scoredJobs: ScoredJobListing[] = [];
  for (const job of deduplicated) {
    const match = scoreJobMatch(job, preferences);
    if (match.eligible) {
      scoredJobs.push({
        ...job,
        match,
      });
    }
  }

  // 5. Deterministic descending sort
  scoredJobs.sort((a, b) => {
    // 1. Overall Match Score descending
    if (b.match.score !== a.match.score) {
      return b.match.score - a.match.score;
    }
    // 2. Role score descending
    if (b.match.breakdown.role !== a.match.breakdown.role) {
      return b.match.breakdown.role - a.match.breakdown.role;
    }
    // 3. Keyword evidence descending
    if (b.match.breakdown.keywords !== a.match.breakdown.keywords) {
      return b.match.breakdown.keywords - a.match.breakdown.keywords;
    }
    // 4. Freshness score descending
    if (b.match.breakdown.freshness !== a.match.breakdown.freshness) {
      return b.match.breakdown.freshness - a.match.breakdown.freshness;
    }
    // 5. Stable tie-breaker: title + company
    const keyA = `${a.title} ${a.company}`.toLowerCase();
    const keyB = `${b.title} ${b.company}`.toLowerCase();
    return keyA.localeCompare(keyB);
  });

  const previousIds = new Set(currentJobs.map((j) => j.id));
  const newlyAddedCount = scoredJobs.filter((j) => !previousIds.has(j.id)).length;

  return {
    jobs: scoredJobs,
    newJobsCount: newlyAddedCount,
    addedNormalizedCount: normalizedNewJobs.length,
    totalUniqueJobs: deduplicated.length,
    totalEligibleJobs: scoredJobs.length,
    totalFilteredJobs: deduplicated.length - scoredJobs.length,
  };
}
