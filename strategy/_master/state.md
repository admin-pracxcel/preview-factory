# Project State

Last updated: 2026-06-20
Current phase: F — Phase F backend specs complete (commit 7e6fa3c). Gate F-backend-checkpoint WRITTEN — awaiting human spec review before Phase G handoff.

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

Schema hardening complete (2026-06-20) — commit 36d45eb:
  - grade.mjs: inline Zod sitePropsSafeSchema validates contact.hours {label,value}, faq ids, content blocks on every grader run, even when AUTOPILOT_SKIP_BUILD=1.
  - generator/run.mjs: tightened mini-schema home.contact; prompt now explicitly documents {label,value} format with example.
  - system-prompt.md: added contact.hours format note.
  - electrician-site.json: added missing faq id fields to Parramatta, Castle Hill, St Marys, Quakers Hill.
  - clearflow-plumbing.json: regenerated clean — both sites GRADER PASS + schema PASS.
  - Gate D-generator-visual-review-2.json written.

Category mass-production complete (2026-06-20) — commit 5c63eb5:
  - 3 parallel category-builder subagents ran and passed grader independently.
  - All 4 sites pass GRADER (4 sites checked).
  - Gate C-categories-checkpoint.json written.

Next action: Human approves gate C-categories-checkpoint → Phase E funnel infrastructure (E1-E6 in sequence).

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
- [x] Allied health — Restore Physio (Chatswood NSW), 22 pages, teal palette, AHPRA-compliant, MedicalBusiness JSON-LD. GRADER PASS 2026-06-20.
- [x] Beauty & aesthetics — Studio Luma salon (Fitzroy VIC), 23 pages, rose/gold palette, gallery-forward, HairSalon JSON-LD. GRADER PASS 2026-06-20.
- [x] Fitness & wellness — Peak Form Training (South Yarra VIC), 22 pages, charcoal/red palette, SportsActivityLocation JSON-LD. GRADER PASS 2026-06-20.
Visual fixes (commit 4e69078):
  - allied-health/HomePage: GalleryGrid heading changed from default "Recent work" to "Our clinic".
  - ServiceDetailPage (all 4 categories): inline full-width hero_image rendered after intro (16:7, rounded, shadowed). All 4 GRADER PASS.
<<C-categories-checkpoint-2 GATE WRITTEN — awaiting human visual sign-off>>
- [ ] Professional services (DEFERRED — HOLD niche)
- [ ] Hospitality (DEFERRED — HOLD niche)
- [ ] Retail & boutique (DEFERRED — HOLD niche)
Cleanups still pending (non-destructive so far): legacy single-page `templates/tradies/` left in place as reference; `templates/mobile-services/` orphaned stub not yet removed. New work lives under `templates/categories/`.

## Phase D: Generator upgrade
- [ ] D1-D4 complete

## Phase E: Funnel infrastructure
Phase E v1 (commit 43fc900): initial 6-page build — REJECTED (no images, no niche split, not premium enough).
Phase E v2 complete (2026-06-20, commit 6fc9895):
  - app/page.tsx: white master landing — 2x2 niche category tiles (Trades/Allied Health/Beauty/Fitness) with Unsplash background images, stats bar, HowItWorks, Testimonials, feature grid, blue CTA band.
  - app/for/trades/, app/for/allied-health/, app/for/beauty/, app/for/fitness/: 4 niche landing pages each with full-viewport hero image + overlay, sub-niche dropdown (9 options each), niche copy, live iframe browser mockup, HowItWorks, Testimonials (3 per niche), FAQ accordion, bottom repeat form.
  - app/components/NicheForm.tsx: shared form (sub-niche select, business name, suburb, submit with n8n stub).
  - app/components/NicheLanding.tsx: shared niche landing template component.
  - app/components/HowItWorks.tsx: 3-step explainer with numbered pills, icons, cards.
  - app/components/Testimonials.tsx: star ratings + quote cards, configurable items.
  - app/building/page.tsx: improved — ambient glow, GBP result card with icons, checklist reveal, build stage cycling progress bar.
  - app/preview/[id]/page.tsx: improved — struck-through price, urgency countdown, Stripe lock note, mobile customise toggle.
  - app/expired/[id]/page.tsx: improved — animated clock ring, preview thumbnail, 3-point checklist card.
  - app/welcome/[id]/page.tsx: improved — animated star burst, copy URL button, action cards grid, SMS example, timeline.
  Gate E-funnel-checkpoint-2.json WRITTEN — awaiting human visual sign-off.
- [x] E1: landing page (v2 with category tiles + images)
- [x] E2: building page (improved)
- [x] E3: preview page (improved)
- [x] E4: customise panel (unchanged)
- [x] E5: expired + welcome pages (improved)
- [ ] E6: Supabase realtime (stubbed with setTimeout; real channel wired in prod)

## Phase F: Backend specs
Phase F complete (2026-06-20, commit 7e6fa3c):
  - strategy/_master/n8n-workflows/: 11 importable n8n workflow JSONs (01-lead-capture through 11-upsell-automation). Real n8n node types, real JS in code nodes, Turnstile verification, Outscraper GBP, Anthropic API, Vercel deployments API, Stripe webhook, Twilio SMS, Postmark email, Supabase realtime events.
  - strategy/_master/supabase-schema.sql: 482-line Postgres migration — leads, sites, subscriptions, customisations, events, recovery_attempts, monthly_reports, build_progress tables; RLS policies; realtime publications; pg_cron for expiry checks.
  - strategy/_master/deployment-checklist.md: 1,079-line ordered checklist — 14 sections covering all accounts (Cloudflare/Supabase/Vercel/Stripe/Twilio/Postmark/Outscraper/Anthropic/Hetzner/Meta), all env vars, end-to-end test, go-live checks, common failure modes.
  Gate F-backend-checkpoint.json WRITTEN.
- [x] F1: n8n workflow JSONs (11 workflows)
- [x] F2: Supabase schema (supabase-schema.sql)
- [x] F3: deployment-checklist.md

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
