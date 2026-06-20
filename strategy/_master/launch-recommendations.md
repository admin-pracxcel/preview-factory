# Launch Recommendations — Preview Factory v1

**Date:** 2026-06-19 · **Currency:** AUD · **Phase:** A5 output (post-batch)
**Coverage:** 10 niches analysed under the full methodology — the lead candidate for each of the seven visual categories, plus a home-services candidate. This is a representative cross-category set sufficient to set launch priority; it is **not** the full viable universe (see "Coverage & remaining queue").

> **All economics are unvalidated estimates.** CAC, conversion, tenure and Meta audience sizes are reasoned against real market anchors but must be confirmed against live Ads Manager data and a real price test before budget is committed. Uncertainty is flagged per niche in each `analysis.md`.

---

## Headline recommendation

**Launch on the `trades` visual category first.** It is the only category with an existing (single-page) template, it needs *expansion to multi-page* rather than a from-scratch build, and that single build unlocks the **three strongest GO niches simultaneously — electrician, plumber and house-cleaning** — which also happen to top the economics ranking. Sequence the remaining GO categories by economics and build cost behind it: allied-health (physiotherapy) → beauty-aesthetics (hairdresser) → fitness-wellness (personal-trainer).

The decisive strategic fact from this batch: **the template build is the critical path, not niche discovery.** Five of five GO niches are blocked on a category build, and three of them share one build. Prioritising by *build leverage* (niches unlocked per template) beats prioritising by raw LTV:CAC alone.

---

## Ranked by base-case LTV:CAC (all 10 analysed)

| Rank | Niche | Category | Base LTV:CAC | Decision | Tier | Build status |
|---|---|---|---|---|---|---|
| 1 | House Cleaning | trades | **~5.0:1** | GO | 1 | Shares trades build (no new template) |
| 2 | Physiotherapy | allied-health | **~4.9:1** | GO | 1 | Build from scratch (1-line stub) |
| 3= | Electrician | trades | **~4.5:1** | GO | 1 | Trades multi-page expansion |
| 3= | Plumber | trades | **~4.5:1** | GO | 1 | Shares trades build (no new template) |
| 5 | Accounting/Bookkeeping | professional-services | ~4.0:1* | **HOLD** | 3 | Net-new category |
| 6 | Hairdressing | beauty-aesthetics | **~3.5:1** | GO | 1 | Build from scratch (stub) |
| 7 | Personal Training | fitness-wellness | **~3.2:1** | GO | 1 | Net-new category |
| 8= | Bricklaying | trades | ~2.4:1 | HOLD | 3 | Shares trades build |
| 8= | Florist | retail-boutique | ~2.3:1 | HOLD | 3 | Net-new category |
| 10 | Café | hospitality | ~1.1:1 | HOLD | 3 | Net-new category |

\* **Accounting ranks high on the base ratio but is a HOLD**: it fails the product-fit test (high existing digital sophistication, referral/consultation demand that mutes the "more local calls" frame) and its **bear case fails at 0.7:1** once the "actually needs us" minority is exhausted. The ratio is real but thin and fragile — a clear illustration that LTV:CAC alone is not the decision; product-fit and bear-case robustness gate it.

---

## Recommended launch sequence

### Wave 1 — Trades category (build: multi-page expansion of existing template)
**Niches unlocked: Electrician, Plumber, House Cleaning (all GO, Tier 1).**
Best combined economics in the portfolio (~4.5–5.0:1), strongest "more calls now" value frame (emergency trades + recurring cleaning), and the lowest build cost because `templates/tradies/page.tsx` already exists — it needs expanding to the multi-page `SiteProps` site system, not building from zero. House cleaning maps to `trades` with generation-time tuning only (no separate template). **Electrician and plumber additionally carry confirmed Australian LSA (Google Guaranteed) eligibility**, enabling a differentiated Scale-tier upsell those two niches can sell that cleaning currently cannot (LSA not yet in AU for cleaning — re-verify quarterly).
→ *This wave is the recommended MVP launch.*

### Wave 2 — Allied-health category (build: from scratch)
**Niche unlocked: Physiotherapy (GO, Tier 1, ~4.9:1).**
Second-best economics and a structurally growing market, but a from-scratch category build and an **Ahpra advertising-compliance overlay** (no clinical-outcome testimonials, no cure/guarantee claims, owner-supplied credentials) that must be engineered into the schema, generation prompt and review tooling. Higher build + compliance cost is why it sits behind trades despite strong numbers.

