import { searchTinyFish } from '../tinyfish/search';
import { fetchTinyFish } from '../tinyfish/fetch';
import { runTinyFishAgent } from '../tinyfish/agent';
import { NormalizedSearchResult } from '../tinyfish/types';
import { JobListing } from '../jobs/types';
import {
  canonicalizeUrl,
  normalizeAgentJob,
  normalizeFetchedJob,
  normalizeSearchResult,
} from '../jobs/normalize';
import { deduplicateJobs } from '../jobs/dedupe';
import { scoreJobMatch } from '../matching/scoring';
import { UserPreferences } from '../matching/types';
import {
  PipelineStats,
  ScoredJobListing,
  SearchPipelineResult,
} from './types';
import { classifyUrl } from './classifier';

/**
 * Builds deterministic, targeted search queries based on user criteria.
 */
export function generateSearchQueries(preferences: UserPreferences): string[] {
  const role = preferences.role.trim();
  const location = preferences.location.trim();
  const topKeyword =
    Array.isArray(preferences.keywords) && preferences.keywords.length > 0
      ? preferences.keywords[0].trim()
      : '';

  const kwToken = topKeyword ? ` ${topKeyword}` : '';

  const queries = [
    `"${role}" "${location}"${kwToken} site:jobs.ashbyhq.com`,
    `"${role}" "${location}"${kwToken} site:boards.greenhouse.io`,
    `"${role}" "${location}"${kwToken} site:jobs.lever.co`,
    `"${role}" "${location}"${kwToken} careers`,
  ];

  // Return unique queries
  return Array.from(new Set(queries.map((q) => q.replace(/\s+/g, ' ').trim())));
}

/**
 * Executes an array of async tasks with bounded concurrency.
 */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      try {
        const value = await fn(items[idx]);
        results[idx] = { status: 'fulfilled', value };
      } catch (reason: unknown) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
}

/**
 * Main End-to-End Search Pipeline Orchestrator.
 * Connects TinyFish Search -> Classify -> TinyFish Fetch / Agent ->
 * Normalize -> Deduplicate -> Match -> Hard Filter -> Deterministic Rank.
 */
