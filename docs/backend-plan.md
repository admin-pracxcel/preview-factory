# Preview Factory — Backend Migration Plan

Locked in 2026-07-02. Twelve phases (0-11) taking Preview Factory from local prototype to live subscription SaaS on customer-owned domains.

## Target architecture

```
Browser
  │
  ├─▶ Vercel (Next.js Hobby)
  │     intake, preview render, customise, status poll,
  │     claim / checkout redirect, magic-link auth, Stripe webhook
  │
  ├─▶ Supabase (Free)
  │     Postgres: sessions, tenants, jobs, leads, magic_tokens, processed_events
  │     Storage: previews bucket (uploaded logos/images)
  │     pg_cron: reaper + jobs cleanup
  │
  ├─▶ Self-hosted n8n (existing box, Claude CLI logged in)
  │     Webhook trigger: fast path from Vercel
  │     Scheduled trigger: recovery poll of queued jobs
  │     Execute Command: runs generator CLI
  │     Writes site_props back to Supabase
  │
  ├─▶ Cloudflare (Free)
  │     One zone per custom domain, auto TLS, proxies to Vercel origin
  │
  └─▶ Stripe (swappable via lib/billing interface)
        Hosted checkout + customer portal, webhook -> Vercel
```

## Global principles

- Every phase ends in a working `next dev` and a git commit.
- Nothing serves real users until Phase 7.
- Provider-specific logic behind an interface (billing, DNS especially).
- The `tenants` row is the "account". No separate `users` table.
- Reaper never deletes anything with an active subscription.
- Webhooks are source of truth; redirects and polls are UX only.
- Local dev keeps working through every phase.

---

## Phase 0 — Environments and secrets

**Why first**: local dev must keep working while prod exists. Skipping this creates "works on my machine" hell after Phase 3.

**Deliverables**:
- Two Supabase projects: `preview-factory-dev` and `preview-factory-prod` (both free tier, `ap-southeast-2`).
- Product domain registered (e.g., `previewfactory.com.au`).
- Cloudflare account + API token with Zone:Edit permissions.
- Two n8n workflows: `generate-dev` and `generate-prod`, distinguished by webhook path + which Supabase they write to.
- `.env.local` (dev), `.env.production` values stored only in Vercel dashboard.
- Env registry documented in `docs/env.md`:
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `N8N_WEBHOOK_URL`, `WORKER_SHARED_SECRET`
  - `PEXELS_API_KEY`, `GOOGLE_PLACES_API_KEY`
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`
  - `MAGIC_LINK_SIGNING_KEY`, `RESEND_API_KEY`, `FROM_EMAIL`
  - `BASE_URL`, `WORKER_REPORT_URL`
  - `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- One-page architecture doc: `docs/architecture.md` (the diagram above).
- Resend account for magic-link + concierge emails.
- Calendly link for concierge tier ($99 setup call).
- Crazy Domains affiliate program signup — capture tracking link format.
- Record 5 registrar walkthrough videos (Crazy Domains, VentraIP, GoDaddy AU, Netregistry, generic fallback), 60-90s each.

**Acceptance**: `pnpm dev` works with dev Supabase; secrets exist in Vercel; nothing sensitive in repo.

---

## Phase 1 — Extract generator to stdin/stdout CLI

**Why**: makes generation portable. n8n today, a proper queue worker tomorrow.

**Deliverables**:
- `generator/cli.ts` — reads JSON from stdin, writes exactly one JSON line to stdout, exits 0 on success / 1 on failure.
- Payload contract (versioned):
  ```json
  { "v": 1, "tenant_id": "...", "category": "trades", "gbp_data": {...},
    "uploaded_images": [{"path":"tenants/abc/logo.png","kind":"logo"}],
    "customisation": null }
  ```
- Result contract:
  ```json
  { "v": 1, "ok": true, "site_props": {...}, "meta": {"duration_ms": 123456, "phases": ["A","B","C"]} }
  ```
  Errors: `{"v":1,"ok":false,"error":{"code":"phase_a_validation","message":"..."}}`.