### Wave 3 — Beauty-aesthetics category (build: from scratch)
**Niche unlocked: Hairdressing (GO, Tier 1, ~3.5:1).**
Best Meta-targeting fit of any category and a visually-motivated owner, but requires first-class **online-booking and gallery** components and clears the bar with less headroom (hot beauty CPM, lower entry price, no LSA).

### Wave 4 — Fitness-wellness category (build: net-new)
**Niche unlocked: Personal Training / studios (GO, Tier 1, ~3.2:1, narrow).**
GO is **studio/reformer-Pilates-led, not sole-trader-led**. Requires active management of audience inversion (Meta fitness interests reach clients, not owners) and a net-new category build with booking-embed + Instagram-feed components. Lowest-headroom GO — sequence last among GOs.

### Hold (do not build for these yet)
- **Café (hospitality, ~1.1:1):** fails the floor; product-frame mismatch (walk-in business, no phone-call retention loop). Revisit only on a live owner-CPL test near the bull end.
- **Accounting (professional-services, ~4:1 but fragile):** product-fit fail; revisit on a better-fit professional niche + customer-list lookalike.
- **Florist (retail-boutique, ~2.3:1):** e-commerce/checkout intent dominates over lead-gen; revisit scoped to weddings/events or if the product gains checkout.
- **Bricklaying (trades, ~2.4:1):** marginal; builder-referral demand + behaviour-only targeting. Fold into the multi-trade trades offering rather than launch standalone.

---

## Cross-cutting findings

1. **Template build is the bottleneck.** Every GO niche is build-blocked; the trades expansion unlocks three at once. Phase B/C (template architecture) is the real critical path to revenue, not further niche analysis.
2. **Churn is the universal bear-case killer.** Every GO niche's bear case fails primarily on churn among price-sensitive sole traders. Onboarding/activation and *demonstrated call/enquiry volume* (the retention frame in business-context) are the cross-portfolio retention levers — invest there regardless of niche.
3. **LSA is a real differentiator but narrow.** Confirmed AU-eligible only for electrician and plumber in this batch; not available for cleaning, physio, hairdressing, PT. Treat the LSA-managed Scale tier as a trades-electrical/plumbing upsell, not a universal one.
4. **Pricing ladder pattern.** Trades/cleaning $39–49 entry; allied-health supports higher ($69) on willingness-to-pay; beauty/fitness pinned low ($39) by price-sensitivity; hospitality floored ($19–25) and uneconomic. Entry price tracks margin and demand-urgency, exactly as business-context predicts.
5. **"More local calls" frame fits services, not retail/hospitality.** The product's retention engine (tracked phone calls) is the screen: it fits trades/cleaning/health/fitness and mismatches café (walk-in) and florist (checkout) — the two clearest HOLDs-on-fit.

---

## Coverage & remaining queue

Analysed (10): electrician, plumber, house-cleaning, physiotherapy, hairdresser, personal-trainer (GO); cafe, accountant, florist, bricklayer (HOLD).

**Not yet analysed** (recommend batching after the build plan is set, since launch sequencing is already determined by the cross-category leads above):
- **Trades / home-services:** HVAC/air-con, carpenter, roofer, landscaper/lawn, painter, concreter, tiler, fencing, pest control, removalist, handyman, gardening.
- **Allied-health:** chiropractor, dentist (independent), podiatry, remedial massage, dietitian, psychology/counselling.
- **Beauty:** barber, nail salon, lash/brow, skin clinic / cosmetic injectables (policy-sensitive).
- **Fitness:** yoga/Pilates (standalone), martial arts/boxing.
- **Hospitality:** restaurant, caterer, bakery.
- **Professional services:** lawyer/conveyancer, mortgage broker (Credit Special-Ad-Category risk).
- **Retail:** boutique fashion, jeweller.
- **Automotive / pet / other:** mechanic, car detailing, dog grooming, photographers/videographers.

These will refine *which additional niches* ride each category build, but they will not change the recommended *build order* — the lead candidates already establish that trades → allied-health → beauty → fitness is the right sequence.

---

## What I recommend deciding at this checkpoint

1. **Approve the build order** (trades first, unlocking electrician + plumber + house-cleaning) so Phase B/C can begin — this is the revenue-critical path.
2. **Confirm the v1 launch set** (the Wave-1 trio, or a subset).
3. **Decide depth of further niche analysis** — batch the remaining queue now, or defer until after the trades build ships and validates the model.
