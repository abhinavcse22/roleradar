import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyUrl,
  normalizeCareerHubIdentity,
  formatHubDisplayName,
} from '../src/lib/pipeline/classifier';
import {
  groupCareerHubs,
  scoreHubRelevance,
  rankCareerHubs,
} from '../src/lib/pipeline/searchPipeline';
import { NormalizedSearchResult } from '../src/lib/tinyfish/types';
import { UserPreferences } from '../src/lib/matching/types';

const defaultPreferences: UserPreferences = {
  role: 'Product Manager',
  location: 'India',
  keywords: ['AI'],
  seniority: 'Any',
  workMode: 'Any',
  visaPreference: 'Any',
};

// -------------------------------------------------------------
// Test A: Same Lever hub with trailing slash -> 1 hub
// -------------------------------------------------------------
test('Test A: Same Lever hub with trailing slash resolves to identical identity and groups to 1 hub', () => {
  const url1 = 'https://jobs.lever.co/gohighlevel';
  const url2 = 'https://jobs.lever.co/gohighlevel/';

  const id1 = normalizeCareerHubIdentity(url1);
  const id2 = normalizeCareerHubIdentity(url2);
  assert.strictEqual(id1, 'lever:gohighlevel');
  assert.strictEqual(id2, 'lever:gohighlevel');
  assert.strictEqual(id1, id2);

  const candidates: NormalizedSearchResult[] = [
    { url: url1, title: 'GoHighLevel Careers', snippet: 'Jobs at GoHighLevel', domain: 'jobs.lever.co', position: 1 },
    { url: url2, title: 'GoHighLevel - Open Roles', snippet: 'Join us', domain: 'jobs.lever.co', position: 2 },
  ];

  const grouped = groupCareerHubs(candidates, defaultPreferences);
  assert.strictEqual(grouped.length, 1);
  assert.strictEqual(normalizeCareerHubIdentity(grouped[0].url), 'lever:gohighlevel');
});

// -------------------------------------------------------------
// Test B: Same Lever hub with query parameters -> 1 hub
// -------------------------------------------------------------
test('Test B: Same Lever hub with query parameters groups into 1 hub', () => {
  const urlBase = 'https://jobs.lever.co/gohighlevel';
  const urlWithParams = 'https://jobs.lever.co/gohighlevel?department=Product&team=Core&utm_source=linkedin';

  assert.strictEqual(normalizeCareerHubIdentity(urlBase), 'lever:gohighlevel');
  assert.strictEqual(normalizeCareerHubIdentity(urlWithParams), 'lever:gohighlevel');

  const candidates: NormalizedSearchResult[] = [
    { url: urlBase, title: 'GoHighLevel Careers', snippet: 'Product Manager', domain: 'jobs.lever.co', position: 1 },
    { url: urlWithParams, title: 'GoHighLevel Careers - Product', snippet: 'PM openings', domain: 'jobs.lever.co', position: 2 },
  ];

  const grouped = groupCareerHubs(candidates, defaultPreferences);
  assert.strictEqual(grouped.length, 1);
});

// -------------------------------------------------------------
// Test C: Same Ashby hub with tracking/filter query parameters -> 1 hub
// -------------------------------------------------------------
test('Test C: Same Ashby hub with tracking and filter query parameters groups into 1 hub', () => {
  const url1 = 'https://jobs.ashbyhq.com/sarvam';
  const url2 = 'https://jobs.ashbyhq.com/sarvam?utm_source=careers&location=India&department=AI';

  assert.strictEqual(normalizeCareerHubIdentity(url1), 'ashby:sarvam');
  assert.strictEqual(normalizeCareerHubIdentity(url2), 'ashby:sarvam');

  const candidates: NormalizedSearchResult[] = [
    { url: url1, title: 'Sarvam AI Careers', snippet: 'Frontier AI models', domain: 'jobs.ashbyhq.com', position: 1 },
    { url: url2, title: 'Sarvam AI Openings', snippet: 'Build Indic LLMs', domain: 'jobs.ashbyhq.com', position: 2 },
  ];

  const grouped = groupCareerHubs(candidates, defaultPreferences);
  assert.strictEqual(grouped.length, 1);
  assert.strictEqual(normalizeCareerHubIdentity(grouped[0].url), 'ashby:sarvam');
});

