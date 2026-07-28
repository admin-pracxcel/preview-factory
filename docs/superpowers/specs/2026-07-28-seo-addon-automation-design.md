# SEO add-on automation — design

**Status:** approved for implementation planning.
**Date:** 2026-07-28.
**Author:** Bilal + Claude (brainstorming session).
**Scope:** blog + Google Business Profile (GBP) automation for the SEO add-on. Directory citations remain manual and are out of scope for this spec.

## 1. Goal

When a customer subscribes to any SEO tier (Starter $29/mo, Growth $59/mo, Pro $79/mo), the platform automatically:
- Publishes blog posts on their generated website — 4 / 8 / 16 per month by tier, first post on subscribe day, rest spread evenly.
- Publishes matching Google Business Profile posts on the same days, via a Google OAuth delegation the customer completes immediately after checkout.

Both automations are fully hands-off after subscribe. Non-technical customers do nothing except sign in to Google once.

## 2. Decisions locked

| Decision | Choice |
|---|---|
| Blog review model | Fully automated. No human queue. |
| Blog storage | Supabase `blog_posts` table; rendered live at request time (no redeploy per post). |
| Publish time | 06:00 AEST, same for every tenant. |
| Blog generation timing | Just-in-time each publish day. |
| Topic source | Claude picks per publish day, using tenant's category + services + suburb + last 10 published titles for dedup. |
| GBP failure UX | Blog keeps running; GBP paused; dashboard banner + Postmark nudges on day 3 and 7. Never blocks the subscription. |

## 3. System shape

Two independent cron-driven automations, wired to the tenant's active SEO subscription and never blocking each other. Both fire from the same 06:00 AEST tick and share one cadence engine so their schedules stay in lockstep.

**All Claude calls happen inside n8n via Claude Code.** Vercel routes never call `api.anthropic.com`. Vercel exposes read endpoints (which tenants are due, tenant context) and write endpoints (validated inserts / GBP-publish). n8n owns the workflow, the LLM invocation, and the fan-out loop.

```
n8n cron (06:00 AEST daily)
   │
   ├─▶ GET  /api/admin/seo/due-tenants?kind=blog   → list of due tenants + full generation context
   │      │
   │      ▼
   │   for each tenant: n8n → Claude Code → generated post JSON
   │      │
   │      ▼
   │   POST /api/admin/seo/blog-posts (per tenant)  → Zod-validate + insert into blog_posts
   │
   └─▶ GET  /api/admin/seo/due-tenants?kind=gbp    → list of due tenants that also have an active GBP connection
          │
          ▼
       for each tenant: n8n → Claude Code → generated GBP post JSON
          │
          ▼
       POST /api/admin/gbp/publish/[tenantId]      → Vercel reads refresh_token, exchanges, calls Business Profile API
```

## 4. Data model

New migration: `strategy/_master/migrations/2026-07-28-seo-automation.sql`.

### `blog_posts`
One row per published post. Rendered live from the customer-site route.

```sql
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  body_md TEXT NOT NULL,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'published',
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generation_meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_blog_posts_tenant_slug ON blog_posts(tenant_id, slug);
CREATE INDEX idx_blog_posts_tenant_published ON blog_posts(tenant_id, published_at DESC);
```

### `tenant_gbp_connections`
One row per tenant with an active OAuth connection to Google Business Profile.

```sql
CREATE TABLE tenant_gbp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  gbp_account_id TEXT NOT NULL,
  gbp_location_id TEXT NOT NULL,
  gbp_location_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_used_at TIMESTAMPTZ,
  last_error TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`refresh_token_encrypted` uses pgsodium column encryption. Plaintext never leaves Vercel.

### `seo_publish_log`
Every fire attempt, for debugging + monthly reporting.

```sql
CREATE TABLE seo_publish_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,               -- 'blog' | 'gbp'
  status TEXT NOT NULL,             -- 'success' | 'skipped' | 'failed'
  reason TEXT,
  blog_post_id UUID REFERENCES blog_posts(id) ON DELETE SET NULL,
  cron_run_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_seo_publish_log_tenant_time ON seo_publish_log(tenant_id, cron_run_at DESC);
