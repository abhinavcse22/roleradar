import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalizeUrl,
  normalizeAgentJob,
  normalizeFetchedJob,
  normalizeSearchResult,
} from '../src/lib/jobs/normalize';
import { areJobsDuplicates, deduplicateJobs } from '../src/lib/jobs/dedupe';
import { JobListing } from '../src/lib/jobs/types';

// Synthetic test helper
function createTestJob(overrides: Partial<JobListing> = {}): JobListing {
  return {
    id: overrides.id || `job_${Math.random().toString(36).slice(2)}`,
    title: overrides.title || 'Product Manager',
    company: overrides.company || 'Acme Corp',
    location: overrides.location || 'Bengaluru, India',
    country: overrides.country !== undefined ? overrides.country : 'India',
    employmentType: overrides.employmentType !== undefined ? overrides.employmentType : 'Full-time',
    seniority: overrides.seniority !== undefined ? overrides.seniority : 'Mid',
    workMode: overrides.workMode !== undefined ? overrides.workMode : 'On-site',
    description: overrides.description || 'Test job description',
    requirements: overrides.requirements || ['3+ years experience'],
    keywords: overrides.keywords || ['AI', 'SaaS'],
    source: overrides.source || 'fetch',
    sourceUrl: overrides.sourceUrl || 'https://acme.example.com/careers/pm',
    applyUrl: overrides.applyUrl || 'https://acme.example.com/careers/pm/apply',
    checkedAt: overrides.checkedAt || '2026-09-29T10:00:00.000Z',
    provenance: overrides.provenance || [
      {
        source: 'fetch',
        url: 'https://acme.example.com/careers/pm/apply',
        timestamp: '2026-09-29T10:00:00.000Z',
      },
    ],
  };
}

// -------------------------------------------------------------
// Test A: Same URL with different formatting -> One job
// -------------------------------------------------------------
test('Test A: Same URL with tracking parameters and trailing slashes normalizes and deduplicates to one job', () => {
  const url1 = 'https://jobs.example.com/roles/123/?utm_source=linkedin&utm_campaign=hiring#overview';
  const url2 = 'https://JOBS.example.com/roles/123?ref=newsletter';

  assert.strictEqual(canonicalizeUrl(url1), 'https://jobs.example.com/roles/123');
  assert.strictEqual(canonicalizeUrl(url2), 'https://jobs.example.com/roles/123');

  const job1 = createTestJob({
    applyUrl: url1,
    sourceUrl: url1,
    title: 'Product Manager',
    company: 'Alpha Inc',
  });

  const job2 = createTestJob({
    applyUrl: url2,
    sourceUrl: url2,
    title: 'Product Manager',
    company: 'Alpha',
  });

  const deduplicated = deduplicateJobs([job1, job2]);
  assert.strictEqual(deduplicated.length, 1);
  assert.strictEqual(deduplicated[0].applyUrl, 'https://jobs.example.com/roles/123');
});

// -------------------------------------------------------------
// Test B: Same company/title/location with minor formatting differences -> One job
// -------------------------------------------------------------
test('Test B: Minor formatting differences in company/title/location match and deduplicate to one job', () => {
  const job1 = createTestJob({
    company: 'Sarvam AI, Inc.',
    title: 'Product Manager',
    location: 'Bengaluru, India',
    applyUrl: 'https://sarvam.example.com/apply/1',
  });

  const job2 = createTestJob({
    company: 'Sarvam AI',
    title: 'product manager',
    location: 'Bengaluru',
    applyUrl: 'https://boards.example.com/sarvam-pm',
  });

  assert.strictEqual(areJobsDuplicates(job1, job2), true);

  const deduplicated = deduplicateJobs([job1, job2]);
  assert.strictEqual(deduplicated.length, 1);
  assert.strictEqual(deduplicated[0].company, 'Sarvam AI, Inc.');
});

// -------------------------------------------------------------
// Test C: Same title but different locations -> Two jobs
// -------------------------------------------------------------
test('Test C: Same title and company but different locations remain separate jobs', () => {
  const jobBengaluru = createTestJob({
    company: 'Global Corp',
    title: 'Product Manager',
    location: 'Bengaluru, India',
    applyUrl: 'https://global.example.com/jobs/pm-blr',
  });

  const jobLondon = createTestJob({
    company: 'Global Corp',
    title: 'Product Manager',
    location: 'London, United Kingdom',
    applyUrl: 'https://global.example.com/jobs/pm-ldn',
  });

  assert.strictEqual(areJobsDuplicates(jobBengaluru, jobLondon), false);

  const deduplicated = deduplicateJobs([jobBengaluru, jobLondon]);
  assert.strictEqual(deduplicated.length, 2);
});

