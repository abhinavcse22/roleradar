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
// Test A: Exact role + location + keywords -> High score (e.g. >= 90)
// -------------------------------------------------------------
test('Test A: Exact role + location + keywords produces a high score (> 85) and positive match reasons', () => {
  const job = createMockJob({
    title: 'Product Manager',
    location: 'Bengaluru, India',
    country: 'India',
    workMode: 'On-site',
    keywords: ['AI', 'SaaS'],
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'Bengaluru, India',
    keywords: ['AI', 'SaaS'],
    workMode: 'On-site',
    seniority: 'Mid',
  };

  const result = scoreJobMatch(job, prefs);
  assert.strictEqual(result.eligible, true);
  assert.ok(result.score >= 90, `Score was ${result.score}, expected >= 90`);
  assert.strictEqual(result.breakdown.role, 30);
  assert.strictEqual(result.breakdown.location, 20);
  assert.strictEqual(result.breakdown.keywords, 20);
  assert.ok(result.reasons.some((r) => r.includes('Exact role match')));
});

// -------------------------------------------------------------
// Test B: Matching role but different location -> Ineligible via hard filter
// -------------------------------------------------------------
test('Test B: Matching role but incompatible location marks job ineligible (eligible: false)', () => {
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

// -------------------------------------------------------------
// Test C: Same role but seniority mismatch -> Eligible with lower score + warning
// -------------------------------------------------------------
test('Test C: Seniority mismatch remains eligible with reduced points and descriptive warning', () => {
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

// -------------------------------------------------------------
// Test D: Partial keyword match -> Proportional keyword score
// -------------------------------------------------------------
test('Test D: Partial keyword match awards proportional score and explains matched/missing terms', () => {
  const job = createMockJob({
    description: 'Looking for an AI product builder to design speech models.',
    keywords: ['AI'],
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    keywords: ['AI', 'Kubernetes'], // 1 of 2 matches
  };

  const result = scoreJobMatch(job, prefs);
  // 1/2 of 20 = 10 points
  assert.strictEqual(result.breakdown.keywords, 10);
  assert.ok(result.reasons.some((r) => r.includes('AI')));
  assert.ok(result.warnings.some((w) => w.includes('Kubernetes')));
});

// -------------------------------------------------------------
// Test E: Remote preference + remote job -> Full work-mode points (10/10)
// -------------------------------------------------------------
test('Test E: Remote preference + Remote job awards full 10 work-mode points', () => {
  const job = createMockJob({
    workMode: 'Remote',
    location: 'Remote, India',
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    workMode: 'Remote',
  };

  const result = scoreJobMatch(job, prefs);
  assert.strictEqual(result.breakdown.workMode, 10);
  assert.ok(result.reasons.some((r) => r.toLowerCase().includes('remote') || r.toLowerCase().includes('work mode')));
});

// -------------------------------------------------------------
// Test F: Remote preference + hybrid job -> Reduced work-mode points
// -------------------------------------------------------------
test('Test F: Remote preference + Hybrid job reduces work mode score to 5 with warning', () => {
  const job = createMockJob({
    workMode: 'Hybrid',
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    workMode: 'Remote',
  };

  const result = scoreJobMatch(job, prefs);
  assert.strictEqual(result.breakdown.workMode, 5);
  assert.ok(result.warnings.some((w) => w.includes('Hybrid')));
});

// -------------------------------------------------------------
// Test G: Visa sponsorship explicitly available -> Full 5 points
// -------------------------------------------------------------
test('Test G: Explicit visa sponsorship statement awards full 5 points and positive reason', () => {
  const job = createMockJob({
    description: 'We welcome international applicants. Visa sponsorship is available for qualified candidates.',
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    visaPreference: 'Sponsorship required',
  };

  const result = scoreJobMatch(job, prefs);
  assert.strictEqual(result.breakdown.visa, 5);
  assert.ok(result.reasons.some((r) => r.toLowerCase().includes('visa') || r.toLowerCase().includes('sponsorship')));
});

// -------------------------------------------------------------
// Test H: Visa sponsorship unknown -> No false positive + neutral score + warning
// -------------------------------------------------------------
test('Test H: Unspecified visa policy gives neutral score (2) and informative warning without false claim', () => {
  const job = createMockJob({
    description: 'Product manager position building fintech applications in Bengaluru.',
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    visaPreference: 'Sponsorship required',
  };

  const result = scoreJobMatch(job, prefs);
  assert.strictEqual(result.breakdown.visa, 2);
  assert.ok(result.warnings.some((w) => w.toLowerCase().includes('visa') || w.toLowerCase().includes('sponsorship')));
});

// -------------------------------------------------------------
// Test I: Empty keywords -> Scorer still works and awards full keyword points
// -------------------------------------------------------------
test('Test I: Empty keyword list behaves neutrally and awards full 20 keyword points', () => {
  const job = createMockJob();
  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    keywords: [],
  };

  const result = scoreJobMatch(job, prefs);
  assert.strictEqual(result.breakdown.keywords, 20);
  assert.ok(result.score > 0);
});

// -------------------------------------------------------------
// Test J: Missing optional job fields -> Scorer does not crash
// -------------------------------------------------------------
test('Test J: Sparse job record with null optional fields scores gracefully without crashing', () => {
  const sparseJob: JobListing = {
    id: 'sparse_1',
    title: 'Product Manager',
    company: 'Startup',
    location: '',
    country: null,
    employmentType: null,
    seniority: null,
    workMode: null,
    description: '',
    requirements: [],
    keywords: [],
    source: 'search',
    sourceUrl: 'https://example.com/sparse',
    applyUrl: 'https://example.com/sparse',
    checkedAt: '',
    provenance: [],
  };

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
    seniority: 'Senior',
    workMode: 'Remote',
  };

  const result = scoreJobMatch(sparseJob, prefs);
  assert.strictEqual(typeof result.score, 'number');
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.ok(result.warnings.length > 0);
});

// -------------------------------------------------------------
// Test K: Fresh vs older checkedAt -> Freshness scoring behaves deterministically
// -------------------------------------------------------------
test('Test K: Freshly verified job (checked 10m ago) scores higher than 2-week-old job', () => {
  const freshJob = createMockJob({
    checkedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
  });

  const oldJob = createMockJob({
    checkedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
  });

  const prefs: UserPreferences = {
    role: 'Product Manager',
    location: 'India',
  };

  const freshResult = scoreJobMatch(freshJob, prefs);
  const oldResult = scoreJobMatch(oldJob, prefs);

  assert.strictEqual(freshResult.breakdown.freshness, 5);
  assert.strictEqual(oldResult.breakdown.freshness, 1);
  assert.ok(freshResult.score > oldResult.score);
});

// -------------------------------------------------------------
// Test L: Clearly unrelated role -> Ineligible via hard filter
// -------------------------------------------------------------
test('Test L: Clearly unrelated role (e.g. Software Engineer vs Product Manager) is marked ineligible', () => {
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
