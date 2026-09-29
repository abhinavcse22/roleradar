import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreJobMatch } from '../src/lib/matching/scoring';
import { JobListing } from '../src/lib/jobs/types';
import { UserPreferences } from '../src/lib/matching/types';

function createMockJob(overrides: Partial<JobListing> = {}): JobListing {
  return {
    id: overrides.id || 'test_job_1',
    title: overrides.title || 'Product Manager',
    company: overrides.company || 'Sarvam AI',
    location: overrides.location || 'Bengaluru, India',
    country: overrides.country !== undefined ? overrides.country : 'India',
    employmentType: overrides.employmentType !== undefined ? overrides.employmentType : 'Full-time',
    seniority: overrides.seniority !== undefined ? overrides.seniority : 'Mid',
    workMode: overrides.workMode !== undefined ? overrides.workMode : 'On-site',
    description:
      overrides.description ||
      'Looking for a product manager to build Sovereign AI platforms with SaaS workflows in Bengaluru.',
    requirements: overrides.requirements || ['3+ years in AI product management', 'Experience with SQL'],
    keywords: overrides.keywords || ['AI', 'SaaS'],
    source: overrides.source || 'fetch',
    sourceUrl: overrides.sourceUrl || 'https://sarvam.ai/careers/pm',
    applyUrl: overrides.applyUrl || 'https://jobs.ashbyhq.com/sarvam/pm/application',
    checkedAt: overrides.checkedAt || new Date().toISOString(),
    provenance: overrides.provenance || [
      {
        source: 'fetch',
        url: 'https://jobs.ashbyhq.com/sarvam/pm/application',
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

// -------------------------------------------------------------
// Core Regression Tests
// -------------------------------------------------------------
test('Regression 1: Matching role but incompatible location marks job ineligible (eligible: false)', () => {
  const job = createMockJob({
    title: 'Product Manager',
    location: 'London, United Kingdom',
    country: 'United Kingdom',
    workMode: 'On-site',
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
  };

  const result = scoreJobMatch(job, prefs);
  assert.strictEqual(result.eligible, false);
  assert.strictEqual(result.breakdown.location, 0);
  assert.ok(result.warnings.some((w) => w.toLowerCase().includes('location')));
});

test('Regression 2: Seniority mismatch remains eligible with reduced points and descriptive warning', () => {
  const job = createMockJob({
    title: 'Product Manager',
    seniority: 'Senior',
    requirements: ['Requires 5+ years experience in product management'],
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    seniority: 'Junior',
  };

  const result = scoreJobMatch(job, prefs);
  assert.strictEqual(result.eligible, true, 'Seniority gap should not hard-filter eligibility');
  assert.ok(result.breakdown.seniority < 10, 'Seniority points must be penalized');
  assert.ok(result.warnings.some((w) => w.toLowerCase().includes('senior') || w.toLowerCase().includes('experience')));
});

test('Regression 3: Clearly unrelated role is marked ineligible via hard filter', () => {
  const job = createMockJob({
    title: 'Senior Backend Software Engineer (Go/Rust)',
    description: 'Writing low-level network drivers in Rust.',
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
  };

  const result = scoreJobMatch(job, prefs);
  assert.strictEqual(result.eligible, false);
  assert.strictEqual(result.breakdown.role, 0);
  assert.ok(result.warnings.some((w) => w.includes('Software Engineer')));
});

test('Regression 4: Closed or expired job posting is marked ineligible', () => {
  const job = createMockJob({
    title: 'Product Manager',
    description: 'This position is closed and no longer accepting applications.',
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
  };

  const result = scoreJobMatch(job, prefs);
  assert.strictEqual(result.eligible, false);
  assert.ok(result.warnings.some((w) => w.toLowerCase().includes('closed')));
});

// -------------------------------------------------------------
// Milestone 6C Specific Tests (Tests A through O)
// -------------------------------------------------------------

// Test A: Any seniority does NOT award seniority points
test('Test A: Any seniority does NOT award seniority points and does not create noisy warnings', () => {
  const job = createMockJob({ seniority: 'Senior' });
  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    seniority: 'Any',
  };

  const result = scoreJobMatch(job, prefs);
  assert.strictEqual(result.breakdown.seniority, 0, 'Unspecified seniority must earn 0 points');
  assert.ok(
    !result.warnings.some((w) => w.toLowerCase().includes('seniority')),
    'Unspecified seniority must not produce a warning'
  );
});

// Test B: Any work mode does NOT award work-mode points
test('Test B: Any work mode does NOT award work-mode points', () => {
  const job = createMockJob({ workMode: 'Remote' });
  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    workMode: 'Any',
  };

  const result = scoreJobMatch(job, prefs);
  assert.strictEqual(result.breakdown.workMode, 0, 'Unspecified work mode must earn 0 points');
  assert.ok(
    !result.warnings.some((w) => w.toLowerCase().includes('work mode')),
    'Unspecified work mode must not produce a warning'
  );
});

// Test C: Any visa does NOT award visa points
test('Test C: Any visa does NOT award visa points', () => {
  const job = createMockJob({
    description: 'Visa sponsorship is available for all eligible hires.',
  });
  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    visaPreference: 'Any',
  };

  const result = scoreJobMatch(job, prefs);
  assert.strictEqual(result.breakdown.visa, 0, 'Unspecified visa preference must earn 0 points');
  assert.ok(
    !result.warnings.some((w) => w.toLowerCase().includes('visa')),
    'Unspecified visa must not produce a warning'
  );
});

// Test D: Score is normalized to 0–100 after excluding neutral dimensions
test('Test D: Score is normalized to 0–100 after excluding neutral dimensions from denominator', () => {
  // Role: 30, Location: 20, Keywords: 20 (AI matched), Freshness: 5 = 75 earned
  // Seniority, WorkMode, Visa are Any -> Denominator is 75 -> 75/75 = 100
  const job = createMockJob({
    title: 'Product Manager',
    location: 'Bengaluru, India',
    country: 'India',
    description: 'Building AI product roadmaps.',
    keywords: ['AI'],
    checkedAt: new Date().toISOString(), // 5 pts
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    keywords: ['AI'],
    seniority: 'Any',
    workMode: 'Any',
    visaPreference: 'Any',
  };

  const result = scoreJobMatch(job, prefs);
  assert.strictEqual(result.breakdown.role, 30);
  assert.strictEqual(result.breakdown.location, 20);
  assert.strictEqual(result.breakdown.keywords, 20);
  assert.strictEqual(result.breakdown.seniority, 0);
  assert.strictEqual(result.breakdown.workMode, 0);
  assert.strictEqual(result.breakdown.visa, 0);
  assert.strictEqual(result.breakdown.freshness, 5);
  // Denominator is 30 + 20 + 20 + 5 = 75. Earned is 75. Result must be 100, not 75!
  assert.strictEqual(result.score, 100);
});

// Test E: Exact role ranks above related role
test('Test E: Exact role ranks above specialized, seniority-variant, and adjacent roles', () => {
  const exactJob = createMockJob({ id: 'exact', title: 'Product Manager' });
  const specializedJob = createMockJob({ id: 'spec', title: 'Product Manager, Growth' });
  const seniorVariantJob = createMockJob({ id: 'senior', title: 'Senior Product Manager' });
  const weakAdjacentJob = createMockJob({ id: 'adj', title: 'Product Analyst' });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
  };

  const exactRes = scoreJobMatch(exactJob, prefs);
  const specRes = scoreJobMatch(specializedJob, prefs);
  const seniorRes = scoreJobMatch(seniorVariantJob, prefs);
  const adjRes = scoreJobMatch(weakAdjacentJob, prefs);

  assert.strictEqual(exactRes.breakdown.role, 30);
  assert.strictEqual(specRes.breakdown.role, 27);
  assert.strictEqual(seniorRes.breakdown.role, 24);
  assert.strictEqual(adjRes.breakdown.role, 12);

  assert.ok(exactRes.score > specRes.score, 'Exact PM must rank above PM Growth');
  assert.ok(specRes.score > seniorRes.score, 'PM Growth must rank above Senior PM');
  assert.ok(seniorRes.score > adjRes.score, 'Senior PM must rank above Product Analyst');
});

// Test F: Exact keyword coverage ranks above partial keyword coverage
test('Test F: Full keyword coverage ranks above partial keyword coverage', () => {
  const fullKwJob = createMockJob({
    id: 'full_kw',
    description: 'Developing AI platforms with enterprise SaaS integrations.',
    keywords: ['AI', 'SaaS'],
  });

  const partialKwJob = createMockJob({
    id: 'partial_kw',
    description: 'Developing AI platforms for local retail.',
    keywords: ['AI'],
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    keywords: ['AI', 'SaaS'],
  };

  const fullRes = scoreJobMatch(fullKwJob, prefs);
  const partRes = scoreJobMatch(partialKwJob, prefs);

  assert.strictEqual(fullRes.breakdown.keywords, 20);
  assert.strictEqual(partRes.breakdown.keywords, 10);
  assert.ok(fullRes.score > partRes.score);
});

// Test G: Missing requested keyword prevents a 100 score
test('Test G: Missing requested keyword prevents a 100 score', () => {
  const missingKwJob = createMockJob({
    title: 'Product Manager',
    location: 'Bengaluru, India',
    description: 'Leading mobile developer platform initiatives.',
    requirements: ['Experience with iOS and Android mobile SDKs'],
    keywords: ['Mobile'],
    checkedAt: new Date().toISOString(),
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    keywords: ['AI'], // AI missing
  };

  const result = scoreJobMatch(missingKwJob, prefs);
  assert.strictEqual(result.breakdown.keywords, 0);
  assert.ok(result.score < 100, `Score was ${result.score}, expected strictly < 100`);
  assert.ok(result.warnings.some((w) => w.includes('AI')));
});

// Test H: Strong city match ranks above country-only match where appropriate
test('Test H: Strong city match ranks above country-only match when specific city requested', () => {
  const cityJob = createMockJob({
    id: 'city_job',
    location: 'Bengaluru, India',
  });

  const countryOnlyJob = createMockJob({
    id: 'country_job',
    location: 'India',
    country: 'India',
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'Bengaluru, India',
  };

  const cityRes = scoreJobMatch(cityJob, prefs);
  const countryRes = scoreJobMatch(countryOnlyJob, prefs);

  assert.strictEqual(cityRes.breakdown.location, 20);
  assert.strictEqual(countryRes.breakdown.location, 18);
  assert.ok(cityRes.score > countryRes.score, 'Specific city match must outscore country-only match');
});

// Test I: Unknown location does not become a false positive
test('Test I: Unknown location does not become a false positive', () => {
  const unknownLocJob = createMockJob({
    location: 'undisclosed',
    country: null,
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
  };

  const result = scoreJobMatch(unknownLocJob, prefs);
  assert.strictEqual(result.breakdown.location, 6);
  assert.ok(result.warnings.some((w) => w.toLowerCase().includes('location not specified')));
  assert.ok(result.score < 90);
});

// Test J: Remote preference ranks remote above hybrid
test('Test J: Remote preference ranks remote above hybrid', () => {
  const remoteJob = createMockJob({ workMode: 'Remote' });
  const hybridJob = createMockJob({ workMode: 'Hybrid' });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    workMode: 'Remote',
  };

  const remoteRes = scoreJobMatch(remoteJob, prefs);
  const hybridRes = scoreJobMatch(hybridJob, prefs);

  assert.strictEqual(remoteRes.breakdown.workMode, 10);
  assert.strictEqual(hybridRes.breakdown.workMode, 5);
  assert.ok(remoteRes.score > hybridRes.score);
});

// Test K: Sponsorship-required preference ranks confirmed sponsorship above unknown
test('Test K: Sponsorship-required preference ranks confirmed sponsorship above unknown', () => {
  const sponsoredJob = createMockJob({
    description: 'We welcome foreign nationals. Visa sponsorship is available for this position.',
  });

  const unknownJob = createMockJob({
    description: 'General product manager role overseeing agile delivery in Bengaluru.',
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    visaPreference: 'Sponsorship required',
  };

  const sponsoredRes = scoreJobMatch(sponsoredJob, prefs);
  const unknownRes = scoreJobMatch(unknownJob, prefs);

  assert.strictEqual(sponsoredRes.breakdown.visa, 5);
  assert.strictEqual(unknownRes.breakdown.visa, 2);
  assert.ok(sponsoredRes.score > unknownRes.score);
  assert.ok(unknownRes.warnings.some((w) => w.toLowerCase().includes('visa')));
});

// Test L: Freshness remains a small contributor
test('Test L: Freshness remains a small contributor (maximum 5 points)', () => {
  const freshJob = createMockJob({
    checkedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5m ago -> 5 pts
  });

  const oldJob = createMockJob({
    checkedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30d ago -> 1 pt
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
  };

  const freshRes = scoreJobMatch(freshJob, prefs);
  const oldRes = scoreJobMatch(oldJob, prefs);

  assert.strictEqual(freshRes.breakdown.freshness, 5);
  assert.strictEqual(oldRes.breakdown.freshness, 1);
  // Freshness difference is 4 points out of 55 applicable max -> ~7% difference
  const scoreDiff = freshRes.score - oldRes.score;
  assert.ok(scoreDiff <= 10, `Freshness score gap was ${scoreDiff}, expected <= 10%`);
});

// Test M: Exact strong job can reach 100 when it actually satisfies all applicable preferences
test('Test M: Exact strong job can reach 100 when satisfying all applicable preferences', () => {
  const perfectJob = createMockJob({
    title: 'Product Manager',
    location: 'Bengaluru, India',
    country: 'India',
    description: 'Product manager building enterprise AI and SaaS applications.',
    keywords: ['AI', 'SaaS'],
    seniority: 'Mid',
    workMode: 'On-site',
    checkedAt: new Date().toISOString(),
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'Bengaluru, India',
    keywords: ['AI', 'SaaS'],
    seniority: 'Mid',
    workMode: 'On-site',
  };

  const result = scoreJobMatch(perfectJob, prefs);
  assert.strictEqual(result.eligible, true);
  assert.strictEqual(result.score, 100);
});

// Test N: No preference specified still produces a valid score
test('Test N: No preference specified still produces a valid score without errors', () => {
  const job = createMockJob();
  const emptyPrefs: UserPreferences = {
    role: '',
    location: '',
  };

  const result = scoreJobMatch(job, emptyPrefs);
  assert.strictEqual(typeof result.score, 'number');
  assert.ok(!isNaN(result.score));
  assert.ok(result.score >= 0 && result.score <= 100);
});

// Test O: Score remains deterministic across repeated calls
test('Test O: Score remains deterministic across repeated calls', () => {
  const job = createMockJob({
    title: 'Product Manager, AI Platform',
    location: 'Bengaluru, India',
    keywords: ['AI', 'SaaS'],
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    keywords: ['AI'],
  };

  const run1 = scoreJobMatch(job, prefs);
  const run2 = scoreJobMatch(job, prefs);
  const run3 = scoreJobMatch(job, prefs);

  assert.deepStrictEqual(run1, run2);
  assert.deepStrictEqual(run2, run3);
});
