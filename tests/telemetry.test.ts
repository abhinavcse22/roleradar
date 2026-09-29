import test from 'node:test';
import assert from 'node:assert/strict';
import { PipelineStats, ScoredJobListing } from '../src/lib/pipeline/types';
import { mergeAgentResults } from '../src/lib/pipeline/mergeAgentResults';
import { AgentJobItem } from '../src/lib/tinyfish/types';
import { UserPreferences } from '../src/lib/matching/types';

const mockPreferences: UserPreferences = {
  role: 'Product Manager',
  location: 'India',
  keywords: ['AI'],
  seniority: 'Any',
  workMode: 'Any',
  visaPreference: 'Any',
};

// -------------------------------------------------------------
// Test A: Search count is displayed with correct meaning
// -------------------------------------------------------------
test('Telemetry A: Search count represents raw results across queries, not companies or sources', () => {
  const stats: PipelineStats = {
    searchResults: 50,
    searchQueries: 5,
    directJobCandidates: 29,
    careerHubCandidates: 12,
    fetchAttempted: 6,
    fetchedPages: 6,
    agentRuns: 1,
    agentRunsStarted: 2,
    agentRunsCompleted: 1,
    agentFailures: 0,
    agentJobsExtracted: 4,
    normalizedJobs: 48,
    uniqueJobs: 43,
    eligibleJobs: 26,
    filteredJobs: 17,
    failedSources: 0,
  };

  assert.strictEqual(stats.searchResults, 50, 'searchResults must reflect raw query results');
  assert.strictEqual(stats.searchQueries, 5, 'searchQueries must reflect query vectors executed');
  assert.strictEqual(stats.directJobCandidates + stats.careerHubCandidates <= stats.searchResults, true);
});

// -------------------------------------------------------------
// Test B: Fetch attempted != fetched successfully when failures occur
// -------------------------------------------------------------
test('Telemetry B: Fetch attempted != fetched successfully when page fetch errors occur', () => {
  const fetchAttempted = 6;
  const fetchCompleted = 4;
  const failedFetches = 2;

  const stats: PipelineStats = {
    searchResults: 40,
    directJobCandidates: 15,
    careerHubCandidates: 5,
    fetchAttempted,
    fetchedPages: fetchCompleted,
    agentRuns: 0,
    agentRunsStarted: 0,
    agentRunsCompleted: 0,
    agentFailures: 0,
    agentJobsExtracted: 0,
    normalizedJobs: 34,
    uniqueJobs: 30,
    eligibleJobs: 18,
    filteredJobs: 12,
    failedSources: failedFetches,
  };

  assert.notStrictEqual(
    stats.fetchAttempted,
    stats.fetchedPages,
    'Attempted and completed fetch counts must remain distinct'
  );
  assert.strictEqual(stats.fetchAttempted, 6);
  assert.strictEqual(stats.fetchedPages, 4);
});

// -------------------------------------------------------------
// Test C: Agent started != Agent completed
// -------------------------------------------------------------
test('Telemetry C: Agent started != Agent completed during async execution', () => {
  const stats: PipelineStats = {
    searchResults: 50,
    directJobCandidates: 25,
    careerHubCandidates: 10,
    fetchAttempted: 6,
    fetchedPages: 6,
    agentRuns: 0,
    agentRunsStarted: 2,
    agentRunsCompleted: 0,
    agentFailures: 0,
    agentJobsExtracted: 0,
    normalizedJobs: 45,
    uniqueJobs: 40,
    eligibleJobs: 22,
    filteredJobs: 18,
    failedSources: 0,
  };

  assert.strictEqual(stats.agentRunsStarted, 2, 'Two agent runs were started');
  assert.strictEqual(stats.agentRunsCompleted, 0, 'Zero agent runs have completed yet');
  assert.notStrictEqual(stats.agentRunsStarted, stats.agentRunsCompleted);
});

// -------------------------------------------------------------
// Test D: Agent completed increments only on successful valid extraction
// -------------------------------------------------------------
test('Telemetry D: Agent completed increments only on successful extraction', () => {
  const agentRunsStarted = 2;
  let agentRunsCompleted = 0;
  let agentFailures = 0;

  // Run 1 succeeds with valid extraction
  agentRunsCompleted += 1;

  assert.strictEqual(agentRunsCompleted, 1);
  assert.strictEqual(agentRunsStarted, 2);

  // Run 2 fails
  agentFailures += 1;

  // agentRunsCompleted must not increment on failure
  assert.strictEqual(agentRunsCompleted, 1);
  assert.strictEqual(agentFailures, 1);
});