```

### Additive columns on `tenant_addons`
Idempotency guards so a duplicate cron run doesn't double-post.

```sql
ALTER TABLE tenant_addons
  ADD COLUMN IF NOT EXISTS last_blog_tick_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_gbp_tick_at  TIMESTAMPTZ;
```

`subscribed_at` already exists and anchors the cadence.

### RLS
All three tables: `service_role`-only. Dashboard reads via server components using the service role. `blog_posts` served publicly through the SSR page route, not from the client.

## 5. Cadence engine

Single pure function, testable in isolation. Lives at `lib/seo/cadence.ts`.

```ts
export function postsPerMonth(tier: SeoTier): number {
  return { starter: 4, growth: 8, pro: 16 }[tier];
}

export function isPublishDay(args: {
  subscribedAt: Date;
  tier: SeoTier;
  today: Date;
}): boolean {
  const n = postsPerMonth(args.tier);
  const dayOfCycle = daysBetween(args.subscribedAt, args.today) % 30;
  const spacing = args.tier === "pro" ? 2 : Math.floor(30 / n);
  return dayOfCycle % spacing === 0 && dayOfCycle < spacing * n;
}
```

Behaviour by tier:
- **Starter (4/mo)**: days 0, 7, 14, 21.
- **Growth (8/mo)**: days 0, 3, 6, 9, 12, 15, 18, 21.
- **Pro (16/mo)**: days 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30 — special-cased to spread across the whole month instead of the naive `floor(30/16)=1` which would publish 16 consecutive days then rest.

`subscribed_at` never resets on renewal — the row keeps rolling, so cycles stay clean. Cancellation short-circuits at the `status='active'` check upstream.

## 6. Blog automation flow

**n8n workflow** (`n8n/seo-blog-tick.json`), triggered by a cron node at 06:00 AEST daily:

```
1. HTTP Request: GET https://<app>/api/admin/seo/due-tenants?kind=blog
      auth: x-cron-secret header
      response: [
        {
          tenantId, category, business_name, services[], suburb, brand_voice,
          recent_titles[]   // last 10, for dedup guard
        }, ...
      ]

2. Split-in-Batches over the array. For each tenant:

   2a. Claude Code node — runs the category prompt (trades/allied-health/
       beauty/fitness) with the tenant context. Returns strict JSON:
         { title, slug, excerpt, body_md, cover_image_query }

   2b. HTTP Request: GET Pexels API with cover_image_query
         → cover_image_url (falls back to category default if 0 hits)

   2c. HTTP Request: POST https://<app>/api/admin/seo/blog-posts
         body: { tenantId, ...postJson, cover_image_url }
         Vercel Zod-validates and inserts blog_posts + seo_publish_log rows,
         stamps tenant_addons.last_blog_tick_at.

3. If any per-tenant step fails: continue the loop (don't fail the whole
   cron), and n8n logs the failure to seo_publish_log via a POST to
   /api/admin/seo/log-failure.
```

### Vercel endpoints

- `GET /api/admin/seo/due-tenants?kind=blog|gbp` — walks `tenant_addons` where `addon_key='seo' AND status='active'`, applies `isPublishDay(...)`, filters `last_(blog|gbp)_tick_at` for AEST-calendar-day idempotency, joins tenant context (category, services, suburb, brand voice, last 10 blog titles) and — for `kind=gbp` only — inner-joins `tenant_gbp_connections` where `status='active'`.
- `POST /api/admin/seo/blog-posts` — Zod-validates `{tenantId, title, slug, excerpt, body_md, cover_image_url, generation_meta}`, inserts into `blog_posts`, inserts `seo_publish_log` row `status='success'`, stamps `tenant_addons.last_blog_tick_at`.
- `POST /api/admin/seo/log-failure` — inserts `seo_publish_log` row `status='failed'` with the reason string.

All three routes require `x-cron-secret: $CRON_SECRET` header. No auth cookie, no user session.

### Rendering (SSR, no client)

- `app/preview/site/[tenantId]/blog/page.tsx` — index page. Reads `blog_posts` by `tenant_id`, orders by `published_at DESC`, paginated.
- `app/preview/site/[tenantId]/blog/[slug]/page.tsx` — post page. Renders `body_md` via `react-markdown`, Article JSON-LD, canonical, OG image = `cover_image_url`.
- Nav in `shared/ui/sections.tsx` gets a "Blog" link when the tenant has ≥1 published post (server-computed).
- `app/sitemap.xml/route.ts` appends `/blog` and each `/blog/<slug>` per tenant.

## 7. GBP OAuth + posting

### OAuth trigger flow (customer just paid for SEO)

1. Stripe checkout success → redirect to `/dashboard/[tenantId]?connect_gbp=1`.
2. Dashboard sees the flag, opens a modal: *"One last step: connect your Google Business Profile so we can post there on your behalf."* Single CTA: **Connect Google Business Profile**.
3. Click → `GET /api/auth/gbp/start?tenantId=…` → 302 to Google's OAuth consent URL with:
   - `scope=https://www.googleapis.com/auth/business.manage`
   - `access_type=offline` + `prompt=consent` (forces refresh_token)
   - `state=<signed JWT: tenantId + nonce>`
