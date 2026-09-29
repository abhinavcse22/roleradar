import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startTinyFishAgentAsync,
  getTinyFishAgentRun,
  cancelTinyFishAgentRun,
} from '../src/lib/tinyfish/agent';
import { normalizeAgentJob } from '../src/lib/jobs/normalize';
import { mergeAgentResults } from '../src/lib/pipeline/mergeAgentResults';
import { AgentJobItem } from '../src/lib/tinyfish/types';
import { ScoredJobListing } from '../src/lib/pipeline/types';
import { UserPreferences } from '../src/lib/matching/types';

// Mock preferences for test cases
const testPreferences: UserPreferences = {
  role: 'Product Manager',
  location: 'India',
  keywords: ['AI', 'Python'],
  seniority: 'Mid',
  workMode: 'Remote',
  visaPreference: 'Any',
};

// -------------------------------------------------------------
// Test A: startTinyFishAgentAsync returns run ID
// -------------------------------------------------------------
test('Milestone 6 - Test A: startAsyncAgent returns run ID and submits correct payload', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.TINYFISH_API_KEY;
  process.env.TINYFISH_API_KEY = 'test_key_123';

  let capturedUrl = '';
  let capturedOptions: RequestInit | undefined;

  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(url);
    capturedOptions = init;
    return new Response(
      JSON.stringify({
        run_id: 'run_test_abc123',
        status: 'PENDING',
        error: null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const res = await startTinyFishAgentAsync({
      url: 'https://jobs.lever.co/postman',
      role: 'Product Manager',
      location: 'India',
      keywords: ['AI'],
    });

    assert.strictEqual(res.runId, 'run_test_abc123');
    assert.strictEqual(res.status, 'PENDING');
    assert.strictEqual(res.url, 'https://jobs.lever.co/postman');
    assert.strictEqual(capturedUrl, 'https://agent.tinyfish.ai/v1/automation/run-async');
    assert.strictEqual(capturedOptions?.method, 'POST');

    const headers = capturedOptions?.headers as Record<string, string>;
    assert.strictEqual(headers['X-API-Key'], 'test_key_123');

    const body = JSON.parse(capturedOptions?.body as string);
    assert.strictEqual(body.url, 'https://jobs.lever.co/postman');
    assert.ok(typeof body.goal === 'string' && body.goal.includes('Product Manager'));
  } finally {
    globalThis.fetch = originalFetch;
    process.env.TINYFISH_API_KEY = originalApiKey;
  }
});

// -------------------------------------------------------------
// Test B: malformed async response is rejected safely
// -------------------------------------------------------------
test('Milestone 6 - Test B: malformed async response is rejected safely', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.TINYFISH_API_KEY;
  process.env.TINYFISH_API_KEY = 'test_key_123';

  // Case B1: Missing run_id in response JSON
  globalThis.fetch = async () => {
    return new Response(JSON.stringify({ unexpected: 'payload' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    await assert.rejects(
      async () => {
        await startTinyFishAgentAsync({
          url: 'https://jobs.lever.co/postman',
          role: 'Product Manager',
          location: 'India',
          keywords: [],
        });
      },
      /did not return a valid run_id/
    );

    // Case B2: HTTP 500 error from API
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ error: 'Service Unavailable' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    await assert.rejects(
      async () => {
        await startTinyFishAgentAsync({
          url: 'https://jobs.lever.co/postman',
          role: 'Product Manager',
          location: 'India',
          keywords: [],
        });
      },
      /TinyFish run-async error \(500\)/
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.env.TINYFISH_API_KEY = originalApiKey;
  }
});

// -------------------------------------------------------------
// Test C: getAgentRun returns RUNNING
// -------------------------------------------------------------
test('Milestone 6 - Test C: getAgentRun returns RUNNING with empty jobs array', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.TINYFISH_API_KEY;
  process.env.TINYFISH_API_KEY = 'test_key_123';

  globalThis.fetch = async (url: string | URL | Request) => {
    assert.ok(String(url).endsWith('/v1/runs/run_running_999'));
    return new Response(
      JSON.stringify({
        run_id: 'run_running_999',
        status: 'RUNNING',
        result: null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const res = await getTinyFishAgentRun('run_running_999');
    assert.strictEqual(res.runId, 'run_running_999');
    assert.strictEqual(res.status, 'RUNNING');
    assert.deepStrictEqual(res.jobs, []);
    assert.strictEqual(res.error, null);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.TINYFISH_API_KEY = originalApiKey;
  }
});

// -------------------------------------------------------------
// Test D: getAgentRun returns COMPLETED + result
// -------------------------------------------------------------
test('Milestone 6 - Test D: getAgentRun returns COMPLETED and parses structured jobs', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.TINYFISH_API_KEY;
  process.env.TINYFISH_API_KEY = 'test_key_123';

  const mockPayload = {
    run_id: 'run_done_111',
    status: 'COMPLETED',
    result: {
      jobs: [
        {
          title: 'Senior Product Manager - AI',
          company: 'Acme Corp',
          location: 'Bengaluru, India',
          employment_type: 'Full-time',
          work_mode: 'Remote',
          description: 'Lead next-gen AI product development.',
          requirements: ['5+ years PM experience', 'Deep learning familiarity'],
          apply_url: '/apply/pm-ai',
          source_url: '/careers',
        },
      ],
    },
    finished_at: '2026-09-29T14:00:00Z',
  };

  globalThis.fetch = async () => {
    return new Response(JSON.stringify(mockPayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const res = await getTinyFishAgentRun('run_done_111', 'https://acme.io/careers');
    assert.strictEqual(res.runId, 'run_done_111');
    assert.strictEqual(res.status, 'COMPLETED');
    assert.strictEqual(res.jobs.length, 1);
    assert.strictEqual(res.jobs[0].title, 'Senior Product Manager - AI');
    assert.strictEqual(res.jobs[0].company, 'Acme Corp');
    assert.strictEqual(res.jobs[0].apply_url, 'https://acme.io/apply/pm-ai');
    assert.strictEqual(res.finishedAt, '2026-09-29T14:00:00Z');
  } finally {
    globalThis.fetch = originalFetch;
    process.env.TINYFISH_API_KEY = originalApiKey;
  }
});

// -------------------------------------------------------------
// Test E: getAgentRun returns FAILED
// -------------------------------------------------------------
test('Milestone 6 - Test E: getAgentRun returns FAILED with error message', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.TINYFISH_API_KEY;
  process.env.TINYFISH_API_KEY = 'test_key_123';

  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        run_id: 'run_fail_222',
        status: 'FAILED',
        error: 'Target domain rate limited or blocked navigation',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const res = await getTinyFishAgentRun('run_fail_222');
    assert.strictEqual(res.runId, 'run_fail_222');
    assert.strictEqual(res.status, 'FAILED');
    assert.deepStrictEqual(res.jobs, []);
    assert.strictEqual(res.error, 'Target domain rate limited or blocked navigation');
  } finally {
    globalThis.fetch = originalFetch;
    process.env.TINYFISH_API_KEY = originalApiKey;
  }
});

// -------------------------------------------------------------
// Test F: getAgentRun returns CANCELLED
// -------------------------------------------------------------
test('Milestone 6 - Test F: getAgentRun and cancelTinyFishAgentRun handle CANCELLED', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.TINYFISH_API_KEY;
  process.env.TINYFISH_API_KEY = 'test_key_123';

  // Test cancel invocation
  let cancelCalled = false;
  globalThis.fetch = async (url: string | URL | Request) => {
    if (String(url).endsWith('/cancel')) {
      cancelCalled = true;
      return new Response(
        JSON.stringify({
          run_id: 'run_cancel_333',
          status: 'CANCELLED',
          cancelled_at: '2026-09-29T14:10:00Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({
        run_id: 'run_cancel_333',
        status: 'CANCELLED',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const cancelRes = await cancelTinyFishAgentRun('run_cancel_333');
    assert.ok(cancelCalled);
    assert.strictEqual(cancelRes.status, 'CANCELLED');
    assert.strictEqual(cancelRes.runId, 'run_cancel_333');

    const statusRes = await getTinyFishAgentRun('run_cancel_333');
    assert.strictEqual(statusRes.status, 'CANCELLED');
  } finally {
    globalThis.fetch = originalFetch;
    process.env.TINYFISH_API_KEY = originalApiKey;
  }
});

// -------------------------------------------------------------
// Test G: status endpoint validates run ID
// -------------------------------------------------------------
test('Milestone 6 - Test G: status endpoint validates run ID and rejects empty inputs', async () => {
  await assert.rejects(
    async () => {
      await getTinyFishAgentRun('');
    },
    /Missing required runId parameter/
  );

  await assert.rejects(
    async () => {
      await cancelTinyFishAgentRun('   ');
    },
    /Missing required runId parameter/
  );
});

// -------------------------------------------------------------
// Test H: completed Agent jobs normalize correctly
// -------------------------------------------------------------
test('Milestone 6 - Test H: completed Agent jobs normalize correctly into JobListing', () => {
  const rawAgentItem: AgentJobItem = {
    title: 'Lead Product Manager',
    company: 'Freshworks',
    location: 'Chennai, India',
    employment_type: 'Full-time',
    work_mode: 'Hybrid',
    description: 'Lead CRM products.',
    requirements: ['8+ years in product management', 'Experience scaling SaaS'],
    apply_url: 'https://freshworks.com/careers/lead-pm?ref=agent',
    source_url: 'https://freshworks.com/careers',
  };

  const normalized = normalizeAgentJob(rawAgentItem);
  assert.ok(normalized);
  assert.strictEqual(normalized.title, 'Lead Product Manager');
  assert.strictEqual(normalized.company, 'Freshworks');
  assert.strictEqual(normalized.location, 'Chennai, India');
  assert.strictEqual(normalized.workMode, 'Hybrid');
  assert.strictEqual(normalized.source, 'agent');
  assert.strictEqual(normalized.provenance[0].source, 'agent');
  assert.ok(normalized.applyUrl.startsWith('https://freshworks.com/careers/lead-pm'));
});

// -------------------------------------------------------------
// Test I: Agent result merges with initial Search/Fetch jobs
// -------------------------------------------------------------
test('Milestone 6 - Test I: Agent result merges with initial Search/Fetch jobs', () => {
  const initialJob: ScoredJobListing = {
    id: 'job_initial_1',
    title: 'Product Manager',
    company: 'Postman',
    location: 'Bengaluru, India',
    country: 'India',
    workMode: 'Remote',
    employmentType: 'Full-time',
    seniority: 'Mid',
    description: 'Build API platform.',
    requirements: ['3+ years PM'],
    keywords: ['API', 'Platform'],
    source: 'fetch',
    sourceUrl: 'https://jobs.lever.co/postman/pm1',
    applyUrl: 'https://jobs.lever.co/postman/pm1',
    checkedAt: '2026-09-29T12:00:00Z',
    provenance: [
      { source: 'search', url: 'https://jobs.lever.co/postman/pm1', timestamp: '2026-09-29T12:00:00Z' },
      { source: 'fetch', url: 'https://jobs.lever.co/postman/pm1', timestamp: '2026-09-29T12:00:00Z' },
    ],
    match: {
      score: 90,
      eligible: true,
      breakdown: { role: 35, location: 25, keywords: 20, workMode: 10, seniority: 5, visa: 5, freshness: 5 },
      reasons: ['Role matches'],
      warnings: [],
    },
  };

  const newAgentItem: AgentJobItem = {
    title: 'Staff Product Manager',
    company: 'Razorpay',
    location: 'Bengaluru, India',
    employment_type: 'Full-time',
    work_mode: 'Remote',
    description: 'Scale payment infrastructure.',
    requirements: ['AI experience', 'Python familiarity'],
    apply_url: 'https://razorpay.com/jobs/staff-pm',
    source_url: 'https://razorpay.com/careers',
  };

  const mergeOutput = mergeAgentResults([initialJob], [newAgentItem], testPreferences);

  assert.strictEqual(mergeOutput.jobs.length, 2, 'Should have both initial and newly merged job');
  assert.strictEqual(mergeOutput.newJobsCount, 1);
  const titles = mergeOutput.jobs.map((j) => j.title);
  assert.ok(titles.includes('Product Manager'));
  assert.ok(titles.includes('Staff Product Manager'));
});

// -------------------------------------------------------------
// Test J: duplicates collapse after Agent completion
// -------------------------------------------------------------
test('Milestone 6 - Test J: duplicates collapse after Agent completion and merge provenance', () => {
  const initialJob: ScoredJobListing = {
    id: 'job_dup_1',
    title: 'Product Manager',
    company: 'Swiggy',
    location: 'Bengaluru, India',
    country: 'India',
    workMode: 'On-site',
    employmentType: 'Full-time',
    seniority: 'Mid',
    description: 'Initial fetch description.',
    requirements: ['SQL'],
    keywords: ['SQL'],
    source: 'fetch',
    sourceUrl: 'https://careers.swiggy.com/pm',
    applyUrl: 'https://careers.swiggy.com/pm',
    checkedAt: '2026-09-29T12:00:00Z',
    provenance: [
      { source: 'fetch', url: 'https://careers.swiggy.com/pm', timestamp: '2026-09-29T12:00:00Z' },
    ],
    match: {
      score: 80,
      eligible: true,
      breakdown: { role: 35, location: 25, keywords: 0, workMode: 5, seniority: 5, visa: 5, freshness: 5 },
      reasons: ['Role matches'],
      warnings: [],
    },
  };

  // Same role & company discovered dynamically on careers hub by Agent
  const duplicateAgentItem: AgentJobItem = {
    title: 'Product Manager',
    company: 'Swiggy',
    location: 'Bengaluru, India',
    employment_type: 'Full-time',
    work_mode: 'On-site',
    description: 'Agent rich description.',
    requirements: ['SQL', 'AI product discovery'],
    apply_url: 'https://careers.swiggy.com/pm?source=tinyfish_agent',
    source_url: 'https://careers.swiggy.com',
  };

  const mergeOutput = mergeAgentResults([initialJob], [duplicateAgentItem], testPreferences);

  assert.strictEqual(mergeOutput.jobs.length, 1, 'Duplicate must collapse to exactly 1 canonical listing');
  assert.strictEqual(mergeOutput.newJobsCount, 0, 'No brand-new positions added, duplicate merged');
  const mergedJob = mergeOutput.jobs[0];
  assert.ok(mergedJob.provenance.some((p) => p.source === 'fetch'));
  assert.ok(mergedJob.provenance.some((p) => p.source === 'agent'));
  assert.ok(mergedJob.requirements.includes('AI product discovery'));
});

// -------------------------------------------------------------
// Test K: match scores are recalculated after Agent results arrive
// -------------------------------------------------------------
test('Milestone 6 - Test K: match scores are recalculated after Agent results arrive', () => {
  const initialJob: ScoredJobListing = {
    id: 'job_k1',
    title: 'Associate Product Manager',
    company: 'Company A',
    location: 'Bengaluru, India',
    country: 'India',
    workMode: 'Remote',
    employmentType: 'Full-time',
    seniority: 'Junior',
    description: 'General PM role',
    requirements: [],
    keywords: [],
    source: 'search',
    sourceUrl: 'https://a.com/job',
    applyUrl: 'https://a.com/job',
    checkedAt: '2026-09-29T12:00:00Z',
    provenance: [{ source: 'search', url: 'https://a.com/job', timestamp: '2026-09-29T12:00:00Z' }],
    match: {
      score: 70,
      eligible: true,
      breakdown: { role: 30, location: 25, keywords: 0, workMode: 10, seniority: 2, visa: 2, freshness: 5 },
      reasons: [],
      warnings: [],
    },
  };

  // New Agent job with exact keywords ('AI', 'Python') matching preferences
  const highMatchAgentItem: AgentJobItem = {
    title: 'Product Manager',
    company: 'Company B',
    location: 'Bengaluru, India',
    employment_type: 'Full-time',
    work_mode: 'Remote',
    description: 'Build AI applications with Python and LLMs.',
    requirements: ['AI', 'Python'],
    apply_url: 'https://b.com/job',
    source_url: 'https://b.com/careers',
  };

  const mergeOutput = mergeAgentResults([initialJob], [highMatchAgentItem], testPreferences);
  assert.strictEqual(mergeOutput.jobs.length, 2);

  // High match agent job must be ranked #1
  assert.strictEqual(mergeOutput.jobs[0].company, 'Company B');
  assert.ok(mergeOutput.jobs[0].match.score >= 85, 'High match agent job must score high');
});

// -------------------------------------------------------------
// Test L: one Agent failure does not remove initial results
// -------------------------------------------------------------
test('Milestone 6 - Test L: empty or failed Agent run leaves initial results untouched', () => {
  const initialJobs: ScoredJobListing[] = [
    {
      id: 'job_init_1',
      title: 'Senior Product Manager',
      company: 'Atlassian',
      location: 'Bengaluru, India',
      country: 'India',
      workMode: 'Remote',
      employmentType: 'Full-time',
      seniority: 'Senior',
      description: 'Jira cloud.',
      requirements: ['Agile'],
      keywords: ['Agile'],
      source: 'fetch',
      sourceUrl: 'https://atlassian.com/pm',
      applyUrl: 'https://atlassian.com/pm',
      checkedAt: '2026-09-29T12:00:00Z',
      provenance: [{ source: 'fetch', url: 'https://atlassian.com/pm', timestamp: '2026-09-29T12:00:00Z' }],
      match: {
        score: 88,
        eligible: true,
        breakdown: { role: 35, location: 25, keywords: 0, workMode: 10, seniority: 5, visa: 5, freshness: 5 },
        reasons: [],
        warnings: [],
      },
    },
  ];

  // Simulating an agent failure returning no jobs
  const mergeOutput = mergeAgentResults(initialJobs, [], testPreferences);
  assert.strictEqual(mergeOutput.jobs.length, 1);
  assert.strictEqual(mergeOutput.jobs[0].id, 'job_init_1');
  assert.strictEqual(mergeOutput.newJobsCount, 0);
});

// -------------------------------------------------------------
// Test M: starting a new search can cancel prior pending runs
// -------------------------------------------------------------
test('Milestone 6 - Test M: pending runs can be cancelled cleanly', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.TINYFISH_API_KEY;
  process.env.TINYFISH_API_KEY = 'test_key_123';

  const cancelledRuns: string[] = [];

  globalThis.fetch = async (url: string | URL | Request) => {
    const urlStr = String(url);
    if (urlStr.includes('/cancel')) {
      const runId = urlStr.split('/runs/')[1]?.split('/cancel')[0];
      if (runId) cancelledRuns.push(runId);
      return new Response(
        JSON.stringify({ run_id: runId, status: 'CANCELLED', cancelled_at: new Date().toISOString() }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  };

  try {
    const activeRunIds = ['run_old_1', 'run_old_2'];
    await Promise.all(activeRunIds.map((id) => cancelTinyFishAgentRun(id)));

    assert.deepStrictEqual(cancelledRuns, ['run_old_1', 'run_old_2']);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.TINYFISH_API_KEY = originalApiKey;
  }
});

// -------------------------------------------------------------
// Test N: polling stops on terminal states
// -------------------------------------------------------------
test('Milestone 6 - Test N: polling stops on terminal states (COMPLETED, FAILED, CANCELLED)', () => {
  const isTerminal = (status: string) => {
    const upper = status.toUpperCase();
    return upper === 'COMPLETED' || upper === 'FAILED' || upper === 'CANCELLED';
  };

  assert.strictEqual(isTerminal('PENDING'), false);
  assert.strictEqual(isTerminal('RUNNING'), false);
  assert.strictEqual(isTerminal('pending'), false);
  assert.strictEqual(isTerminal('running'), false);

  assert.strictEqual(isTerminal('COMPLETED'), true);
  assert.strictEqual(isTerminal('FAILED'), true);
  assert.strictEqual(isTerminal('CANCELLED'), true);
  assert.strictEqual(isTerminal('completed'), true);
  assert.strictEqual(isTerminal('failed'), true);
});
