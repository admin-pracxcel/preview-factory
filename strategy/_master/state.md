# Project State

Last updated: 2026-06-20
Current phase: GATE WRITTEN — awaiting D-generator-visual-review sign-off before category mass-production.

Phase D complete (2026-06-20):
  - generator/run.mjs: ESM runner, streaming Claude API calls, Zod mini-schema + grader-mirror validation, retry-once on failure. Grader PASS on first attempt.
  - generator/output/clearflow-plumbing.json: Clearflow Plumbing (Melbourne plumber) — 6 services, 8 locations, 5 service-areas. GRADER: PASS.
  - generator/index.ts: full TypeScript implementation for TS build integration.
  - Hydration fixes committed 95535b3: body suppressHydrationWarning + CountdownBanner null-init fix.
  - Plumber preview route: /preview/plumber (all sub-pages work).

Location page quality pass complete (2026-06-20) — commit 9421958:
  - LocationPage.tsx: replaced plain arrow-card RelatedLinks for services with ServicesGrid (icon + price + description cards). Added testimonial fallback: if no suburb-specific testimonials, show site-wide max-3.
  - electrician-site.json: all 6 location entries (Penrith, Blacktown, Parramatta, Castle Hill, St Marys, Quakers Hill) now have headline, benefits[] (4 items), and faqs[] (2 items). Broken image replaced (photo-1581094288338-2314dddb7ece).
  - Grader PASS.

Next action: Human approves gate D-generator-visual-review → mass-produce allied-health, beauty-aesthetics, fitness-wellness categories (3 category-builder subagents in parallel, each grader-gated).

