import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCompanyFromUrl,
  cleanDisplayCompany,
  cleanJobDescription,
  extractCleanLocation,
  extractStructuredRequirements,
  normalizeSearchResult,
  normalizeFetchedJob,
  normalizeAgentJob,
  GENERIC_COMPANY_BLOCKLIST,
} from '../src/lib/jobs/normalize';
import { deduplicateJobs } from '../src/lib/jobs/dedupe';
import { scoreJobMatch } from '../src/lib/matching/scoring';
import { generateSearchQueries } from '../src/lib/pipeline/searchPipeline';
import { UserPreferences } from '../src/lib/matching/types';

// -------------------------------------------------------------
// Test 1: ATS URL Company Extraction & Generic Blocklist
// -------------------------------------------------------------
test('Data Quality 1: Company extraction resolves real company and never yields generic ATS labels', () => {
  const ashbyUrl = 'https://jobs.ashbyhq.com/sarvam-ai/c4bb3b2c-7608-4d57-8761-650b4222ac13';
  const greenhouseUrl = 'https://boards.greenhouse.io/figma/jobs/567890';
  const leverUrl = 'https://jobs.lever.co/netflix/1234abcd-5678';
  const careerSubdomainUrl = 'https://careers.swiggy.com/product-manager-101';
  const mainDomainWithCareers = 'https://sarvam.ai/careers/jobs/pm-lead';

  assert.strictEqual(extractCompanyFromUrl(ashbyUrl), 'Sarvam Ai');
  assert.strictEqual(extractCompanyFromUrl(greenhouseUrl), 'Figma');
  assert.strictEqual(extractCompanyFromUrl(leverUrl), 'Netflix');
  assert.strictEqual(extractCompanyFromUrl(careerSubdomainUrl), 'Swiggy');
  assert.strictEqual(extractCompanyFromUrl(mainDomainWithCareers), 'Sarvam');

  // Verify generic names are blocked
  assert.ok(GENERIC_COMPANY_BLOCKLIST.has('jobs'));
  assert.ok(GENERIC_COMPANY_BLOCKLIST.has('boards'));
  for (const generic of ['Jobs', 'Careers', 'Boards', 'ATS', 'Apply', 'Openings']) {
    assert.strictEqual(
      cleanDisplayCompany(generic, 'jobs.ashbyhq.com', 'https://jobs.ashbyhq.com/sarvam/pm'),
      'Sarvam'
    );
  }
});

// -------------------------------------------------------------
// Test 2: Job Description Cleaning (Strips Markdown Headers & Noise)
// -------------------------------------------------------------
test('Data Quality 2: Raw markdown headers and boilerplate are stripped from job descriptions', () => {
  const rawFetchContent = `
# Product Manager
## Location India, Bengaluru
### About the Role

We are building next-generation AI foundation models for India.
[Apply here](https://jobs.ashbyhq.com/sarvam)
**Key Responsibility**: Lead product from 0 to 1.

Apply for this job
Powered by Ashby
© 2026 Sarvam AI
`;

  const cleaned = cleanJobDescription(rawFetchContent, 'Product Manager', 'Sarvam AI');

  assert.ok(!cleaned.includes('# Product Manager'), 'Headers (#) must be stripped');
  assert.ok(!cleaned.includes('## Location India'), 'Subheaders (##) must be stripped');
  assert.ok(!cleaned.includes('### About the Role'), 'Subheaders (###) must be stripped');
  assert.ok(!cleaned.includes('[Apply here]'), 'Markdown link syntax must be stripped');
  assert.ok(!cleaned.includes('Powered by Ashby'), 'Boilerplate must be stripped');
  assert.ok(!cleaned.includes('© 2026'), 'Copyright boilerplate must be stripped');
  assert.ok(cleaned.includes('We are building next-generation AI foundation models for India.'));
  assert.ok(cleaned.includes('Key Responsibility: Lead product from 0 to 1.'));
});

// -------------------------------------------------------------
// Test 3: Location Extraction is Clean and Concise
// -------------------------------------------------------------
test('Data Quality 3: Location is never contaminated with entire page content or raw markdown', () => {
  const giantContent = `
# Staff Software Engineer
Company Overview: Sarvam AI is an AI research lab based in Bengaluru, Karnataka, India.
We are hiring globally but this position is based on-site in Bengaluru, India.
Here are 5000 words of job description, team updates, culture statements, press releases...
`;

  const { location, country } = extractCleanLocation(null, giantContent, 'Staff Software Engineer');

  assert.ok(location.length <= 80, `Location should be concise, got length ${location.length}`);
  assert.ok(!location.includes('#'), 'Location must not contain markdown symbols');
  assert.ok(!location.includes('Here are 5000 words'), 'Location must not contain body text');
  assert.strictEqual(country, 'India');
  assert.ok(location.includes('Bengaluru') || location.includes('India'));
});

// -------------------------------------------------------------
// Test 4: Structured Requirements Extraction (Excludes Benefits)
// -------------------------------------------------------------
test('Data Quality 4: Requirements extraction isolates real qualification bullets and ignores benefits', () => {
  const pageContent = `
## About the Role
We are looking for an experienced PM.

## Qualifications
* 5+ years of product management experience building enterprise SaaS
* Deep familiarity with LLMs, prompt engineering, and agentic workflows
* Strong analytical skills and proficiency in SQL
* Excellent cross-functional communication abilities

## What We Offer
* Comprehensive health insurance and dental coverage
* 401k with 5% matching
* Unlimited paid time off (PTO)
* Free lunch and daily snacks
`;

  const requirements = extractStructuredRequirements(pageContent);

  assert.ok(requirements.length >= 3, `Expected at least 3 requirements, got ${requirements.length}`);
  assert.ok(requirements.some((r) => r.includes('5+ years of product management experience')));
  assert.ok(requirements.some((r) => r.includes('Deep familiarity with LLMs')));
  assert.ok(requirements.some((r) => r.includes('proficiency in SQL')));

  // Ensure benefits are excluded
  assert.ok(!requirements.some((r) => r.includes('health insurance')), 'Benefits must not be in requirements');
  assert.ok(!requirements.some((r) => r.includes('401k')), '401k must not be in requirements');
  assert.ok(!requirements.some((r) => r.includes('Unlimited paid time off')), 'PTO must not be in requirements');
});