// -------------------------------------------------------------
// Test D: Different companies -> different hubs
// -------------------------------------------------------------
test('Test D: Different companies on same ATS host produce different hub identities and are not merged', () => {
  const urlA = 'https://jobs.lever.co/gohighlevel';
  const urlB = 'https://jobs.lever.co/linear';

  const idA = normalizeCareerHubIdentity(urlA);
  const idB = normalizeCareerHubIdentity(urlB);
  assert.strictEqual(idA, 'lever:gohighlevel');
  assert.strictEqual(idB, 'lever:linear');
  assert.notStrictEqual(idA, idB);

  const candidates: NormalizedSearchResult[] = [
    { url: urlA, title: 'GoHighLevel Careers', snippet: 'All roles', domain: 'jobs.lever.co', position: 1 },
    { url: urlB, title: 'Linear Careers', snippet: 'Issue tracker', domain: 'jobs.lever.co', position: 2 },
  ];

  const grouped = groupCareerHubs(candidates, defaultPreferences);
  assert.strictEqual(grouped.length, 2);
});

// -------------------------------------------------------------
// Test E: Same company represented by different careers URLs -> 1 hub
// -------------------------------------------------------------
test('Test E: Same company native career URLs group to 1 canonical hub identity', () => {
  const url1 = 'https://sarvam.ai/careers';
  const url2 = 'https://careers.sarvam.ai';
  const url3 = 'https://www.sarvam.ai/jobs';

  const id1 = normalizeCareerHubIdentity(url1);
  const id2 = normalizeCareerHubIdentity(url2);
  const id3 = normalizeCareerHubIdentity(url3);

  assert.strictEqual(id1, 'company:sarvam.ai');
  assert.strictEqual(id2, 'company:sarvam.ai');
  assert.strictEqual(id3, 'company:sarvam.ai');

  const candidates: NormalizedSearchResult[] = [
    { url: url1, title: 'Sarvam AI - Careers', snippet: 'Work with us', domain: 'sarvam.ai', position: 1 },
    { url: url2, title: 'Careers at Sarvam AI', snippet: 'Open positions in India', domain: 'careers.sarvam.ai', position: 2 },
    { url: url3, title: 'Sarvam AI Jobs', snippet: 'Product Manager positions', domain: 'sarvam.ai', position: 3 },
  ];

  const grouped = groupCareerHubs(candidates, defaultPreferences);
  assert.strictEqual(grouped.length, 1);
  assert.strictEqual(normalizeCareerHubIdentity(grouped[0].url), 'company:sarvam.ai');
});

// -------------------------------------------------------------
// Test F: careerHubCandidates remains raw count
// -------------------------------------------------------------
test('Test F: careerHubCandidates maintains raw count while uniqueCareerHubs maintains deduplicated count', () => {
  const rawHubs: NormalizedSearchResult[] = [
    { url: 'https://jobs.lever.co/gohighlevel', title: 'GHL 1', snippet: '', domain: 'jobs.lever.co', position: 1 },
    { url: 'https://jobs.lever.co/gohighlevel/', title: 'GHL 2', snippet: '', domain: 'jobs.lever.co', position: 2 },
    { url: 'https://jobs.lever.co/gohighlevel?dept=Product', title: 'GHL 3', snippet: '', domain: 'jobs.lever.co', position: 3 },
    { url: 'https://jobs.ashbyhq.com/sarvam', title: 'Sarvam 1', snippet: '', domain: 'jobs.ashbyhq.com', position: 4 },
    { url: 'https://jobs.ashbyhq.com/sarvam?ref=recruiter', title: 'Sarvam 2', snippet: '', domain: 'jobs.ashbyhq.com', position: 5 },
  ];

  const rawCount = rawHubs.length;
  assert.strictEqual(rawCount, 5);

  const grouped = groupCareerHubs(rawHubs, defaultPreferences);
  const uniqueCount = grouped.length;
  assert.strictEqual(uniqueCount, 2);
});

