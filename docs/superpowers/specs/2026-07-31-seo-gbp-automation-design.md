# SEO GBP automation — design

**Status:** approved for implementation planning.
**Date:** 2026-07-31.
**Author:** Bilal + Claude (brainstorming session).
**Scope:** Google Business Profile (GBP) post automation for SEO addon subscribers. Blog automation shipped separately (see rollout log below). Directory citations remain out of scope.
**Supersedes:** §7-8 of `2026-07-28-seo-addon-automation-design.md`. That document's blog sections (§1-6) shipped 2026-07-28 through 2026-07-31 and are still authoritative; only the GBP sections are replaced by this doc.

## 1. Goal

When a tenant has an active SEO subscription and has connected their Google Business Profile, the platform automatically publishes one GBP "What's New" post per publish day, on the same cadence as the blog. Fully hands-off after the customer completes the one-time OAuth connect.

Non-goals: GBP EVENT / OFFER / PRODUCT post types (v1 STANDARD only), directory citation submissions (manual), review-response automation (separate feature).

## 2. Decisions locked

| Decision | Choice |
|---|---|
| Connection model | Full OAuth: customer signs into Google once, refresh_token stored encrypted, cron auto-publishes |
| Cadence | Same as blog: Starter 4/mo, Growth 8/mo, Pro 16/mo, `isPublishDay()` shared |
| Post type (v1) | STANDARD ("What's New") only |
| Cron tick | Same 06:00 AEST tick as blog (single cron, two kinds) |
| Content model | Fully automated. No human queue. |
| Failure UX | GBP paused on revoked token; blog keeps running; dashboard banner + Postmark day-3/day-7 nudges |
| Character budget | Prompt targets 500-1200 chars (Google limit 1500) |
| Blog↔GBP topic sharing | On blog-publish days, GBP post teases the blog post + links to it. Non-blog days generate standalone. |

## 3. Architecture (reuses blog primitives)

Same shape as blog: Vercel exposes read/write endpoints, n8n owns the cron + Claude Code invocation + fan-out loop. Claude calls happen inside n8n via `Execute Command` shelling to a repo-side `tsx` CLI. **No `api.anthropic.com` from Vercel. No Google credentials in n8n or Claude Code.**

The GBP workflow is a **separate n8n workflow** from the blog workflow, with its own `scheduleTrigger` node using the same cron expression (`0 20 * * *` UTC = 06:00 AEST). They fire independently — a blog-workflow failure does not block GBP, and vice versa. The "shared tick" is a semantic promise about publish dates, not a technical coupling between workflows.

```
n8n cron (06:00 AEST, same as blog)
   │
   ├─▶ SEO Blog Tick (already shipped)
   │
   └─▶ SEO GBP Tick (this spec)
          │
          ▼
       GET /api/admin/seo/due-tenants?kind=gbp
          → tenants with active SEO addon AND active tenant_gbp_connection
          → same shape as ?kind=blog but adds gbp_location_name and
            last_blog_post (title+slug+publishedAt) so the CLI can
            optionally tease it
          │
          ▼
       splitOut over tenants → For each tenant (splitInBatches):
          │
          ▼
       Prep payload (base64) → Run generator (Execute Command)
          → scripts/seo-gbp-generate.ts → lib/claude-cli.ts
          → prints envelope { ok, post: { summary, cta_type, cta_url,
                                          cover_image_query }, meta }
          │
          ▼
       Parse envelope → IF ok
          │                              │
          ▼ true                         ▼ false
       Pexels cover image              Log failure (POST /api/admin/seo/log-failure)
          │
          ▼
       POST /api/admin/gbp/publish/[tenantId]
          → Vercel: decrypt refresh_token, exchange for access_token,
            googleapis SDK → mybusinessplaceactions.googleapis.com/v1/
            {location}/localPosts, classify response, stamp last_gbp_tick_at
          │
          ▼
       loop back to For each tenant
```

Refresh tokens never leave Vercel. Claude Code never sees a Google credential. n8n never sees the refresh token.

## 4. Data model

New migration: `strategy/_master/migrations/2026-07-31-seo-gbp.sql`. Idempotent.

### `tenant_gbp_connections`

