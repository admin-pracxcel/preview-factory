# Reaper cron setup (Phase 8b)

Marks unclaimed sites older than 24h as `status='expired'`, and post-cancel
sites older than 7 days as `status='expired'`. `/preview/site/[id]` redirects
expired tenants to `/expired/[id]`. Site data is preserved for 30 days (hard
delete happens in Phase 8c housekeeping).

Time: 5 minutes.

## 1. Apply the schema change

Supabase → SQL Editor → paste `supabase/schema.sql` → Run. The ALTER at the
top of the tenants section widens the status check constraint to include
`'expired'`. Idempotent — safe to re-run on any environment.

## 2. Import the n8n workflow

n8n UI → Workflows → **Import from file** → `n8n/reaper.json`.

The workflow uses the same env vars as heartbeat:
- `HEARTBEAT_URL` (base URL of the Vercel deployment)
- `WORKER_SECRET` (must match Vercel's `WORKER_SHARED_SECRET`)

Both are already set on your n8n box for the heartbeat workflow — no new
vars.

Schedule: `15 3 * * *` (03:15 UTC daily). Adjust if you prefer a
different quiet hour.

Turn the workflow **Active** and run it once manually via **Execute
Workflow** to smoke test.

## 3. Smoke test

Manual trigger — expected response body:

```json
{ "ok": true, "unclaimedExpired": 0, "cancelledExpired": 0, "ranAt": "..." }
```

To force a real expiry:

1. Supabase → Table Editor → `tenants` → pick a test row that is unclaimed
   (`claimed_at` is null).
2. Edit its `created_at` to something 25+ hours in the past.
3. Run the reaper workflow.
4. Refresh the row — `status` should be `'expired'`.
5. Visit `https://preview-factory.vercel.app/preview/site/<id>` — should
   redirect to `/expired/<id>`.
6. POST `/api/checkout` with that tenantId — should return 410 with
   `expiredUrl` in the body.

## 4. Manual invocation from your laptop

```
curl -X POST https://preview-factory.vercel.app/api/cron/reaper \
     -H "x-worker-secret: $WORKER_SHARED_SECRET" \
     -H "Content-Type: application/json" \
     -d '{}'
```

Handy for one-off cleanup outside the schedule.

## What Phase 8b does NOT cover

- Deleting `site_props` after expiry — that's Phase 8c housekeeping.
- Deleting expired tenant rows entirely — the audit trail stays.
- Notifying the owner via email that their site expired — no design yet;
  they get magic-link-signed-in owners a "This site is scheduled for
  cleanup" banner instead if we build that.