- **Gap fix — stdout pollution**: Claude CLI streams progress to stderr; redirect Claude's stderr to a captured log; only emit result envelope on stdout. Never `console.log` anywhere else in the CLI path.
- **Gap fix — Claude CLI version pinning**: read installed version (`claude --version`), fail fast if below known-good tag. Store tag in `generator/cli.ts`.
- **Gap fix — partial degradation**: if Pexels or Google Places 429/500s, generator falls back (skip that image slot, use archetype default) rather than failing the whole run.
- All existing normalizers (`ensureSeoTitles`, `ensureAboutValues`, `hardenCtas`, `hardenSocialProof`, image assembly) called from inside the CLI.
- `package.json`: `"generate:cli": "node generator/cli.ts"`.
- Fixture: `scripts/fixtures/gbp-trades.json` + smoke-test script.

**Acceptance**: `node generator/cli.ts < scripts/fixtures/gbp-trades.json > /tmp/out.json && jq .ok /tmp/out.json` prints `true`; `site_props` byte-for-byte matches current API route output on same input.

---

## Phase 2 — Supabase schema (dev + prod)

**Why**: the shared bus between Vercel and n8n. Everything else waits on this.

**Deliverables**:
- SQL kept in `supabase/schema.sql` (source of truth, applied via dashboard for now).
- Tables:
  - `sessions(id uuid pk default gen_random_uuid(), created_at timestamptz default now(), last_seen_at timestamptz default now(), ip inet, user_agent text)`
  - `tenants(id uuid pk default gen_random_uuid(), session_id uuid references sessions(id) on delete set null, category text not null, status text not null default 'queued' check (status in ('queued','running','done','failed','claimed','past_due','cancelled')), site_props jsonb, error text, created_at timestamptz default now(), updated_at timestamptz default now(), claimed_at timestamptz, owner_email text, billing_provider text, billing_customer_id text, billing_subscription_id text, subscription_status text, cancelled_at timestamptz)`
  - `jobs(id uuid pk default gen_random_uuid(), tenant_id uuid references tenants(id) on delete cascade, status text not null default 'queued' check (status in ('queued','running','done','failed')), payload jsonb not null, result jsonb, error text, attempts int default 0, created_at timestamptz default now(), started_at timestamptz, finished_at timestamptz)`
  - `leads(id uuid pk default gen_random_uuid(), tenant_id uuid references tenants(id) on delete cascade, name text, email text, phone text, message text, created_at timestamptz default now())`
  - `magic_tokens(token text pk, email text not null, created_at timestamptz default now(), expires_at timestamptz not null, used_at timestamptz)`
  - `processed_events(event_id text pk, provider text not null, seen_at timestamptz default now())` — webhook idempotency
- Indexes (gap fix):
  - `tenants(session_id)`, `tenants(owner_email)`, `tenants(status)`, `tenants(created_at) where claimed_at is null`
  - `jobs(tenant_id)`, `jobs(status) where status in ('queued','running')`
  - `leads(tenant_id)`, `magic_tokens(email)`
- `updated_at` trigger on `tenants` (standard `moddatetime`).
- Storage bucket: `previews`, **public** with unguessable UUID paths (`previews/<tenant_id>/<filename>`).
- RLS: all tables locked to `service_role`. Client never talks to Supabase directly.
- Note in `docs/architecture.md`: Free tier has 7-day PITR; anything longer needs Pro.

**Acceptance**: `psql` insert on dev works; `select * from tenants` returns row; storage bucket accepts an object via service role.

---

## Phase 3 — Replace `lib/tenant-store.ts` with Supabase

**Why**: `data/tenants/*.json` and `data/leads/*.json` don't survive Vercel. Do this before wiring n8n so we're not juggling two persistence layers.

**Deliverables**:
- Rewrite `lib/tenant-store.ts` to hit Supabase. Preserve function signatures — callers in `app/api/intake/route.ts`, `app/preview/[id]/page.tsx`, `app/api/tenants/`, `app/api/lookup/`, `lib/edit-engine.ts` should not change.
- `lib/supabase.ts` — server-only client factory. Guard: `if (typeof window !== 'undefined') throw`.
- Session cookie helper (`lib/session.ts`): httpOnly, SameSite=Lax, 30-day. Sets on first request; used by intake + claim.
- `POST /api/leads` (new) — contact form on rendered sites. Writes to `leads`, keyed by tenant_id.
- Migration script `scripts/migrate-local-tenants.mjs` — pushes existing `data/tenants/*.json` to dev Supabase (one-off).
- **Gap fix — `scripts/outreach.mjs` audit**: check and either port to Supabase or explicitly mark "local research tool, not part of runtime". `data/outreach/` stays local.
- **Gap fix — `lib/edit-engine.ts` audit**: check whether it writes to disk. If yes, route writes through tenant store (updates `site_props` JSONB directly).