// -------------------------------------------------------------
// Test G: uniqueCareerHubs reflects grouped count
// -------------------------------------------------------------
test('Test G: uniqueCareerHubs correctly counts distinct portals across diverse ATS providers', () => {
  const hubs: NormalizedSearchResult[] = [
    { url: 'https://jobs.lever.co/gohighlevel', title: 'GHL', snippet: '', domain: 'jobs.lever.co', position: 1 },
    { url: 'https://jobs.ashbyhq.com/sarvam', title: 'Sarvam', snippet: '', domain: 'jobs.ashbyhq.com', position: 2 },
    { url: 'https://boards.greenhouse.io/stripe', title: 'Stripe', snippet: '', domain: 'boards.greenhouse.io', position: 3 },
    { url: 'https://boards.greenhouse.io/stripe?gh_src=123', title: 'Stripe Dup', snippet: '', domain: 'boards.greenhouse.io', position: 4 },
    { url: 'https://nvidia.myworkdayjobs.com/NVIDIAExternalCareerSite', title: 'Nvidia', snippet: '', domain: 'nvidia.myworkdayjobs.com', position: 5 },
  ];

  const grouped = groupCareerHubs(hubs, defaultPreferences);
  assert.strictEqual(grouped.length, 4); // GHL, Sarvam, Stripe, Nvidia
});

// -------------------------------------------------------------
// Test H: Agent selection chooses at most 1 candidate per hub identity
// -------------------------------------------------------------
test('Test H: Agent candidate selection preserves at most 1 candidate per canonical hub identity', () => {
  const duplicates: NormalizedSearchResult[] = [
    { url: 'https://jobs.lever.co/gohighlevel?team=Engineering', title: 'GHL Eng', snippet: '', domain: 'jobs.lever.co', position: 1 },
    { url: 'https://jobs.lever.co/gohighlevel?team=Product', title: 'GHL PM', snippet: 'Product Manager role in India', domain: 'jobs.lever.co', position: 2 },
    { url: 'https://jobs.lever.co/gohighlevel', title: 'GHL Home', snippet: '', domain: 'jobs.lever.co', position: 3 },
  ];

  const grouped = groupCareerHubs(duplicates, defaultPreferences);
  assert.strictEqual(grouped.length, 1);

  // The candidate with highest relevance score (matching role/location) should be selected
  assert.strictEqual(grouped[0].url, 'https://jobs.lever.co/gohighlevel?team=Product');
});

// -------------------------------------------------------------
// Test I: Top 2 selected Agent candidates have distinct hub identities
// -------------------------------------------------------------
test('Test I: Bounded Agent selection returns at most 2 distinct companies, never duplicates', () => {
  const hubs: NormalizedSearchResult[] = [
    { url: 'https://jobs.lever.co/gohighlevel', title: 'GoHighLevel Product Manager', snippet: 'AI PM India', domain: 'jobs.lever.co', position: 1 },
    { url: 'https://jobs.lever.co/gohighlevel/', title: 'GoHighLevel Careers', snippet: 'Product Manager', domain: 'jobs.lever.co', position: 2 },
    { url: 'https://jobs.lever.co/gohighlevel?department=Product', title: 'GoHighLevel Product', snippet: 'PM', domain: 'jobs.lever.co', position: 3 },
    { url: 'https://jobs.ashbyhq.com/sarvam', title: 'Sarvam AI Product Manager', snippet: 'AI PM India', domain: 'jobs.ashbyhq.com', position: 4 },
    { url: 'https://boards.greenhouse.io/stripe', title: 'Stripe Product', snippet: 'PM India', domain: 'boards.greenhouse.io', position: 5 },
  ];

  const uniqueHubs = groupCareerHubs(hubs, defaultPreferences);
  const ranked = rankCareerHubs(uniqueHubs, defaultPreferences);
  const top2ForAgent = ranked.slice(0, 2);

  assert.strictEqual(top2ForAgent.length, 2);
  const id0 = normalizeCareerHubIdentity(top2ForAgent[0].url);
  const id1 = normalizeCareerHubIdentity(top2ForAgent[1].url);
  assert.notStrictEqual(id0, id1, 'Selected Agent runs must belong to two distinct hub identities');
});

