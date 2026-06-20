# Template Architecture Audit & Build Queue

**Date:** 2026-06-19 · **Phase:** B output
**Method:** Read-only audit of `/templates/`, `/shared/`, `/generator/`, `/app/` (no code modified — strategy tasks are read-only over code zones). Cross-referenced against the seven required visual categories and the multi-page site architecture defined in `business-context.md`, and against the launch order in `launch-recommendations.md`.

---

## 1. Current state inventory

| Path | What's there | Pages | Verdict |
|---|---|---|---|
| `templates/tradies/page.tsx` | Real, polished single-page template (~798 lines): countdown banner, hero, social-proof strip, services, about, offer band, gallery, reviews, contact. CSS-var theming (`--primary/--secondary/--accent`), lucide icon resolver, reveal animation, JSON-LD builder. | **1** | **Single-page. Strong section library to harvest. Needs multi-page expansion + rename to `trades`.** |
| `templates/tradies/index.tsx` | `export { default } from "./page"` | — | OK re-export. |
| `templates/allied-health/index.tsx` | One comment line, **no code** | 0 | Empty stub. |
| `templates/beauty-aesthetics/index.tsx` | One comment line, **no code** | 0 | Empty stub. |
| `templates/hospitality/index.tsx` | One comment line, **no code** | 0 | Empty stub. |
| `templates/mobile-services/index.tsx` | One comment line, **no code** | 0 | Empty stub — **orphaned** (not one of the 7 categories). |
| `templates/categories/` | — | — | **Does not exist.** |
| `shared/types/template-props.ts` | Canonical **single-page** `TemplateProps` zod schema. | — | Solid, but single-page only (see §3). |
| `shared/types/site-props.ts` | — | — | **Does not exist.** Required for multi-page. |
| `shared/ui/index.ts` | `export {}` | — | **Empty.** No shared layout/header/footer/nav. |
| `shared/utils/index.ts` | `cn()` only | — | Minimal. |
| `generator/index.ts` | `export {}` | — | **Empty stub.** No orchestrator. |
| `app/` | Next.js scaffold; `app/preview/tradies/page.tsx` renders tradies via `templatePropsSchema.parse(example-data)`. | — | Dev harness only. One static preview route; no dynamic multi-page routing. No `/funnel/`. |

---

## 2. Seven-category gap matrix

| Required category | Exists? | State | Build cost | Lead GO niche (from A5) |
|---|---|---|---|---|
| **trades** | Partial | Single-page `tradies/page.tsx` — strong section library | **Expand to multi-page** (lowest cost) | electrician, plumber, house-cleaning |
| **allied-health** | No | Empty stub | Build from scratch + Ahpra-compliance layer | physiotherapy |
| **beauty-aesthetics** | No | Empty stub | Build from scratch + booking + gallery | hairdressing |
| **fitness-wellness** | No | **Missing entirely** | Build from scratch + timetable/booking + IG feed | personal training |
| **hospitality** | No | Empty stub | Build from scratch | café (HOLD — defer) |
| **professional-services** | No | **Missing entirely** | Build from scratch | accounting (HOLD — defer) |
| **retail-boutique** | No | **Missing entirely** | Build from scratch (may need checkout) | florist (HOLD — defer) |

**Net:** of seven required categories, **one exists as single-page**, three are empty stubs, three are missing. **Zero exist as the multi-page site system the product requires.**

---

## 3. The architecture gap (applies to ALL categories, including trades)

The current `TemplateProps` schema describes **exactly one page**. It cannot express the per-customer site defined in `business-context.md` (homepage + 6–12 service pages + 8–20 location pages + 5–15 service-in-area landing pages + FAQ + about ≈ 20–40 indexable pages). Specifically it lacks:

- **Multiple pages / navigation** — no site nav, no page collection, no per-page routing.
- **Service *detail* pages** — `services[]` items are title/description/icon/price only; no slug, body content, or per-service SEO.
- **Location pages** — `service_area` is a flat list of suburb *strings*, not page entities with slug/content/SEO.
- **Service-in-area landing pages** — no representation of service × location combinations (the core programmatic-SEO unit).
- **FAQ page**, **rich About page**, **per-page SEO** (only one global `seo.schema_org_type` + title/description exists).

