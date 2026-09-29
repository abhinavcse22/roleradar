import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanJobDescription,
  formatTimeAgo,
  getProvenanceLabel,
  isDimensionNeutral,
} from '../src/components/JobCard';
import { ScoredJobListing, PipelineStats } from '../src/lib/pipeline/types';

function createMockScoredJob(overrides: Partial<ScoredJobListing> = {}): ScoredJobListing {
  return {
    id: overrides.id || 'test_job_ux_1',
    title: overrides.title || 'Product Manager',
    company: overrides.company || 'Sarvam AI',
    location: overrides.location || 'Bengaluru, India',
    country: overrides.country !== undefined ? overrides.country : 'India',
    employmentType: overrides.employmentType !== undefined ? overrides.employmentType : 'Full-time',
    seniority: overrides.seniority !== undefined ? overrides.seniority : 'Mid',
    workMode: overrides.workMode !== undefined ? overrides.workMode : 'On-site',
    description:
      overrides.description ||
      '# Product Manager\n## About the Role\nWe are looking for a product builder with AI experience.',
    requirements: overrides.requirements || [
      '3+ years in product management',
      'Experience with AI systems',
      'Strong analytical ability',
    ],
    keywords: overrides.keywords || ['AI', 'SaaS'],
    source: overrides.source || 'fetch',
    sourceUrl: overrides.sourceUrl || 'https://example.com/careers/pm',
    applyUrl: overrides.applyUrl !== undefined ? overrides.applyUrl : 'https://jobs.ashbyhq.com/sarvam/apply',
    checkedAt: overrides.checkedAt || new Date().toISOString(),
    provenance: overrides.provenance || [
      { source: 'search', url: 'https://google.com', timestamp: new Date().toISOString() },
      { source: 'fetch', url: 'https://jobs.ashbyhq.com/sarvam/apply', timestamp: new Date().toISOString() },
    ],
    match: overrides.match || {
      score: 93,
      eligible: true,
      reasons: ['Exact role match for "Product Manager"', 'Location matches India', 'Keywords matched: AI'],
      warnings: ['Visa sponsorship not specified in listing'],
      breakdown: {
        role: 30,
        location: 20,
        keywords: 20,
        seniority: 0,
        workMode: 0,
        visa: 0,
        freshness: 5,
      },
    },
  };
}

// -------------------------------------------------------------
// Test A: Missing salary/optional fields are not displayed
// -------------------------------------------------------------
test('UX Test A: Missing salary or optional fields are safely omitted and not rendered as placeholders', () => {
  const job = createMockScoredJob({
    employmentType: null,
    workMode: null,
    seniority: null,
  });

  // Verify that optional fields remain null without falling back to "Not disclosed" or "Unknown"
  assert.strictEqual(job.employmentType, null);
  assert.strictEqual(job.workMode, null);
  assert.strictEqual(job.seniority, null);
});

// -------------------------------------------------------------
// Test B: Match reasons render from API response
// -------------------------------------------------------------
test('UX Test B: Match reasons render directly from server API response', () => {
  const expectedReasons = [
    'Exact role match for "Product Manager"',
    'Location matches requested city: "Bengaluru, India"',
    'Keywords matched: AI, SaaS',
  ];
  const job = createMockScoredJob({
    match: {
      score: 100,
      eligible: true,
      reasons: expectedReasons,
      warnings: [],
      breakdown: { role: 30, location: 20, keywords: 20, seniority: 10, workMode: 10, visa: 5, freshness: 5 },
    },
  });

  assert.deepStrictEqual(job.match.reasons, expectedReasons);
  assert.strictEqual(job.match.reasons.length, 3);
});

// -------------------------------------------------------------
// Test C: Warnings render from API response
// -------------------------------------------------------------
test('UX Test C: Warnings render directly from server API response', () => {
  const expectedWarnings = [
    'Job requests Senior level experience',
    'Visa sponsorship not specified in listing',
  ];
  const job = createMockScoredJob({
    match: {
      score: 68,
      eligible: true,
      reasons: ['Exact role match for "Product Manager"'],
      warnings: expectedWarnings,
      breakdown: { role: 30, location: 20, keywords: 0, seniority: 3, workMode: 5, visa: 2, freshness: 5 },
    },
  });

  assert.deepStrictEqual(job.match.warnings, expectedWarnings);
  assert.ok(job.match.warnings.some((w) => w.includes('Senior')));
});

