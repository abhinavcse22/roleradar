<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# RoleRadar — AI Agent Guidelines & Engineering Rules

RoleRadar is an AI-powered job and internship discovery engine built for the **TinyFish Technical Student Bounty Drop 001**. It discovers real, current job openings directly from live company career pages and ATS portals (Ashby, Greenhouse, Lever, etc.) using all three TinyFish capabilities (Search, Fetch, Agent).

## Core Principles for AI Coding Sessions

### 1. Meaningful TinyFish Core Dependency
- **All 3 TinyFish capabilities must remain central and meaningful:**
  1. **TinyFish Search (`api.search.tinyfish.ai`)**: Web-wide discovery of active job listings and portal URLs across ATS platforms.
  2. **TinyFish Fetch (`api.fetch.tinyfish.ai`)**: Full-browser reading of individual job posting pages into clean, token-efficient markdown.
  3. **TinyFish Agent (`agent.tinyfish.ai/v1/automation/run` or `/run-sse`)**: Deep multi-step interaction and structured extraction for dynamic career hubs and client-rendered job portals.
- **NEVER artificially pad or mock TinyFish calls in production paths.** If `TINYFISH_API_KEY` is present, it must execute real calls against the official endpoints.

### 2. No Hardcoded or Fake Job Listings
- Under no circumstances should demo or hardcoded job listings be substituted for live discovery in the production workflow.
- All results must originate from live web sources with real apply links, verifiable timestamps (`checkedAt`), and source attribution.

### 3. Absolute Security & API Key Protection
- The `TINYFISH_API_KEY` must **NEVER** be exposed to client-side code, headers, or bundles.
- All TinyFish API interactions must execute strictly in server-side API routes (`/api/...`) or server actions.
- Never commit `.env` or any file containing active secrets. Maintain `.env.example` as the canonical schema.

### 4. Simple, Robust Architecture
- Keep dependencies minimal.
- Do not introduce unnecessary databases for the discovery engine; state is streamed in real-time to the client using Server-Sent Events (SSE).
- Ensure graceful degradation: if one source or ATS portal fails or times out, the engine continues processing other sources without crashing the search.

### 5. Explainable Matching & Canonical Deduplication
- Matching scores (0–100%) must be derived from explicit, deterministic heuristics (role fit, location/remote policy, keywords, seniority, visa sponsorship) and provide human-readable badges (`✓`, `⚠`).
- Do not use arbitrary or unexplained LLM percentage guesses.
- Deduplication must canonicalize job titles, companies, locations, and normalized URLs across different discovery vectors (e.g. search snippet vs ATS direct vs company portal).

### 6. Verification Discipline
- Always verify changes with `npm run build` and `npm run lint`.
- Do not rewrite working code unnecessarily.
- When modifying Next.js server/client components, preserve Next.js App Router idioms.
