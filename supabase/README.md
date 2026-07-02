# Supabase setup

Manual steps to apply this repo's schema to your Supabase project. All done via the dashboard — no CLI or migrations tool required at this stage.

**Estimated time**: 5 minutes.

Repeat this checklist per environment. For now you have one project (`preview-factory`) that doubles as dev; create a second one (`preview-factory-prod`) before Phase 7 and repeat these steps against it.

---

## 1. Apply the schema

1. Open your project → **SQL Editor** → **New query**.
2. Paste the entire contents of [`schema.sql`](./schema.sql).
3. Click **Run**.
4. Look for a green success toast. If anything failed, screenshot the error and share it.

The script is idempotent. If you tweak the schema later, re-running is safe (except column changes on existing tables — see "Later schema changes" below).

## 2. Confirm the storage bucket exists

The schema creates `previews` for you via `INSERT INTO storage.buckets`. Confirm:

1. Go to **Storage** in the left sidebar.
2. You should see a `previews` bucket, marked **Public**.
3. If it's missing (some Supabase regions restrict `storage.buckets` writes from the SQL Editor), create it manually:
   - Click **New bucket** → Name: `previews` → **Public bucket**: ON → Create.

## 3. Confirm RLS is on

The schema enables RLS on all six public tables with zero policies (locked to `service_role`).

1. Go to **Table Editor** → click into each table (`sessions`, `tenants`, `jobs`, `leads`, `magic_tokens`, `processed_events`).
2. In the top-right, verify **RLS enabled** shows a green pill for each.

## 4. Capture the credentials

You'll need two values for local dev and (later) Vercel:

1. **Settings** → **API**.
2. Copy the **Project URL** (e.g. `https://xxxxxxxxxxxxxxxxxxxx.supabase.co`).
3. Copy the **`service_role`** key (NOT the `anon` key — check twice, the labels are close).

Add both to `.env.local` in the repo root:

```
SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

`.env.local` is gitignored — safe to paste real values.

**Never** commit the service_role key. It bypasses RLS and has full DB access.

## 5. Smoke-test the connection

From the repo root, once the env vars are set:

```
node -e "
  const { createClient } = require('@supabase/supabase-js');
  const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  s.from('tenants').select('id').limit(1).then(({error, data}) => {
    if (error) { console.error('FAIL:', error.message); process.exit(1); }
    console.log('OK — connected, tenants table returned', data.length, 'rows');
  });
"
```

(This one-liner assumes `@supabase/supabase-js` is installed, which happens in Phase 3.)

Alternative right now — just eyeball the URL in the SQL Editor:

```sql
insert into public.sessions (user_agent) values ('setup-smoke-test') returning id;
```

If that returns a UUID, everything's wired.

---

## Later schema changes

`CREATE TABLE IF NOT EXISTS` skips silently if the table exists — column changes in `schema.sql` after the initial run **won't apply**. When we need to change columns, we'll:

- Add a dedicated migration file (`supabase/migrations/YYYY-MM-DD-description.sql`)
- Apply via SQL Editor (same paste-and-run flow)
- Update `schema.sql` to reflect the target state so a fresh project can be provisioned in one go

Once you're past first-launch, switch to `supabase db push` and CI-driven migrations. Overkill now.

## What's not in the schema yet

Deferred to later phases so the file stays readable:

- **pg_cron reapers** (Phase 8) — 3-hour unclaimed cleanup, 30-day cancel grace, weekly jobs/tokens cleanup
- **Storage cleanup Edge Function** (Phase 8) — deletes `previews/<tenant_id>/*` when the tenant row is dropped
- **Rate-limit query helpers** (Phase 9)
