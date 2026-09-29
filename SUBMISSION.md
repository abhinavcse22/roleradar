# RoleRadar — TinyFish Bounty Submission

**Project**: RoleRadar  
**Bounty**: TinyFish Technical Student Bounty Drop 001 — Job Portal / Careers Finder  
**Live Demo**: https://roleradar-iota.vercel.app  
**Repository**: https://github.com/abhinavcse22/roleradar  
**Date**: September 2026  

---

## 1. Executive Summary

### Problem
Modern job searching is plagued by aggregator decay, "ghost jobs" (postings left active months after being filled), syndicated duplicate listings across third-party boards, and black-box matching percentages that give candidates no actionable insight into why a role was recommended. Job seekers repeatedly bounce across fragmented ATS portals (Ashby, Greenhouse, Lever, Workday) and company career pages, sifting through noise and broken links.

### Solution
RoleRadar is an AI-powered job discovery engine that searches live career pages, reads actual postings into clean markdown, navigates dynamic career portals autonomously, deduplicates across discovery vectors into authoritative canonical records, and ranks them against explicit user preferences using a transparent, 100% explainable scoring model.

RoleRadar meaningfully utilizes all three official TinyFish capabilities: **Search**, **Fetch**, and **Agent**.

---

## 2. Meaningful TinyFish Usage

### A. TinyFish Search (`https://api.search.tinyfish.ai`)
- **Role in Pipeline**: High-velocity discovery of active job listings and portal URLs across ATS domains and native company career pages.
- **Implementation**: Dynamically generates 5 targeted search vectors based on user role, location, and keywords:
  1. `"{role}" "{location}" {keyword} site:jobs.ashbyhq.com`
  2. `"{role}" "{location}" {keyword} site:boards.greenhouse.io`
  3. `"{role}" "{location}" {keyword} site:jobs.lever.co`
  4. `"{role}" "{location}" {keyword} ("join our team" OR "work with us" OR "careers")`
  5. `"{role}" "{location}" {keyword} "open positions"`
- **Why it is meaningful**: Directly surfaces live, indexed openings across disparate career ecosystems without relying on stale, syndicated third-party job aggregators.

### B. TinyFish Fetch (`https://api.fetch.tinyfish.ai`)
- **Role in Pipeline**: Full-browser reading of individual job posting pages into clean, token-efficient markdown.
- **Implementation**: Routes URLs classified as `directJob` (e.g. `jobs.ashbyhq.com/sarvam/<uuid>`, `boards.greenhouse.io/<company>/jobs/<id>`, `jobs.lever.co/<company>/<id>`) to Fetch with bounded concurrency (3 concurrent, max 6 per search).
- **What it accomplishes**:
  - Strips boilerplate, navigation bars, cookie consents, and scripts.
  - Verifies whether the listing is active or expired (*"no longer accepting applications"*, *"job expired"*).
  - Extracts clean description, qualification requirements, responsibilities, and confirmed direct apply URLs.
- **Why it is meaningful**: Ensures the user never sees raw HTML or broken/closed listings; extracts rich qualifications that search snippets miss.

### C. TinyFish Agent (`https://agent.tinyfish.ai/v1/automation/run-async`)
- **Role in Pipeline**: Autonomous multi-step browser navigation, interaction, and structured extraction on dynamic career hubs.
- **Implementation**: Asynchronously dispatches up to 2 distinct company career hubs (e.g. `jobs.lever.co/gohighlevel`, `jobs.ashbyhq.com/sarvam`) using `/run-async` with a strict JSON schema.
- **Browser Polling & Live Merging**: The frontend polls `GET /api/jobs/agent-status?runId=<id>` every 5 seconds. As Agent runs complete, new structured jobs are normalized, deduplicated with existing results, rescored, and rendered live in the UI without a page refresh.
- **Hub Diversity & Candidate Deduplication**: Canonicalizes hub URLs (`normalizeCareerHubIdentity`) to ensure multiple URLs for the same portal (e.g. trailing slashes, tracking parameters, department filters) collapse into a single entity, guaranteeing that the 2 Agent slots explore two completely different companies.
- **Why it is meaningful**: Unlocks Single-Page Applications (SPAs) and interactive career portals that static scrapers cannot read, extracting positions directly into structured JSON.

---

## 3. How RoleRadar Satisfies Bounty Requirements