// -------------------------------------------------------------
// Test D: Different companies with same title/location -> Two jobs
// -------------------------------------------------------------
test('Test D: Different companies with same title and location remain separate jobs', () => {
  const jobStripe = createTestJob({
    company: 'Stripe',
    title: 'Product Manager',
    location: 'Bengaluru, India',
    applyUrl: 'https://stripe.example.com/jobs/pm',
  });

  const jobRazorpay = createTestJob({
    company: 'Razorpay',
    title: 'Product Manager',
    location: 'Bengaluru, India',
    applyUrl: 'https://razorpay.example.com/jobs/pm',
  });

  assert.strictEqual(areJobsDuplicates(jobStripe, jobRazorpay), false);

  const deduplicated = deduplicateJobs([jobStripe, jobRazorpay]);
  assert.strictEqual(deduplicated.length, 2);
});

// -------------------------------------------------------------
// Test E: Search + Fetch + Agent versions of the same job -> One merged job
// -------------------------------------------------------------
test('Test E: Search + Fetch + Agent records for the same job merge into one authoritative record', () => {
  // 1. Search record (least detailed)
  const searchJob = normalizeSearchResult({
    title: 'Product Manager at Sarvam AI',
    url: 'https://sarvam.example.com/careers/jobs/pm-123',
    snippet: 'Looking for a PM with AI experience in Bengaluru, India.',
    domain: 'sarvam.example.com',
    position: 1,
  });
  assert.ok(searchJob);

  // 2. Fetch record (full page text)
  const fetchJob = normalizeFetchedJob({
    url: 'https://sarvam.example.com/careers/jobs/pm-123',
    finalUrl: 'https://sarvam.example.com/careers/jobs/pm-123',
    title: 'Product Manager',
    description: 'Detailed description from full page fetch...',
    content: 'Full description\n* 3-7 years experience\n* SQL and analytics',
    contentLength: 200,
    latencyMs: 150,
    domain: 'sarvam.example.com',
    language: 'en',
    checkedAt: '2026-09-29T10:05:00.000Z',
  });
  assert.ok(fetchJob);

  // 3. Agent record (structured ATS apply URL)
  const agentJob = normalizeAgentJob({
    title: 'Product Manager',
    company: 'Sarvam AI',
    location: 'Bengaluru, India',
    employment_type: 'Full Time',
    work_mode: 'On-Site',
    description: 'Autonomous agent extracted role description',
    requirements: ['Hands-on familiarity with AI', 'SQL and analytics'],
    apply_url: 'https://jobs.ashbyhq.com/sarvam/pm-123/application',
    source_url: 'https://sarvam.example.com/careers/jobs/pm-123',
  });
  assert.ok(agentJob);

  // Deduplicate all 3
  const mergedResults = deduplicateJobs([searchJob, fetchJob, agentJob]);
  assert.strictEqual(mergedResults.length, 1);

  const finalJob = mergedResults[0];
  assert.strictEqual(finalJob.source, 'merged');
  assert.strictEqual(finalJob.title, 'Product Manager');
  assert.strictEqual(finalJob.applyUrl, 'https://jobs.ashbyhq.com/sarvam/pm-123/application');
  assert.strictEqual(finalJob.employmentType, 'Full-time');
  assert.strictEqual(finalJob.workMode, 'On-site');
  assert.ok(finalJob.requirements.includes('Hands-on familiarity with AI'));
  assert.ok(finalJob.requirements.includes('3-7 years experience'));
  assert.strictEqual(finalJob.provenance.length, 3);
});

// -------------------------------------------------------------
// Test F: Missing optional fields -> Normalization does not crash
// -------------------------------------------------------------
test('Test F: Missing optional fields and empty attributes normalize safely without throwing', () => {
  const sparseAgentJob = normalizeAgentJob({
    title: 'Software Engineer',
    company: '',
    location: '',
    employment_type: null,
    work_mode: null,
    description: '',
    requirements: [],
    apply_url: 'https://sparse.example.com/job',
    source_url: '',
  });

  assert.ok(sparseAgentJob);
  assert.strictEqual(sparseAgentJob.title, 'Software Engineer');
  assert.strictEqual(sparseAgentJob.company, 'Unknown Company');
  assert.strictEqual(sparseAgentJob.employmentType, null);
  assert.strictEqual(sparseAgentJob.workMode, null);
  assert.deepStrictEqual(sparseAgentJob.requirements, []);

  // Empty or invalid objects return null safely
  const invalid = normalizeSearchResult({ title: '', url: '', snippet: '', domain: '', position: 0 });
  assert.strictEqual(invalid, null);
});

// -------------------------------------------------------------
// Test G: Distinct apply URLs -> Jobs remain separate
// -------------------------------------------------------------
test('Test G: Different positions with distinct apply URLs stay separate even with same title prefix', () => {
  const pmRole1 = createTestJob({
    title: 'Product Manager',
    applyUrl: 'https://ashbyhq.com/company/pm-growth/application',
  });

  const pmRole2 = createTestJob({
    title: 'Product Manager Core',
    applyUrl: 'https://ashbyhq.com/company/pm-core/application',
  });

  assert.strictEqual(areJobsDuplicates(pmRole1, pmRole2), false);

  const deduplicated = deduplicateJobs([pmRole1, pmRole2]);
  assert.strictEqual(deduplicated.length, 2);
});
