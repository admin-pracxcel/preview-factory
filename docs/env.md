# Environment variable registry

Single source of truth for every env var the app touches. Copy-paste template lives at `.env.local.example` (dev) — this file is the "why + where" reference.

Vars are grouped by the phase that introduces them so it's clear what's needed for what.

**Never commit real secrets.** `.env.local` is gitignored; production values live only in the Vercel dashboard (production + preview scopes).

---

## Currently in use (pre-migration)

### `GOOGLE_PLACES_API_KEY`
Google Places API (New) key.
- **Used by**: `lib/places-client.ts` to fetch real GBP data + photos
- **How to get**: Google Cloud Console → enable "Places API (New)" → create API key
- **Cost**: pay-as-you-go; enable billing alerts at 80% of free tier

### `PEXELS_API_KEY`
Pexels stock photography key.
- **Used by**: `lib/pexels-client.ts`, `lib/image-assembler.ts` as fallback when GBP has few photos
- **How to get**: https://www.pexels.com/api/ (free, no approval)
- **Cost**: free tier covers 200 req/hour, 20k/month

### `STRIPE_SECRET_KEY`
Stripe API key.
- **Used by**: `app/api/checkout/route.ts`, `app/api/billing/portal/route.ts`
- **Format**: `sk_test_...` in dev, `sk_live_...` in prod
- **How to get**: https://dashboard.stripe.com/apikeys

### `STRIPE_PRICE_ID`
The subscription price the checkout creates.
- **Used by**: `app/api/checkout/route.ts`
- **Format**: `price_...`
- **How to get**: Stripe dashboard → Products

### `STRIPE_WEBHOOK_SECRET`
Signing secret for webhook verification.
- **Used by**: `app/api/webhooks/stripe/route.ts`
- **How to get dev**: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- **How to get prod**: Stripe dashboard → Webhooks → your endpoint → signing secret

### `NEXT_PUBLIC_BASE_URL`
Base URL for redirects and absolute links. Public (bundled to client).
- **Used by**: many
- **Values**: `http://localhost:3000` (dev), `https://previewfactory.com.au` (prod)

### `USE_FIXTURE`
Bypasses the model entirely with deterministic fixtures.
- **Used by**: `lib/generator-api.ts`, `lib/edit-engine.ts`
- **Values**: `1` to enable; anything else disables
- **When**: CI, offline dev, fast UI iteration

### `ANTHROPIC_API_KEY`
NOT REQUIRED. Site generation shells out to the `claude` CLI (Claude Code login), not the API.
- **When needed**: only if you switch generation to the API (not planned pre-launch)

---

## Introduced in Phase 0 (manual setup, no code yet)

### `RESEND_API_KEY`
Resend transactional email.
- **Used by** (Phase 7.5 onwards): `app/api/auth/request/route.ts`, `app/api/health/alert/route.ts`
- **How to get**: https://resend.com → verify sending domain → API key

### `FROM_EMAIL`
Sender address for outbound email.
- **Used by**: same as above
- **Value**: `noreply@previewfactory.com.au` (must match Resend-verified domain)

### `CLOUDFLARE_API_TOKEN`
Scoped API token for zone CRUD.
- **Used by** (Phase 11): `lib/dns/cloudflare.ts`
- **How to get**: CF dashboard → My Profile → API Tokens → Create Token
- **Scopes needed**: Zone:Edit, Zone:Read, DNS:Edit, DNS:Read, SSL and Certificates:Edit
- **Zone Resources**: All zones (or All zones from an account)

### `CLOUDFLARE_ACCOUNT_ID`
- **Used by**: Phase 11 module
- **How to get**: CF dashboard → any zone → Overview → right sidebar

### `CRAZY_DOMAINS_AFFILIATE_ID`
Affiliate tracking parameter.
- **Used by** (Phase 11): domain purchase redirect
- **How to get**: sign up for Crazy Domains affiliate program

---

## Introduced in Phase 2 (Supabase schema)

### `SUPABASE_URL`
- **Used by**: `lib/supabase.ts` (server-only)
- **Value**: `https://<project-ref>.supabase.co`

