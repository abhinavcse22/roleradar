# RoleRadar — 60–90 Second Bounty Demo Walkthrough

This document outlines the exact, step-by-step 60–90 second demonstration script for evaluating RoleRadar against the TinyFish Bounty Drop 001 requirements.

---

## Live Application
- **Production URL**: [https://roleradar-iota.vercel.app](https://roleradar-iota.vercel.app)
- **Local Dev / Evaluation URL**: `http://localhost:3000` (via `npm run build && npm run start`)
- **Prerequisites**: Modern web browser, internet connection.

---

## Demo Sequence (60–90 Seconds)

### Step 1: Landing Page & User Preferences (0:00 – 0:15)
1. Open [https://roleradar-iota.vercel.app](https://roleradar-iota.vercel.app).
2. Point out the clean search interface designed for live career discovery.
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

### Step 3: Inspecting Pipeline Telemetry (0:30 – 0:45)
1. Click **"How RoleRadar searched"** to expand the telemetry drawer.
2. Walk through the 5 honest pipeline stages:
   - **Search**: Raw results across 5 search vectors.
   - **Fetch**: Direct job pages verified into clean markdown.
   - **Agent**: Active portal runs and extracted positions.
   - **Deduplication**: Raw records &rarr; unique canonical jobs.
   - **Matching**: Unique &rarr; eligible jobs passing hard filters.

### Step 4: Live Agent Completion & Smooth Merging (0:45 – 1:10)
1. Point to the **Agent Status Banner** as a background task transitions to `COMPLETED`:
   - e.g. `+4 jobs` extracted from `GoHighLevel · Lever`.
2. Notice the job feed automatically updating in real time:
   - Newly discovered Agent positions (e.g. *Principal Product Manager - Conversation AI*, *Principal Product Manager - Voice AI*) smoothly slide into the list.
   - Match scores calculate immediately.
   - Jobs rerank deterministically based on match score and relevance.
   - No manual page refresh was required!

### Step 5: Inspecting Scored Job & Direct Apply (1:10 – 1:30)
1. Click on a job card (e.g. HighLevel or Ashby/Greenhouse posting).
2. Show the structured details:
   - Company name, role title, location.
   - Clean description (stripped of raw markdown headers and boilerplate).
   - Real qualification requirement bullets.
3. Highlight the **Deterministic Match Score**:
   - `✓ Exact role match for "Product Manager"`
   - `✓ Location matches requested country: India`
   - `✓ Keywords matched: AI`
4. Point out the **Provenance** tag showing how this job was verified (`Discovered via Search • Verified via Fetch` or `Discovered via Agent`).
5. Click **"Apply"** — verify that it opens directly to the authentic employer ATS application page in a new tab (`target="_blank" rel="noopener noreferrer"`).