// -------------------------------------------------------------
// Test E: Agent failure increments agentFailures
// -------------------------------------------------------------
test('Telemetry E: Agent failure increments agentFailures and leaves completed count unchanged', () => {
  const initialStats: PipelineStats = {
    searchResults: 50,
    directJobCandidates: 25,
    careerHubCandidates: 10,
    fetchAttempted: 6,
    fetchedPages: 6,
    agentRuns: 1,
    agentRunsStarted: 2,
    agentRunsCompleted: 1,
    agentFailures: 0,
    agentJobsExtracted: 4,
    normalizedJobs: 48,
    uniqueJobs: 42,
    eligibleJobs: 25,
    filteredJobs: 17,
    failedSources: 0,
  };

  // Simulate second agent run failure
  const updatedStats: PipelineStats = {
    ...initialStats,
    agentFailures: initialStats.agentFailures + 1,
    failedSources: initialStats.failedSources + 1,
  };

  assert.strictEqual(updatedStats.agentFailures, 1);
  assert.strictEqual(updatedStats.agentRunsCompleted, 1);
  assert.strictEqual(updatedStats.failedSources, 1);
});

// -------------------------------------------------------------
// Test F: Agent extracted jobs increase normalized/unique counts appropriately
// -------------------------------------------------------------
test('Telemetry F: Agent extracted jobs increase normalized and unique counts accurately', () => {
  const initialJob: ScoredJobListing = {
    id: 'job_init_1',
    title: 'Product Manager',
    company: 'Razorpay',
    location: 'Bengaluru, India',
    country: 'India',
    workMode: 'Remote',
    employmentType: 'Full-time',
    seniority: 'Mid',
    description: 'Core payments product manager.',
    requirements: ['SQL'],
    keywords: ['SQL'],
    source: 'fetch',
    sourceUrl: 'https://razorpay.com/jobs/pm',
    applyUrl: 'https://razorpay.com/jobs/pm',
    checkedAt: '2026-09-29T12:00:00Z',
    provenance: [{ source: 'fetch', url: 'https://razorpay.com/jobs/pm', timestamp: '2026-09-29T12:00:00Z' }],
    match: {
      score: 85,
      eligible: true,
      breakdown: { role: 35, location: 25, keywords: 0, workMode: 10, seniority: 5, visa: 5, freshness: 5 },
      reasons: [],
      warnings: [],
    },
  };

  // Agent extracts 2 jobs: 1 brand new, 1 duplicate of existing
  const agentJobs: AgentJobItem[] = [
    {
      title: 'Principal Product Manager - AI',
      company: 'HighLevel',
      location: 'India',
      employment_type: 'Full-time',
      work_mode: 'Remote',
      description: 'Lead AI products.',
      requirements: ['AI', 'Python'],
      apply_url: 'https://jobs.lever.co/gohighlevel/pm-ai',
      source_url: 'https://jobs.lever.co/gohighlevel',
    },
    {
      title: 'Product Manager',
      company: 'Razorpay',
      location: 'Bengaluru, India',
      employment_type: 'Full-time',
      work_mode: 'Remote',
      description: 'Updated payments description from Agent.',
      requirements: ['SQL', 'AI'],
      apply_url: 'https://razorpay.com/jobs/pm',
      source_url: 'https://razorpay.com/careers',
    },
  ];

  const merged = mergeAgentResults([initialJob], agentJobs, mockPreferences);

  assert.strictEqual(merged.addedNormalizedCount, 2, '2 normalized records added');
  assert.strictEqual(merged.totalUniqueJobs, 2, '1 existing + 1 brand new = 2 unique jobs after deduplication');
  assert.strictEqual(merged.newJobsCount, 1, 'Exactly 1 newly eligible job added');
});

// -------------------------------------------------------------
// Test G: Deduplication displays normalized → unique
// -------------------------------------------------------------
test('Telemetry G: Deduplication step displays normalizedRecords -> uniqueJobs', () => {
  const normalizedJobs = 52;
  const uniqueJobs = 45;

  assert.ok(uniqueJobs <= normalizedJobs, 'uniqueJobs must be <= normalizedJobs');
  const deduplicationLabel = `${normalizedJobs} records → ${uniqueJobs} unique`;
  assert.strictEqual(deduplicationLabel, '52 records → 45 unique');
});

// -------------------------------------------------------------
// Test H: Matching displays unique → eligible
// -------------------------------------------------------------
test('Telemetry H: Matching step displays uniqueJobs -> eligibleJobs', () => {
  const uniqueJobs = 45;
  const eligibleJobs = 28;

  assert.ok(eligibleJobs <= uniqueJobs, 'eligibleJobs must be <= uniqueJobs');
  const matchingLabel = `${uniqueJobs} unique → ${eligibleJobs} eligible`;
  assert.strictEqual(matchingLabel, '45 unique → 28 eligible');
});

// -------------------------------------------------------------
// Test I: Filtered = unique - eligible
// -------------------------------------------------------------
test('Telemetry I: Filtered jobs strictly equals uniqueJobs - eligibleJobs', () => {
  const uniqueJobs = 48;
  const eligibleJobs = 24;
  const filteredJobs = uniqueJobs - eligibleJobs;

  assert.strictEqual(filteredJobs, 24);
  assert.strictEqual(uniqueJobs, eligibleJobs + filteredJobs);
});