## Phase A: Niche intelligence
- [x] A1: meta-job-titles.md built (352 lines, AU-specific, last researched 2026-06-19)
- [x] A2: niche screening complete (decision-log.md screened-out table + borderline list)
- [x] A3: first analysis (methodology calibration) — electrician (GO), run under the NEW methodology (Phase 5 = category mapping) on 2026-06-19. <<A3 CHECKPOINT — awaiting human review>>
      - Prior calibration analysis bricklayer (HOLD) remains on file but was written under the OLD Phase 5 ("adapts tradies template") — superseded as the calibration reference. Open question: re-run its Phase 5 or leave (it's a HOLD).
- [x] A4: lead-candidate batch complete — 10 niches analysed across all 7 categories (GO: electrician, plumber, house-cleaning, physiotherapy, hairdresser, personal-trainer; HOLD: cafe, accountant, florist, bricklayer). niches-master.csv + decision-log.md updated. Long-tail viable niches remain (listed in launch-recommendations.md "remaining queue") — defer or batch on human call.
- [x] A5: launch-recommendations.md written — ranked by LTV:CAC, sequenced by build leverage. <<post-A5 CHECKPOINT — awaiting human review>>

## Phase B: Template architecture audit
- [x] B1-B3: template-audit.md complete. <<Phase B CHECKPOINT — awaiting human approval of build plan>>
      Findings: of 7 required categories, only `trades` exists (single-page tradies/page.tsx, ~798 lines, strong section library); allied-health/beauty-aesthetics/hospitality are empty stubs; professional-services/fitness-wellness/retail-boutique missing entirely. ZERO exist as multi-page site systems. Shared UI (shared/ui) empty; generator empty; no SiteProps; no /templates/categories/; no dynamic routing. mobile-services stub is orphaned (not one of the 7). Build queue: Foundation C-0 (SiteProps + shared layout + page components/routing) → trades → allied-health → beauty-aesthetics → fitness-wellness; HOLD categories (hospitality/professional-services/retail-boutique) deferred.

## Phase C: Site system expansion (per category)
Foundation (C-0) DONE: SiteProps schema (shared/types/site-props.ts); shared UI (shared/ui: helpers, icons, theme, seo, client, layout, sections) harvested from the legacy single-page trades template; page components (home, service-detail, location, service-area, faq, about) + dynamic routing (app/preview/trades/[[...slug]]).
- [x] Trades — multi-page system + system-prompt.md + electrician example (18 pages). Grader PASS 2026-06-20 (fixed thin location/service-area pages + added 2 locations to meet 6-page floor). <<Phase C GATE WRITTEN — autopilot/state/gates/C-trades-checkpoint.json — awaiting human visual sign-off>>
- [ ] Allied health (next; from scratch + Ahpra compliance)
- [ ] Beauty & aesthetics (booking + gallery)
- [ ] Fitness & wellness (timetable/booking + IG feed)
- [ ] Professional services (DEFERRED — HOLD niche)
- [ ] Hospitality (DEFERRED — HOLD niche)
- [ ] Retail & boutique (DEFERRED — HOLD niche)
Cleanups still pending (non-destructive so far): legacy single-page `templates/tradies/` left in place as reference; `templates/mobile-services/` orphaned stub not yet removed. New work lives under `templates/categories/`.

## Phase D: Generator upgrade
- [ ] D1-D4 complete

## Phase E: Funnel infrastructure
- [ ] E1: landing page
- [ ] E2: building page
- [ ] E3: preview page
- [ ] E4: customise panel
- [ ] E5: expired + welcome pages
- [ ] E6: Supabase realtime

## Phase F: Backend specs
- [ ] F1: n8n workflow JSONs
- [ ] F2: Supabase schema
- [ ] F3: deployment-checklist.md

## Phase G: Human handoff
- [ ] G1: what-human-must-do.md

## Notes
**Audit 2026-06-19 (initial state capture):**
- `/templates/` holds 5 NICHE-named dirs (tradies, mobile-services, allied-health, beauty-aesthetics, hospitality), NOT the seven VISUAL CATEGORIES the new architecture requires. No `/templates/categories/` dir exists.
- Only `tradies` has real content (`page.tsx`, 798 lines, single-page). The other four are 1-line stub `index.tsx` re-exports with no page. All are SINGLE-PAGE — no multi-page site system anywhere. → Phase B audit will need to reconcile niche→category naming; Phase C (all 7 categories) is effectively greenfield.
- `/shared/types/` has `template-props.ts` (single-page TemplateProps). NO `site-props.ts` → Phase C C1 / Phase D D3 not started.
- `/generator/index.ts` is an empty stub (`export {}`). No `orchestrator.ts` → Phase D not started.
- No `/funnel/` directory at all → Phase E greenfield.
- `app/` contains a Next.js scaffold with one preview route (`app/preview/tradies/page.tsx`) — dev harness, not the funnel.
- Strategy: research + screening + one calibration analysis (bricklayer) done; niches-master.csv and decision-log.md populated.

**Open question for human:** bricklayer analysis predates the category-mapping methodology — re-run its Phase 5 under new framing, or leave as-is since it's a HOLD?

**2026-06-19 — A3 calibration run (electrician):** Ran the full 10-phase methodology on `electrician` under the new Phase 5. Chosen over strict alphabetical order (next trade would be ~carpenter/concreter) because a clear-GO, direct-demand, interest-targetable trade exercises more of the methodology surface than another behaviour-only HOLD; the A4 batch will resume the prescribed order (trades → mobile → allied → beauty → rest; alphabetical within each). Result: GO, Tier 1, ~4.5:1 base LTV:CAC. Surfaced a recurring category-level finding: the `trades` template is single-page and must be expanded to the multi-page site system (Phase C) before any trades niche can be generated as specified — this will apply to every category, confirming Phase B/C is the real critical path.
- `strategy/research/competitive-intel.md` is an empty 1-line stub; per-niche competitive research is done inline via web search (as in both analyses), so it is not currently a blocker.

**2026-06-19 — A4/A5 batch complete.** Ran 8 parallel niche analyses (plumber, physiotherapy, hairdresser, cafe, personal-trainer, accountant, florist, house-cleaning) via subagents; merged CSV rows + decision-log paragraphs centrally. Key conclusions in launch-recommendations.md:
  - **Build is the critical path**, not niche discovery. All 5 GO niches are build-blocked; the trades multi-page expansion alone unlocks electrician + plumber + house-cleaning (the top-3 economics). Recommended build/launch order: trades → allied-health → beauty-aesthetics → fitness-wellness.
  - House-cleaning has the best base economics (~5:1) and maps to `trades` with generation-time tuning only (no new template). Physiotherapy ~4.9:1 but from-scratch build + Ahpra compliance.
  - LSA confirmed AU-eligible only for electrician + plumber (not cleaning/physio/hair/PT).
  - 3 HOLDs on product-fit/economics: cafe (walk-in, no call-retention loop), florist (e-commerce intent), accountant (high sophistication, fragile bear case); bricklayer remains HOLD (fold into multi-trade).
  - Two subagents noted the Write tool guards strategy `.md` files as "report files"; they wrote via the workspace shell mount to the correct paths (all 10 analysis.md verified present, 175–202 lines each).
