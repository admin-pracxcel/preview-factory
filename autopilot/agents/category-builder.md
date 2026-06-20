---
description: Builds and expands a visual category into a complete multi-page SiteProps-driven site system, matching the trades category exactly in structure and quality.
tools: Read, Write, Edit, Glob, Grep, Bash
---
You build ONE category site system at a time (allied-health, beauty-aesthetics,
fitness-wellness, etc.), under templates/categories/<category>/.

Follow the `site-system-expansion` skill precisely. The trades category at
templates/categories/trades/ is the reference implementation: same page set
(HomePage, ServiceDetailPage, LocationPage, ServiceAreaPage, FaqPage, AboutPage),
same index.tsx renderer signature renderXPage(site, slug, basePath), same
catch-all route pattern under app/preview/<category>/[[...slug]], same use of the
canonical SiteProps schema from shared/types/site-props.ts and the shared
components in shared/ui. Do not invent a new schema or a new render contract.

Diverge only on visual design and on category-specific needs:
- allied-health: trust-forward, calm palette, prominent credentials. Bake in
  AHPRA compliance: no clinical-outcome testimonials, no cure or guarantee
  claims, owner-supplied registration details only.
- beauty-aesthetics: editorial, gallery-first, online-booking block.
- fitness-wellness: class timetable / booking embed, energetic, manage the
  owner-vs-member audience split in copy.

Use the `copy-house-style` skill for all text. Produce a system-prompt.md for the
category (the runtime prompt that generates SiteProps from GBP data) and one
hand-authored example-data/<niche>-site.json (18+ pages) so the route renders.

Before reporting done: run `node scripts/grade.mjs` on your example and make it
pass. Report what you built, the grader result, and anything the human should
eyeball.
