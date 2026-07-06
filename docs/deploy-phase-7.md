# Phase 7 deploy guide

First Vercel go-live. Everything below is manual — I can't run deploys,
migrations, or credential moves.

Rough time: 20–30 minutes end to end.

## 0. Before you start

- Make sure the local branch is pushed:
  ```
  git push origin main
  ```
  n8n's generator command already does `git reset --hard origin/main` at the
  start of every job, so anything unpushed won't be picked up on the box.

## 1. Apply the schema change in Supabase

Phase 7 adds one new table: `edit_requests`. Run this once against the
existing project (`roglgvdxixyaxrnfddqi`).

1. Open the Supabase dashboard → SQL editor.
2. Open `supabase/schema.sql` from the repo, copy the whole file, paste and Run.
   The file is idempotent — everything is `create ... if not exists` or
   `insert ... on conflict do nothing`.
3. Verify: in the Table Editor you should now see `edit_requests` with
   columns `id, tenant_id, request, status, created_at, resolved_at,
   change_summary, proposed_site_props`.

## 2. Create the Vercel project

1. https://vercel.com/new → import Git repository.
2. Pick `admin-pracxcel/preview-factory`. Branch: `main`.
3. Framework preset: **Next.js** (auto-detected).
4. Root directory: leave as `./`.
5. Build command / output dir: leave defaults.
6. **Don't deploy yet** — hit "Environment Variables" first.

## 3. Set environment variables

Paste in each var from `docs/vercel-env.md`. Scope: **Production** and
**Preview** (tick both). Skip the `NEXT_PUBLIC_BASE_URL` for now — you'll
add it in step 5 once you know the vercel.app domain.

## 4. First deploy

Hit **Deploy**. Watch the build log. Two things that historically bit us:

- **`tsx` in devDependencies** — fixed in Phase 5, `tsx` is a regular dep now.
  A build error here means the fix was reverted.
- **Native module bindings** — we don't use any, but if the build fails with
  `sharp` or `lightningcss` errors, tell me and I'll investigate.

When the build finishes you get a `<project>.vercel.app` URL.

## 5. Add `NEXT_PUBLIC_BASE_URL`

Back to Vercel → Project Settings → Environment Variables → add
`NEXT_PUBLIC_BASE_URL` = `https://<project>.vercel.app` (the URL you just got).
Trigger a redeploy (any small commit or the **Redeploy** button).

Without this, the dashboard's "Live URL" copy button and welcome-page redirects
point at `localhost:3000`.

## 6. Activate the n8n heartbeat

The workflow reads `$env.HEARTBEAT_URL` so no JSON edit is needed.

1. On the n8n VPS, add to `/opt/n8n/.env` (or wherever docker-compose reads env):
   ```
   HEARTBEAT_URL=https://<project>.vercel.app
   WORKER_SHARED_SECRET=<same value as the Vercel env var>
   ```
2. `docker compose up -d --force-recreate n8n` so the container picks up the
   new env.
3. In n8n UI: import `n8n/heartbeat.json` if not already imported.
4. Confirm the workflow POSTs `HEARTBEAT_URL/api/health/worker` with the
   `x-worker-secret` header derived from `WORKER_SHARED_SECRET`.
5. **Activate** the workflow. It runs every 5 minutes.

Verify: watch executions for one 5-minute cycle. First run should return 200.
Then check the `worker_health` row in Supabase — `last_seen_at` should be
within the last 5 minutes.

## 7. Smoke test (production URL)

The goal is a full end-to-end from a real browser, not localhost.

1. Open `https://<project>.vercel.app` in an incognito window.
2. Submit the intake form (any real business — search by name).
3. Watch the building page. Within ~2 minutes it should redirect to the
   preview.
4. Confirm the preview renders correctly (hero, services, gallery images).
5. Open the customise panel → upload a logo (PNG or JPG). Confirm it appears
   and is stored at `<supabase-url>/storage/v1/object/public/previews/<tenantId>/...`.
6. Try uploading an `.svg` — should be rejected with a "PNG, JPG, WebP" message.
7. Open `/dashboard/<tenantId>` — confirm the leads section and edit-request
   history render without errors.
8. Submit a dashboard edit request ("change the phone number to 1234"),
   confirm status flips pending → processing → preview and the preview banner
   shows up when you visit the preview URL.

If any step fails, capture the tenant/job ID from the URL and pull the
execution log via the n8n MCP — I can debug from there.

## 8. Deploy done

Update `strategy/_master/state.md` to note Phase 7 complete with the
production URL. Phase 7.5 (Stripe, magic-link claim) is next.

## Rollback

Vercel keeps every previous deployment. Project → Deployments → click the
prior good deployment → "Promote to Production". Zero downtime, no code
change needed.

The Supabase schema change is additive-only (new table), so a rollback of
the app code is safe. No schema rollback needed.