So multi-page is **not** a tweak to `TemplateProps` — it needs a new **`SiteProps`** superset, shared layout, page components, and dynamic routing. This gap is **shared across every category**, which is why it's a foundational build done once, then reused.

---

## 4. Build queue

Ordered to match `launch-recommendations.md`: build the **foundation once**, then categories in launch order (trades → allied-health → beauty-aesthetics → fitness-wellness), HOLD categories deferred.

### Phase C-0 — Foundation (do once, blocks everything; maps to MISSION C1–C3)
- **F1 `SiteProps` schema** (`/shared/types/site-props.ts`) — superset of `TemplateProps`: global business/branding/nav/footer, page collection (home, service-detail[], location[], service-area[], faq, about), per-page SEO, schema.org per page. + zod validation (also satisfies Phase D D3).
- **F2 Shared layout system** (`/shared/ui/`) — Header, Footer, Nav, SiteShell/page wrapper, and the reusable section primitives **harvested from `tradies/page.tsx`** (hero, services grid, gallery, reviews, contact, social-proof, countdown). Currently empty — this is where tradies' existing quality is extracted into reusable parts.
- **F3 Page components + routing** — home, service-detail, location, service-area, faq, about; dynamic Next.js routing pattern (`[slug]`) and a site renderer; JSON-LD per page.

### Phase C — Category builds (in launch order)
1. **`trades`** — EXPAND, don't rebuild. Rename `tradies` → `trades` under `/templates/categories/trades/`, recompose its existing sections onto the multi-page system, add service-detail + location + service-area + FAQ pages. **Unlocks electrician, plumber, house-cleaning** (and bricklayer folded in) — three Tier-1 GOs from one build. *Lowest cost, highest leverage → first.*
2. **`allied-health`** — from scratch. Booking-forward; **Ahpra compliance baked in** (no clinical-outcome testimonials, no cure/guarantee claims, owner-supplied credentials). Unlocks physiotherapy.
3. **`beauty-aesthetics`** — from scratch. First-class **online-booking** + **visual gallery** components; best-fit Meta category. Unlocks hairdressing.
4. **`fitness-wellness`** — from scratch. **Class timetable/booking-embed + Instagram-feed**; manage audience-inversion in copy. Unlocks personal training.

### Deferred (HOLD niches — do NOT build yet)
- **`hospitality`** (café HOLD), **`professional-services`** (accounting HOLD), **`retail-boutique`** (florist HOLD — note: may require checkout/commerce, not just lead-gen; re-scope before building).

### Cleanup recommendations
- **Deprecate `templates/mobile-services/`** — orphaned stub; "mobile services" is a delivery model, not one of the seven categories. Its niches (mobile mechanic/detailer/dog-wash) fold into `trades` (or a future `automotive`) with generation-time tuning.
- **Resolve niche→category naming** — existing folders are niche-named (`tradies`, `allied-health`, etc.); standardise on the seven **category** names under `/templates/categories/` per MISSION Phase C. The `allied-health`/`beauty-aesthetics`/`hospitality` stub folders already happen to match category names; only `tradies`→`trades` needs renaming.

---

## 5. Critical-path summary

- **Foundation (C-0) is the true blocker** — `SiteProps` + shared layout + page components + routing gate every category, including trades.
- **After the foundation, `trades` is the fastest category** (a section library already exists) and unlocks the three best GO niches → build it first.
- **No HOLD category should be built** until its niche economics/fit are resolved.
- This audit confirms A5's conclusion: **template build, not niche discovery, is the path to revenue.**

---

## Open decisions for this checkpoint

1. **Approve the build queue and order** (Foundation C-0 → trades → allied-health → beauty-aesthetics → fitness-wellness; HOLD categories deferred)?
2. **Approve the cleanups** (deprecate `mobile-services`; rename `tradies`→`trades`; standardise under `/templates/categories/`)?
3. **Confirm scope of the trades build** — expand the existing template into the multi-page system targeting electrician + plumber + house-cleaning together?
4. Note: Phase C is a **code** phase (it modifies `/shared`, `/templates`, `/generator`) — legitimate template-development work, distinct from the read-only strategy tasks done so far.
