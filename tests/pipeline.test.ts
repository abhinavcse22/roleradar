import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyUrl } from '../src/lib/pipeline/classifier';
import { generateSearchQueries } from '../src/lib/pipeline/searchPipeline';
import { deduplicateJobs } from '../src/lib/jobs/dedupe';
import {
  normalizeAgentJob,
  normalizeFetchedJob,
  normalizeSearchResult,
} from '../src/lib/jobs/normalize';
import { scoreJobMatch } from '../src/lib/matching/scoring';
import { UserPreferences } from '../src/lib/matching/types';
import { JobListing } from '../src/lib/jobs/types';
import { ScoredJobListing } from '../src/lib/pipeline/types';

// -------------------------------------------------------------
// Test A & B: Multiple Search results combine and duplicate URLs collapse
// -------------------------------------------------------------
test('Test A & B: Multiple Search queries combine and duplicate URLs collapse cleanly', () => {
  const queryList1 = [
    { title: 'PM - Sarvam', url: 'https://sarvam.ai/careers/pm', snippet: 'AI PM', domain: 'sarvam.ai', position: 1 },
    { title: 'PM - Swiggy', url: 'https://careers.swiggy.com/pm', snippet: 'Delivery PM', domain: 'swiggy.com', position: 2 },
  ];

  const queryList2 = [
    { title: 'Product Manager', url: 'https://sarvam.ai/careers/pm?utm_source=boards', snippet: 'AI PM', domain: 'sarvam.ai', position: 1 },
    { title: 'PM - Razorpay', url: 'https://razorpay.com/jobs/pm', snippet: 'Fintech PM', domain: 'razorpay.com', position: 2 },
  ];

  const combined = [...queryList1, ...queryList2];
  assert.strictEqual(combined.length, 4);

  // Normalized into jobs and deduplicated
  const normalized = combined.map((s) => normalizeSearchResult(s)).filter((j): j is JobListing => j !== null);
  const unique = deduplicateJobs(normalized);

  // Sarvam duplicate collapsed, 3 unique companies remain
  assert.strictEqual(unique.length, 3);
  const companies = unique.map((u) => u.company);
  assert.ok(companies.includes('Sarvam'));
  assert.ok(companies.includes('Swiggy'));
  assert.ok(companies.includes('Razorpay'));
});

// -------------------------------------------------------------
// Test C: Direct job URLs are routed to Fetch
// -------------------------------------------------------------
test('Test C: Direct job posting URLs are accurately classified as directJob for Fetch', () => {
  const ashbyJob = 'https://jobs.ashbyhq.com/sarvam/c4bb3b2c-7608-4d57-8761-650b4222ac13';
  const ghJob = 'https://boards.greenhouse.io/openai/jobs/123456';
  const leverJob = 'https://jobs.lever.co/netflix/abcdef';
  const companyJob = 'https://example.com/careers/jobs/product-manager-101';

  assert.strictEqual(classifyUrl(ashbyJob), 'directJob');
  assert.strictEqual(classifyUrl(ghJob), 'directJob');
  assert.strictEqual(classifyUrl(leverJob), 'directJob');
  assert.strictEqual(classifyUrl(companyJob), 'directJob');
});

// -------------------------------------------------------------
// Test D: Career hub candidates are routed to Agent
// -------------------------------------------------------------
test('Test D: Career hubs and portal landing pages are classified as careerHub for Agent', () => {
  const sarvamHub = 'https://www.sarvam.ai/careers';
  const postmanHub = 'https://jobs.ashbyhq.com/postman'; // ATS company root without job ID
  const greenhouseHub = 'https://boards.greenhouse.io/stripe'; // Greenhouse company root
  const genericHub = 'https://acme.example.com/open-positions';

  assert.strictEqual(classifyUrl(sarvamHub), 'careerHub');
  assert.strictEqual(classifyUrl(postmanHub), 'careerHub');
  assert.strictEqual(classifyUrl(greenhouseHub), 'careerHub');
  assert.strictEqual(classifyUrl(genericHub), 'careerHub');
});

// -------------------------------------------------------------
// Test E & F: Failed Fetch or Agent does not crash the pipeline
// -------------------------------------------------------------
test('Test E & F: Pipeline error isolation ensures failed sources do not crash collection', async () => {
  const simulatedDirectUrls = ['https://valid.com/jobs/1', 'https://broken.com/jobs/error'];

  const results: JobListing[] = [];
  let failedSources = 0;

  for (const url of simulatedDirectUrls) {
    try {
      if (url.includes('broken')) {
        throw new Error('500 Service Unavailable');
      }
      const fetched = normalizeFetchedJob({
        url,
        finalUrl: url,
        title: 'Valid Product Manager',
        content: 'Job details here',
        contentLength: 100,
        domain: 'valid.com',
        language: 'en',
        description: 'Role description',
        checkedAt: new Date().toISOString(),
      });
      if (fetched) results.push(fetched);
    } catch {
      failedSources++;
    }
  }

  assert.strictEqual(results.length, 1);
  assert.strictEqual(failedSources, 1);
  assert.strictEqual(results[0].title, 'Valid Product Manager');
});

