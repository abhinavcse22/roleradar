# RoleRadar 🎯

> **"Tell me what kind of job you're looking for. RoleRadar searches live career pages, verifies real openings, removes duplicates, and explains why each job matches you."**

**Live Demo**: [https://roleradar-iota.vercel.app](https://roleradar-iota.vercel.app)  
**GitHub Repository**: [https://github.com/abhinavcse22/roleradar](https://github.com/abhinavcse22/roleradar)

RoleRadar is a live job and internship discovery application built for the **TinyFish Technical Student Bounty Drop 001 — Job Portal / Careers Finder**. It replaces stale, generic aggregator boards with live, verified career discovery powered directly by TinyFish's tripartite web infrastructure: **Search**, **Fetch**, and **Agent**.

---

## Problem

Modern job searching suffers from three pervasive issues:
1. **Aggregator Decay & "Ghost Jobs"**: Major job portals index postings and leave them active weeks or months after positions are closed or filled.
2. **Duplicate Clutter**: A single opening at an employer gets syndicated across LinkedIn, Indeed, Glassdoor, and third-party scrapers, forcing candidates to sift through identical listings with broken referral links.
3. **Black-Box Matching**: Job seekers are presented with arbitrary "Match %" figures generated without explanation, leaving them unclear about whether visa sponsorship is supported, whether seniority requirements match their background, or why a role was flagged.

RoleRadar solves this by pulling directly from live company careers pages and modern ATS portals (Ashby, Greenhouse, Lever, Workday) in real time, verifying page contents, deduplicating across sources, and presenting clear, explainable match score breakdowns.

---

## Product

RoleRadar provides a clean, intentional discovery experience for candidates:

- **Customizable Candidate Preferences**:
  - **Target Role** (Required): e.g. `Product Manager`, `Software Engineer`, `Marketing Manager`.
  - **Target Location** (Required): e.g. `India`, `Bengaluru`, `Remote`, `United States`.
  - **Keywords** (Optional): Comma-separated domain keywords, skills, or technologies (e.g. `AI`, `Python`, `SaaS`).
  - **Seniority** (Optional): `Any`, `Entry`, `Mid`, `Senior`, `Lead`, `Executive`.
  - **Work Mode** (Optional): `Any`, `Remote`, `Hybrid`, `On-site`.
  - **Visa Preference** (Optional): `Any`, `Sponsorship required`, `No sponsorship required`.
- **Live Discovery Feed**: Displays verified jobs with direct apply links, source provenance badges (`Discovered via Search • Verified via Fetch`), and live verification timestamps (`Verified 45s ago`).
- **Instant Client-Side Filtering**: Refine visible results by match tier (90%+, 75%+, 60%+), work mode, or seniority instantly without re-fetching.
- **Explainable Match Modal**: View clear breakdown scores across 7 dimensions along with transparent `✓` match reasons and `⚠` warnings.

---

## Architecture

RoleRadar is built on Next.js 16 (App Router), TypeScript 5 (Strict Mode), and Tailwind CSS v4, with zero external database dependencies. State is streamed in real time to the browser via an asynchronous architecture.

### End-to-End Pipeline

```
Search (5 targeted vectors)
  ↓
Classify
  ├── Direct job → TinyFish Fetch (markdown extraction & active check)
  └── Career hub → TinyFish Agent (autonomous browser navigation)
  ↓
Normalize (Canonical JobListing schema)
  ↓
Deduplicate (Multi-signal canonical URL & company/title fingerprinting)
  ↓
Match & Filter (100-point deterministic scoring with hard eligibility filters)
  ↓
Deterministic Rank (Score, role alignment, keyword coverage, freshness)
```

```
roleradar/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── jobs/
│   │   │   │   ├── search/start/route.ts  # Initiates Search/Fetch & dispatches async Agent
│   │   │   │   ├── search/route.ts        # Synchronous search pipeline route
│   │   │   │   ├── agent-status/route.ts  # Polls TinyFish Agent status by runId
│   │   │   │   └── agent-cancel/route.ts  # Cancels in-flight Agent tasks
│   │   │   ├── tinyfish/                  # Direct test wrappers for TinyFish endpoints
│   │   │   └── health/route.ts            # Server health & API key verification
│   │   ├── dev/tinyfish/page.tsx          # Interactive developer sandbox
│   │   ├── layout.tsx                     # Root layout & theme configuration
│   │   └── page.tsx                       # Main product interface & live feed
│   ├── components/
│   │   ├── SearchForm.tsx                 # Preference inputs with quick filters
│   │   ├── JobCard.tsx                    # Detailed job card with match badges
│   │   ├── AgentStatusBanner.tsx          # Real-time background task progress
│   │   └── PipelineSummary.tsx            # Transparent 5-stage telemetry panel
│   └── lib/
│       ├── tinyfish/                      # Official TinyFish Search, Fetch, Agent clients
│       ├── jobs/                          # Normalization and deduplication engines
│       ├── matching/                      # Deterministic explainable scoring engine
│       └── pipeline/                      # Search orchestrator, classifier, hub diversity
├── tests/                                 # 104 automated tests covering all features
├── AGENTS.md                              # Core guidelines and engineering rules
├── DEMO.md                                # 60–90 second evaluation walkthrough
├── SUBMISSION.md                          # Official bounty submission report
└── README.md                              # Complete product documentation
```

---

## Search

- **Endpoint**: `GET https://api.search.tinyfish.ai`
- **Headers**: `X-API-Key: $TINYFISH_API_KEY`
- **Purpose**: High-velocity discovery of fresh, live job opportunities and career portals.
- **Query Strategy**: Rather than one generic search query, RoleRadar dynamically generates 5 targeted search vectors based on user criteria:
  1. `"{role}" "{location}" {keywords} site:jobs.ashbyhq.com`
  2. `"{role}" "{location}" {keywords} site:boards.greenhouse.io`
  3. `"{role}" "{location}" {keywords} site:jobs.lever.co`
  4. `"{role}" "{location}" {keywords} ("join our team" OR "work with us" OR "careers")`
  5. `"{role}" "{location}" {keywords} "open positions"`
- **Output**: Ranked array of live URLs, domain sources, page titles, and real snippets.

---

## Fetch

- **Endpoint**: `POST https://api.fetch.tinyfish.ai`
- **Headers**: `X-API-Key: $TINYFISH_API_KEY`, `Content-Type: application/json`
- **Body**: `{ "urls": [...], "format": "markdown" }`
- **Purpose**: Full-browser execution that converts candidate job pages into clean, token-efficient markdown.
- **What it accomplishes**:
  - Strips ads, cookie banners, navigation menus, and scripts.
  - Verifies whether the job posting is active or expired (*"This job has expired"*, *"No longer accepting applications"*).
  - Extracts raw job description, requirements list, responsibilities, compensation, and visa sponsorship statements.
  - Extracts authoritative direct apply URLs.

---

## Agent

- **Endpoint**: `POST https://agent.tinyfish.ai/v1/automation/run-async` (or `/run`)
- **Headers**: `X-API-Key: $TINYFISH_API_KEY`, `Content-Type: application/json`
- **Purpose**: Deep autonomous interaction and structured extraction for complex, dynamic career hubs.
- **When it triggers**:
  - TinyFish Agent is **not** wasted on static pages. It is selectively dispatched to dynamic career portals (such as company-specific interactive job boards or multi-step career search forms) that require client-side interaction, search filtering, or pagination.
- **Goal Definition**: Natural language instruction:
  - `"Find open ${seniority} ${role} positions in ${location}. Extract the exact job title, location, employment type, requirements, and direct application URL."`
- **Strict Output Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "jobs": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "title": { "type": "string" },
            "company": { "type": "string" },
            "location": { "type": "string" },
            "employmentType": { "type": "string" },
            "workMode": { "type": "string" },
            "requirements": { "type": "array", "items": { "type": "string" } },
            "applyUrl": { "type": "string" }
          },
          "required": ["title", "location", "applyUrl"]
        }
      }
    },
    "required": ["jobs"]
  }
  ```

---

## Normalization and Deduplication

Search, Fetch, and Agent can discover the same opening through different URLs or representations. RoleRadar converts all source records into one canonical `JobListing` model and deterministically deduplicates them using normalized URLs and company/title/location fingerprints.

### Canonical Multi-Signal Deduplication
1. **Normalized Canonical URL**: Strips tracking parameters (`utm_*`, `gh_src`, `ref`, `fbclid`), trailing slashes, and anchor hashes while preserving meaningful route IDs.
2. **Company Fingerprinting**: Normalizes corporate designations (`Inc`, `LLC`, `Pvt Ltd`, `Corp`) and casing (`"Sarvam AI, Inc."` &rarr; `"sarvam ai"`).
3. **Exact Title Alignment**: Strict title matching distinguishes distinct levels (`Product Manager` vs `Senior Product Manager`).
4. **Location Compatibility**: Geographic comparison prevents merging disparate office locations (`Bengaluru` vs `London`).

### Deterministic Merging
When multiple records represent the same role (e.g. Search snippet + Fetch page content + Agent structured data), RoleRadar combines them without data loss:
- **Title & Company**: Authoritative representation preserved.
- **Description**: Longest, most informative markdown text retained (with raw markdown headers stripped).
- **Requirements & Keywords**: Union set of all unique requirements and detected skills.
- **Apply URL**: Prefers authentic, direct ATS endpoints (`ashbyhq.com`, `greenhouse.io`, `/apply`).
- **Provenance**: Records the entire discovery history across all contributing pipeline stages.

---

## Matching and Ranking

RoleRadar strictly rejects "black-box LLM percentages". Instead, every match score (0–100) is calculated deterministically across explicit, traceable dimensions with human-readable evidence.

### Neutral Dimensions & Dynamic Denominator Normalization
Unspecified preferences are neutral and do not contribute points. The final percentage is normalized across the preferences the user actually specified, preventing broad searches with many 'Any' fields from producing artificially inflated scores.

- **Formula**:
  $$\text{Score} = \min\left(100, \max\left(0, \text{round}\left(\frac{\sum \text{Earned Points on Applicable Dimensions}}{\sum \text{Maximum Points of Applicable Dimensions}} \times 100\right)\right)\right)$$
  For example, with `Role: PM`, `Location: India`, `Keywords: AI`, and all other preferences set to `Any`, the applicable maximum is $30 + 20 + 20 + 5 = 75$. If a job earns $30 + 20 + 15 + 5 = 70$, its displayed normalized score is $\text{round}(70 / 75 \times 100) = 93\%$.

### Dimension Weights
- **Role Fit (30 pts)**: Exact match (30), seniority-variant match (23), specialized variant (27), adjacent role (14), partial word match (8).
- **Location Fit (20 pts)**: Exact city match (20), country match (20 if country requested, 15 if specific city requested), remote match (20 if remote requested, 14 if country requested), undisclosed location (6).
- **Keyword Coverage (20 pts)**: Proportional match across all requested skills and tools.
- **Seniority (10 pts)**: Exact match (10), 1-level variance (5), 2+ level variance (0). Neutral (0 pts, excluded from denominator) if `Any`.
- **Work Mode (10 pts)**: Exact match (10), remote vs hybrid variance (5). Neutral if `Any`.
- **Visa Sponsorship (5 pts)**: Confirmed sponsorship (5), unknown (2), incompatible (0). Neutral if `Any`.
- **Freshness (5 pts)**: Verified < 2 hours (5), < 24 hours (4), < 7 days (3), older (1).

### Hard Eligibility Filters
A job is marked `eligible: false` and excluded if:
1. Role alignment is zero or below threshold.
2. Explicit location incompatibility (e.g. *London, UK* when *India* was requested).
3. Closed or expired postings.

---

## Async Agent Architecture

In production job discovery, interactive browser workflows and dynamic career hubs (e.g. Lever, Ashby, Greenhouse company portals) may take substantially longer (60–180+ seconds) than simple HTTP search or fetch requests. RoleRadar decouples immediate discovery from deep browser automation using an **asynchronous Agent architecture**:

1. **Search and Fetch provide the initial result set**: When a candidate initiates a search, TinyFish Search and TinyFish Fetch execute synchronously, returning verified direct job postings within 2–4 seconds.
2. **Dynamic Career Hubs are submitted to TinyFish Agent asynchronously**: High-relevance candidate career hubs are submitted in parallel via `POST https://agent.tinyfish.ai/v1/automation/run-async`, returning unique `runId` descriptors without blocking the initial HTTP response.
3. **The browser polls run status**: The frontend receives initial jobs and begins polling `GET /api/jobs/agent-status?runId=<id>` (which queries `GET https://agent.tinyfish.ai/v1/runs/{id}`) at a 5-second interval. An honest Agent status banner displays real-time progress (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`).
4. **Completed Agent results merge smoothly**: As each Agent run completes, its structured positions are normalized, deduplicated with existing jobs (merging provenance and preserving highest-authority fields), rescored against user preferences, and reranked deterministically. Results update live in the UI without a page refresh.
5. **Safe In-Flight Cancellation**: Starting a new search or clearing preferences automatically cancels pending Agent tasks via `POST /api/jobs/agent-cancel` (which triggers `POST https://agent.tinyfish.ai/v1/runs/{id}/cancel`).

---

## Agent Candidate Selection & Hub Diversity

TinyFish Agent is a high-capability, autonomous browser navigator. To maximize discovery efficiency, prevent duplicate work, and ensure broad coverage across different employers, RoleRadar enforces strict diversity and candidate deduplication rules before dispatching Agent runs:

1. **Career Hub Identification**: Discovered URLs are classified by deterministic routing rules. Single job postings (e.g. `jobs.ashbyhq.com/sarvam/<uuid>`) route directly to TinyFish Fetch, while company career portals and ATS hubs (e.g. `jobs.lever.co/gohighlevel`, `jobs.ashbyhq.com/sarvam`) route to Agent evaluation.
2. **Canonical Hub Identity Normalization (`normalizeCareerHubIdentity`)**: Search queries frequently return multiple URLs for the same company career portal differing only by trailing slashes, protocol, or query parameters:
   - `https://jobs.lever.co/gohighlevel`
   - `http://jobs.lever.co/gohighlevel/`
   - `https://jobs.lever.co/gohighlevel?department=Product&team=Core`
   All of these resolve to the single canonical entity key: `lever:gohighlevel`. Similarly, Greenhouse (`boards.greenhouse.io/{slug}` or `?for={slug}`), Ashby (`jobs.ashbyhq.com/{slug}`), Workday (`{company}.myworkdayjobs.com`), and company native career sites (`careers.sarvam.ai`, `sarvam.ai/careers`) resolve to canonical keys like `ashby:sarvam` or `company:sarvam.ai`.
3. **Representative Candidate Grouping (`groupCareerHubs`)**: All discovered hub candidates are grouped by their normalized hub identity. For each unique company/portal, RoleRadar computes a multi-signal relevance score (matching role, location, keywords, and ATS type) and selects the single highest-scoring representative candidate (preferring the clean base URL in case of score ties).
4. **Guaranteed Employer Diversity (Max 2 Distinct Hubs)**: RoleRadar dispatches at most **2 distinct career hubs** to TinyFish Agent concurrently, guaranteeing that each run explores a different company or portal. Under no circumstances can a single company occupy both Agent slots.
5. **Truthful Candidate Telemetry**: The telemetry panel preserves full discovery provenance by displaying both raw discovered candidates (`stats.careerHubCandidates`) and the deduplicated entity count (`stats.uniqueCareerHubs`), e.g. `8 discovered · 7 unique hubs`.

---

## Pipeline Telemetry

RoleRadar provides an honest, transparent breakdown of exactly what happened during discovery:

| Metric | Meaning | Source |
|---|---|---|
| `searchResults` | Total raw search results returned across all 5 query vectors | TinyFish Search |
| `searchQueries` | Total search query vectors generated & executed (5) | Pipeline generator |
| `directJobCandidates` | Discovered URLs classified as direct job postings | Classifier (`directJob`) |
| `careerHubCandidates` | Raw discovered URLs classified as company career hubs | Classifier (`careerHub`) |
| `uniqueCareerHubs` | Distinct company portals after canonical hub identity grouping | `groupCareerHubs` |
| `fetchAttempted` | Direct job pages dispatched to TinyFish Fetch (capped at 6) | Fetch queue |
| `fetchedPages` | Direct job pages successfully fetched and verified | Fetch responses |
| `agentRunsStarted` | Asynchronous Agent tasks submitted to TinyFish | Agent async runner |
| `agentRunsCompleted` | Agent runs that finished successfully with valid extraction | Agent polling |
| `agentFailures` | Agent runs that timed out, encountered errors, or failed | Agent polling |
| `agentJobsExtracted` | Total valid job records extracted by completed Agent runs | Agent extraction |
| `normalizedJobs` | Canonical JobListing records produced before deduplication | Normalizer |
| `uniqueJobs` | Authoritative jobs remaining after multi-signal deduplication | Deduplicator |
| `eligibleJobs` | Unique jobs that passed hard preference filters | Matcher (`eligible: true`) |
| `filteredJobs` | Unique jobs rejected by hard preference filters (`unique - eligible`) | Matcher (`eligible: false`) |
| `failedSources` | Network source timeouts or unavailable URLs handled gracefully | Error handler |

---

## Setup & Installation

### Prerequisites
- Node.js 18+ (tested on Node v25)
- npm 9+
- A TinyFish API Key from [agent.tinyfish.ai/api-keys](https://agent.tinyfish.ai/api-keys)

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/abhinavcse22/roleradar.git
   cd roleradar
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env.local
   ```
   Add your TinyFish API key to `.env.local`:
   ```bash
   TINYFISH_API_KEY=your_actual_key_here
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Build for production:**
   ```bash
   npm run build
   npm run start
   ```

---

## Environment Variables

| Variable | Description | Required | Default |
|---|---|---|---|
| `TINYFISH_API_KEY` | Your official TinyFish API key | Yes | None |
| `PORT` | Local server port | No | `3000` |

*Security Note: `TINYFISH_API_KEY` is strictly accessed server-side. It is never prefixed with `NEXT_PUBLIC_` and is never bundled in client code.*

---

## Testing

RoleRadar includes an extensive automated test suite covering all pipeline, matching, deduplication, telemetry, and UX components:

```bash
# Run all unit and integration tests (104 tests)
npm test

# Run ESLint check
npm run lint

# Run production build and type checking
npm run build
```

### Test Suite Structure
- `tests/hub_diversity.test.ts` (14 tests): Hub identity normalization, portal candidate grouping, diversity constraints, and formatted display names.
- `tests/telemetry.test.ts` (12 tests): Telemetry accuracy, distinct started vs completed counts, server state isolation.
- `tests/ux_components.test.ts` (13 tests): Job card rendering, provenance labels, time-ago formatting, markdown cleaning.
- `tests/matching.test.ts` (19 tests): 100-point scoring, neutral dimension handling, dynamic denominator normalization, hard filters.
- `tests/data_quality.test.ts` (7 tests): Heading stripping, structured location isolation, requirement bullets extraction.
- `tests/async_agent.test.ts` (10 tests): Async start/status/cancel route lifecycle and state transitions.
- `tests/agent_execution.test.ts` (7 tests): Agent schema enforcement, SSE streaming parsing, structured extraction.
- `tests/pipeline.test.ts` (11 tests): End-to-end classification, error isolation, sorting, query generation.
- `tests/jobs.test.ts` (10 tests): Deduplication, canonical URL parsing, multi-source provenance merging.
- `tests/integration_shapes.test.ts` (1 test): Real TinyFish API response shapes normalization.

---

## Bounty Qualification

RoleRadar directly satisfies every requirement of the **TinyFish Technical Student Bounty Drop 001 — Job Portal / Careers Finder**:

1. **All 3 TinyFish Endpoints Meaningfully Used**:
   - **Search**: Multi-query ATS and company careers discovery engine.
   - **Fetch**: Full-browser reader that extracts clean markdown from direct job postings.
   - **Agent**: Interactive workflow executor for dynamic, client-rendered career portals with structured JSON output schema.
2. **Live Web Data, Zero Hardcoded Listings**:
   - Every listing is discovered live from real career pages.
   - Timestamps show exact verification recency (`Verified 45s ago`).
3. **Multi-Source Discovery Across ATS Ecosystems**:
   - Discovers openings across Ashby, Greenhouse, Lever, Workday, and native company websites.
4. **Canonical Deduplication**:
   - Eliminates redundant listings across search results, aggregators, and primary career pages.
5. **Explainable Match Scoring**:
   - Replaces opaque AI percentages with transparent, verifiable criterion badges.
6. **Real Direct Apply Links**:
   - Candidates are linked directly to authentic employer job boards, never spam redirects.
7. **Production-Ready Next.js & TypeScript Architecture**:
   - Server-side API key protection, real-time SSE streaming pipeline tracker, responsive design, and strict type safety.
