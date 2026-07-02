# pf-generate-stub — build guide

Manual build steps for the Phase 4 stub workflow. Once complete, it drains the Supabase `jobs` queue and writes a hardcoded Clearflow Plumbing site_props back to `tenants` so we can prove the async plumbing end-to-end before Phase 5's real generator lands.

**Time**: 15–20 minutes if you're comfortable with n8n; 30 minutes first time.

**Assumes**: shared setup from `n8n/README.md` is done (credentials + `WORKER_SECRET` env var).

---

## Architecture recap

```
Vercel /api/intake ──POST──► n8n webhook ──┐
                                            ├──► Sub-workflow: race-guard → wait → PATCH tenant → PATCH job
n8n cron (30s) ──SELECT queued jobs──── ────┘
```

Two triggers converge on one processing branch. The DB is source of truth — the webhook is a "poke" for speed, the cron is the guarantee.

---

## Step 1 — Create the workflow

1. n8n → **Workflows** → **New**
2. Name: `pf-generate-stub`
3. Save.

## Step 2 — Webhook trigger

1. Add **Webhook** node (Trigger).
2. **HTTP Method**: `POST`
3. **Path**: `pf-generate-stub` (or any slug you like — copy it later for `N8N_WEBHOOK_URL`).
4. **Authentication**: `None` (we verify a shared secret in the next node).
5. **Response Mode**: `Immediately` — we ack fast, do work async.
6. **Response Code**: `202`.
7. **Response Data**: `First Entry JSON` with body `{ "ok": true, "queued": true }`.
8. Save. Copy the **Production URL** — that's your `N8N_WEBHOOK_URL`.

## Step 3 — Verify shared secret

1. Add an **IF** node right after the webhook.
2. **Condition**:
   - Left: `{{$json.headers["x-worker-secret"]}}`
   - Operator: `equal`
   - Right: `{{$env.WORKER_SECRET}}`
3. **false** branch → **Respond to Webhook** node with status 401, body `{"error":"unauthorized"}`. (Or just leave it hanging — nothing to do.)
4. **true** branch → next node.

## Step 4 — Extract job_id + tenant_id from body

1. Add a **Set** node named `Extract IDs`.
2. Add two string values:
   - `job_id` = `{{$json.body.job_id}}`
   - `tenant_id` = `{{$json.body.tenant_id}}`
3. Turn on **Keep Only Set** so we don't drag headers downstream.

## Step 5 — Race guard (mark job=running)

1. Add an **HTTP Request** node named `Claim job`.
2. **Method**: `PATCH`
3. **URL**: `{{$env.SUPABASE_URL}}/rest/v1/jobs?id=eq.{{$json.job_id}}&status=eq.queued`
4. **Authentication**: Use both credentials you set up:
   - Add header `apikey` with your service_role key (or use the Header Auth credential)
   - Add header `Authorization: Bearer <service_role key>`
   - Add header `Prefer: return=representation` (so Supabase returns the updated row)
   - Add header `Content-Type: application/json`
5. **Body** (JSON):
   ```json
   {
     "status": "running",
     "started_at": "{{ new Date().toISOString() }}"
   }
   ```
6. **Options** → **Response** → set **Response Format** to `JSON`.

**Race guard behaviour**: because we `?status=eq.queued`, the UPDATE only touches rows that are still queued. If two workers race, only one wins; the loser gets an empty array back.

## Step 6 — Exit if no rows claimed

1. Add an **IF** node named `Claim succeeded?`.
2. **Condition**: `{{$json.length}}` equal to `0` → **true** branch stops (do nothing).
3. **false** branch → proceed.

## Step 7 — Simulate work (5s wait)

1. Add a **Wait** node.
2. **Wait Amount**: `5`
3. **Wait Unit**: `Seconds`

This is where Phase 5 will replace the wait with an Execute Command calling `generator/cli.ts`.

## Step 8 — Load hardcoded site_props