```sql
CREATE TABLE IF NOT EXISTS tenant_gbp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  gbp_account_id TEXT NOT NULL,
  gbp_location_id TEXT NOT NULL,     -- Google's `locations/{id}` form stored bare
  gbp_location_name TEXT NOT NULL,   -- Human-readable, for prompt + dashboard
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'error')),
  last_used_at TIMESTAMPTZ,
  last_error TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tenant_gbp_connections ENABLE ROW LEVEL SECURITY;
```

`refresh_token_encrypted` uses pgsodium column encryption via a Postgres function. Plaintext never returned to the client; the publish route calls a server-side `pgsodium.crypto_aead_det_decrypt(...)` when it needs to exchange.

### Additive columns on `tenant_addons`

```sql
ALTER TABLE tenant_addons
  ADD COLUMN IF NOT EXISTS last_gbp_tick_at TIMESTAMPTZ;
```

`last_blog_tick_at` already exists from the blog migration. Same idempotency guard pattern: AEST calendar-day key.

### `gbp_posts`

Needed for the dashboard's "recent GBP posts" surface (§8) and to store Google's post identifier for later deletion / edit flows. `seo_publish_log` only records outcomes, not content.

```sql
CREATE TABLE IF NOT EXISTS gbp_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  google_post_id TEXT NOT NULL,     -- Full name from Google, e.g. accounts/.../locations/.../localPosts/...
  summary TEXT NOT NULL,
  cta_type TEXT,
  cta_url TEXT,
  cover_image_url TEXT,
  linked_blog_post_id UUID REFERENCES blog_posts(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generation_meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_gbp_posts_tenant_published
  ON gbp_posts(tenant_id, published_at DESC);

ALTER TABLE gbp_posts ENABLE ROW LEVEL SECURITY;
```

## 5. OAuth flow

### Trigger

Two entry points:
1. **Post-checkout** — Stripe success → redirect to `/dashboard/[tenantId]?connect_gbp=1`. Dashboard sees the flag, opens a modal: *"One last step: connect your Google Business Profile so we can post there on your behalf."* CTA: **Connect Google Business Profile**.
2. **Dashboard status pill** — the SeoStatusCard's GBP pill is red/yellow when disconnected; clicking it starts the flow.

### Endpoints

- `GET /api/auth/gbp/start?tenantId=<uuid>` — session-cookie-authenticated (the dashboard is the only caller). Signs a JWT `state` with tenantId + nonce + 10-min expiry, redirects to Google:

  ```
  https://accounts.google.com/o/oauth2/v2/auth?
    client_id=$GOOGLE_OAUTH_CLIENT_ID
    &redirect_uri=$APP_BASE_URL/api/auth/gbp/callback
    &response_type=code
    &scope=https://www.googleapis.com/auth/business.manage
    &access_type=offline
    &prompt=consent    # forces refresh_token even on re-consent
    &state=<signed JWT>
  ```