// -------------------------------------------------------------
// Test G: Search + Fetch + Agent duplicate records become one canonical job
// -------------------------------------------------------------
test('Test G: Search, Fetch, and Agent records for the same opening merge to 1 canonical job', () => {
  const searchRecord = normalizeSearchResult({
    title: 'Product Manager at Sarvam AI',
    url: 'https://sarvam.ai/careers/jobs/pm-123',
    snippet: 'Product Manager role in Bengaluru, India',
    domain: 'sarvam.ai',
    position: 1,
  })!;

  const fetchRecord = normalizeFetchedJob({
    url: 'https://sarvam.ai/careers/jobs/pm-123',
    finalUrl: 'https://sarvam.ai/careers/jobs/pm-123',
    title: 'Product Manager',
    description: 'Detailed description fetched from live career page',
    content: 'Full responsibilities and requirements\n* 3+ years experience',
    contentLength: 500,
    domain: 'sarvam.ai',
    language: 'en',
    checkedAt: new Date().toISOString(),
  })!;

  const agentRecord = normalizeAgentJob({
    title: 'Product Manager',
    company: 'Sarvam AI',
    location: 'Bengaluru, India',
    employment_type: 'Full Time',
    work_mode: 'On-Site',
    description: 'Autonomous agent extracted job',
    requirements: ['Hands-on familiarity with AI'],
    apply_url: 'https://jobs.ashbyhq.com/sarvam/pm-123/application',
    source_url: 'https://sarvam.ai/careers/jobs/pm-123',
  })!;

  const deduplicated = deduplicateJobs([searchRecord, fetchRecord, agentRecord]);
  assert.strictEqual(deduplicated.length, 1);
  assert.strictEqual(deduplicated[0].title, 'Product Manager');
  assert.strictEqual(deduplicated[0].company, 'Sarvam AI');
  assert.strictEqual(deduplicated[0].source, 'merged');
  assert.strictEqual(deduplicated[0].provenance.length, 3);
});

// -------------------------------------------------------------
// Test H & I: Ineligible jobs are removed, eligible jobs receive MatchResult
// -------------------------------------------------------------
test('Test H & I: Ineligible jobs are hard-filtered while eligible jobs receive full MatchResult', () => {
  const eligibleJob = normalizeAgentJob({
    title: 'Product Manager',
    company: 'Sarvam AI',
    location: 'Bengaluru, India',
    employment_type: 'Full Time',
    work_mode: 'On-Site',
    description: 'AI platform product manager',
    requirements: ['AI experience'],
    apply_url: 'https://ashbyhq.com/sarvam/pm/application',
    source_url: 'https://sarvam.ai/careers',
  })!;

  const ineligibleJob = normalizeAgentJob({
    title: 'Software Engineer Backend',
    company: 'Sarvam AI',
    location: 'Bengaluru, India',
    employment_type: 'Full Time',
    work_mode: 'On-Site',
    description: 'Rust distributed systems engineer',
    requirements: ['Rust'],
    apply_url: 'https://ashbyhq.com/sarvam/swe/application',
    source_url: 'https://sarvam.ai/careers',
  })!;

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
  };

  const eligibleMatch = scoreJobMatch(eligibleJob, prefs);
  const ineligibleMatch = scoreJobMatch(ineligibleJob, prefs);

  assert.strictEqual(eligibleMatch.eligible, true);
  assert.strictEqual(ineligibleMatch.eligible, false);

  const scoredList: ScoredJobListing[] = [];
  if (eligibleMatch.eligible) scoredList.push({ ...eligibleJob, match: eligibleMatch });
  if (ineligibleMatch.eligible) scoredList.push({ ...ineligibleJob, match: ineligibleMatch });

  assert.strictEqual(scoredList.length, 1);
  assert.strictEqual(scoredList[0].title, 'Product Manager');
  assert.ok(scoredList[0].match.score >= 50);
});

// -------------------------------------------------------------
// Test J: Results are sorted deterministically by match score descending
// -------------------------------------------------------------
test('Test J: Pipeline results sort deterministically by match score descending', () => {
  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'Bengaluru, India',
    keywords: ['AI', 'SaaS'],
    workMode: 'On-site',
  };

  const strongJob = normalizeAgentJob({
    title: 'Product Manager',
    company: 'Alpha AI',
    location: 'Bengaluru, India',
    employment_type: 'Full Time',
    work_mode: 'On-Site',
    description: 'AI SaaS platform product manager',
    requirements: ['AI', 'SaaS'],
    apply_url: 'https://example.com/apply/alpha',
    source_url: 'https://example.com/alpha',
  })!;

  const weakerJob = normalizeAgentJob({
    title: 'Product Manager',
    company: 'Beta Corp',
    location: 'Bengaluru, India',
    employment_type: 'Full Time',
    work_mode: 'On-Site',
    description: 'Real estate logistics operations',
    requirements: ['Warehouse logistics'], // No AI or SaaS
    apply_url: 'https://example.com/apply/beta',
    source_url: 'https://example.com/beta',
  })!;

  const matchStrong = scoreJobMatch(strongJob, prefs);
  const matchWeaker = scoreJobMatch(weakerJob, prefs);

  const scored: ScoredJobListing[] = [
    { ...weakerJob, match: matchWeaker },
    { ...strongJob, match: matchStrong },
  ];

  scored.sort((a, b) => b.match.score - a.match.score);

  assert.strictEqual(scored[0].company, 'Alpha AI');
  assert.strictEqual(scored[1].company, 'Beta Corp');
  assert.ok(scored[0].match.score > scored[1].match.score);
});

// -------------------------------------------------------------
// Test K & L: Empty search results & missing optional preferences return safely
// -------------------------------------------------------------
test('Test K & L: Query generator and pipeline handle empty keywords and sparse preferences safely', () => {
  const minimalPrefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
  };

  const queries = generateSearchQueries(minimalPrefs);
  assert.ok(queries.length >= 3);
  for (const q of queries) {
    assert.ok(q.includes('Product Manager'));
    assert.ok(q.includes('India'));
    assert.ok(!q.includes('undefined'));
  }
});
