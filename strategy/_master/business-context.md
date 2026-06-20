# Preview Factory — Business Context

## Core model
AI-generated website preview → 3-hour free trial → SaaS subscription. Meta ads acquire leads. 3-field form (business name, niche, suburb) triggers GBP scrape via Outscraper, Claude Sonnet 4.6 generates TemplateProps, Vercel deploys to subdomain. User customises (logo, colour, hero image) free during preview. Tiered pricing per niche.

## Target market
Australian small businesses, owner-operated, with existing Google Business Profile presence. Geographic concentration in metro and regional postcodes. Owner is decision-maker, low digital sophistication, current website is absent or sub-2018 quality.

## Tech stack
Vercel (hosting + deployment API), Claude Sonnet 4.6 (content generation), n8n on Hetzner (orchestration), Supabase (data layer), Stripe (billing), Twilio (SMS), Postmark (email), Outscraper (GBP data), Cloudflare (DNS + Turnstile).

## Templates
Niche-specific Next.js + Tailwind templates. Each template accepts a canonical TemplateProps schema. Templates are the quality ceiling of the product — must visually impress someone in that niche, not generic AI output. Already built locally for several niches.

## Site structure per customer
Single domain with multiple indexable pages: homepage, 6-10 service pages, 5-15 service-area pages, FAQ page, location-specific landing pages. Programmatic local SEO, not single-page sites.

## Pricing philosophy
Entry tier must be a no-brainer relative to delivered value in that niche. For low-margin niches (cafes, food trucks), this is $19-29. For high-margin services (cosmetic surgery, dentistry), it could be $99-199 — too low signals low value. Pricing is per-niche, per-service not universal.

## Upsells
Monthly SEO, Google ads management, meta ads management, review acquisition tools (bundled in higher tiers). Triggered by behavioural events (first form submission, plateau detection), not time-based. Self-serve dashboard for upgrades, not human calls at entry tier.

## Human time tiering
Entry tier: zero scheduled human time. Mid tier: 1 strategy call per quarter. Top tier: 1 call per month plus async channel. Anything below $99 stays fully self-serve.

## Customer outcome frame
What customers actually buy is "more phone calls from people in my suburb." Every site has call tracking. Monthly automated reports show calls generated. This is the retention frame.

## Channels
Meta ads (primary, via job title and behavioural targeting).

## Compliance
Australian Spam Act 2003 (post-conversion consent only), Privacy Act 1988 (APP 7), Stripe dispute ratio < 0.75%, Meta ad policy compliance. ABN-registered Pty Ltd by month 3.

## Key risks
Meta ad account suspension (mitigation: two parallel accounts), Google content penalty (mitigation: programmatic local pages, not blog farms), support burden (mitigation: edit caps on entry tier), competitor pricing pressure (mitigation: vertical-specific template quality).

## What this project decides
Which niches to target, what to price each at, how to position templates per niche, what upsells fit each niche, and the rollout priority order.

## Site architecture (updated)
Each customer's "site" is a multi-page Next.js app, not a single page. Per-customer structure: homepage + 6-12 service pages + 8-20 location pages + 5-15 service-in-area landing pages + FAQ + about. Roughly 20-40 indexable pages per customer site. Programmatic local SEO is the entire ranking strategy.

## Template architecture (updated)
Templates are organised by VISUAL CATEGORY, not by niche. Seven categories cover the full universe of Australian small service businesses: trades, allied-health, beauty-aesthetics, professional-services, hospitality, fitness-wellness, retail-boutique. Each niche maps to one category. Niche-specific tuning (colour emphasis, section priority, content tone) happens at GENERATION TIME via the niche-specific system prompt — not by building new templates.

## What already exists
Initial templates were built via Claude Code in this same project folder. Audit `/templates/` to determine current state — which categories exist, whether they're single-page or full site systems, what's missing.

## Operating mode
This project runs autonomously following `_master/MISSION.md`. On every task, read MISSION.md and `_master/state.md` to determine current phase and next action. Execute unblocked tasks, update state.md, pause at defined checkpoints for human review.

## Customer journey specification
The complete customer experience is documented in `strategy/_master/customer-journey.md`. All funnel work in Phase E must implement this specification. The journey document is the source of truth for UX decisions, not assumptions or defaults.
