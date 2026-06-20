---
name: site-system-expansion
description: Use when building or expanding a Preview Factory visual category into a complete multi-page site system. Covers the exact structure, render contract, schema, and component reuse that every category must match. Trigger for any work under templates/categories/<category>/.
---
# Site system expansion

Every category is a multi-page site rendered from a single validated `SiteProps`
blob. The trades category is the reference. Match it exactly in structure; diverge
only on visual design and category-specific sections.

## Non-negotiable contract (copy from trades)
- Schema: import the canonical `sitePropsSchema` / `SiteProps` from
  `shared/types/site-props.ts`. Never define a parallel schema. If real data needs
  a new field, extend site-props.ts once (shared by all categories) and re-grade.
- Pages: `pages/HomePage.tsx`, `ServiceDetailPage.tsx`, `LocationPage.tsx`,
  `ServiceAreaPage.tsx`, `FaqPage.tsx`, `AboutPage.tsx`. Same props signature
  `({ site, basePath, page })`.
- Renderer: `templates/categories/<cat>/index.tsx` exporting
  `render<Cat>Page(site, slug, basePath)` and `<cat>PageMetadata(site, slug)`,
  resolving slug[] exactly as trades does (services/<slug>, locations/<slug>,
  areas/<slug>, faq, about, home).
- Route: `app/preview/<cat>/[[...slug]]/page.tsx` using `generateStaticParams`
  from `enumerateSitePaths(site)`, `generateMetadata`, and the renderer.
- Shared UI: reuse `shared/ui` (layout, sections, seo, icons, theme, helpers).
  Harvest new primitives into shared/ui rather than duplicating per category.
- SEO: every page emits JSON-LD with the correct schema.org @type
  (LocalBusiness + niche subtype on home, Service on service pages, FAQPage on
  FAQ, BreadcrumbList, AggregateRating from review count). The grader checks this.

## Per category
- Each category ships a `system-prompt.md` (runtime prompt that turns GBP data
  into SiteProps for that category) and one `example-data/<niche>-site.json`
  (18+ pages) so the route renders for review.

## Definition of done
`node scripts/grade.mjs` passes on the category's example, the route renders all
enumerated paths, and `next build` is green on linux. Then it is a human visual
checkpoint (decision gate), not an agent decision.
