# RoleRadar — 60–90 Second Bounty Demo Walkthrough

This document outlines the exact, step-by-step 60–90 second demonstration script for verifying RoleRadar against the TinyFish Bounty Drop 001 requirements.

---

## Prerequisites
- Node.js 18+ installed
- Server running locally (`npm run build && npm run start` or `npm run dev`) at `http://localhost:3000`
- Valid `TINYFISH_API_KEY` configured in `.env.local`

---

## Demo Script (60–90 Seconds)

### Step 1: Landing Page & User Preferences (0:00 – 0:15)
1. Navigate to `http://localhost:3000`.
2. Point out the clean search interface designed specifically for live career exploration.
3. Enter the test criteria:
   - **Target Role**: `Product Manager`
   - **Target Location**: `India`
   - **Keywords**: `AI`
   - Keep Seniority, Work Mode, and Visa as `Any` (or customize them).
4. Click **"Find live openings"**.

### Step 2: Instant Search + Fetch Arrival (0:15 – 0:30)
1. Within 3–4 seconds, point out the **Initial Results** rendering immediately.
2. Note that the application did not block or freeze waiting for deep web navigation.
3. Point out the **TinyFish Agent Background Tasks** banner at the top showing active background runs:
   - e.g. `GoHighLevel · Lever` and `Clickhouse · Careers` marked as `RUNNING`.
4. Point out the live polling indicator: *"Polling live"*.

### Step 3: Inspecting Search & Fetch Results (0:30 – 0:45)
1. Click on a job card (e.g. from an Ashby or Greenhouse direct job).
2. Show the structured details:
   - Company name, role title, location.
   - Clean description (stripped of raw markdown headers and boilerplate).
   - Real qualification requirement bullets.
3. Highlight the **Deterministic Match Score**:
   - `✓ Exact role match for "Product Manager"`
   - `✓ Location matches requested country: India`
   - `✓ Keywords matched: AI`
4. Hover over the **Provenance** tag showing how this job was verified (`Discovered via Search rank #1 • Verified via Fetch`).
5. Click **"Apply"** — note that it opens directly to the authentic employer ATS application page in a new tab (`target="_blank" rel="noopener noreferrer"`).

### Step 4: Live Agent Completion & Smooth Merging (0:45 – 1:10)
1. Point to the **Agent Status Banner** as the background task transitions from `RUNNING` to `COMPLETED`:
   - e.g. `+4 jobs` extracted from `GoHighLevel · Lever`.
2. Notice the job feed automatically updating in real time:
   - Newly discovered Agent positions (e.g. *Principal Product Manager - Conversation AI*, *Principal Product Manager - Voice AI*) smoothly slide into the list.
   - The match scores are calculated immediately.
   - The jobs are reranked deterministically based on match score and relevance.
   - No manual page refresh was required!

### Step 5: Transparency & Telemetry Audit (1:10 – 1:30)
1. Click **"How RoleRadar searched"** to expand the telemetry panel.
2. Walk through the 5 honest pipeline stages:
   - **Search**: `48` live results across 5 search vectors.
   - **Fetch**: `6` attempted, `6` verified into clean markdown.
   - **Agent**: `1 / 2` completed, `4` structured jobs extracted.
   - **Deduplication**: `46` raw records &rarr; `46` unique canonical jobs.
   - **Matching**: `46` unique &rarr; `31` eligible jobs passing hard filters (`15` filtered out).
3. Conclude: RoleRadar is a fully functional, live, multi-source career discovery engine that authentically utilizes TinyFish Search, Fetch, and Agent without hardcoded data.
