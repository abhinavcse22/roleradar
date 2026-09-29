# RoleRadar 🎯

> **"Tell me what kind of job you're looking for. RoleRadar searches live career pages, verifies real openings, removes duplicates, and explains why each job matches you."**

RoleRadar is a live job and internship discovery application built for the **TinyFish Technical Student Bounty Drop 001 — Job Portal / Careers Finder**. It replaces stale, generic aggregator boards with live, verified career discovery powered directly by TinyFish's tripartite web infrastructure: **Search**, **Fetch**, and **Agent**.

---

## 1. The Problem

Modern job searching suffers from three pervasive issues:
1. **Aggregator Decay & "Ghost Jobs"**: Major job portals index postings and leave them active weeks or months after positions are closed or filled.
2. **Duplicate Clutter**: A single opening at an employer gets syndicated across LinkedIn, Indeed, Glassdoor, and third-party scrapers, forcing candidates to sift through identical listings with broken referral links.
3. **Black-Box Matching**: Job seekers are presented with arbitrary "Match %" figures generated without explanation, leaving them unclear about whether visa sponsorship is supported, whether seniority requirements match their background, or why a role was flagged.

RoleRadar solves this by pulling directly from live company careers pages and modern ATS portals (Ashby, Greenhouse, Lever, Workday) in real-time, verifying page contents, deduplicating across sources, and presenting clear, explainable match score breakdowns.

---

---

## 2. End-to-End Pipeline

Search discovers live sources. Fetch reads straightforward direct job postings. Agent handles dynamic career hubs and browser interaction. All results flow through one normalization, deduplication, and deterministic ranking layer.

```
Search
  ↓
Classify
  ├── Direct job → Fetch
  └── Career hub → Agent
  ↓
Normalize
  ↓
Deduplicate
  ↓
Match
  ↓
Filter
  ↓
Rank
```

### Discovery & Processing Stages

1. **Search**: Targeted multi-query discovery across live ATS subdomains (Ashby, Greenhouse, Lever) and native company careers pages.
2. **Classify**: Deterministic URL routing distinguishing direct job postings from career hub portals.
3. **Fetch**: Full-browser reading of direct job posting pages into clean, token-efficient markdown.
4. **Agent**: Autonomous browser navigation, interaction, and structured JSON extraction on dynamic career hubs.
5. **Normalize**: Universal transformation of all incoming records into the canonical `JobListing` schema.
6. **Deduplicate**: Canonical multi-signal deduplication merging duplicates across discovery vectors into authoritative records with audit provenance.
7. **Match & Filter**: 100-point deterministic scoring against user preferences, filtering out ineligible listings.
8. **Rank**: Deterministic ranking by match score, role alignment, and verification recency.

---

## Asynchronous Agent Architecture

### Overview
In production job discovery, interactive browser workflows and dynamic career hubs (e.g. Lever, Ashby, Greenhouse company portals) may take substantially longer (60–180+ seconds) than simple HTTP search or fetch requests. RoleRadar decouples immediate discovery from deep browser automation using an **asynchronous Agent architecture**:

1. **Search and Fetch provide the initial result set**: When a candidate initiates a search, TinyFish Search and TinyFish Fetch execute synchronously, returning verified direct job postings within 2–5 seconds.
2. **Dynamic Career Hubs are submitted to TinyFish Agent asynchronously**: High-relevance candidate career hubs are submitted in parallel via `POST https://agent.tinyfish.ai/v1/automation/run-async`, returning unique `runId` descriptors without blocking the initial HTTP response.
3. **The browser polls run status**: The frontend receives initial jobs and begins polling `GET /api/jobs/agent-status?runId=<id>` (which queries `GET https://agent.tinyfish.ai/v1/runs/{id}`) at a 5-second interval. An honest Agent status banner displays real-time progress (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`).
4. **Completed Agent results merge smoothly**: As each Agent run completes, its structured positions are normalized, deduplicated with existing jobs (merging provenance and preserving highest-authority fields), rescored against user preferences, and reranked deterministically. Results update live in the UI without a page refresh.
5. **Safe In-Flight Cancellation**: Starting a new search or clearing preferences automatically cancels pending Agent tasks via `POST /api/jobs/agent-cancel` (which triggers `POST https://agent.tinyfish.ai/v1/runs/{id}/cancel`).

### Pipeline Progression Diagram
```
Search
 ↓
Fetch
 ↓
Initial results
 ↓
Async Agent runs
 ↓
Agent status polling
 ↓
Merge
 ↓
Deduplicate
 ↓
Rescore
 ↓
Rerank
```

### Why Agent is Asynchronous
Interactive browser workflows may take substantially longer than simple Search/Fetch requests. Direct job postings can be scraped and markdown-extracted in milliseconds, but navigating client-rendered Single-Page Applications (SPAs), interacting with filter forms, and extracting open positions from dynamic career portals requires autonomous multi-step browser sessions. Making Agent execution asynchronous ensures candidates receive immediate, actionable results without waiting, while deep autonomous navigation continues enriching their feed in the background.

---

## 3. Architecture

RoleRadar is built on a modern, high-performance, and minimal tech stack:

- **Framework**: Next.js 16 (App Router, Server-Sent Events, Route Handlers)
- **Language**: TypeScript 5 (Strict Mode)
- **Styling**: Tailwind CSS v4 (Clean, modern typography, zero bloat)
- **Icons**: Lucide React
- **Backend Orchestrator**: Server-side SSE route (`/api/discover`) streaming pipeline events to the client.
- **Web Layer**: TinyFish official REST API endpoints:
  - `GET https://api.search.tinyfish.ai`
  - `POST https://api.fetch.tinyfish.ai`
  - `POST https://agent.tinyfish.ai/v1/automation/run` (or `/run-sse`)

```
roleradar/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── discover/
│   │   │       └── route.ts         # SSE streaming discovery endpoint
│   │   ├── layout.tsx               # Root layout & typography
│   │   ├── page.tsx                 # Main screen & interactive feed
│   │   └── globals.css              # Theme styling
│   ├── components/
│   │   ├── PreferenceForm.tsx       # User criteria form
│   │   ├── PipelineTracker.tsx      # Real-time TinyFish pipeline visualizer
│   │   ├── JobCard.tsx              # Job card with explainable match badges
│   │   └── FilterSortBar.tsx        # In-memory instant filtering & sorting
│   └── lib/
│       ├── tinyfish/
│       │   ├── search.ts            # TinyFish Search discovery client
│       │   ├── fetch.ts             # TinyFish Fetch page reader client
│       │   ├── agent.ts             # TinyFish Agent structured automation client
│       │   └── types.ts             # Core data contracts & schemas
│       ├── matching/
│       │   └── scoring.ts           # Multi-dimensional explainable matching
│       ├── dedup/
│       │   └── deduplicate.ts       # Canonical hashing and multi-source merge
│       └── normalize/
│           └── jobNormalizer.ts     # Schema normalization & parsing
├── .env.example                     # Environment template
├── AGENTS.md                        # AI coding assistant guidelines
└── README.md                        # Documentation
```

---

## 4. TinyFish Search Usage

- **Endpoint**: `GET https://api.search.tinyfish.ai`
- **Headers**: `X-API-Key: $TINYFISH_API_KEY`
- **Purpose**: High-velocity discovery of fresh, live job opportunities and career hubs.
- **Query Strategy**: Rather than one generic search, RoleRadar generates targeted query matrices:
  - `"{role}" "{location}" {keywords} site:jobs.ashbyhq.com`
  - `"{role}" "{location}" {keywords} site:boards.greenhouse.io`
  - `"{role}" "{location}" {keywords} site:jobs.lever.co`
  - `"{role}" "{location}" careers open positions`
- **Output**: Ranked array of live URLs, domain sources, page titles, and real snippets.

---

## 5. TinyFish Fetch Usage

- **Endpoint**: `POST https://api.fetch.tinyfish.ai`
- **Headers**: `X-API-Key: $TINYFISH_API_KEY`, `Content-Type: application/json`
- **Body**: `{ "urls": [...], "format": "markdown" }`
- **Purpose**: Full-browser execution that converts candidate job pages into clean, token-efficient markdown.
- **What it accomplishes**:
  - Strips ads, cookie banners, navigation menus, and scripts.
  - Verifies whether the job posting is active or expired ("This job has expired", "No longer accepting applications").
  - Extracts raw job description, requirements list, responsibilities, compensation, and visa sponsorship statements.

---

## 6. TinyFish Agent Usage

- **Endpoint**: `POST https://agent.tinyfish.ai/v1/automation/run` (or `/run-sse`)
- **Headers**: `X-API-Key: $TINYFISH_API_KEY`, `Content-Type: application/json`
- **Purpose**: Deep interaction and structured extraction for complex, dynamic career hubs.
- **When it triggers**:
  - TinyFish Agent is **not** wasted on static pages. It is selectively dispatched to dynamic career search portals (such as company-specific interactive job boards or multi-step career search forms) that require client-side interaction, search filtering, or pagination.
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

## 7. Matching and Ranking

RoleRadar strictly rejects "black-box LLM percentages". Instead, every match score (0–100) is calculated deterministically across explicit, traceable dimensions with human-readable evidence.

### 100-Point Deterministic Model

| Dimension | Points | Description & Criteria |
|---|:---:|---|
| **Role Match** | 30 | Normalized token overlap against job title. Exact matches receive 30 pts; subset alignments (e.g. "Product Manager" in "Product Manager, Growth") receive 28 pts; related roles receive 20 pts. |
| **Location Match** | 20 | Geographic matching of city and country. Explicit Remote roles receive full points for region-compatible candidates. Neutral points (8 pts) if location is undisclosed. |
| **Keywords Match** | 20 | Proportional scoring of requested skills and domain tags against title, description, and requirements. Zero requested keywords awards full neutral points. |
| **Seniority Match** | 10 | Compares preferred level (Intern, Junior, Mid, Senior, Lead, Executive) against detected job requirements and experience years. |
| **Work Mode Match** | 10 | Matches Remote, Hybrid, and On-site policies. Incompatible policies receive reduced points and explanatory warnings. |
| **Visa Sponsorship** | 5 | Awards 5 pts for confirmed sponsorship or when not required; 2 pts (neutral) with warning when unspecified; 0 pts if explicitly restricted. |
| **Freshness** | 5 | Verification recency: verified within 1h (5 pts), 24h (4 pts), 3 days (3 pts), 7 days (2 pts), or older (1 pt). |

### Hard Filters (`eligible: false`)
A job is flagged as ineligible if any of the following critical mismatches occur:
1. **Unrelated Role**: Role token overlap is below 0.3 (e.g. *Software Engineer* when *Product Manager* was requested).
2. **Explicit Location Incompatibility**: The position is strictly on-site/in-office in an incompatible geographic region (e.g. *London, UK* when *India* was requested).
3. **Closed or Expired Postings**: The page content contains closed indicators (e.g. *"no longer accepting applications"*, *"job has expired"*).

*Note: Seniority gaps, missing keywords, and unspecified visa policies affect the score and trigger warnings, but do not make a job ineligible.*

### Unknown Data Handling
- **Missing Location**: Scored neutrally (8/20) with warning *"Location not specified in posting"*.
- **Missing Work Mode**: Scored neutrally (5/10) with warning *"Work mode not specified in listing"*.
- **Missing Visa Policy**: Scored neutrally (2/5) with warning *"Visa sponsorship not specified in listing"*.
- **Empty Keywords**: Scored neutrally (20/20) with reason *"No specific keywords required"*.

### Explainable Evidence Tags
- `✓ Exact role match for "Product Manager"`
- `✓ Location matches "Bengaluru, India"`
- `✓ Keywords matched: AI, SaaS`
- `⚠ Job requests 3–7 years of experience (Senior)`
- `⚠ Visa sponsorship not specified in listing`

---

## 8. Job Normalization and Deduplication

Search, Fetch, and Agent can discover the same opening through different URLs or representations. RoleRadar therefore converts all source records into one canonical `JobListing` model and deterministically deduplicates them using normalized URLs and company/title/location fingerprints.

### Canonical Multi-Signal Deduplication
1. **Normalized Canonical URL**: Strips tracking parameters (`utm_*`, `gh_src`, `ref`, `fbclid`), trailing slashes, and anchor hashes while preserving meaningful route IDs.
2. **Company Fingerprinting**: Normalizes corporate designations (`Inc`, `LLC`, `Pvt Ltd`, `Corp`) and casing (`"Sarvam AI, Inc."` &rarr; `"sarvam ai"`).
3. **Exact Title Alignment**: Strict title matching distinguishes distinct levels (`Product Manager` vs `Senior Product Manager`).
4. **Location Compatibility**: Geographic comparison prevents merging disparate office locations (`Bengaluru` vs `London`).

### Deterministic Merging
When multiple records represent the same role (e.g. Search snippet + Fetch page content + Agent structured data), RoleRadar combines them without data loss:
- **Title & Company**: Authoritative representation preserved.
- **Description**: Longest, most informative markdown text retained.
- **Requirements & Keywords**: Union set of all unique requirements and detected skills.
- **Apply URL**: Prefers authentic, direct ATS endpoints (`ashbyhq.com`, `greenhouse.io`, `/application`).
- **Provenance**: Records the entire discovery history across all contributing pipeline stages.

---

## 9. Setup & Installation

### Prerequisites
- Node.js 18+ (tested on Node v25)
- npm 9+
- A TinyFish API Key from [agent.tinyfish.ai/api-keys](https://agent.tinyfish.ai/api-keys)

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/roleradar.git
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

## 10. Environment Variables

| Variable | Description | Required | Default |
|---|---|---|---|
| `TINYFISH_API_KEY` | Your official TinyFish API key | Yes | None |
| `PORT` | Local server port | No | `3000` |

*Security Note: `TINYFISH_API_KEY` is strictly accessed server-side. It is never prefixed with `NEXT_PUBLIC_` and is never bundled in client code.*

---

## 11. Limitations

- **Rate Limits**: TinyFish Search and Fetch have generous per-minute limits, while Agent requests are metered. RoleRadar implements concurrency pacing to stay within account limits.
- **Bot Defense on Legacy Portals**: While TinyFish handles standard bot mitigation, portals requiring mandatory multi-factor authentication or reCAPTCHA v3 enterprise checkboxes may require custom session persistence.
- **ATS Custom Fields**: Some non-standard ATS deployments embed application questions within iframe wrappers that require deeper Agent exploration.

---

## 12. How This Satisfies the Bounty

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
