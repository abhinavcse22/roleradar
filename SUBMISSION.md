# RoleRadar — TinyFish Bounty Submission

**Project**: RoleRadar  
**Bounty**: TinyFish Technical Student Bounty Drop 001 — Job Portal / Careers Finder  
**Live Demo**: `<placeholder to fill after deployment>`  
**Repository**: `<placeholder>`  
**Date**: September 2026  

---

## 1. Overview

RoleRadar is an AI-powered, live job and internship discovery engine that searches real company career pages and ATS portals (Ashby, Greenhouse, Lever, Workday) in real time. It replaces stale aggregator scrapers and "ghost jobs" with live verified openings, canonical deduplication, and 100% explainable, deterministic match scoring.

RoleRadar meaningfully utilizes all three TinyFish web infrastructure capabilities: **Search**, **Fetch**, and **Agent**.

---

## 2. Meaningful TinyFish Usage

### A. TinyFish Search (`https://api.search.tinyfish.ai`)
- **Role in Pipeline**: High-velocity discovery of active job listings and portal URLs across ATS domains and native company career pages.
- **Implementation**: Generates 5 targeted search vectors based on user role, location, and keywords:
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
  - Verifies whether the listing is active or expired ("no longer accepting applications", "job expired").
  - Extracts clean description, qualification requirements, responsibilities, and confirmed direct apply URLs.
- **Why it is meaningful**: Ensures the user never sees raw HTML or broken/closed listings; extracts rich qualifications that search snippets miss.

### C. TinyFish Agent (`https://agent.tinyfish.ai/v1/automation/run-async`)
- **Role in Pipeline**: Autonomous multi-step browser navigation, interaction, and structured extraction on dynamic career hubs.
- **Implementation**: Asynchronously dispatches up to 2 distinct company career hubs (e.g. `jobs.lever.co/gohighlevel`, `jobs.ashbyhq.com/sarvam`) using `/run-async` with a strict JSON schema.
- **Browser Polling & Live Merging**: The frontend polls `GET /api/jobs/agent-status?runId=<id>` every 5 seconds. As Agent runs complete, new structured jobs are normalized, deduplicated with existing results, rescored, and rendered live in the UI without a page refresh.
- **Hub Diversity & Deduplication**: Canonicalizes hub URLs (`normalizeCareerHubIdentity`) to ensure multiple URLs for the same portal (e.g. trailing slashes, tracking parameters, department filters) collapse into a single entity, guaranteeing that the 2 Agent slots explore two completely different companies.
- **Why it is meaningful**: Unlocks Single-Page Applications (SPAs) and interactive career portals that static scrapers cannot read, extracting positions directly into structured JSON.

---

## 3. How RoleRadar Satisfies the Bounty Approval Criteria

1. **Uses TinyFish Meaningfully to Discover and Read Listings**:
   - Search discovers candidate URLs across ATS providers.
   - Fetch verifies and reads full job posting pages into markdown.
   - Agent navigates dynamic portals and returns structured JSON.
   - All 3 capabilities execute in production for every search with zero artificial padding.

2. **Uses LIVE Web Data Rather Than Hardcoded Listings**:
   - Zero hardcoded or demo job arrays in production paths.
   - Every result originates from live TinyFish HTTP responses.
   - All listings feature real, verified `checkedAt` timestamps (`Verified 45s ago`) and full discovery provenance.

3. **Works Across Multiple Companies or Portals**:
   - Discovers openings across Ashby, Greenhouse, Lever, Workday, and native company websites.
   - Tested and verified across diverse employers (e.g. HighLevel, Sarvam AI, Stripe, Enveda, AlphaSense, Neuron7, Anaplan, Donorbox).

4. **Works for Different Roles, Locations, and Inputs**:
   - Verified across diverse roles and locations:
     - `Product Manager` / `India` / `AI`
     - `Software Engineer` / `India` / `Python, AI`
     - `Marketing Manager` / `Remote` / `SaaS`
   - Accepts customizable filters: Role, Location, Keywords, Seniority (Entry, Mid, Senior, Lead, Executive), Work Mode (Remote, Hybrid, On-site), and Visa Sponsorship preference.

5. **Filters, Matches, and Ranks Results Rather Than Dumping Raw Pages**:
   - **Hard Filters**: Rejects unrelated roles and geographically incompatible postings.
   - **Explainable Match Scoring (0–100)**: Transparent deterministic scoring across Role Fit, Location, Keywords, Seniority, Work Mode, Visa, and Freshness.
   - **Neutral Dimensions**: Unspecified user preferences are neutral and excluded from the scoring denominator, preventing inflated scores.
   - **Human-Readable Evidence**: Every job displays concrete `✓` match reasons and `⚠` warnings.

---

## 4. Known Limitations

1. **Agent Duration**: Dynamic SPAs navigated by TinyFish Agent can take 60–180+ seconds. RoleRadar solves this via its asynchronous architecture, delivering initial Search + Fetch results in ~3 seconds while Agent runs in the background.
2. **Aggressive Bot Protection / SSO**: Portals requiring mandatory multi-factor authentication, enterprise CAPTCHAs, or employee logins cannot be automated.
3. **ATS Custom Iframe Embeds**: Rare custom ATS wrappers that embed job boards inside cross-origin iframes may require deeper multi-page Agent navigation.

---

## 5. Demo Flow

1. Open RoleRadar at `http://localhost:3000`.
2. Enter search criteria:
   - **Role**: `Product Manager`
   - **Location**: `India`
   - **Keywords**: `AI`
3. Click **Find live openings**.
4. Initial results appear in ~3–4 seconds from TinyFish Search & Fetch.
5. Observe the **TinyFish Agent Background Tasks** banner showing active runs with clean company labels (`GoHighLevel · Lever`, `Clickhouse · Careers`).
6. Expand **"How RoleRadar searched"** to inspect live pipeline telemetry.
7. As TinyFish Agent completes, newly extracted jobs automatically merge into the feed, deduplicate, and rerank live without page refresh.
8. Expand a job card to view the match breakdown and evidence tags (`✓ Exact role match`, `✓ Keywords matched: AI`).
9. Click **Apply** to open the authentic ATS job application page in a new tab.
