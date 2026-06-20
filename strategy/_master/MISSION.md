# Preview Factory Mission

## Operating mode
Read this file and state.md on every task. Determine current phase and next unblocked action. Execute, update state.md, pause at defined checkpoints. Do not skip phases. Do not proceed past a checkpoint without explicit human approval ("continue" or equivalent).

## Phase A: Niche intelligence
A1. Build `strategy/research/meta-job-titles.md` — addressable niche universe
A2. Screen all niches against business-context.md fit criteria — log screened-out in decision-log.md
A3. Run full methodology on first viable niche — CHECKPOINT (review methodology output quality)
A4. Batch through remaining viable niches
A5. Output `strategy/_master/launch-recommendations.md` — ranked by LTV:CAC
CHECKPOINT: human reviews launch recommendations

## Phase B: Template architecture audit
B1. Audit `/templates/` and `/templates/categories/` — what categories exist, single-page or site system, what's missing
B2. Cross-reference against the seven required categories
B3. Output `strategy/_master/template-audit.md` with build queue
CHECKPOINT: human approves build plan

## Phase C: Site system expansion
For each category needing expansion to multi-page:
C1. Define SiteProps schema in `/shared/types/site-props.ts` (if not yet done)
C2. Build page components: home, service-detail, location, service-area, faq, about
C3. Build shared layout (header, footer, nav)
C4. Update `/templates/categories/[cat]/system-prompt.md` for multi-page generation
CHECKPOINT after first category expanded: human reviews rendered example
Then auto-continue through remaining categories.

## Phase D: Generator upgrade
D1. Update `/generator/orchestrator.ts` to produce full SiteProps blob (not just homepage props)
D2. Implement multi-page generation logic with token-efficient batching
D3. Add zod validation for SiteProps
D4. Test end-to-end with one niche + one category
CHECKPOINT: human reviews test output

## Phase E: Funnel infrastructure
Before any implementation: read strategy/_master/customer-journey.md in full. This document defines what the funnel must do.

E1. Build /funnel/app/page.tsx (landing page)
E2. Build /funnel/app/building/page.tsx (loading experience with progressive phase reveals)
E3. Build /funnel/app/preview/[id]/page.tsx (mobile fullscreen, desktop framed mockup)
E4. Build /funnel/components/CustomisePanel.tsx (colour, logo, hero only)
E5. Build /funnel/app/expired/[id]/page.tsx and /funnel/app/welcome/[id]/page.tsx
E6. Build GBP disambiguation flow and extended form fallback
E7. Build share-to-partner mechanism
E8. Set up Supabase realtime for progress streaming

After E1-E8 complete, run an internal audit:
- Read customer-journey.md again
- For each phase 1-12 in that document, verify the implementation matches the specification
- Identify any gaps, generic implementations, or missing UX details
- Output strategy/_master/funnel-audit.md listing every gap
- Refine implementations to close every gap
- Re-audit
- Repeat until audit returns zero gaps

CHECKPOINT: human reviews the final funnel against customer-journey.md.

## Phase F: Backend specs
F1. Write n8n workflow JSON exports for workflows 1-10 from business plan
F2. Write Supabase schema migrations
F3. Output `strategy/_master/deployment-checklist.md` listing operational accounts needed
CHECKPOINT: specs reviewed

## Phase G: Human handoff
Cowork cannot do: ABN registration, Stripe account verification, n8n deployment, domain purchase, Meta ads account setup, real-world validation outreach.
G1. Output `strategy/_master/what-human-must-do.md` listing all offline work in execution order
END.

## Checkpoint behaviour
At each checkpoint:
1. Stop all further work
2. Output a summary of what was completed
3. Show file paths to review
4. Explicitly ask "Continue to next phase?" and wait for response
5. If user requests revisions, make them and re-checkpoint
6. If user says "continue," update state.md and proceed