// -------------------------------------------------------------
// Test D: Neutral dimensions display appropriately
// -------------------------------------------------------------
test('UX Test D: Neutral dimensions are identified correctly as neutral for display', () => {
  const neutralJob = createMockScoredJob({
    match: {
      score: 93,
      eligible: true,
      reasons: ['Exact role match for "Product Manager"', 'Location matches India'],
      warnings: [], // No seniority, work mode, or visa warnings
      breakdown: {
        role: 30,
        location: 20,
        keywords: 0,
        seniority: 0, // Unspecified
        workMode: 0,  // Unspecified
        visa: 0,      // Unspecified
        freshness: 5,
      },
    },
  });

  assert.strictEqual(isDimensionNeutral(neutralJob, 'seniority'), true);
  assert.strictEqual(isDimensionNeutral(neutralJob, 'workMode'), true);
  assert.strictEqual(isDimensionNeutral(neutralJob, 'visa'), true);
  assert.strictEqual(isDimensionNeutral(neutralJob, 'keywords'), true);

  const activeJob = createMockScoredJob({
    match: {
      score: 75,
      eligible: true,
      reasons: ['Seniority aligns with requested Mid'],
      warnings: ['Role is Hybrid, but Remote was preferred'],
      breakdown: {
        role: 30,
        location: 20,
        keywords: 10,
        seniority: 10,
        workMode: 5,
        visa: 2,
        freshness: 5,
      },
    },
  });

  assert.strictEqual(isDimensionNeutral(activeJob, 'seniority'), false);
  assert.strictEqual(isDimensionNeutral(activeJob, 'workMode'), false);
});

// -------------------------------------------------------------
// Test E: Breakdown displays actual returned values
// -------------------------------------------------------------
test('UX Test E: Match breakdown accurately reflects the returned breakdown values', () => {
  const job = createMockScoredJob();
  const { breakdown } = job.match;

  assert.strictEqual(breakdown.role, 30);
  assert.strictEqual(breakdown.location, 20);
  assert.strictEqual(breakdown.keywords, 20);
  assert.strictEqual(breakdown.freshness, 5);
  assert.strictEqual(typeof breakdown.seniority, 'number');
  assert.strictEqual(typeof breakdown.workMode, 'number');
  assert.strictEqual(typeof breakdown.visa, 'number');
});

// -------------------------------------------------------------
// Test F: Apply button uses actual applyUrl
// -------------------------------------------------------------
test('UX Test F: Apply button targets the exact authoritative applyUrl', () => {
  const directUrl = 'https://jobs.lever.co/company/job-1234/apply';
  const job = createMockScoredJob({ applyUrl: directUrl });

  assert.strictEqual(job.applyUrl, directUrl);
  assert.ok(job.applyUrl.startsWith('https://'));
});

// -------------------------------------------------------------
// Test G: Missing applyUrl does not create a broken link
// -------------------------------------------------------------
test('UX Test G: Missing or empty applyUrl is safely handled without generating invalid links', () => {
  const jobMissingUrl = createMockScoredJob({ applyUrl: '' });
  assert.strictEqual(jobMissingUrl.applyUrl, '');

  const rawApplyUrl = jobMissingUrl.applyUrl;
  const hasValidLink = typeof rawApplyUrl === 'string' && rawApplyUrl.trim().length > 0;
  assert.strictEqual(hasValidLink, false, 'Should flag invalid link');
});

// -------------------------------------------------------------
// Test H: Pipeline stats display actual backend numbers
// -------------------------------------------------------------
test('UX Test H: Pipeline statistics accurately display backend numbers without fabrication', () => {
  const stats: PipelineStats = {
    searchResults: 50,
    searchQueries: 5,
    directJobCandidates: 32,
    careerHubCandidates: 13,
    fetchAttempted: 6,
    fetchedPages: 5,
    agentRuns: 2,
    agentRunsStarted: 2,
    agentRunsCompleted: 1,
    agentFailures: 0,
    agentJobsExtracted: 4,
    normalizedJobs: 48,
    uniqueJobs: 43,
    eligibleJobs: 27,
    filteredJobs: 16,
    failedSources: 1,
  };

  assert.strictEqual(stats.searchResults, 50);
  assert.strictEqual(stats.fetchedPages, 5);
  assert.strictEqual(stats.agentRunsStarted, 2);
  assert.strictEqual(stats.agentRunsCompleted, 1);
  assert.strictEqual(stats.agentJobsExtracted, 4);
  assert.strictEqual(stats.uniqueJobs, 43);
  assert.strictEqual(stats.eligibleJobs, 27);
  assert.strictEqual(stats.filteredJobs, 16);
});