1. Add a **Set** node named `Hardcoded siteprops`.
2. Add one JSON value:
   - `site_props_json` = paste the entire contents of `n8n/stub-siteprops.json` here.
3. Turn on **Keep Only Set**.

## Step 9 — PATCH tenant with site_props + status=done

1. Add an **HTTP Request** node named `Finish tenant`.
2. **Method**: `PATCH`
3. **URL**: `{{$env.SUPABASE_URL}}/rest/v1/tenants?id=eq.{{$node["Extract IDs"].json.tenant_id}}`
4. Same auth headers as before (apikey + Bearer + Prefer).
5. **Body** (JSON):
   ```json
   {
     "status": "done",
     "site_props": {{$json.site_props_json}}
   }
   ```

## Step 10 — PATCH job with status=done

1. Add an **HTTP Request** node named `Finish job`.
2. **Method**: `PATCH`
3. **URL**: `{{$env.SUPABASE_URL}}/rest/v1/jobs?id=eq.{{$node["Extract IDs"].json.job_id}}`
4. Same auth headers.
5. **Body** (JSON):
   ```json
   {
     "status": "done",
     "finished_at": "{{ new Date().toISOString() }}"
   }
   ```

## Step 11 — Error handler (catches any failure from steps 5–10)

1. In each of the three HTTP Request nodes (Claim job, Finish tenant, Finish job) → **Settings** → set **On Error** to `Continue (using error output)`.
2. Add an **HTTP Request** node named `Mark job failed`, wired to the error outputs of the three HTTP nodes above.
3. **Method**: `PATCH`
4. **URL**: `{{$env.SUPABASE_URL}}/rest/v1/jobs?id=eq.{{$node["Extract IDs"].json.job_id}}`
5. Same auth.
6. **Body** (JSON):
   ```json
   {
     "status": "failed",
     "error": "{{$json.error?.message ?? "unknown"}}",
     "finished_at": "{{ new Date().toISOString() }}"
   }
   ```
7. Chain another PATCH after that to also mark the tenant `status='failed'` with the error message.

## Step 12 — Cron trigger (recovery path)

1. Add a **Schedule Trigger** node.
2. **Trigger Interval**: every 30 seconds.
3. Add an **HTTP Request** node named `Pick queued job`:
   - **Method**: `GET`
   - **URL**: `{{$env.SUPABASE_URL}}/rest/v1/jobs?status=eq.queued&created_at=lt.{{ new Date(Date.now() - 30000).toISOString() }}&order=created_at.asc&limit=1&select=id,tenant_id`
   - Same auth.
4. Add an **IF** node: `{{$json.length}}` greater than 0 → true branch.
5. Add a **Set** node to reshape into `{ job_id, tenant_id }` like the webhook side.
6. Wire into the same sub-workflow entry point as Step 5 (Claim job).

**Trick**: to avoid duplicating steps 5–11, either put them in a separate sub-workflow and call it via **Execute Workflow** from both triggers, or use a **Set** node to normalise the shape and merge into one processing chain.

## Step 13 — Activate

Toggle the workflow to **Active** in the top right. Both triggers go live.

## Verify

1. Push the Vercel env vars: `N8N_WEBHOOK_URL` (from Step 2) and `WORKER_SHARED_SECRET` (matches `WORKER_SECRET` on n8n).
2. `npm run dev` on your Mac.
3. Do a fresh intake through the normal flow.
4. In Supabase SQL Editor watch:
   ```sql
   select id, status, updated_at from tenants order by updated_at desc limit 3;
   select id, status, started_at, finished_at from jobs order by created_at desc limit 3;
   ```
   You should see status transitions: `queued -> running -> done` within ~6s.
5. `/building` page redirects to `/preview/[id]` after the animation. The preview renders Clearflow Plumbing (the stub blob).

If the webhook path is broken but the cron path works, you'll still see it complete within ~30s — that's the recovery guarantee in action.
