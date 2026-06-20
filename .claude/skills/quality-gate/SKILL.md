---
name: quality-gate
description: Use before marking any generated site or category build "done". Defines the machine-checkable bar and how to run it. Trigger after any site generation or category build, and when diagnosing a grader failure.
---
# Quality gate

Run `node scripts/grade.mjs` (or pass a specific site JSON). A unit is done only
when it returns PASS. Revise and re-run until green; never mark done on warnings
you have not read.

What it enforces:
- SiteProps validates (via `next build`, which parses the wired example).
- Page-count floors: services, locations, service-area pages meet the minimum.
- Every page has a slug and its own seo.title; no thin pages (word floor).
- No near-duplicate location/service-area pages (doorway-page / Google spam risk).
- JSON-LD present in every category's pages (LocalBusiness/Service/FAQPage).
- NAP present and, when a GBP source is given, exactly consistent with it.
- `next build` passes on linux (the real ship gate; tsc alone is not enough).

What it does NOT check (these are human decision gates, not grader checks):
- Whether the design actually impresses a real owner in that niche.
- Which niches to launch. Anything that spends money or touches a credential.
Escalate those by writing a gate file under autopilot/state/gates/.