4. Customer signs in with the Google account that owns/manages their GBP, clicks Allow.
5. Google redirects to `GET /api/auth/gbp/callback?code=…&state=…`. We verify state, exchange code for tokens, then hit:
   - `mybusinessaccountmanagement.googleapis.com/v1/accounts` → list accounts
   - `mybusinessbusinessinformation.googleapis.com/v1/accounts/{id}/locations` → list locations
6. **If one location total**: auto-select, encrypt+store refresh_token, redirect to dashboard with success banner.
7. **If multiple**: render `/dashboard/[tenantId]/gbp/pick-location` — thumbnail + business name + address per option. Customer picks.
8. Upsert `tenant_gbp_connections` on `tenant_id`. `refresh_token` encrypted via pgsodium column encryption.

### Posting flow (same 06:00 AEST tick)

**n8n workflow** (`n8n/seo-gbp-tick.json`):

```
1. HTTP Request: GET /api/admin/seo/due-tenants?kind=gbp
      response: same shape as blog, plus gbp_location_name for
      Claude Code to reference in the post copy. Only returns
      tenants whose tenant_gbp_connections is active.

2. Split-in-Batches. For each tenant:

   2a. Claude Code node — GBP-specific prompt (shorter format,
       one CTA). Returns:
         { summary, cta_label, cover_image_query }

   2b. HTTP Request: GET Pexels API → cover_image_url

   2c. HTTP Request: POST /api/admin/gbp/publish/[tenantId]
         body: { summary, cta_label, cover_image_url }
         Vercel handles the whole Google side: reads encrypted
         refresh_token, exchanges for access_token, POSTs to
         Business Profile API. Returns { status, googlePostId } or
         { status:'failed', reason }.

3. Vercel-side response classification (inside /api/admin/gbp/publish):
   - 200:      log 'success', set last_gbp_tick_at, return 200
   - 401/403:  mark tenant_gbp_connections.status='revoked',
               log 'failed' reason='revoked', return 200 with
               classification so n8n doesn't retry
   - 5xx:      log 'failed' reason='google_5xx', return 502 so
               n8n keeps the failure visible but doesn't retry
               inside the same run (next day's cron retries)
```

Refresh tokens never leave Vercel. Claude Code never sees a Google credential. n8n never sees the refresh token.

GBP posts are generated independently of that day's blog post — shorter, more casual, one CTA. They share topic themes for the week but never echo the blog title verbatim.

Refresh-token rotation is handled silently inside `/api/admin/gbp/publish` during the exchange step.

### Risk: GBP local-posts API is access-restricted

Google restricts write access to the Business Profile Local Posts endpoints. New Google Cloud projects are not automatically granted `localPosts.create`; the project needs to apply via the Google Business Profile API access request form and be approved. Approval typically takes 1–3 weeks and requires:
- Verified GCP project with billing enabled
- Justification of the use case (managed local marketing service)
- Screenshots or demo of the intended posting flow

**Mitigation:** submit the access request the same day the GCP project is created (Human-must-do §9). If approval is denied or delayed, Phase 5 (GBP posting) stays queued but Phase 4 (OAuth connect) can still ship — customers can connect their account and see the "connected" state on the dashboard while we work through approval. Blog automation is entirely unaffected.

