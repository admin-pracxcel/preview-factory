# Preview Factory — Architecture at a glance

One-page reference. For the full migration plan see [`backend-plan.md`](./backend-plan.md).

---

## Diagram

```
                       ┌──────────────────────────┐
                       │        Customer          │
                       │     (mobile browser)     │
                       └────────────┬─────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────┐
│                    Cloudflare (per-customer zones)                 │
│    - One free zone per custom domain                               │
│    - Auto-TLS via Let's Encrypt                                    │
│    - Proxies to Vercel origin, preserves original Host in header   │
└──────────────────────────────┬────────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│                       Vercel (Next.js Hobby)                       │
│                                                                    │
│  ┌────────────────────┐   ┌──────────────────┐   ┌─────────────┐  │
│  │ POST /api/intake   │   │ GET /preview/[id]│   │ webhooks    │  │
│  │   (async, <200ms)  │   │ (SSR from DB)    │   │ (Stripe)    │  │
│  └─────────┬──────────┘   └──────────────────┘   └─────────────┘  │
│            │                                                       │
│            │ enqueue                                               │
│            ▼                                                       │
└────────────┼───────────────────────────────────────────────────────┘
             │                                       ▲
             │                                       │ status polls
             ▼                                       │
┌───────────────────────────────────────────────────────────────────┐
│                     Supabase (Free tier)                           │
│                                                                    │
│  Postgres:                            Storage:                     │
│    - sessions                           - previews bucket          │
│    - tenants (site_props JSONB)         - public, UUID paths       │
│    - jobs                                                          │
│    - leads                                                         │
│    - magic_tokens                     pg_cron:                     │
│    - processed_events                   - 3h reaper                │
│                                         - 30d cancel-grace         │
│                                         - weekly cleanups          │
└──────────────────────────────┬────────────────────────────────────┘
                               │
                               │ webhook (fast) + cron (recovery)
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│                self-hosted n8n (existing box)                      │
│                                                                    │
│  - Claude Code CLI (already logged in — no API key)                │
│  - Execute Command runs generator/cli.mjs                          │
│  - Writes site_props back to Supabase                              │
│  - Heartbeat every 5 min → Vercel                                  │
└───────────────────────────────────────────────────────────────────┘

     ┌────────────┐        ┌────────────┐       ┌────────────┐
     │   Stripe   │        │   Resend   │       │   Pexels   │
     │ (billing)  │        │  (email)   │       │  (images)  │
     └────────────┘        └────────────┘       └────────────┘
     ┌────────────┐        ┌────────────────────┐
     │Google Places│       │ Crazy Domains      │
     │ (GBP data) │        │ (affiliate)        │
     └────────────┘        └────────────────────┘
```

---

## Request paths

### Intake (async generation)

1. Browser → `POST /api/intake` with GBP payload
2. Vercel: validate, insert `tenants` (status=queued), insert `jobs`, POST to n8n webhook, return `{tenant_id}` in <200ms
3. Browser → `/building` polls `GET /api/tenants/[id]/status` every 2s
4. n8n: `Execute Command: node generator/cli.mjs` (~1–3 min), writes `site_props` + `status=done`
5. Browser sees `done` → redirects to `/preview/[id]`

### Preview render

1. Browser → `GET /preview/[id]` (or custom domain)
2. Middleware: if Host matches custom domain, rewrite to `/preview/[id]`
3. Server: SELECT `site_props` FROM tenants; render page tree
4. Return HTML + hydration data

### Claim (payment)

1. Browser → "Subscribe" → `POST /api/claim`
2. Vercel: verify session cookie owns tenant; create Stripe Checkout with `metadata.tenant_id`
3. Browser redirected to Stripe hosted page
4. Customer pays
5. Stripe → `POST /api/billing/webhook` → verify signature → check `processed_events` → update `tenants.claimed_at`, `owner_email`, `billing_*`
6. Browser: `/claimed?cs=...` polls status → redirects to preview

### Return login (magic link)

1. Browser → `/login` → enter email
2. Server: token → `magic_tokens` → email via Resend
3. Customer clicks link → `/auth/verify?token=` → set `pf_auth` cookie → `/my-sites`
4. `/my-sites` lists tenants where `owner_email = cookie.email`

### Custom domain setup

1. Customer post-checkout → `/dashboard/domain`
2. Choose "I have a domain" or "I need one" (affiliate to Crazy Domains)
3. On existing: WHOIS lookup → import DNS via public resolver → create CF zone → return assigned NS
4. Customer changes NS at registrar (guided by registrar-specific video)
5. Vercel cron every 2 min: check CF zone status + DNS propagation
6. Once `active`: subsequent requests to `www.acmeplumbing.com.au` hit CF → forwarded to Vercel with `X-Forwarded-Host` → middleware rewrites to `/preview/[id]`

---

## Key invariants

- **The `tenants` row is the account.** No separate `users` table. Ownership = `owner_email` matches magic-link cookie.
- **Preview URLs are capabilities.** Anyone with the URL sees the preview. Sharing is intentional; auth only guards claim/manage.
- **Webhooks are truth, redirects are UX.** Never update state on a success redirect.
- **Idempotency everywhere.** `processed_events` for billing webhooks; race-guard `UPDATE ... WHERE status='queued' RETURNING *` for job pickup.
- **No filesystem writes in prod.** All persistent state in Postgres or Storage.
- **The CLI runs only on n8n.** Vercel never spawns `claude`.
- **Provider isolation.** Billing (`lib/billing/`), DNS (`lib/dns/`), and any future email/registrar providers live behind interfaces.
- **Fail closed.** If n8n unreachable during intake, the job row still exists and n8n's cron trigger picks it up.

---

## Free-tier limits worth remembering

| Service | Free tier | Meaningful for |
|---------|-----------|----------------|
| Vercel Hobby | 100GB bandwidth, 100k func invocations/day | Traffic |
| Supabase Free | 500MB DB, 1GB storage, 2GB egress, 7-day PITR | Storage size |
| Cloudflare Free | Unlimited zones, unlimited requests | Custom domains |
| Pexels | 200/hr, 20k/month | Generation frequency |
| Google Places | ~$200/mo free credit, then paid | Generation frequency |
| Resend | 3k emails/mo | Magic-link volume |
| Stripe | No free tier, per-txn fees | N/A |

If any of these become the bottleneck, upgrade only the one that's tight.

---

## Where to change what

| Change | File(s) |
|--------|---------|
| Add a category | `templates/categories/<name>/*` |
| Change generation prompt | `lib/generator-api.ts` |
| Change normalizers/guardrails | `lib/generator-api.ts` (ensure*, harden*) |
| Add a UI section | `shared/ui/sections.tsx` |
| Swap billing provider | new `lib/billing/<provider>.ts` + env var |
| Add a registrar to detector | `lib/dns/detect-registrar.ts` (Phase 11) |
| Extend Supabase schema | `supabase/schema.sql` + apply via dashboard (Phase 2 onwards) |
| Change tenant lifecycle | `lib/tenant-store.ts` |
