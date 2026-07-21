# Preview-ready SMS via KrispCall (n8n-only)

The customer's mobile is captured at intake and stored on `tenants.phone`. The
"your preview is ready" SMS is sent from your existing KrispCall number,
inside the same n8n workflow that generates the site. Nothing is wired on the
Vercel side — n8n owns the entire send path.

## What's already built on our side

- **DB column**: `tenants.preview_notified_at` (nullable TIMESTAMPTZ).
  Migration: `strategy/_master/migrations/2026-07-21-tenants-preview-notified-at.sql`.
- **TenantRecord** exposes `previewNotifiedAt` so future admin surfaces
  (e.g. "resend preview SMS" button) can read/write it.

That's the whole Vercel-side scope. Everything else is n8n.

## What you need to do

### 1. Run the migration in Supabase

```sql
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS preview_notified_at TIMESTAMPTZ;
```

### 2. Add four nodes at the tail of the Generate Real workflow

Attachment point: hook the first new node off **Finish job**, not
**Finish tenant**. The existing tail is
`... → Ok? → Finish tenant → Finish job → (end)`; the SMS chain extends past
Finish job so an SMS failure never blocks the job runner from picking up the
next queued generation.

The new chain:
```
Finish job → GET tenant row → IF (not notified & has phone) → KrispCall send → PATCH preview_notified_at
```

**Node A — Supabase GET: has this tenant already been notified?**

- **Method**: `GET`
- **URL** (copy this exact string — do NOT include any surrounding backticks):
  ```
  {{ $env.SUPABASE_URL }}/rest/v1/tenants?id=eq.{{ $json.tenant_id }}&select=phone,name,preview_notified_at
  ```
- **Headers**:
  - `apikey`: `={{ $env.SUPABASE_SERVICE_ROLE_KEY }}`
  - `Authorization`: `Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}`
- **Response**: single-row array. Extract the first item.

**Node B — IF: skip if already notified or no phone**

- **Condition 1 (AND)**: `{{ $json.preview_notified_at }}` — Is Empty
- **Condition 2 (AND)**: `{{ $json.phone }}` — Is Not Empty

Wire the "true" branch to node C. The "false" branch goes nowhere (silent
skip — the workflow ends cleanly).

**Node C — KrispCall Send SMS** (your existing node)

- **To**: `{{ $json.phone }}` — already in AU E.164 format (`+614...`) from
  intake validation.
- **From**: your KrispCall number.
- **Body**:
  ```
  Your Launcharoo preview for {{ $json.name || 'your business' }} is ready: {{ $env.LAUNCHAROO_ORIGIN }}/preview/{{ $('Load queued job').item.json.tenant_id }} — Reply STOP to opt out.
  ```
  Adjust the `$('Load queued job')` reference name to whatever node holds
  `tenant_id` earlier in your workflow.

**Node D — Supabase PATCH: mark as notified**

- **Method**: `PATCH`
- **URL** (copy exact — no surrounding backticks):
  ```
  {{ $env.SUPABASE_URL }}/rest/v1/tenants?id=eq.{{ $('Load queued job').item.json.tenant_id }}
  ```
- **Headers**:
  - `apikey`: `={{ $env.SUPABASE_SERVICE_ROLE_KEY }}`
  - `Authorization`: `Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}`
  - `Content-Type`: `application/json`
  - `Prefer`: `return=minimal`
- **Body** (JSON):
  ```json
  {
    "preview_notified_at": "{{ $now.toISO() }}"
  }
  ```

**Continue on Fail**: Turn this on for node C. An SMS failure shouldn't fail
the whole generation run — the preview is still live and you can resend
manually if needed. Node D should only run when C succeeds, so it wires off
C's success branch (not the "continue on fail" branch), meaning
`preview_notified_at` is only set when the SMS actually went out.

### 3. Test it end-to-end

- Trigger a fresh intake with your own AU mobile.
- Wait for the site to render on `/preview/<id>`.
- SMS should arrive within seconds.
- Supabase:
  ```sql
  select id, phone, preview_notified_at
  from tenants
  order by created_at desc
  limit 1;
  ```
  `preview_notified_at` should be non-null.

## What's NOT built (flag if you want either)

- **Post-checkout SMS** — no "welcome, your site is live at {domain}"
  message after Stripe subscribe. Would live in a similar n8n branch off
  the Stripe webhook.
- **Inbound SMS handling** — the marketing copy says *"SMS us to update
  your site"*. Wiring KrispCall's inbound webhook to `/api/edit-request`
  would make that real. Small piece of glue on our side + a KrispCall
  routing rule.