- `GET /api/auth/gbp/callback?code=&state=` — verifies state signature, exchanges code for tokens using `googleapis` `OAuth2Client.getToken()`. If no `refresh_token` in the response, error out with a clear message (this can happen if the user has previously granted consent without `prompt=consent` — our start forces it, so this shouldn't fire).

  Then calls `mybusinessaccountmanagement.googleapis.com/v1/accounts` → for each account, `mybusinessbusinessinformation.googleapis.com/v1/accounts/{id}/locations`. Collects a flat list of `{ accountId, locationId, locationName, address }`.

  - 0 locations → redirect to dashboard with error: *"That Google account doesn't manage any Business Profile locations. Sign in with the account that owns your listing."*
  - 1 location → auto-select, encrypt refresh_token, upsert `tenant_gbp_connections`, redirect to dashboard with success banner.
  - 2+ locations → temp-store the token+locations in a signed cookie (short TTL), redirect to `/dashboard/[tenantId]/gbp/pick-location`.

- `GET /dashboard/[tenantId]/gbp/pick-location` — server component, reads the cookie, renders a list of `{ name, address }` radio-style cards. Submit posts to `POST /api/auth/gbp/finalize` which upserts the connection with the picked location and clears the cookie.

### State signing secret

New env var: `OAUTH_STATE_SECRET` (32-byte random hex, set once in Vercel + rotated only on suspected compromise). Separate from `CRON_SECRET`; separate lifecycle.

### Refresh-token encryption

pgsodium is already available on Supabase's managed Postgres. Encryption uses the `key_id` referenced by a per-project `PGSODIUM_KEY_ID` env var. Encrypt/decrypt is done via SQL functions (`pgsodium.crypto_aead_det_encrypt` / `_decrypt`) called from Postgres, so the plaintext never appears in Node memory outside the publish route's ephemeral scope.

## 6. Content generation

### CLI

`scripts/seo-gbp-generate.ts` — same shape as `scripts/seo-blog-generate.ts`:
- reads base64 JSON payload from stdin (tenant context + optional last blog post)
- reads `strategy/_master/claude-code-prompts/gbp-<category>.md`
- calls `callClaudeCli({systemPrompt, userPrompt, jsonSchema})`
- emits envelope `{v:1, ok:true, post: {...}, meta: {...}}` on stdout

### Prompt files

Four new files, same convention as blog:
- `strategy/_master/claude-code-prompts/gbp-trades.md`
- `strategy/_master/claude-code-prompts/gbp-allied-health.md`
- `strategy/_master/claude-code-prompts/gbp-beauty-aesthetics.md`
- `strategy/_master/claude-code-prompts/gbp-fitness-wellness.md`

Each covers:
- Voice + compliance rules (same as blog: AU English, no em-dashes, no outcome claims, no cliches)
- Length: 500-1200 chars for the summary body
- CTA type + URL guidance per category (trades → `CALL` + tel URL, allied-health/beauty → `BOOK`, fitness → `LEARN_MORE`)
- **Blog integration** — the `/due-tenants?kind=gbp` route includes `last_blog_post: { id, slug, title, publishedAt } | null` when today or the previous day was a blog-publish day. If present, the prompt prefers teasing that post ("New on the blog: [title] — [one-sentence teaser]") with CTA URL = the blog post URL. The CLI passes `linked_blog_post_id` (the ID it received, verbatim) through to the publish endpoint so it doesn't have to look up the ID from a slug. Absent = generate a standalone GBP post.
- Never invent business phone / booking URL. Use only what's provided.

### JSON output schema

```ts
{
  summary: { type: "string", minLength: 200, maxLength: 1500 },
  cta_type: { enum: ["LEARN_MORE", "BOOK", "CALL", "ORDER", "SIGN_UP", "NONE"] },
  cta_url: { type: "string", format: "uri" },   // required unless cta_type === "NONE"; for CALL, tel: URI
  cover_image_query: { type: "string", minLength: 1, maxLength: 100 },
  linked_blog_post_id: { type: ["string", "null"] }  // pass-through of the id from `last_blog_post` when teasing; null otherwise
}
```

Same `structured_output` extraction path as blog. Same `extractJsonObject` fallback if the model wraps the response.

## 7. Publish endpoint

`POST /api/admin/gbp/publish/[tenantId]` — cron-secret-authenticated, called by n8n once per due tenant.

### Body

```ts
{
  summary: string,
  cta_type: "LEARN_MORE" | "BOOK" | "CALL" | "ORDER" | "SIGN_UP" | "NONE",
  cta_url?: string,
  coverImageUrl?: string,
  linkedBlogPostId?: string,
  generationMeta?: Record<string, unknown>
}
```

Zod-validated. `cta_url` required unless `cta_type === "NONE"`.

### Flow

```
1. assertCronRequest(req)  // shared with blog routes
2. Load tenant_gbp_connections row for tenantId. If missing or status != 'active',
   respond 200 with { status: 'skipped', reason: 'no_active_connection' }.
3. Decrypt refresh_token via SQL function call.
4. gbpPublisher.publish({
     locationName: connection.gbp_location_id,   // "accounts/x/locations/y"
     refreshToken,
     post: { summary, cta_type, cta_url, coverImageUrl },
   })
5. Classify response:
   - 200: insert gbp_posts row, log seo_publish_log 'success',
          stamp last_gbp_tick_at, respond 200 { status: 'success', googlePostId }
   - 401/403: mark connection status='revoked', log seo_publish_log 'failed'
          reason='revoked', queue day-3 email (Postmark), respond 200
          { status: 'revoked' } — n8n does NOT retry
   - 429: respond 502 { status: 'rate_limited' } — n8n keeps failure visible;
          next cron retries tomorrow
   - other 5xx: log seo_publish_log 'failed' reason='google_5xx', respond 502
   - Google validation error: log 'failed' reason=<google error msg>, respond 200
          { status: 'failed' } so n8n doesn't retry a bad payload
```

### Publisher abstraction

`lib/gbp/publisher.ts` — interface for testability and pre-approval unblocking:

```ts
interface GbpPublisher {
  publish(args: PublishArgs): Promise<PublishResult>;
}

// Two impls:
// - GoogleGbpPublisher (real, wraps googleapis)
// - MockGbpPublisher (test double, deterministic responses keyed off summary content)

// Selector:
export function gbpPublisher(): GbpPublisher {
  if (process.env.GBP_MOCK === "1") return new MockGbpPublisher();
  return new GoogleGbpPublisher();
}
```

`GBP_MOCK=1` used in local dev + Vercel Preview until Google approval lands. Production has no `GBP_MOCK` env, so it uses the real publisher.

## 8. Dashboard surfaces

- **`SeoStatusCard`** (existing, extended) — adds a GBP pill row next to the existing tier/next-publish/recent-posts sections:
  - `active` → green ✓ "Google Business Profile connected" + last posted date
  - `revoked` / no connection → red pill "GBP not connected" + inline CTA to connect
  - `error` → yellow pill "GBP connection has an issue" + link to reconnect
  Below the blog "recent posts" list, adds a separate "recent GBP posts" list (3 most recent from `gbp_posts`) showing summary snippet + a link to view the post on Google. Blog and GBP posts are visually distinct — not merged into one list.

- **GBP disconnected banner** — persistent yellow banner at top of dashboard when SEO active + no valid GBP connection. Dismissable for the session, reappears next visit. Copy: *"Your Google Business Profile isn't connected — GBP posts are paused. Connect now →"*.

- **`/dashboard/[tenantId]/gbp/pick-location`** — new page, shown only when the OAuth callback yields >1 location. Renders a list of location cards with radio-select, submit posts to `/api/auth/gbp/finalize`.

## 9. Failure UX + email nudges

Nudge day count is **days since `tenant_gbp_connections.status` first flipped to `revoked`** (or since the connection was expected but never made — i.e. days since the SEO addon went active with no active connection row). Computed by n8n at cron time via a small helper endpoint `GET /api/admin/gbp/nudge-candidates` that returns tenants where the day-count equals 3 or 7. Postmark templates, fired only when the tenant appears on the candidate list for that day:

- **Day 3**: *"Quick heads-up: your Google Business Profile still needs connecting. Your SEO subscription includes GBP posts — [Reconnect]."*
- **Day 7**: *"Reminder: 7 days without GBP connected — you're missing GBP posts. [Reconnect]."*
- **Day 30+**: no further emails (dashboard banner remains). The seo_publish_log filter surfaces persistent gaps to admin.

The email templates live in `strategy/_master/postmark-templates/` (existing folder pattern). Template IDs stored in `POSTMARK_GBP_REVOKED_D3` / `_D7` env vars.

## 10. Google Cloud + API access

### Google Cloud project setup (human-must-do, one-off)

Added to `strategy/_master/what-human-must-do.md`:

1. Create GCP project `launcharoo-prod` (or reuse existing).
2. Enable APIs: **Business Profile API**, **My Business Account Management API**, **My Business Business Information API**.
3. Configure OAuth consent screen — External, add `business.manage` scope, privacy + ToS URLs.
4. Create OAuth 2.0 Client ID (Web application). Authorised redirect URIs: `https://<prod-domain>/api/auth/gbp/callback`, plus preview + `http://localhost:3000/api/auth/gbp/callback`.
5. Copy client ID + secret into Vercel env: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`.
6. Generate `OAUTH_STATE_SECRET` (`openssl rand -hex 32`) and set on Vercel.
7. In Supabase Dashboard: create a pgsodium key, note its key_id, set `PGSODIUM_KEY_ID` on Vercel.
8. **Submit OAuth verification** — `business.manage` is a sensitive scope. Until verified, cap is 100 users lifetime + "unverified app" warning. Submission needs verified domain, privacy policy, ToS, YouTube demo video of the OAuth flow, written justification. Google review ~4-6 weeks.
9. **Submit Business Profile API write-access request** — Local Posts write access is restricted; new GCP projects need to apply and be approved. ~1-3 weeks.

**Recommendation** — do steps 1-7 today (unblocks staging/preview + up to 100 test users). Submit steps 8-9 same day so Google's clock runs while we build.

### Env vars (added to `strategy/_master/addons-stripe-setup.md`)

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `OAUTH_STATE_SECRET`
- `PGSODIUM_KEY_ID`
- (Existing `CRON_SECRET`, `APP_BASE_URL`, `PEXELS_API_KEY` all still used.)
- Optional per-env: `GBP_MOCK=1` in local + preview until Google approval, `GBP_MOCK` unset in prod.

## 11. Rollout order

Ten small phases, each independently useful and grader-passable. Roughly 1-2 days per phase.

1. **Migration + `tenant_gbp_connections` + `gbp_posts` + `last_gbp_tick_at`** — SQL migration, spec-only. Human applies.
2. **Store + types** — `lib/gbp/connections-store.ts` + `lib/gbp/posts-store.ts` with row↔record mappers. Zod schemas.
3. **Publisher abstraction + Mock impl** — `lib/gbp/publisher.ts` interface, `MockGbpPublisher` that inspects the `summary` for magic tokens (`__MOCK_401__`, `__MOCK_429__`, `__MOCK_5XX__`) and returns the matching classification; otherwise returns `{ok:true, googlePostId:"mock/posts/{uuid}"}`. Unit tests exercise each classification. Real `GoogleGbpPublisher` skeleton (throws NotImplemented at first) so the interface locks.
4. **Real `GoogleGbpPublisher`** — googleapis SDK integration, token refresh, error classification. Unit tests against nock or the googleapis mock.
5. **OAuth start + callback endpoints + state signing** — `/api/auth/gbp/start`, `/api/auth/gbp/callback`, `/api/auth/gbp/finalize`. Location-picker page. Test with GBP_MOCK on the Google side (mock the location listing too).
6. **Publish endpoint** — `POST /api/admin/gbp/publish/[tenantId]`. Handles the failure matrix. Zod input, seo_publish_log writes, connection status updates.
7. **Extend `/api/admin/seo/due-tenants?kind=gbp`** — join `tenant_gbp_connections`, include `gbp_location_name` and optional `last_blog_post` in the payload. (Route already exists; only the SELECT + response shape changes.)
8. **CLI + prompts** — `scripts/seo-gbp-generate.ts` mirroring blog CLI. Four category prompts. Local test with a mock tenant payload.
9. **n8n workflow** — `n8n/seo-gbp-tick.json` built by `n8n/build-seo-gbp-tick.mjs`. Same Execute Command + Set config + Parse envelope pattern as blog. Manual trigger test in Preview.
10. **Dashboard surfaces** — extend `SeoStatusCard`, add disconnected banner, wire the connect modal on `?connect_gbp=1`. Postmark templates + nudge trigger.

Every phase gated on `next build` + `npx tsc --noEmit` + `npm test` before commit. Auto-push to main per project convention.

Once Google approval + API access land, flip `GBP_MOCK` off in production, do one manual trigger to prove end-to-end, then enable the cron.

## 12. Testing strategy

- **Unit tests** — cadence engine (already tested), Zod schemas, publisher classification, prompt file existence + minimum-length checks.
- **Publisher integration** — `GoogleGbpPublisher` tests use nock or the googleapis test harness to mock HTTP responses; verify token refresh, error classification, rate-limit handling.
- **End-to-end with mock** — dedicated test tenant with a `tenant_gbp_connections` row and `GBP_MOCK=1`; run one manual cron and assert `gbp_posts` + `seo_publish_log` rows land and Postmark was NOT triggered.
- **Manual test with real Google** — after approvals, one real test with the founder's own GBP; verify post appears in Google Search / Maps.

## 13. Out of scope for this spec

- EVENT / OFFER / PRODUCT post types (v1 STANDARD only)
- Directory citation submissions (Yellow Pages, TrueLocal, StartLocal — manual for now)
- Review-response automation
- Multi-location tenants beyond initial pick (pick locks; changing later is a manual re-connect for v1)
- Non-AEST timezones
- GBP post editing / deletion from dashboard (a delete workflow can be added later using stored `google_post_id`)
- Reporting dashboard for aggregate GBP metrics (page views / clicks per post)
