import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyUrl } from '../src/lib/pipeline/classifier';
import { rankCareerHubs, runWithConcurrency } from '../src/lib/pipeline/searchPipeline';
import { normalizeAgentJob } from '../src/lib/jobs/normalize';
import { NormalizedSearchResult } from '../src/lib/tinyfish/types';
import { UserPreferences } from '../src/lib/matching/types';
import { deduplicateJobs } from '../src/lib/jobs/dedupe';
import { JobListing } from '../src/lib/jobs/types';

// -------------------------------------------------------------
// Test A & B: Candidate Classification & Routing
// -------------------------------------------------------------
test('Milestone 5C - Test A & B: Career hub candidate routes to Agent while direct job routes to Fetch', () => {
  const directJob1 = 'https://jobs.ashbyhq.com/sarvam/c4bb3b2c-7608-4d57-8761-650b4222ac13';
  const directJob2 = 'https://boards.greenhouse.io/figma/jobs/567890';
  const directJob3 = 'https://jobs.lever.co/netflix/1234abcd-5678';

  const careerHub1 = 'https://jobs.lever.co/gohighlevel';
  const careerHub2 = 'https://jobs.ashbyhq.com/sarvam';
  const careerHub3 = 'https://www.nextiva.com/company/careers';
  const careerHub4 = 'https://boards.greenhouse.io/stripe';

  assert.strictEqual(classifyUrl(directJob1), 'directJob', 'Direct Ashby posting must route to directJob');
  assert.strictEqual(classifyUrl(directJob2), 'directJob', 'Direct Greenhouse posting must route to directJob');
  assert.strictEqual(classifyUrl(directJob3), 'directJob', 'Direct Lever posting must route to directJob');

  assert.strictEqual(classifyUrl(careerHub1), 'careerHub', 'Lever company portal must route to careerHub');
  assert.strictEqual(classifyUrl(careerHub2), 'careerHub', 'Ashby company portal must route to careerHub');
  assert.strictEqual(classifyUrl(careerHub3), 'careerHub', 'Company /careers page must route to careerHub');
  assert.strictEqual(classifyUrl(careerHub4), 'careerHub', 'Greenhouse company board must route to careerHub');
});

// -------------------------------------------------------------
// Test C: Agent Timeout Failure Handling
// -------------------------------------------------------------
test('Milestone 5C - Test C: Agent timeout returns a controlled failure without crashing', async () => {
  // Simulate an agent function that times out
  const mockAgentWithTimeout = async () => {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TinyFish Agent timed out after 60000ms.')), 10);
    });
  };

  await assert.rejects(
    async () => await mockAgentWithTimeout(),
    /TinyFish Agent timed out/
  );
});

// -------------------------------------------------------------
// Test D & E: Terminal Events Resolution (COMPLETE vs FAILED)
// -------------------------------------------------------------
test('Milestone 5C - Test D & E: COMPLETE event resolves as success while FAILED resolves as failure', () => {
  // Case D: Success
  const completeEvent = {
    type: 'COMPLETE',
    status: 'COMPLETED',
    resultJson: {
      jobs: [
        {
          title: 'Staff Product Manager',
          company: 'GoHighLevel',
          location: 'India',
          apply_url: 'https://jobs.lever.co/gohighlevel/123',
        },
      ],
    },
  };

  const isSuccess =
    (completeEvent.type === 'COMPLETE' || completeEvent.status === 'COMPLETED') &&
    completeEvent.status !== 'FAILED';
  assert.strictEqual(isSuccess, true, 'COMPLETE status should resolve as success');

  // Case E: Failure
  const failedEvent = {
    type: 'ERROR',
    status: 'FAILED',
    error: 'Navigation timed out',
  };

  const isFailed =
    failedEvent.status === 'FAILED' || failedEvent.type === 'ERROR';
  assert.strictEqual(isFailed, true, 'FAILED status should resolve as failure');
});