### `SUPABASE_SERVICE_ROLE_KEY`
- **Used by**: `lib/supabase.ts` (SERVER-ONLY, never leak to client)
- **Value**: from Supabase dashboard → Project Settings → API → `service_role` key
- **Warning**: bypasses RLS. Client code must never see this.

---

## Introduced in Phase 4 (n8n handoff)

### `N8N_WEBHOOK_URL`
Webhook path on n8n for the generate workflow.
- **Used by**: `app/api/intake/route.ts`
- **Values**: `https://n8n.yourdomain.com/webhook/pf-generate-dev` (dev), `.../pf-generate-prod` (prod)

### `WORKER_SHARED_SECRET`
Bearer secret in `x-worker-secret` header.
- **Used by**: `app/api/intake/route.ts` (outbound), all worker-facing endpoints (inbound)
- **Value**: random 32-byte base64 string. Same value on Vercel and on n8n.

### `WORKER_REPORT_URL`
The URL n8n hits back to report status.
- **Used by**: n8n only, not Vercel
- **Value**: `https://previewfactory.com.au/api/health/worker`

---

## Introduced in Phase 7.5 (auth)

### `MAGIC_LINK_SIGNING_KEY`
Secret for signing the `pf_auth` JWT.
- **Used by**: `app/api/auth/verify/route.ts`, `middleware.ts`
- **Value**: random 32-byte base64 string. Rotate = invalidate all sessions.

### `BILLING_PROVIDER`
Selects billing implementation.
- **Used by**: `lib/billing/index.ts`
- **Values**: `stripe` (default). Reserved for future providers.

---

## Introduced in Phase 11c (error monitoring)

### `SENTRY_DSN`
Server-side Sentry DSN — where errors get sent.
- **Used by**: `sentry.server.config.ts`, `sentry.edge.config.ts`
- **How to get**: Sentry → Projects → your project → Settings → Client Keys (DSN)
- **Scope**: Production only. Leaving unset in dev/preview disables Sentry (log-only fallback).

### `NEXT_PUBLIC_SENTRY_DSN`
Same DSN as above, but exposed to the browser bundle. Sentry SDK auto-tunnels through `/monitoring` so ad-blockers don't drop events.
- **Used by**: `instrumentation-client.ts`
- **Value**: same as `SENTRY_DSN`

### `SENTRY_ORG`
Sentry organisation slug (e.g. `pracxcel`).
- **Used by**: `next.config.ts` withSentryConfig — required for source-map upload at build time
- **How to get**: Sentry → your org name in top-left → slug in URL

### `SENTRY_PROJECT`
Sentry project slug (e.g. `preview-factory`).
- **Used by**: `next.config.ts` withSentryConfig

### `SENTRY_AUTH_TOKEN`
Personal auth token with `project:releases` scope. Uploads source maps during `next build`.
- **Used by**: `next.config.ts` withSentryConfig
- **How to get**: Sentry → User Settings → Auth Tokens → Create New Token → scope: `project:releases`
- **Scope**: Vercel Production build env. Not needed in dev.

---

## Vercel env var scopes

Set every prod var in **both** Production and Preview scopes, but with different values:

| Var | Production | Preview |
|-----|-----------|---------|
| `SUPABASE_URL` | prod project URL | dev project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | prod key | dev key |
| `N8N_WEBHOOK_URL` | prod workflow | dev workflow |
| `STRIPE_SECRET_KEY` | live key | test key |
| `STRIPE_PRICE_ID` | live product | test product |
| `STRIPE_WEBHOOK_SECRET` | prod endpoint | dev endpoint (from `stripe listen`) |
| `NEXT_PUBLIC_BASE_URL` | prod URL | preview URL (or dev URL if using tunnels) |
| all others | shared | shared |

This is what stops Vercel preview deploys from polluting prod Supabase.

---

## Legacy / autopilot vars

Only relevant if running `npm run autopilot` locally (the build supervisor). Not needed in prod.

- `AUTOPILOT_HOST`, `AUTOPILOT_PORT`, `AUTOPILOT_PUBLIC_URL`, `AUTOPILOT_NOTIFY_URL`, `AUTOPILOT_MAX_INCREMENTS`, `AUTOPILOT_MODEL`, `AUTOPILOT_SKIP_BUILD`
