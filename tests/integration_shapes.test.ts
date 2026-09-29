import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAgentJob,
  normalizeFetchedJob,
  normalizeSearchResult,
} from '../src/lib/jobs/normalize';
import { deduplicateJobs } from '../src/lib/jobs/dedupe';
import {
  AgentJobItem,
  NormalizedFetchResult,
  NormalizedSearchResult,
} from '../src/lib/tinyfish/types';

test('Integration Shape Test: Real TinyFish API response shapes normalize and deduplicate cleanly', () => {
  // Shape from Milestone 2A Search
  const liveSearchResult: NormalizedSearchResult = {
    title: 'Product Manager | Careers',
    url: 'https://www.sarvam.ai/careers/jobs/c4bb3b2c-7608-4d57-8761-650b4222ac13',
    snippet:
      "We're looking for product managers who are builders first — people who talk to customers constantly, ship real product to real users, and get into the details ...",
    domain: 'www.sarvam.ai',
    position: 2,
  };

  // Shape from Milestone 2B Fetch
  const liveFetchResult: NormalizedFetchResult = {
    url: 'https://www.sarvam.ai/careers/jobs/c4bb3b2c-7608-4d57-8761-650b4222ac13',
    finalUrl: 'https://www.sarvam.ai/careers/jobs/c4bb3b2c-7608-4d57-8761-650b4222ac13',
    title: 'Product Manager - Sarvam AI Careers',
    description:
      "Product Manager - Product · Bengaluru · at Sarvam AI. Apply now and help build India's AI infrastructure.",
    language: 'en',
    content:
      "Product\n\n# Product Manager\n\nProductBengaluruFull TimeOn-Site\n\nApply for this role\n\n* 3–7 years of product management experience\n* Hands-on familiarity with AI",
    contentLength: 4360,
    latencyMs: 1129,
    domain: 'sarvam.ai',
    checkedAt: '2026-09-29T10:04:57.166Z',
  };

  // Shape from Milestone 2C Agent
  const liveAgentJob: AgentJobItem = {
    title: 'Product Manager',
    company: 'Sarvam AI',
    location: 'Bengaluru, India',
    employment_type: 'Full Time',
    work_mode: 'On-Site',
    description:
      'Sarvam is building the bedrock of Sovereign AI for India. The role involves building products end-to-end.',
    requirements: [
      '3–7 years of product management experience at scale in India',
      'Hands-on familiarity with AI (agents, context windows, trade-offs)',
    ],
    apply_url:
      'https://jobs.ashbyhq.com/sarvam/c4bb3b2c-7608-4d57-8761-650b4222ac13/application',
    source_url:
      'https://www.sarvam.ai/careers/jobs/c4bb3b2c-7608-4d57-8761-650b4222ac13',
  };

  const normalizedSearch = normalizeSearchResult(liveSearchResult);
  const normalizedFetch = normalizeFetchedJob(liveFetchResult);
  const normalizedAgent = normalizeAgentJob(liveAgentJob);

  assert.ok(normalizedSearch, 'Search normalization must succeed');
  assert.ok(normalizedFetch, 'Fetch normalization must succeed');
  assert.ok(normalizedAgent, 'Agent normalization must succeed');

  assert.strictEqual(normalizedSearch.title, 'Product Manager');
  assert.strictEqual(normalizedFetch.title, 'Product Manager');
  assert.strictEqual(normalizedAgent.title, 'Product Manager');

  // Verify deduplication merges all 3 real pipeline outputs into 1 canonical listing
  const deduplicated = deduplicateJobs([normalizedSearch, normalizedFetch, normalizedAgent]);

  assert.strictEqual(deduplicated.length, 1, 'All 3 pipeline stages for Sarvam PM must merge to 1 job');

  const canonicalJob = deduplicated[0];
  assert.strictEqual(canonicalJob.title, 'Product Manager');
  assert.strictEqual(canonicalJob.company, 'Sarvam AI');
  assert.strictEqual(
    canonicalJob.applyUrl,
    'https://jobs.ashbyhq.com/sarvam/c4bb3b2c-7608-4d57-8761-650b4222ac13/application'
  );
  assert.strictEqual(canonicalJob.source, 'merged');
  assert.strictEqual(canonicalJob.employmentType, 'Full-time');
  assert.strictEqual(canonicalJob.workMode, 'On-site');
  assert.strictEqual(canonicalJob.provenance.length, 3);
});