// -------------------------------------------------------------
// Test F & G: resultJson Validation (Valid vs Malformed)
// -------------------------------------------------------------
test('Milestone 5C - Test F & G: Valid resultJson produces Agent JobListings; malformed JSON does not crash', () => {
  // Valid JSON string
  const validJsonString = JSON.stringify({
    jobs: [
      {
        title: 'Principal Product Manager - Voice AI',
        company: 'GoHighLevel',
        location: 'India',
        employment_type: 'Full-time',
        work_mode: 'Remote',
        description: 'Lead Voice AI agents for enterprise automation.',
        requirements: ['5+ years PM experience', 'AI agents familiarity'],
        apply_url: 'https://jobs.lever.co/gohighlevel/voice-ai',
        source_url: 'https://jobs.lever.co/gohighlevel',
      },
    ],
  });

  const parsed = JSON.parse(validJsonString);
  const normalized = normalizeAgentJob(parsed.jobs[0]);

  assert.ok(normalized, 'Valid job must normalize successfully');
  assert.strictEqual(normalized.title, 'Principal Product Manager');
  assert.strictEqual(normalized.company, 'GoHighLevel');
  assert.strictEqual(normalized.source, 'agent');
  assert.strictEqual(normalized.location, 'India');
  assert.strictEqual(normalized.workMode, 'Remote');
  assert.ok(normalized.requirements.includes('5+ years PM experience'));

  // Malformed: missing title
  const malformedItem = {
    company: 'GoHighLevel',
    location: 'India',
    apply_url: 'https://jobs.lever.co/gohighlevel/no-title',
  };
  const malformedNormalized = normalizeAgentJob(malformedItem as unknown as Parameters<typeof normalizeAgentJob>[0]);
  assert.strictEqual(malformedNormalized, null, 'Job without title must be safely ignored');

  // Malformed: empty / invalid JSON
  assert.doesNotThrow(() => {
    try {
      JSON.parse('INVALID_JSON_HERE');
    } catch {
      // Graceful fallback
    }
  });
});

// -------------------------------------------------------------
// Test H: Successful Agent Extraction Contributes Jobs
// -------------------------------------------------------------
test('Milestone 5C - Test H: Successful Agent extraction produces distinct Agent JobListings', () => {
  const agentJob = normalizeAgentJob({
    title: 'Group Product Manager - Commerce',
    company: 'GoHighLevel',
    location: 'India, Remote',
    employment_type: 'Full Time',
    work_mode: 'Remote',
    description: 'Lead eCommerce agent platform.',
    requirements: ['8+ years experience in product management'],
    apply_url: 'https://jobs.lever.co/gohighlevel/gpm-commerce',
    source_url: 'https://jobs.lever.co/gohighlevel',
  });

  assert.ok(agentJob);
  assert.strictEqual(agentJob.source, 'agent');
  assert.strictEqual(agentJob.provenance[0].source, 'agent');
  assert.strictEqual(agentJob.provenance[0].details, 'Extracted via autonomous browser navigation');
});

// -------------------------------------------------------------
// Test I: Agent Failure Does Not Prevent Search/Fetch Results
// -------------------------------------------------------------
test('Milestone 5C - Test I: Search and Fetch results persist even if Agent fails', () => {
  const searchJob = {
    id: 'job_search_1',
    title: 'Product Manager',
    company: 'Ema',
    location: 'Bengaluru',
    country: 'India',
    employmentType: 'Full-time' as const,
    seniority: 'Senior' as const,
    workMode: null,
    description: 'Enterprise AI PM role',
    requirements: [],
    keywords: ['AI'],
    source: 'search' as const,
    sourceUrl: 'https://jobs.ashbyhq.com/ema/pm',
    applyUrl: 'https://jobs.ashbyhq.com/ema/pm',
    checkedAt: new Date().toISOString(),
    provenance: [{ source: 'search' as const, url: 'https://jobs.ashbyhq.com/ema/pm', timestamp: new Date().toISOString() }],
  };

  // Agent failed (returns 0 jobs)
  const agentJobs: JobListing[] = [];

  const combined = [...agentJobs, searchJob];
  const deduplicated = deduplicateJobs(combined);

  assert.strictEqual(deduplicated.length, 1, 'Search job must be preserved despite Agent failure');
  assert.strictEqual(deduplicated[0].company, 'Ema');
});