// -------------------------------------------------------------
// Test 5: Merge Priority Across Search, Fetch, and Agent
// -------------------------------------------------------------
test('Data Quality 5: mergeJobs respects field-specific authority (Agent title/applyUrl, Fetch description, union reqs)', () => {
  const searchJob = normalizeSearchResult({
    title: 'PM at Sarvam',
    url: 'https://sarvam.ai/careers/pm',
    snippet: 'Search snippet summary of PM role.',
    domain: 'sarvam.ai',
    position: 1,
  })!;

  const fetchJob = normalizeFetchedJob({
    url: 'https://sarvam.ai/careers/pm',
    finalUrl: 'https://sarvam.ai/careers/pm',
    title: 'Product Manager - Sarvam Careers',
    description: 'Rich comprehensive description fetched directly from the live page text.',
    content: 'Full page markdown content...\n## Requirements\n* 4+ years of product management experience\n* SQL analytics',
    contentLength: 1200,
    latencyMs: 300,
    domain: 'sarvam.ai',
    language: 'en',
    checkedAt: '2026-09-29T11:00:00.000Z',
  })!;

  const agentJob = normalizeAgentJob({
    title: 'Staff Product Manager',
    company: 'Sarvam AI',
    location: 'Bengaluru, India',
    employment_type: 'Full Time',
    work_mode: 'On-Site',
    description: 'Agent summary of role',
    requirements: ['Hands-on familiarity with AI agent workflows'],
    apply_url: 'https://jobs.ashbyhq.com/sarvam/pm/application',
    source_url: 'https://sarvam.ai/careers/pm',
  })!;

  const deduplicated = deduplicateJobs([searchJob, fetchJob, agentJob]);
  assert.strictEqual(deduplicated.length, 1);

  const merged = deduplicated[0];
  // Title: Agent has priority
  assert.strictEqual(merged.title, 'Staff Product Manager');
  // Company: Authoritative company
  assert.strictEqual(merged.company, 'Sarvam AI');
  // Apply URL: Agent direct ATS apply URL
  assert.strictEqual(merged.applyUrl, 'https://jobs.ashbyhq.com/sarvam/pm/application');
  // Description: Fetch rich content has priority
  assert.ok(merged.description.includes('Rich comprehensive description fetched directly'));
  // Requirements: Union of Agent and Fetch
  assert.ok(merged.requirements.some((r) => r.includes('Hands-on familiarity with AI agent workflows')));
  assert.ok(merged.requirements.some((r) => r.includes('4+ years of product management experience')));
  // Work Mode & Employment Type: Structured Agent values
  assert.strictEqual(merged.workMode, 'On-site');
  assert.strictEqual(merged.employmentType, 'Full-time');
});

// -------------------------------------------------------------
// Test 6: Match Explanation References Only Clean Location
// -------------------------------------------------------------
test('Data Quality 6: Match explanation references only clean structured location, never raw fetch markdown', () => {
  const dirtyLocationJob = normalizeFetchedJob({
    url: 'https://example.com/careers/pm',
    finalUrl: 'https://example.com/careers/pm',
    title: 'Product Manager',
    description: 'Role description',
    content: `
# Product Manager
## Location: Bengaluru, India
Full page text here...
`,
    contentLength: 85,
    latencyMs: 120,
    domain: 'example.com',
    language: 'en',
    checkedAt: new Date().toISOString(),
  })!;

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    keywords: ['AI'],
    workMode: 'On-site',
    visaPreference: 'No sponsorship required',
  };

  const match = scoreJobMatch(dirtyLocationJob, prefs);
  assert.ok(match.eligible, 'Job should be eligible');

  const locReason = match.reasons.find((r) => r.toLowerCase().includes('location')) || '';
  assert.ok(locReason.length > 0, 'Should have a location match reason');
  assert.ok(!locReason.includes('#'), 'Location explanation must not include markdown header');
  assert.ok(!locReason.includes('Full page text'), 'Location explanation must not include body text');
  assert.ok(locReason.includes('India'), 'Location explanation should mention matched country');
});

// -------------------------------------------------------------
// Test 7: Career Hub Discovery Queries Generate Correct Vectors
// -------------------------------------------------------------
test('Data Quality 7: Query generator constructs vectors targeting interactive career hubs', () => {
  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    keywords: ['AI'],
  };

  const queries = generateSearchQueries(prefs);
  assert.ok(queries.length >= 3, `Expected at least 3 queries, got ${queries.length}`);

  // Must include portal search queries (Ashby, Greenhouse, Lever)
  assert.ok(queries.some((q) => q.includes('ashbyhq.com') || q.includes('greenhouse.io')));

  // Must include interactive career hub vectors
  assert.ok(
    queries.some(
      (q) =>
        q.includes('"join our team"') ||
        q.includes('"work with us"') ||
        q.includes('inurl:careers "openings"')
    ),
    'Search queries must include vectors to discover interactive company career portals'
  );
});