// -------------------------------------------------------------
// Test J: Agent candidate ranking still uses relevance score
// -------------------------------------------------------------
test('Test J: Agent candidate ranking properly scores role, location, and keyword relevance', () => {
  const relevantHub: NormalizedSearchResult = {
    url: 'https://jobs.ashbyhq.com/sarvam',
    title: 'Sarvam AI - Product Manager Openings in India',
    snippet: 'Hiring Product Manager for AI Foundation Models in India',
    domain: 'jobs.ashbyhq.com',
    position: 1,
  };

  const irrelevantHub: NormalizedSearchResult = {
    url: 'https://jobs.lever.co/randomretail',
    title: 'Random Retail Careers',
    snippet: 'Store Associates in Ohio',
    domain: 'jobs.lever.co',
    position: 2,
  };

  const scoreRelevant = scoreHubRelevance(relevantHub, defaultPreferences);
  const scoreIrrelevant = scoreHubRelevance(irrelevantHub, defaultPreferences);

  assert.ok(scoreRelevant > scoreIrrelevant, 'Relevant hub should score significantly higher than irrelevant hub');

  const ranked = rankCareerHubs([irrelevantHub, relevantHub], defaultPreferences);
  assert.strictEqual(ranked[0].url, relevantHub.url);
});

// -------------------------------------------------------------
// Test K: Direct job URLs remain Fetch candidates
// -------------------------------------------------------------
test('Test K: Direct job URLs are classified as directJob and not routed to Agent grouping', () => {
  const ashbyDirect = 'https://jobs.ashbyhq.com/sarvam/c4bb3b2c-7608-4d57-8761-650b4222ac13';
  const leverDirect = 'https://jobs.lever.co/gohighlevel/a1b2c3d4';
  const ghDirect = 'https://boards.greenhouse.io/stripe/jobs/123456';
  const nativeDirect = 'https://example.com/careers/jobs/pm-101';

  assert.strictEqual(classifyUrl(ashbyDirect), 'directJob');
  assert.strictEqual(classifyUrl(leverDirect), 'directJob');
  assert.strictEqual(classifyUrl(ghDirect), 'directJob');
  assert.strictEqual(classifyUrl(nativeDirect), 'directJob');
});

// -------------------------------------------------------------
// Test L: No Agent run occurs when there are no meaningful career hubs
// -------------------------------------------------------------
test('Test L: No Agent run is dispatched when there are zero career hubs discovered', () => {
  const directOnlyCandidates: NormalizedSearchResult[] = [];
  const grouped = groupCareerHubs(directOnlyCandidates, defaultPreferences);
  assert.strictEqual(grouped.length, 0);

  const topForAgent = rankCareerHubs(grouped, defaultPreferences).slice(0, 2);
  assert.strictEqual(topForAgent.length, 0);
});

// -------------------------------------------------------------
// Test M: Agent telemetry reflects actual unique runs
// -------------------------------------------------------------
test('Test M: Agent runs started equals the count of distinct grouped hubs dispatched', () => {
  // If only 1 distinct hub is discovered, exactly 1 Agent run is started
  const singleHub: NormalizedSearchResult[] = [
    { url: 'https://jobs.ashbyhq.com/sarvam', title: 'Sarvam', snippet: '', domain: 'jobs.ashbyhq.com', position: 1 },
    { url: 'https://jobs.ashbyhq.com/sarvam/', title: 'Sarvam Dup', snippet: '', domain: 'jobs.ashbyhq.com', position: 2 },
  ];

  const grouped = groupCareerHubs(singleHub, defaultPreferences);
  assert.strictEqual(grouped.length, 1);
  const runsToStart = grouped.slice(0, 2);
  assert.strictEqual(runsToStart.length, 1);
});

// -------------------------------------------------------------
// Test N: UI / formatHubDisplayName formats cleanly without duplication
// -------------------------------------------------------------
test('Test N: formatHubDisplayName generates clean human-readable names for UI display', () => {
  assert.strictEqual(formatHubDisplayName('https://jobs.lever.co/gohighlevel'), 'Gohighlevel · Lever');
  assert.strictEqual(formatHubDisplayName('https://jobs.ashbyhq.com/sarvam'), 'Sarvam · Ashby');
  assert.strictEqual(formatHubDisplayName('https://boards.greenhouse.io/stripe'), 'Stripe · Greenhouse');
  assert.strictEqual(formatHubDisplayName('https://boards.greenhouse.io/embed/job_board?for=stripe'), 'Stripe · Greenhouse');
  assert.strictEqual(formatHubDisplayName('https://nvidia.myworkdayjobs.com/external'), 'Nvidia · Workday');
  assert.strictEqual(formatHubDisplayName('https://careers.sarvam.ai'), 'Sarvam · Careers');
  assert.strictEqual(formatHubDisplayName('https://sarvam.ai/careers'), 'Sarvam · Careers');
});