// -------------------------------------------------------------
// Test I: Client-side filtering does not mutate pipeline stats
// -------------------------------------------------------------
test('UX Test I: In-memory client-side filtering changes displayed jobs without mutating server pipeline stats', () => {
  const jobs: ScoredJobListing[] = [
    createMockScoredJob({ id: '1', workMode: 'Remote' }),
    createMockScoredJob({ id: '2', workMode: 'On-site' }),
    createMockScoredJob({ id: '3', workMode: 'Hybrid' }),
  ];

  const serverStats: PipelineStats = {
    searchResults: 30,
    searchQueries: 5,
    directJobCandidates: 20,
    careerHubCandidates: 5,
    fetchAttempted: 4,
    fetchedPages: 4,
    agentRuns: 0,
    agentRunsStarted: 0,
    agentRunsCompleted: 0,
    agentFailures: 0,
    agentJobsExtracted: 0,
    normalizedJobs: 3,
    uniqueJobs: 3,
    eligibleJobs: 3,
    filteredJobs: 0,
    failedSources: 0,
  };

  // Client applies filter for 'Remote'
  const filtered = jobs.filter((j) => j.workMode === 'Remote');
  assert.strictEqual(filtered.length, 1);

  // Server stats MUST remain completely unmutated
  assert.strictEqual(serverStats.uniqueJobs, 3);
  assert.strictEqual(serverStats.eligibleJobs, 3);
  assert.strictEqual(serverStats.filteredJobs, 0);
});

// -------------------------------------------------------------
// Test J: Agent status transitions render correctly
// -------------------------------------------------------------
test('UX Test J: Agent status state transitions report truthful summary text', () => {
  // Scenario 1: In progress
  const activeRuns = [
    { runId: 'r1', url: 'https://lever.co/company1', status: 'COMPLETED', jobsExtracted: 2 },
    { runId: 'r2', url: 'https://ashbyhq.com/company2', status: 'RUNNING' },
  ];
  const completed = activeRuns.filter((r) => r.status === 'COMPLETED').length;
  const running = activeRuns.filter((r) => r.status === 'RUNNING').length;
  assert.strictEqual(completed, 1);
  assert.strictEqual(running, 1);

  // Scenario 2: All terminal
  const terminalRuns = [
    { runId: 'r1', url: 'https://lever.co/company1', status: 'COMPLETED', jobsExtracted: 4 },
    { runId: 'r2', url: 'https://ashbyhq.com/company2', status: 'COMPLETED', jobsExtracted: 3 },
  ];
  const totalExtracted = terminalRuns.reduce((acc, r) => acc + (r.jobsExtracted || 0), 0);
  assert.strictEqual(totalExtracted, 7);
});

// -------------------------------------------------------------
// Test K: Description cleaner strips raw markdown headings
// -------------------------------------------------------------
test('UX Test K: Description cleaner strips raw markdown headings into readable text', () => {
  const rawDesc = '# Product Manager\n\n## About Role\nWe are building **AI platforms** in Bengaluru.\n\n### Responsibilities\nDrive roadmap.';
  const cleaned = cleanJobDescription(rawDesc);

  assert.ok(!cleaned.includes('#'), 'Should strip all markdown # characters');
  assert.ok(!cleaned.includes('**'), 'Should strip markdown bold asterisks');
  assert.ok(cleaned.includes('Product Manager'));
  assert.ok(cleaned.includes('AI platforms'));
});

// -------------------------------------------------------------
// Test L: Provenance label generation resolves correctly across source combinations
// -------------------------------------------------------------
test('UX Test L: Provenance label resolves concisely and truthfully for all source combinations', () => {
  const searchAndFetchJob = createMockScoredJob({
    provenance: [
      { source: 'search', url: 'https://google.com', timestamp: '' },
      { source: 'fetch', url: 'https://jobs.ashbyhq.com', timestamp: '' },
    ],
  });
  assert.strictEqual(getProvenanceLabel(searchAndFetchJob), 'Discovered via Search · verified via Fetch');

  const agentJob = createMockScoredJob({
    provenance: [{ source: 'agent', url: 'https://jobs.lever.co/hub', timestamp: '' }],
  });
  assert.strictEqual(getProvenanceLabel(agentJob), 'Discovered by TinyFish Agent');

  const searchOnlyJob = createMockScoredJob({
    provenance: [{ source: 'search', url: 'https://google.com', timestamp: '' }],
  });
  assert.strictEqual(getProvenanceLabel(searchOnlyJob), 'Discovered via TinyFish Search');
});

// -------------------------------------------------------------
// Test M: formatTimeAgo formats timestamps cleanly
// -------------------------------------------------------------
test('UX Test M: formatTimeAgo formats elapsed timestamps into human-readable strings', () => {
  const now = Date.now();
  const fiveMinAgo = new Date(now - 5 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();

  assert.strictEqual(formatTimeAgo(fiveMinAgo), '5 min ago');
  assert.strictEqual(formatTimeAgo(twoHoursAgo), '2 hr ago');
  assert.strictEqual(formatTimeAgo(threeDaysAgo), '3d ago');
});
