# Vercel environment variables (Phase 7)

The Next.js app reads all secrets from `process.env` at request time (no
build-time coupling), so setting them in Vercel Project Settings → Environment
Variables is enough. Apply to **Production** and **Preview** environments —
Vercel treats preview builds (PR previews) as a separate scope.

Values marked `same as .env.local` are already in your local file; copy them
across. Values marked `placeholder` can be left blank or set to any dummy
string for the first deploy — the code paths that use them (Stripe, magic
links) are gated behind Phase 7.5 and won't run until then.

## Required for the first deploy

| Name | Value | Notes |
|---|---|---|
| `SUPABASE_URL` | same as .env.local | `https://roglgvdxixyaxrnfddqi.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | same as .env.local | Server-only. Do **not** set `NEXT_PUBLIC_` on this. |
| `WORKER_SHARED_SECRET` | same as .env.local | Must match what the n8n heartbeat workflow sends. |
| `N8N_WEBHOOK_URL` | `https://n8n.pracxcel.com.au/webhook/pf-generate-real` | Real generator webhook. `/api/intake` POSTs here after inserting the job row. |
| `N8N_LEAD_WEBHOOK_URL` | placeholder OK | Fired on new leads. Optional for the first deploy — if unset, the code just skips it. |
| `GOOGLE_PLACES_API_KEY` | same as .env.local | GBP intake needs this. |
| `PEXELS_API_KEY` | same as .env.local | Image assembler fallback. |
| `NEXT_PUBLIC_BASE_URL` | `https://<your-project>.vercel.app` | Set **after** first deploy so Vercel gives you the URL. Used for redirect URLs and preview links. |

## Placeholder for Phase 7.5 (Stripe / magic-link)

Add these as empty strings for now — the code checks presence and skips the
integration if unset.

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | placeholder |
| `STRIPE_PRICE_ID` | placeholder |
| `STRIPE_WEBHOOK_SECRET` | placeholder |

## Do NOT set on Vercel

- `NEXT_PUBLIC_N8N_WEBHOOK_URL` — only used by a local script; not needed on Vercel.
- `USE_FIXTURE` — dev-only escape hatch.
- `NODE_ENV` — Vercel sets this automatically.

## Verification after setting

1. Trigger a deploy (push any commit, or hit **Redeploy** in Vercel).
2. On the deployed URL, hit `/api/health/worker` with a POST including the
   right `x-worker-secret` — should return 200.
3. Open Vercel's function logs; a missing var shows up as
   `Missing SUPABASE_URL` (or similar) on the first request.