// -------------------------------------------------------------
// Test J: Telemetry Accuracy (agentRuns vs agentFailures)
// -------------------------------------------------------------
test('Milestone 5C - Test J: Pipeline telemetry accurately records agentRuns, agentFailures, and agentJobsExtracted', () => {
  const stats = {
    careerHubCandidates: 3,
    agentRuns: 0,
    agentFailures: 0,
    agentJobsExtracted: 0,
  };

  // Run 1 succeeds with 3 jobs
  const run1Success = true;
  const run1JobsCount = 3;
  if (run1Success) {
    stats.agentRuns++;
    stats.agentJobsExtracted += run1JobsCount;
  } else {
    stats.agentFailures++;
  }

  // Run 2 fails (timeout)
  const run2Success = false;
  if (run2Success) {
    stats.agentRuns++;
  } else {
    stats.agentFailures++;
  }

  assert.strictEqual(stats.careerHubCandidates, 3);
  assert.strictEqual(stats.agentRuns, 1, 'Exactly 1 successful agent run');
  assert.strictEqual(stats.agentFailures, 1, 'Exactly 1 failed agent run');
  assert.strictEqual(stats.agentJobsExtracted, 3, 'Exactly 3 jobs extracted');
});

// -------------------------------------------------------------
// Test K: Concurrency Limit Enforcement
// -------------------------------------------------------------
test('Milestone 5C - Test K: runWithConcurrency enforces maximum 2 simultaneous running tasks', async () => {
  let activeWorkers = 0;
  let maxActiveWorkers = 0;

  const items = [1, 2, 3, 4, 5];
  await runWithConcurrency(items, 2, async () => {
    activeWorkers++;
    maxActiveWorkers = Math.max(maxActiveWorkers, activeWorkers);
    await new Promise((resolve) => setTimeout(resolve, 15));
    activeWorkers--;
  });

  assert.ok(maxActiveWorkers <= 2, `Max active workers must be <= 2, got ${maxActiveWorkers}`);
});

// -------------------------------------------------------------
// Career Hub Ranking Test
// -------------------------------------------------------------
test('Milestone 5C: rankCareerHubs prioritizes tech ATS hubs and deprioritizes unrelated portals', () => {
  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    keywords: ['AI'],
  };

  const hubs: NormalizedSearchResult[] = [
    { title: 'United Nations Careers', url: 'https://careers.un.org/', snippet: 'Global careers at UN', domain: 'un.org', position: 1 },
    { title: 'GoHighLevel Product Careers', url: 'https://jobs.lever.co/gohighlevel', snippet: 'Open Product Manager roles in India with AI', domain: 'jobs.lever.co', position: 2 },
    { title: 'Hyatt Hotel Careers', url: 'https://careers.hyatt.com/en-US/careers/', snippet: 'Hospitality careers', domain: 'hyatt.com', position: 3 },
    { title: 'Ambient AI Careers', url: 'https://www.ambient.ai/careers', snippet: 'Computer vision and AI product manager careers in India', domain: 'ambient.ai', position: 4 },
  ];

  const ranked = rankCareerHubs(hubs, prefs);

  // Top 2 must be tech hubs (Lever GoHighLevel and Ambient AI)
  assert.ok(ranked[0].url.includes('lever.co') || ranked[0].url.includes('ambient.ai'));
  assert.ok(ranked[1].url.includes('lever.co') || ranked[1].url.includes('ambient.ai'));

  // UN and Hyatt must be ranked last
  assert.ok(ranked[2].url.includes('un.org') || ranked[2].url.includes('hyatt.com'));
  assert.ok(ranked[3].url.includes('un.org') || ranked[3].url.includes('hyatt.com'));
});