**Acceptance**: fresh browser -> intake -> preview -> customise -> contact form -> all work end-to-end against Supabase; nothing writes to `data/tenants/` or `data/leads/`. Generation still runs inline via `spawn`.

---

## Phase 4 — Jobs table + n8n stub

**Why**: prove async plumbing before dropping in the real generator. Isolates messaging bugs from generation bugs.

**Deliverables**:
- `POST /api/intake` becomes async:
  1. Validate GBP payload
  2. `INSERT INTO tenants (status='queued', ...)`
  3. `INSERT INTO jobs (tenant_id, payload, status='queued')`
  4. `fetch(N8N_WEBHOOK_URL, { headers: { 'x-worker-secret': ... }, body: { job_id, tenant_id } })` — fire and forget, wrapped in try/catch, never blocks response
  5. Return `{ tenant_id }` in <200ms
- `GET /api/tenants/[id]/status` — returns `{status, error?}` for building page poll.
- `app/building/page.tsx` polls every 2s, redirects to `/preview/[id]` on `done`, shows error on `failed`.
- n8n workflow stub:
  - Webhook trigger (fast path): verifies secret header, updates job status
  - Cron trigger every 30s (recovery path): SELECTs `jobs.status='queued'` older than 30s; picks one at a time; runs same generation sub-workflow. **Gap fix**: webhook is a "poke" not a dependency; if Vercel->n8n fails, job still runs.
  - Both triggers call shared sub-workflow
  - Stub sub-workflow: wait 5s, PATCH tenant with hardcoded captured `site_props`, `status='done'`
- **Gap fix — race guard**: sub-workflow starts with `UPDATE jobs SET status='running', started_at=now() WHERE id=$1 AND status='queued' RETURNING *`. If no row returned, exit clean.

**Acceptance**: intake -> building spins -> hardcoded preview renders. Kill n8n mid-flight, intake still succeeds, job stays queued, n8n restart picks it up within 30s.

---

## Phase 5 — Wire real generator into n8n

**Why**: replace stub with actual CLI.