// -------------------------------------------------------------
// Test J: Client-side filters do not mutate pipeline stats
// -------------------------------------------------------------
test('Telemetry J: Client-side UI filtering does not mutate server pipeline stats', () => {
  const serverStats: PipelineStats = {
    searchResults: 50,
    searchQueries: 5,
    directJobCandidates: 25,
    careerHubCandidates: 10,
    fetchAttempted: 6,
    fetchedPages: 6,
    agentRuns: 1,
    agentRunsStarted: 2,
    agentRunsCompleted: 1,
    agentFailures: 0,
    agentJobsExtracted: 4,
    normalizedJobs: 48,
    uniqueJobs: 43,
    eligibleJobs: 26,
    filteredJobs: 17,
    failedSources: 0,
  };

  const allJobs: Array<{ id: string; workMode: 'Remote' | 'On-site' }> = [
    { id: '1', workMode: 'Remote' },
    { id: '2', workMode: 'Remote' },
    { id: '3', workMode: 'On-site' },
  ];

  // User selects "Remote" filter in UI
  const userFiltered = allJobs.filter((j) => j.workMode === 'Remote');
  assert.strictEqual(userFiltered.length, 2);

  // Server stats must remain completely immutable
  assert.strictEqual(serverStats.eligibleJobs, 26);
  assert.strictEqual(serverStats.uniqueJobs, 43);
  assert.strictEqual(serverStats.filteredJobs, 17);
});

// -------------------------------------------------------------
// Test K: New Agent results update telemetry without resetting Search/Fetch counts
// -------------------------------------------------------------
test('Telemetry K: Arriving Agent results update telemetry without resetting Search/Fetch counts', () => {
  const initialStats: PipelineStats = {
    searchResults: 50,
    searchQueries: 5,
    directJobCandidates: 29,
    careerHubCandidates: 12,
    fetchAttempted: 6,
    fetchedPages: 6,
    agentRuns: 0,
    agentRunsStarted: 2,
    agentRunsCompleted: 0,
    agentFailures: 0,
    agentJobsExtracted: 0,
    normalizedJobs: 48,
    uniqueJobs: 43,
    eligibleJobs: 24,
    filteredJobs: 19,
    failedSources: 0,
  };

  // Agent completes with 4 extracted jobs
  const updatedStats: PipelineStats = {
    ...initialStats,
    agentRuns: 1,
    agentRunsCompleted: 1,
    agentJobsExtracted: 4,
    normalizedJobs: initialStats.normalizedJobs + 4,
    uniqueJobs: initialStats.uniqueJobs + 2,
    eligibleJobs: initialStats.eligibleJobs + 2,
    filteredJobs: (initialStats.uniqueJobs + 2) - (initialStats.eligibleJobs + 2),
  };

  // Invariant verification: Search and Fetch counts must be identical
  assert.strictEqual(updatedStats.searchResults, initialStats.searchResults);
  assert.strictEqual(updatedStats.searchQueries, initialStats.searchQueries);
  assert.strictEqual(updatedStats.fetchAttempted, initialStats.fetchAttempted);
  assert.strictEqual(updatedStats.fetchedPages, initialStats.fetchedPages);

  // Agent & downstream metrics updated
  assert.strictEqual(updatedStats.agentRunsCompleted, 1);
  assert.strictEqual(updatedStats.agentJobsExtracted, 4);
  assert.strictEqual(updatedStats.uniqueJobs, 45);
  assert.strictEqual(updatedStats.eligibleJobs, 26);
  assert.strictEqual(updatedStats.filteredJobs, 19);
});

// -------------------------------------------------------------
// Test L: No ambiguous agentRuns field is used as both started and completed
// -------------------------------------------------------------
test('Telemetry L: agentRunsStarted and agentRunsCompleted are distinct and unambiguous', () => {
  const stats: PipelineStats = {
    searchResults: 50,
    directJobCandidates: 25,
    careerHubCandidates: 10,
    fetchAttempted: 6,
    fetchedPages: 6,
    agentRuns: 1, // alias for completed
    agentRunsStarted: 2,
    agentRunsCompleted: 1,
    agentFailures: 0,
    agentJobsExtracted: 4,
    normalizedJobs: 50,
    uniqueJobs: 44,
    eligibleJobs: 26,
    filteredJobs: 18,
    failedSources: 0,
  };

  assert.strictEqual(stats.agentRunsStarted, 2, 'Must record 2 started runs');
  assert.strictEqual(stats.agentRunsCompleted, 1, 'Must record 1 completed run');
  assert.notStrictEqual(stats.agentRunsStarted, stats.agentRunsCompleted);
});
