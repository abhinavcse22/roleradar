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

## 2. Product Workflow

RoleRadar operates as a coordinated 6-stage discovery pipeline:

```
                  ┌───────────────────────────────┐
                  │       USER PREFERENCES        │
                  │  Role • Location • Seniority  │
                  │  Keywords • WorkMode • Visa   │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                     [ Stage 1: TinyFish Search ]
                Targeted discovery queries across live
                 ATS portals (Ashby, Greenhouse, Lever)
                  and live company careers destinations
                                  │
                   ┌──────────────┴──────────────┐
                   │                             │
                   ▼                             ▼
       Direct Job URLs Discovered     Dynamic Career Portals
                   │                             │
                   ▼                             ▼
      [ Stage 2: TinyFish Fetch ]   [ Stage 3: TinyFish Agent ]
       Full-browser clean markdown    Autonomous navigation,
       extraction from actual job      filtering & structured
       postings (strips web junk)      extraction with JSON schema
                   │                             │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                      [ Stage 4: Deduplication ]
                   Canonical URL & title normalization;
                     multi-source deduplication merge
                                  │
                                  ▼
                   [ Stage 5: Explainable Match ]
                  Role fit • Location & remote policy •
                 Keywords • Seniority • Visa sponsorship
                                  │
                                  ▼
                 [ Stage 6: Ranked Verified Feed ]
                   Real-time SSE streamed to client
```

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

## 7. Matching Logic

RoleRadar avoids "black-box LLM percentages". Instead, every match score (0–100%) is generated deterministically across multiple transparent dimensions:

| Dimension | Weight | Criteria |
|---|---|---|
| **Role Fit** | 30% | Title and department similarity against user desired role |
| **Location & Work Mode** | 25% | Geo-match, remote vs hybrid vs on-site alignment |
| **Keywords & Skills** | 20% | Mentions of desired frameworks, tech stacks, or domains |
| **Seniority Match** | 15% | Years of experience and level (Intern, Junior, Mid, Senior, Lead) |
| **Visa & Sponsorship** | 10% | Detection of visa support or explicit restrictions |

### Hard Filters
- Explicitly incompatible location (e.g., in-office in Tokyo when user requested Berlin).
- Closed or archived postings detected during Fetch.
- Unrelated job categories.

### Explainable Badges
Every job card displays explicit evidence tags:
- `✓ Direct Role Match: Senior Frontend Engineer`
- `✓ Remote work supported`
- `✓ Matches keywords: TypeScript, Next.js`
- `⚠ Visa sponsorship not specified`
- `⚠ Requires 5+ years experience`

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