| Bounty Requirement | Implementation & Evidence |
|---|---|
| **1. Working Demo** | Production application deployed and operational at [https://roleradar-iota.vercel.app](https://roleradar-iota.vercel.app). |
| **2. Custom User Preferences** | User-defined target role, target location, domain keywords, plus seniority, work mode, and visa sponsorship preferences. |
| **3. Live Career Pages & Portals** | Live pulling across Ashby, Greenhouse, Lever, Workday, and native company websites. Zero hardcoded job arrays in production paths. |
| **4. Structured Deduplicated Listings with Apply Links** | Normalizes all incoming data into the canonical `JobListing` schema, merges cross-source duplicates, and provides verified direct apply links opening in a new tab (`target="_blank" rel="noopener noreferrer"`). |
| **5. Explanation of Search, Fetch, and Agent** | Clear architectural breakdown in UI ("How RoleRadar searched" telemetry drawer), `README.md`, and this submission document. |

---

## 4. How RoleRadar Satisfies Approval Criteria

1. **Meaningful TinyFish Core Dependency**:
   - Every search pipeline run coordinates TinyFish Search (discovery), TinyFish Fetch (page reading), and TinyFish Agent (autonomous portal extraction).
   - Zero padding or fake calls: if `TINYFISH_API_KEY` is present, it executes authentic requests against the official endpoints.
2. **Live Web Data, Zero Hardcoded Listings**:
   - Zero mock or demo listings in `src/`.
   - Every result originates from real TinyFish HTTP responses.
   - Timestamps (`checkedAt`) represent RoleRadar's live verification time (`Verified 45s ago`), accompanied by full discovery provenance.
3. **Works Across Multiple Companies and Portals**:
   - Discovers openings across Ashby, Greenhouse, Lever, Workday, and native corporate career hubs without hardcoding specific employers.
   - Verified across diverse employers (e.g. HighLevel, Sarvam AI, Stripe, Enveda, AlphaSense, Neuron7, Anaplan, Donorbox, saas.group).
4. **Works for Varying Inputs**:
   - Verified across diverse role/location/keyword combinations:
     - `Product Manager` / `India` / `AI`
     - `Software Engineer` / `India` / `Python, AI`
     - `Marketing Manager` / `Remote` / `SaaS`
5. **Filters, Matches, and Ranks Rather Than Dumping Raw Data**:
   - **Hard Filters**: Excludes unrelated roles and geographically incompatible positions.
   - **Explainable Match Scoring (0–100)**: Deterministic multi-dimensional scoring across Role Fit (30), Location Fit (20), Keywords (20), Seniority (10), Work Mode (10), Visa (5), and Freshness (5).
   - **Neutral Dimensions**: Unspecified user preferences are neutral and excluded from the denominator to prevent score inflation.
   - **Grounded Evidence Badges**: Transparent `✓` match reasons and `⚠` warnings.

---

## 5. Verified Test Run Observations

*Note: The following metrics represent actual observed outputs during live verification runs and reflect pipeline performance rather than static guarantees.*

### Live Verification Run (Product Manager / India / AI)
- **Search Phase**: 48 raw results returned across 5 search vectors.
- **Classification**: 29 direct job posting URLs, 8 career hub candidates (grouped into 7 unique company portals).
- **Fetch Phase**: 6 direct job pages dispatched, 6 successfully fetched into clean markdown.
- **Agent Phase**: 2 distinct company hubs dispatched asynchronously:
  - Hub 1: `https://jobs.lever.co/gohighlevel/` (Identity: `lever:gohighlevel`, runId: `908405f2-bc96-4312-8f6f-3037eaa4ea75`) &rarr; Status: `COMPLETED` &rarr; 4 structured jobs extracted.
  - Hub 2: `https://clickhouse.com/company/careers` (Identity: `company:clickhouse.com`, runId: `7932c0d0-0b99-457e-b7bc-145a6253b839`) &rarr; Status: `RUNNING`.
- **Deduplication & Matching**: 50 normalized records deduplicated to 50 unique jobs; 35 jobs passed hard eligibility filters; 15 filtered out.
- **Automated Test Suite**: 104 unit, integration, and regression tests passing (`npm test`).
- **Code Quality & Build**: ESLint passed with 0 errors/warnings (`npm run lint`), production build clean (`npm run build`), dependency audit 0 vulnerabilities (`npm audit`).

---

## 6. Known Limitations

1. **Agent Duration**: Dynamic SPAs navigated by TinyFish Agent can take 60–180+ seconds. RoleRadar mitigates this with its asynchronous architecture: candidates receive initial Search + Fetch results in ~3–4 seconds while Agent runs continue in the background.
2. **Bot Defense / Enterprise CAPTCHAs**: Portals requiring mandatory multi-factor authentication, enterprise reCAPTCHA v3 checkboxes, or employee logins cannot be automated.
3. **Session Persistence**: In-flight Agent polling state is held in client memory during the session; refreshing the page clears the active polling tracker (though initial results can be quickly re-queried).

---

## 7. Recommended Demo Flow (60–90 Seconds)

1. Open RoleRadar at [https://roleradar-iota.vercel.app](https://roleradar-iota.vercel.app).
2. Enter target criteria:
   - **Role**: `Product Manager`
   - **Location**: `India`
   - **Keywords**: `AI`
3. Click **"Find live openings"**.
4. Show initial live results arriving quickly (~3–4 seconds) from TinyFish Search & Fetch.
5. Show **"How RoleRadar searched"** telemetry panel with stage-by-stage counts.
6. Show the **TinyFish Agent Background Tasks** banner with active career portal runs (e.g. `GoHighLevel · Lever`).
7. Observe Agent run transition to `COMPLETED` (`+4 jobs extracted`).
8. Show newly extracted Agent positions merging smoothly into the live feed without a page refresh.
9. Open a job card to show the deterministic match score, breakdown, reasons, warnings, requirements, and discovery provenance.
10. Click **"Apply"** to verify that it links directly to the authentic employer ATS application page in a new tab.