export async function searchJobs(
  preferences: UserPreferences
): Promise<SearchPipelineResult> {
  const executedAt = new Date().toISOString();

  const stats: PipelineStats = {
    searchResults: 0,
    directJobCandidates: 0,
    careerHubCandidates: 0,
    fetchedPages: 0,
    agentRuns: 0,
    normalizedJobs: 0,
    uniqueJobs: 0,
    eligibleJobs: 0,
    failedSources: 0,
  };

  if (!preferences.role || preferences.role.trim() === '') {
    throw new Error('User role preference is required.');
  }
  if (!preferences.location || preferences.location.trim() === '') {
    throw new Error('User location preference is required.');
  }

  // -------------------------------------------------------------
  // 1. TinyFish Search Phase
  // -------------------------------------------------------------
  const queries = generateSearchQueries(preferences);
  const rawSearchResults: NormalizedSearchResult[] = [];

  const searchSettled = await Promise.allSettled(
    queries.map((q) => searchTinyFish(q, { timeoutMs: 10000 }))
  );

  for (const res of searchSettled) {
    if (res.status === 'fulfilled') {
      rawSearchResults.push(...res.value);
    } else {
      stats.failedSources++;
    }
  }

  stats.searchResults = rawSearchResults.length;

  // Deduplicate raw search results by canonical URL
  const seenSearchUrls = new Set<string>();
  const uniqueSearchResults: NormalizedSearchResult[] = [];

  for (const item of rawSearchResults) {
    const canonUrl = canonicalizeUrl(item.url);
    if (canonUrl && !seenSearchUrls.has(canonUrl)) {
      seenSearchUrls.add(canonUrl);
      uniqueSearchResults.push(item);
    }
  }

  // -------------------------------------------------------------
  // 2. Search Result Classification Phase
  // -------------------------------------------------------------
  const directJobCandidates: NormalizedSearchResult[] = [];
  const careerHubCandidates: NormalizedSearchResult[] = [];

  for (const item of uniqueSearchResults) {
    const category = classifyUrl(item.url);
    if (category === 'directJob') {
      directJobCandidates.push(item);
    } else if (category === 'careerHub') {
      careerHubCandidates.push(item);
    }
  }

  stats.directJobCandidates = directJobCandidates.length;
  stats.careerHubCandidates = careerHubCandidates.length;

  const candidateJobListings: JobListing[] = [];
  const handledUrls = new Set<string>();

  // -------------------------------------------------------------
  // 3. TinyFish Fetch Phase (Direct Job Postings)
  // -------------------------------------------------------------
  // Cap direct job fetches to 6 to stay responsive and well within rate limits
  const directUrlsToFetch = directJobCandidates
    .map((item) => item.url)
    .filter(Boolean)
    .slice(0, 6);

  if (directUrlsToFetch.length > 0) {
    const fetchSettled = await runWithConcurrency(
      directUrlsToFetch,
      3, // Concurrency limit of 3
      async (url) => {
        return await fetchTinyFish(url, { timeoutMs: 12000 });
      }
    );

    for (let i = 0; i < fetchSettled.length; i++) {
      const res = fetchSettled[i];
      const targetUrl = directUrlsToFetch[i];
      handledUrls.add(canonicalizeUrl(targetUrl));

      if (res.status === 'fulfilled') {
        stats.fetchedPages++;
        const normJob = normalizeFetchedJob(res.value);
        if (normJob) {
          candidateJobListings.push(normJob);
        }
      } else {
        stats.failedSources++;
      }
    }
  }

  // -------------------------------------------------------------
  // 4. TinyFish Agent Phase (Dynamic Career Hubs)
  // -------------------------------------------------------------
  // Run Agent selectively on top 1-2 discovered career hubs with safe timeout
  const careerHubsForAgent = careerHubCandidates
    .map((item) => item.url)
    .filter((url) => !handledUrls.has(canonicalizeUrl(url)))
    .slice(0, 2);

  if (careerHubsForAgent.length > 0) {
    const agentSettled = await runWithConcurrency(
      careerHubsForAgent,
      2, // Concurrency limit of 2 for Agent
      async (url) => {
        return await runTinyFishAgent({
          url,
          role: preferences.role,
          location: preferences.location,
          keywords: preferences.keywords || [],
          timeoutMs: 20000, // 20s bounded timeout per Agent run
        });
      }
    );

    for (let i = 0; i < agentSettled.length; i++) {
      const res = agentSettled[i];
      const targetUrl = careerHubsForAgent[i];
      handledUrls.add(canonicalizeUrl(targetUrl));

      if (res.status === 'fulfilled' && res.value.success) {
        stats.agentRuns++;
        for (const agentJobItem of res.value.jobs) {
          const normJob = normalizeAgentJob(agentJobItem);
          if (normJob) {
            candidateJobListings.push(normJob);
          }
        }
      } else {
        stats.failedSources++;
      }
    }
  }

  // -------------------------------------------------------------
  // 5. Fallback Search Normalization
  // -------------------------------------------------------------
  // For discovered search results not yet processed by Fetch or Agent,
  // normalize their search metadata so discoveries are never lost.
  for (const item of uniqueSearchResults) {
    const canonUrl = canonicalizeUrl(item.url);
    if (!handledUrls.has(canonUrl)) {
      const normJob = normalizeSearchResult(item);
      if (normJob) {
        candidateJobListings.push(normJob);
      }
    }
  }

  stats.normalizedJobs = candidateJobListings.length;

  // -------------------------------------------------------------
  // 6. Deduplication Phase
  // -------------------------------------------------------------
  const deduplicatedJobs = deduplicateJobs(candidateJobListings);
  stats.uniqueJobs = deduplicatedJobs.length;

  // -------------------------------------------------------------
  // 7. Matching & Scoring Phase
  // -------------------------------------------------------------
  const scoredJobs: ScoredJobListing[] = [];

  for (const job of deduplicatedJobs) {
    const match = scoreJobMatch(job, preferences);
    // Hard filter: only keep eligible positions
    if (match.eligible) {
      scoredJobs.push({
        ...job,
        match,
      });
    }
  }

  stats.eligibleJobs = scoredJobs.length;

  // -------------------------------------------------------------
  // 8. Deterministic Ranking Phase
  // -------------------------------------------------------------
  scoredJobs.sort((a, b) => {
    // 1. Overall Match Score descending
    if (b.match.score !== a.match.score) {
      return b.match.score - a.match.score;
    }
    // 2. Role score descending
    if (b.match.breakdown.role !== a.match.breakdown.role) {
      return b.match.breakdown.role - a.match.breakdown.role;
    }
    // 3. Freshness score descending
    if (b.match.breakdown.freshness !== a.match.breakdown.freshness) {
      return b.match.breakdown.freshness - a.match.breakdown.freshness;
    }
    // 4. Stable tie-breaker: title + company
    const keyA = `${a.title} ${a.company}`.toLowerCase();
    const keyB = `${b.title} ${b.company}`.toLowerCase();
    return keyA.localeCompare(keyB);
  });

  return {
    jobs: scoredJobs,
    stats,
    executedAt,
  };
}