**Deliverables**:
- **Gap fix — deployment story**: repo checked out at `/opt/preview-factory` on n8n box. Sub-workflow starts with `Execute Command: cd /opt/preview-factory && git fetch --quiet && git reset --hard origin/main && pnpm install --frozen-lockfile --prod`. Slower but idempotent + self-healing.
- `.env` on n8n box: `PEXELS_API_KEY`, `GOOGLE_PLACES_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Owned root:root, mode 600.
- n8n sub-workflow (final):
  1. Race-guard update on jobs row
  2. Fetch payload from `jobs.payload`
  3. Execute Command with 6-minute timeout, pipe payload to stdin, capture stdout
  4. Function node: parse stdout envelope, branch on `ok`
  5. Success: PATCH tenant `site_props`, `status='done'`; PATCH job `status='done'`, `result`, `finished_at`
  6. Failure: PATCH tenant `status='failed'`, `error`; PATCH job `status='failed'`, `error`, `attempts+=1`, `finished_at`
- **Gap fix — retry policy**: if `attempts < 2` and error is transient (Pexels timeout, Places 5xx), leave job `queued` for cron retry. Permanent errors (validation) -> `failed`, stop.
- **Gap fix — concurrency**: workflow settings -> max 2 parallel executions. Configurable via n8n env.
- **Gap fix — heartbeat**: n8n cron every 5 min hits `POST /api/health/worker` with shared secret. If Vercel hasn't seen a beat in 15 min, mark stale (used in Phase 9 alerts).
- **Gap fix — token logging**: parse Claude CLI output for token usage where available; write to `jobs.result.meta.usage`. No cost control yet, just visibility.

**Acceptance**: real intake -> real GBP fetch -> real generation on n8n -> real preview renders on dev Vercel. Timings match current local generation (~1-3 min).

---

## Phase 6 — Migrate uploads to Supabase Storage

**Why**: `public/uploads/` is filesystem-based; won't work on Vercel.

**Deliverables**:
- `POST /api/upload` — validates content-type (jpeg/png/webp only), max 5MB, streams to `previews/<tenant_id>/<uuid>.<ext>` via service role.
- Returns public URL (bucket is public).
- `CustomisePanel.tsx`: unchanged.
- Image assembler accepts Supabase URLs alongside Pexels/GBP.
- **Gap fix — cascade**: on tenant delete, explicit storage folder cleanup in the reaper (Phase 8).
- **Gap fix — SVG XSS**: reject `image/svg+xml`. Only raster formats.

**Acceptance**: upload logo via customise panel -> renders in preview -> object visible in Supabase Storage dashboard.

---

## Phase 7 — Vercel deploy

**Why**: first time it's live. Verification, not new features.

**Deliverables**:
- Create Vercel project, link to repo, `main` as production branch.
- Phase 0 env vars loaded on Vercel (production + preview scopes).
- `next.config.ts` — add to `images.remotePatterns`: Supabase Storage domain, Pexels (`images.pexels.com`), Google (`places.googleapis.com`).
- **Gap fix — noindex**: every preview page emits `<meta name="robots" content="noindex, nofollow">`. Root `robots.txt` disallows `/preview/*`. Preview URLs stay noindex forever on our subdomain; customer's real domain (Phase 11) is where they get indexed.
- **Gap fix — Vercel preview deploys** point to dev Supabase + dev n8n webhook so they don't pollute prod.
- **Gap fix — cold start on webhooks**: Stripe webhook endpoint will occasionally cold-start; Stripe's 20s retry window handles it, but don't do heavy work in the handler.

**Acceptance**: real preview generated from a phone against the vercel.app URL.

---

## Phase 7.5 — Claim, billing, magic-link auth

**Why**: turn previews into paid subscriptions without building signup/login.

### 7.5a — Billing interface

- `lib/billing/index.ts`:
  ```ts
  interface BillingProvider {
    createCheckout(input: { tenantId, sessionId, successUrl, cancelUrl }): Promise<{ url }>;
    getPortalUrl(input: { customerId, returnUrl }): Promise<{ url }>;
    verifyWebhook(rawBody: string, headers: Headers): { event, id: string };
    handleEvent(event: unknown, ctx: { supabase }): Promise<void>;
  }
  ```
- `lib/billing/stripe.ts` — implementation. Only place that imports Stripe SDK.
- Selection via `BILLING_PROVIDER=stripe` env var.

### 7.5b — Checkout flow

- `POST /api/claim`:
  1. Authorize: session cookie must match `tenants.session_id`
  2. Reject if `claimed_at IS NOT NULL`
  3. Rate limit (5 claims per session per hour)
  4. Create checkout via provider:
     - `metadata: { tenant_id, session_id }` on checkout
     - `subscription_data.metadata: { tenant_id }` on resulting subscription (**gap: renewal events won't have checkout metadata**)
     - `success_url: ${BASE_URL}/claimed?cs={CHECKOUT_SESSION_ID}`
     - `cancel_url: ${BASE_URL}/preview/${tenant_id}`
  5. Return `{ url }`; client redirects
- `GET /claimed?cs=...`:
  1. Retrieve checkout session by ID (optional UX)
  2. Show "Payment received, finalising..." while polling `/api/tenants/[id]/status`
  3. Once webhook flips `status='claimed'`, redirect to `/preview/[id]`
- `GET /api/billing/portal`:
  1. Requires magic-link cookie (see 7.5d)
  2. Look up `billing_customer_id` for the email
  3. Return `{ url }` to provider's hosted portal

### 7.5c — Webhook handler

- `POST /api/billing/webhook`:
  1. Read raw body (**gap fix — Next.js gotcha: not `req.json()`**)
  2. `provider.verifyWebhook(rawBody, headers)` -> `{ event, id }`
  3. Idempotency: `INSERT INTO processed_events (event_id, provider) ON CONFLICT DO NOTHING`. If already present, 200 without processing.
  4. `provider.handleEvent(event, { supabase })`:
     - `checkout.session.completed` -> set `claimed_at`, `owner_email`, `billing_*`, `status='claimed'`, `subscription_status='active'`
     - `invoice.payment_failed` -> `subscription_status='past_due'`
     - `customer.subscription.deleted` -> `subscription_status='cancelled'`, set `cancelled_at`
     - `customer.subscription.updated` -> sync `subscription_status`
  5. Return 200 (unless signature verification failed -> 400)
- Route configured with raw body enabled.

### 7.5d — Magic-link auth

- `POST /api/auth/request`:
  1. Body: `{ email }`
  2. Rate limit (3/hour per IP, 5/day per email)
  3. Generate token (32 bytes, base64url), store in `magic_tokens` with 15-min expiry
  4. Send email via Resend: "Click here to access your Preview Factory sites: `${BASE_URL}/auth/verify?token=xxx`"
  5. Return `{ ok: true }` regardless of email existence (no user enumeration)
- `GET /auth/verify?token=`:
  1. Look up token; must be unused, unexpired
  2. Mark `used_at`
  3. Set `pf_auth` cookie: JWT signed with `MAGIC_LINK_SIGNING_KEY`, payload `{ email, exp: now+30d }`, httpOnly, SameSite=Lax
  4. Redirect to `/my-sites`
- `GET /my-sites`:
  1. Read cookie; if none -> magic-link request form
  2. Query `tenants WHERE owner_email = cookie.email`; list them

### 7.5e — Cancellation / grace period

- Cancelled subscription: `subscription_status='cancelled'`, `claimed_at` stays set. Reaper skips.
- Separate cron: hard-delete tenants where `subscription_status='cancelled' AND cancelled_at < now() - interval '30 days'`. 30-day reactivation window.
- Past-due: after 7 days, warning banner on customer's live site; after 30 days, revert to `status='cancelled'`.

### 7.5f — Legal boilerplate

- `/terms` and `/privacy` pages required before charging money. Content is a lawyer question; routes must exist and be linked from checkout.
- Privacy policy discloses: data sent to Anthropic (generation), Google Places (enrichment), Pexels (images), Stripe (payment).

**Acceptance**: real intake -> claim -> Stripe test-card checkout -> webhook fires -> tenant claimed -> cancel subscription in portal -> webhook flips status -> 30-day cancellation reaper (backdated for testing) removes tenant.

---

## Phase 8 — Reaper and cleanup

**Why**: hygiene + not leaking abandoned data.

**Deliverables**:
- `pg_cron` extension enabled.
- Job 1 (every 15 min): 3-hour reaper for unclaimed previews:
  ```sql
  DELETE FROM tenants
  WHERE claimed_at IS NULL AND created_at < now() - interval '3 hours';
  ```
  Cascade to `jobs`, `leads`. Storage cleanup: cron calls a Supabase Edge Function that lists and deletes objects under deleted tenants' folders (queried from a `deleted_tenants` audit table populated by trigger).
- Job 2 (daily): cancel-grace reaper:
  ```sql
  DELETE FROM tenants
  WHERE subscription_status='cancelled'
    AND cancelled_at < now() - interval '30 days';
  ```
- Job 3 (weekly): `jobs` older than 7 days.
- Job 4 (weekly): `magic_tokens` older than 24h.
- Job 5 (weekly): `processed_events` older than 60 days.

**Acceptance**: backdate a tenant -> within 15 min gone, storage folder gone, preview URL 404s. Sub cancelled + backdated 31 days -> hard-deleted.

---

## Phase 9 — Abuse floor, observability, launch-readiness

**Why**: ship-hygiene. Not optional if the URL is public.

**Deliverables**:
- Rate limits (Postgres, no Redis):
  - `POST /api/intake`: 5/day per session, 20/day per IP
  - `POST /api/claim`: 5/hour per session
  - `POST /api/auth/request`: 3/hour per IP, 5/day per email
  - `POST /api/upload`: 20/hour per session
  - `POST /api/leads`: 5/hour per tenant (spam floor)
- Session cookie: set on first request lacking it. httpOnly, SameSite=Lax, 30-day.
- Error UI: friendly retry on `status='failed'` (redacted error).
- Health/observability:
  - `GET /api/health` — DB reachable, worker heartbeat < 15 min old
  - Vercel Cron every 10 min pings n8n heartbeat endpoint; 3 consecutive fails -> email admin via Resend
  - Sentry (free tier) on Vercel API routes
- Anthropic spend cap in console (belt-and-braces; we're on CLI but might switch).
- Google Places quota alert at 80% of free tier.
- Robots: `/preview/*` and `/claimed` disallowed; sitemap for marketing pages only.

**Acceptance**: spamming intake -> rate-limited with clear message. Killed n8n -> alert within 15 min. Sentry catches a forced 500.

---

## Phase 10 — Smoke test + launch checklist

**Why**: catch regressions between phases; sanity-check before pointing anyone at the URL.

**Deliverables**:
- `scripts/smoke.mjs`:
  1. POSTs intake with fixture
  2. Polls status until done or timeout
  3. Fetches `/preview/[id]` HTML, asserts key markers (business name, contact form, no `undefined`)
  4. Optionally: Stripe test-card checkout via API, asserts webhook fires
- `docs/launch.md` manual checklist:
  - [ ] All env vars set on Vercel production
  - [ ] Stripe webhook endpoint added in Stripe dashboard with correct signing secret
  - [ ] Supabase RLS confirmed locked
  - [ ] Anthropic spend cap set
  - [ ] Terms + privacy linked from checkout
  - [ ] `robots.txt` correct
  - [ ] Sentry receiving events
  - [ ] Heartbeat cron installed
  - [ ] Test intake from a phone on cellular

**Acceptance**: smoke script green on prod; checklist all ticked.

---

## Phase 11 — Custom domains via nameserver transfer

**Why**: turn `preview.previewfactory.com.au/preview/<uuid>` into `www.acmeplumbing.com.au` with valid TLS, without asking non-technical customers to configure DNS records.

### 11.1 Infrastructure

- Cloudflare free tier hosts every customer zone (unlimited zones).
- Assigned nameservers per zone (vanity NS deferred until ~100+ customers).
- TLS provisioned + auto-renewed by CF.
- CF proxies to Vercel origin.
- Middleware routes by Host header.

### 11.2 Schema additions to `tenants`

- `custom_domain text unique` (nullable)
- `custom_domain_status text check in ('none','choosing','purchasing','pending_ns','pending_ssl','active','failed')`
- `cloudflare_zone_id text`
- `assigned_nameservers text[]`
- `dns_records_snapshot jsonb` — pre-import state, for rollback/audit
- `custom_domain_verified_at timestamptz`
- `custom_domain_purchased_via text` — `existing | crazy_domains_affiliate`
- Index: `tenants(custom_domain) unique where custom_domain is not null`

### 11.3 Library modules

- `lib/dns/cloudflare.ts` — thin wrapper: `createZone(domain)`, `addRecord(zoneId, record)`, `getZoneStatus(zoneId)`, `getZoneNameservers(zoneId)`, `deleteZone(zoneId)`
- `lib/dns/import.ts` — public DNS resolver (DoH via 1.1.1.1) fetching MX, TXT, CAA, SRV, CNAME from current authoritative NS
- `lib/dns/detect-registrar.ts` — WHOIS lookup, maps to known-registrar enum for video selection
- `lib/dns/verify.ts` — polls target NS, confirms propagation, tests MX resolution

### 11.4 Endpoints

- `POST /api/domain/check` — availability check for greenfield flow
- `POST /api/domain` — customer submits owned domain: detect registrar -> import DNS records -> create CF zone -> populate zone with imported records + our A record -> return assigned NS
- `GET /api/domain/status` — state machine value for polling UI
- `DELETE /api/domain` — on sub cancel or customer request; deletes CF zone
- `POST /api/domain/test-mx` — post-propagation email routing sanity check

### 11.5 Onboarding UX

Three screens post-Stripe checkout:

1. **Domain choice**: "I have a domain" vs "I need to buy a domain" (recommended)
2. **Domain entry**:
   - Existing: domain input
   - New: Crazy Domains affiliate link with domain pre-filled + "come back when purchased" CTA
3. **NS change instructions**: registrar-detected video, copy-buttons for two NS values, live status polling every 15s, "email is safe" reassurance box, concierge escape link

State machine displayed live: Waiting for NS change -> Change detected, verifying -> Setting up TLS -> Live.

### 11.6 Email preservation (the biggest risk)

Before NS change, run DNS records audit — public query against their current authoritative NS to grab MX, TXT (SPF/DKIM/DMARC/verifications), CAA, SRV, CNAME (autodiscover, sip, mail).

Import all into new CF zone before NS switch. When propagation flips, their email keeps working.

UI walks them through detected records with an explicit "yes, my email works" confirmation before allowing NS change.

Post-propagation: automated MX lookup + "send test email to yourself" button.

DNSSEC check: if DS record detected at parent, block NS change with instructions to disable at registrar first.

### 11.7 Reconciliation cron

Vercel Cron every 2 min: for tenants with `custom_domain_status in ('pending_ns','pending_ssl')`:
- Query CF for zone status
- Query public DNS for NS propagation
- Update state accordingly
- After 24h in `pending_ns` -> email reminder + concierge link
- After 72h -> mark `failed`

### 11.8 Middleware

`middleware.ts`:
- Host header matches known custom domain -> lookup tenant -> rewrite to `/preview/[id]`
- Tenant `subscription_status ≠ 'active'` -> "site not available" page
- Preview subdomain -> normal `/preview/[id]` routing

### 11.9 Failure-mode handling

- DNSSEC enabled -> detect DS at parent, block until disabled
- NS not propagating after 24h -> email + concierge
- Wrong NS values -> detect mismatch, show helpful diff
- MX test fails post-propagation -> alert + revert-NS instructions in dashboard
- Sub cancels -> CF zone deleted; customer keeps domain, can point NS wherever

### 11.10 Acceptance

- Existing owner: real Crazy Domains customer -> NS change -> site live at their URL with valid TLS within 30 min -> existing email still routes
- Greenfield: buy through affiliate -> return -> NS change -> live within 30 min
- Cancellation: sub cancelled -> CF zone deleted -> domain no longer serves our content

---

## Out of scope (deferred, explicitly)

- Full user accounts / password auth: never. Magic link forever.
- Vanity nameservers: deferred until ~100+ paid customers.
- Auto-configuration (Entri / Domain Connect): AU coverage too weak to justify; revisit at 50+ signups/month.
- Full domain reseller (own the account): affiliate covers greenfield path adequately.
- Real-time Supabase subscriptions instead of polling: nice, not needed.
- Horizontal scale of workers: single n8n box until it's not enough.
- Proper CI-driven Supabase migrations: manual schema edits for launch; move to `supabase db push` once we have paying customers.
- Second payment provider: interface exists (7.5a); wire second one when there's a concrete reason.

---

## Order-of-execution rationale

- Phases 0-3 are pure local refactors — nothing goes live, nothing breaks.
- Phase 4 introduces async model with fake worker — debug plumbing without waiting on real generation.
- Phase 5 swaps in reality.
- Phases 6-7 are actual go-live.
- Phase 7.5 turns previews into paid subscriptions.
- Phases 8-9 are hygiene needed for a public URL.
- Phase 10 is the pre-launch sanity check.
- Phase 11 is the "make it real" moment where customers get their own domain.

Each phase should be a single git commit (or a small stack) and a working `next dev`. If a phase doesn't work end-to-end, we don't move on.

---

## Holes found in v2 review (transparency)

1. Env / local-dev story missing -> Phase 0 created
2. n8n unreachable during intake -> cron recovery trigger (Phase 4)
3. Idempotency on job pickup -> race-guard update (Phase 4)
4. Stripe subscription renewal events lack checkout metadata -> set metadata on `subscription_data` too (Phase 7.5b)
5. Webhook idempotency -> `processed_events` table (Phase 2)
6. SVG XSS via uploads -> reject (Phase 6)
7. Storage cleanup on reap -> Edge Function from cron (Phase 8)
8. Cancellation grace period -> Phase 7.5e
9. `noindex` on all previews -> Phase 7
10. Legal (terms/privacy) -> Phase 7.5f
11. Retry policy on transient errors -> Phase 5
12. Heartbeat / worker health -> Phase 5 + Phase 9
13. Claude CLI version pinning -> Phase 1
14. stdout pollution from Claude CLI progress -> Phase 1
15. Partial degradation on Pexels/Places failure -> Phase 1
16. `edit-engine.ts` may still write to disk -> Phase 3 audit
17. `outreach.mjs` and other local-only scripts -> Phase 3 audit
18. Rate-limit index perf -> Phase 2 indexes
19. Preview deploys polluting prod -> Phase 7 (dev Supabase for previews)
20. Sentry / observability absent -> Phase 9
21. Smoke test / launch checklist absent -> Phase 10
