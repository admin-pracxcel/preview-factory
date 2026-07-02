# n8n workflows

Workflows the self-hosted n8n box runs to drain the Supabase `jobs` queue and populate `tenants.site_props`. Built manually in the n8n UI — hand-written JSON imports are fragile and tend to break silently on credential refs and node ID mismatches. This directory holds the build guide and any captured payloads.

## Contents

- **`build-guide-stub.md`** — Phase 4 stub workflow build steps. Two triggers (webhook + 30s cron), race-guarded job pickup, hardcoded `site_props` writeback. Prove the async plumbing end-to-end before the real generator lands.
- **`stub-siteprops.json`** — captured Clearflow Plumbing SiteProps blob. Paste into the "PATCH tenant" node as the hardcoded body during stub testing.
- **`build-guide-real.md`** — Phase 5. Replaces the stub sub-workflow with Execute Command calling `generator/cli.ts`. Added in Phase 5.

## Prerequisites

- n8n instance up and reachable (you already have this)
- Supabase project + `service_role` key (Phase 2)
- Vercel `.env.local` has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Phase 3)

## Shared setup — do once

1. In n8n → **Credentials** → **New** → **Header Auth**:
   - **Name**: `Supabase Service Role`
   - **Header name**: `apikey`
   - **Header value**: your Supabase `service_role` key
2. In n8n → **Credentials** → **New** → **Header Auth**:
   - **Name**: `Supabase Service Role Bearer`
   - **Header name**: `Authorization`
   - **Header value**: `Bearer <your service_role key>`

Both are needed because Supabase's REST API requires both `apikey` and `Authorization: Bearer` headers.

3. Set a workflow-level or global n8n **environment variable**:
   - `WORKER_SECRET` — a random 32-byte base64 string (`openssl rand -base64 32` gives you one). Use the same value on Vercel as `WORKER_SHARED_SECRET`.
   - `SUPABASE_URL` — your Supabase URL (or hardcode in the HTTP nodes).

## Environment variable on Vercel

After building the workflow:
- Copy the URL from the "Webhook — job poke" node → set as `N8N_WEBHOOK_URL` in `.env.local` and Vercel dashboard.
- The `WORKER_SHARED_SECRET` in `.env.local` must match `WORKER_SECRET` on n8n.

## Acceptance test

Once the stub workflow is active:

1. `npm run dev` locally
2. Submit an intake through the normal flow
3. `/building` page spins for ~5s, then redirects to `/preview/[id]`
4. The preview shows Clearflow Plumbing (regardless of the business you submitted — that's the stub)
5. Kill n8n mid-flight, submit another intake. Job stays queued in Supabase. Restart n8n. Within 30s the cron picks it up and finishes.

## What's not in this workflow yet

- **Heartbeat cron** (Phase 5) — separate 5-min cron hits Vercel's `/api/health/worker`.
- **Lead notification** — unrelated workflow forwards `/api/leads` submissions.
