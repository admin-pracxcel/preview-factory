# SMS notifications — ClickSend setup

The "your preview is ready" SMS is sent by our own `/api/tenants/[id]/notify-preview-ready`
endpoint. The generator's n8n workflow calls that endpoint as its last step,
right after PATCHing `site_props` onto the tenant row. This doc covers the
one-time setup you (human) have to do so the wiring works.

## What's already built

- **DB column** — `tenants.preview_notified_at` (nullable TIMESTAMPTZ). Idempotency
  guard so a duplicate call from n8n doesn't double-SMS.
- **`lib/clicksend-client.ts`** — thin wrapper around ClickSend's send-SMS REST
  endpoint. Normalises AU mobiles (`04...` or `+614...`) to E.164 before send.
- **`POST /api/tenants/[id]/notify-preview-ready`** — HMAC-gated endpoint that
  reads `phone` from the tenant row, sends the SMS via ClickSend, marks
  `preview_notified_at`. Idempotent.

## What you need to do (one-time, ~15 min)

### 1. Sign up for ClickSend

- <https://www.clicksend.com/au/> → **Sign up**. Australian entity, AUD billing.
- Verify the business (drivers licence or ABN — takes ~1 business day to be
  approved for full alphanumeric sender IDs; interim sends still work).
- Add a small amount of credit (A$10 is enough for ~180 SMS while you validate).

### 2. Register your alphanumeric sender ID

- Dashboard → **SMS → Dedicated numbers → Alphanumeric Sender IDs**.
- Add `Launcharoo` as a new sender ID. Purpose: "transactional preview link
  notifications". Approval is usually same-day.
- Once approved, notes in your account: "Sender ID Launcharoo is approved for
  transactional messages".

### 3. Generate an API key

- Dashboard → **Developers → API Credentials**.
- Copy your **Username** (your account email) and your **API Key** (long
  base64-ish string; treat it as a secret).

### 4. Paste four env vars into Vercel

Project → **Settings → Environment Variables** → add these for **Production +
Preview + Development**:

| Key                        | Value                                    |
| -------------------------- | ---------------------------------------- |
| `CLICKSEND_USERNAME`       | Your ClickSend username (email)          |
| `CLICKSEND_API_KEY`        | The API key from step 3                  |
| `CLICKSEND_SENDER_ID`      | `Launcharoo` (or whatever you registered)|
| `NEXT_PUBLIC_APP_ORIGIN`   | `https://launcharoo.online` (if not set) |

The endpoint reuses `EDIT_WORKFLOW_HMAC_SECRET` for signature verification —
same secret you already have for the edit-request workflow, no new secret to
manage.

Redeploy after adding.

### 5. Run the migration in Supabase

Open Supabase → SQL Editor → paste and run:

```sql
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS preview_notified_at TIMESTAMPTZ;
```

(Also lives in `strategy/_master/migrations/2026-07-21-tenants-preview-notified-at.sql`.)

### 6. Add the final node to your Generate Real n8n workflow

At the end of the generator workflow, right after the node that PATCHes
`site_props` onto the tenants row, add these two nodes:

**Node A — Function: sign the outbound POST**

```js
const crypto = require('crypto');
const tenantId = $json.tenant_id ?? $('Load queued job').item.json.tenant_id;
if (!tenantId) throw new Error('tenantId missing at notify step');

const body = '{}';   // empty JSON — the endpoint reads everything from the row
const t = Math.floor(Date.now() / 1000).toString();
const sig = crypto
  .createHmac('sha256', $env.EDIT_WORKFLOW_HMAC_SECRET)
  .update(`${t}.${body}`)
  .digest('hex');

return {
  json: {
    tenantId,
    signature: `t=${t},v1=${sig}`,
    body,
  },
};
```

**Node B — HTTP Request: hit /notify-preview-ready**

- **Method**: `POST`
- **URL**: `{{ $env.LAUNCHAROO_ORIGIN }}/api/tenants/{{ $json.tenantId }}/notify-preview-ready`
- **Headers**:
  - `X-Launcharoo-Signature`: `={{ $json.signature }}`
  - `Content-Type`: `application/json`
- **Body Content Type**: **Raw** (NOT JSON — same rule as the apply-patches
  node; JSON mode double-stringifies and breaks HMAC)
- **Body**: `={{ $json.body }}` — the literal string `{}`
- **Continue on Fail**: On — so an SMS failure doesn't fail the whole
  generation run. The preview is still live; the customer can be resent
  manually later.

### 7. Test it end-to-end

- Go through the intake flow with your own AU mobile in the phone field.
- Wait for the site to render on `/preview/<id>`.
- You should get an SMS within 5–10 seconds: *"Your Launcharoo preview for
  {name} is ready: https://launcharoo.online/preview/<id> — Reply STOP to opt
  out."*
- Check Vercel logs: `[notify-preview-ready] tenant <id> → SMS ... notifiedAt=...`
- Check Supabase: `select id, phone, preview_notified_at from tenants order by
  created_at desc limit 1;` — `preview_notified_at` should be set.

## Cost + expected volume

- ClickSend AU rate: ~5–6c per SMS segment.
- Our message stays under 160 chars for most business names → one segment.
- 100 previews/month = ~A$6/month at current rate. Trivial.

## What's NOT built (yet — flag if you want)

- **Post-checkout SMS receipt** — currently only the preview-ready SMS. If you
  want a "welcome, your site is live at {domain}" SMS on subscribe, we'd add
  a Stripe-webhook path that mirrors the notify endpoint.
- **Inbound SMS handling** — the marketing copy promises "SMS us to update
  your site". ClickSend can forward inbound messages to a webhook; hooking
  that up to `/api/edit-request` is a natural next step.
- **Per-tenant STOP suppression** — ClickSend handles STOP centrally so we
  don't need our own suppression list yet; revisit if we ever add a
  concierge who might message customers directly.
