# Housekeeping cron (Phase 8c)

Weekly cleanup sweep. Deletes stale rows and blanks `site_props` on tenants
that have been `status='expired'` for more than 30 days.

Time: 3 minutes (same n8n env pattern as reaper).

## Retention windows

| Table | Rule |
|---|---|
| `jobs` | `created_at` > 7 days → delete |
| `processed_events` | `seen_at` > 60 days → delete |
| `magic_tokens` | used (`used_at is not null`) OR expired, past 7 days → delete |
| `sessions` | `last_seen_at` > 90 days AND no tenant references it → delete |
| `tenants.site_props` | tenant is `expired` AND `updated_at` > 30 days → set NULL (row kept) |

Every step is a pure DELETE (or UPDATE for `site_props`). No cascades outside
the schema's own on-delete rules. Sessions do a two-hop check because
Supabase JS can't do WHERE NOT EXISTS in a single statement.

## 1. Import the workflow

n8n UI → Workflows → **Import from file** → `n8n/cleanup.json`.

Env vars — same as heartbeat/reaper, no new ones:
- `HEARTBEAT_URL`
- `WORKER_SHARED_SECRET`

Schedule: `0 4 * * 0` (Sunday 04:00 UTC).

Activate the workflow.

## 2. Smoke test

Manual trigger — expected response body:

```json
{
  "ok": true,
  "jobsDeleted": 0,
  "processedEventsDeleted": 0,
  "magicTokensDeleted": 0,
  "sessionsDeleted": 0,
  "sitePropsBlanked": 0,
  "ranAt": "..."
}
```

Zero across the board is the normal answer on a fresh weekly run of a healthy
system. To force real deletions:

- **magic_tokens**: log in twice with the magic-link flow, wait long enough
  for one token's `used_at` to be > 7d (or backdate it in the SQL Editor),
  then run cleanup — should delete that row.
- **jobs**: backdate a completed job's `created_at` by 8 days.
- **processed_events**: backdate a row's `seen_at` by 61 days.
- **site_props blank**: pick an `expired` tenant, set its `updated_at` to
  31 days ago in the SQL Editor, run cleanup — `site_props` should become
  NULL, row stays.

## 3. Manual invocation

```
curl -X POST https://preview-factory.vercel.app/api/cron/cleanup \
     -H "x-worker-secret: $WORKER_SHARED_SECRET" \
     -H "Content-Type: application/json" \
     -d '{}'
```

## What Phase 8c does NOT cover

- Deleting expired `tenants` rows entirely. Audit trail stays forever.
- Removing the Supabase Storage objects (logos, generated images) tied to
  blanked tenants. Storage cleanup wants its own sweep because paths are
  keyed off the tenant UUID.
- Vacuuming or reindexing Postgres. Supabase runs autovacuum.