## 8. Dashboard surfaces + failure UX

Three new surfaces in `app/dashboard/[tenantId]/`:

1. **`SeoStatusCard`** — appears when tenant has an active SEO subscription. Shows current tier, next publish date, last 3 published blog posts (title + date + link), GBP connection pill (green ✓ / yellow ! / red ✕).
2. **GBP disconnected banner** — persistent yellow banner at top of dashboard if SEO active + no valid GBP connection. Copy: *"Your Google Business Profile isn't connected — GBP posts are paused. Connect now →"*. Dismissable per-session but reappears next visit.
3. **Email nudges** (Postmark, fired by n8n):
   - Day 3: *"Quick heads-up: your Google Business Profile still needs connecting"*
   - Day 7: *"Reminder: 7 days without GBP connected — you're missing GBP posts"*
   - Day 30: log to admin, don't nag further.

### Failure matrix

| Failure | Blog behaviour | GBP behaviour | Customer sees |
|---|---|---|---|
| Claude Code fails inside n8n | n8n's per-node retry (max 2); after that skip tenant, log `failed`, continue loop | Same | Nothing (silent) |
| Vercel write-endpoint 5xx | n8n retries the POST once; then logs `failed`, continues | Same | Nothing |
| GBP token revoked | Blog unaffected | Skip; mark revoked; banner + email | Banner + email |
| GBP API 5xx | Blog unaffected | Retry tomorrow (next cron run) | Nothing |
| Customer cancels SEO | Stop; keep existing posts live | Stop; keep OAuth 30 days then delete | Posts stay on site |

## 9. Human-must-do additions

Two new items appended to `strategy/_master/what-human-must-do.md`:

### Google Cloud project (~30 min, one-off)
- Create GCP project `launcharoo-prod`.
- Enable APIs: Google Business Profile API, My Business Account Management API, My Business Business Information API.
- Configure OAuth consent screen — External, scope `business.manage`, add privacy + ToS URLs.
- Create OAuth 2.0 Client ID (Web application). Authorised redirect URIs: `https://<prod-domain>/api/auth/gbp/callback` + preview + localhost.
- Copy client ID + secret into Vercel env: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`.

### OAuth verification (~4-6 weeks, submit ASAP)
- `business.manage` is a sensitive scope. Until verified we are capped at 100 users lifetime and users see an "unverified app" warning screen.
- Submission needs: verified domain ownership, privacy policy, ToS, YouTube demo video of the OAuth flow, written justification. Google review ~4-6 weeks.
- Recommendation: launch unverified for the first cohort (well under 100), submit for verification the day of first paid GBP subscribe.

New env-var block for `strategy/_master/addons-stripe-setup.md`:
- `CRON_SECRET` (shared secret between n8n and `/api/cron/seo/*`)
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `PGSODIUM_KEY_ID` (encryption key for `refresh_token_encrypted`)

## 10. Rollout order

Small phases, each independently useful and grader-passable. Approx. 1-2 days per phase.

1. **Migration + cadence engine** — SQL migration, `lib/seo/cadence.ts` + unit tests. No user-facing change.
2. **Blog storage + rendering** — `/blog` + `/blog/[slug]` routes, sitemap update. Seed one row manually to prove render.
3. **Blog automation** — category-aware Claude prompts, `/api/cron/seo/blog-tick`, n8n workflow JSON. Fire manually first, then wire cron.
4. **GBP OAuth** — `/api/auth/gbp/start` + `/api/auth/gbp/callback` + location picker. No posting yet — just proves connect + revoke.
5. **GBP posting** — `/api/cron/seo/gbp-tick`, second n8n workflow, Postmark nudge templates, dashboard banner.
6. **Dashboard `SeoStatusCard`** — polish the customer-facing surface.

Every phase gated on `next build` + grader passing before commit.

## 11. Out of scope for this spec

- Directory citations (manual).
- Google Ads and Meta Ads add-ons — separate specs.
- Blog analytics / internal-linking passes / customer notifications on new posts — leave `blog-published` webhook stub so we can add later.
- Multi-language content.
- Non-AEST timezones.
