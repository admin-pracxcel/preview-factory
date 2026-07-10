# n8n workflow — edit-request approval

This is the node-by-node build spec for the workflow that turns an approved
edit request into a live site change. The Vercel side is fully wired (Phases
0–4); this is what you build in n8n to close the loop.

## What triggers it

`POST /api/admin/edit-requests/[id]/approve` on Vercel calls
`N8N_APPROVE_WEBHOOK_URL` with:

```
POST <your-n8n-webhook-url>
X-Launcharoo-Signature: t=<epoch>,v1=<hex-hmac>
Content-Type: application/json

{ "editRequestId": "<uuid>" }
```

The signature is HMAC-SHA256 of `"<t>.<body>"` using
`EDIT_WORKFLOW_HMAC_SECRET`. Verify it on entry so a stolen webhook URL
can't fire the workflow.

## Env vars to set on the n8n host

- `EDIT_WORKFLOW_HMAC_SECRET` — same value as in Vercel. Signs the
  webhook Vercel sends and the `context` / `apply-patches` calls we make
  back into Vercel.
- `LAUNCHAROO_ORIGIN` — `https://launcharoo.online`. Just so we don't
  hard-code it in a workflow expression.
- `claude` — logged in via `claude login` on the container. No
  `ANTHROPIC_API_KEY` needed while running under a subscription.

## Node graph

```
[1 Webhook]
      │
[2 Function — verify Vercel signature]
      │
[3 Function — sign an outbound GET to /context]
      │
[4 HTTP — GET /api/admin/edit-requests/{id}/context]
      │
[5 Execute Command — claude -p "$PROMPT" < /dev/null]
      │
[6 Function — parse claude output → { patches, summary, outOfScope }]
      │
[7 Function — sign an outbound POST to /apply-patches]
      │
[8 HTTP — POST /api/admin/edit-requests/{id}/apply-patches]
      │
[9 Function — surface { ok, applied } / log errors]

  Any failure branches to:
[E1 HTTP — POST /apply-patches with { patches: [], summary: "", outOfScope: ["workflow error: ..."] }]
```

The failure branch is optional but useful — hitting `/apply-patches`
with empty patches AND a non-empty `outOfScope` still marks the row
`applied` and emails admin about what didn't land. Alternatively skip
it; the row will sit in `approved` until you handle it manually or the
next retry kicks in.

---

## 1. Webhook trigger

- **HTTP Method**: POST
- **Path**: `edit-request-approved` (or whatever you prefer)
- **Authentication**: None (we verify manually in node 2 for HMAC).
- **Response Mode**: Immediately — respond `{ ok: true }` with 202 and
  keep processing async.

Take note of the Production URL — that goes in Vercel's
`N8N_APPROVE_WEBHOOK_URL`.

## 2. Function — verify Vercel signature

Node type: **Code** (JavaScript). Purpose: reject anything without a
valid signature so a leaked webhook URL alone isn't enough to run
claude on your Anthropic account.

```js
const crypto = require('crypto');
const secret = $env.EDIT_WORKFLOW_HMAC_SECRET;
if (!secret) throw new Error('EDIT_WORKFLOW_HMAC_SECRET is not set');

const sigHeader = $input.item.json.headers?.['x-launcharoo-signature']
  ?? $input.item.json.headers?.['X-Launcharoo-Signature'];
if (!sigHeader) throw new Error('missing signature header');

const parts = sigHeader.split(',').map(p => p.trim());
const t = parts.find(p => p.startsWith('t='))?.slice(2);
const v1 = parts.find(p => p.startsWith('v1='))?.slice(3);
if (!t || !v1) throw new Error('malformed signature header');

const nowSec = Math.floor(Date.now() / 1000);
if (Math.abs(nowSec - Number(t)) > 300) {
  throw new Error('signature timestamp is stale (>5 min)');
}

const body = JSON.stringify($input.item.json.body ?? {});
const expected = crypto
  .createHmac('sha256', secret)
  .update(`${t}.${body}`)
  .digest('hex');

const a = Buffer.from(v1, 'hex');
const b = Buffer.from(expected, 'hex');
if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
  throw new Error('signature mismatch');
}

return { json: { editRequestId: $input.item.json.body.editRequestId } };
```

_(n8n's Webhook node exposes headers/body slightly differently by
version — adjust the field accessors to match yours. The core logic
above is stable.)_

## 3. Function — sign the outbound GET to /context

We're about to fetch tenant siteProps + prompt from Vercel. The
`/context` endpoint requires the same HMAC signature. GETs sign an
empty body.

```js
const crypto = require('crypto');
const editRequestId = $json.editRequestId;
const t = Math.floor(Date.now() / 1000).toString();
const sig = crypto
  .createHmac('sha256', $env.EDIT_WORKFLOW_HMAC_SECRET)
  .update(`${t}.`)
  .digest('hex');
return {
  json: {
    editRequestId,
    signature: `t=${t},v1=${sig}`,
  },
};
```

## 4. HTTP Request — fetch context

- **Method**: GET
- **URL**: `{{ $env.LAUNCHAROO_ORIGIN }}/api/admin/edit-requests/{{ $json.editRequestId }}/context`
- **Headers**:
  - `X-Launcharoo-Signature`: `={{ $json.signature }}`
- **Response**: JSON — you'll get back `{ editRequestId, tenantId, tenantName, request, adminNote, prompt }`.

Store the response in a variable / expression you can pull from later
nodes (e.g. `$('4. HTTP').item.json.prompt`).

## 5. Execute Command — claude

Node type: **Execute Command**.

- **Command**: `bash -lc 'claude -p "$PROMPT" < /dev/null'`
- **Environment Variables**:
  - `PROMPT`: `={{ $('4. HTTP').item.json.prompt }}`

n8n will handle escaping when it substitutes the expression into the
env var. Do NOT try to inline the prompt into the command string —
shell escaping will bite you.

**Timeout**: 120–180 seconds. Small edits finish in ~10s; larger
mutations may want longer.

**Working directory**: doesn't matter (claude runs stateless with `-p`).

**Optional flags** to consider:
- `--output-format json` (if you want claude to double-wrap its JSON in
  its own metadata envelope — I'd leave this off and rely on our prompt
  telling claude to output raw JSON).

## 6. Function — parse claude output

Claude _should_ output only JSON. Defensively strip markdown fences and
leading/trailing whitespace before parsing.

```js
const raw = $json.stdout ?? '';
let cleaned = raw.trim();

// Strip ``` fences if claude ignored our instruction.
cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

let parsed;
try {
  parsed = JSON.parse(cleaned);
} catch (err) {
  throw new Error(`claude output was not valid JSON: ${err.message}\n\nRaw output was:\n${raw}`);
}

if (!Array.isArray(parsed.patches)) {
  throw new Error('response is missing patches[]');
}

return {
  json: {
    editRequestId: $('4. HTTP').item.json.editRequestId,
    patches: parsed.patches,
    summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
    outOfScope: Array.isArray(parsed.outOfScope) ? parsed.outOfScope : [],
  },
};
```

## 7. Function — sign the outbound POST to /apply-patches

Same HMAC over the exact JSON body we'll send. Order matters: stringify
now, sign the exact string, then send the exact string.

```js
const crypto = require('crypto');
const body = JSON.stringify({
  patches: $json.patches,
  summary: $json.summary,
  outOfScope: $json.outOfScope,
});
const t = Math.floor(Date.now() / 1000).toString();
const sig = crypto
  .createHmac('sha256', $env.EDIT_WORKFLOW_HMAC_SECRET)
  .update(`${t}.${body}`)
  .digest('hex');
return {
  json: {
    editRequestId: $json.editRequestId,
    body,
    signature: `t=${t},v1=${sig}`,
  },
};
```

## 8. HTTP Request — apply patches

- **Method**: POST
- **URL**: `{{ $env.LAUNCHAROO_ORIGIN }}/api/admin/edit-requests/{{ $json.editRequestId }}/apply-patches`
- **Headers**:
  - `X-Launcharoo-Signature`: `={{ $json.signature }}`
  - `Content-Type`: `application/json`
- **Body Content Type**: Raw / JSON
- **Body**: `={{ $json.body }}` — the exact string we HMAC'd. Not an
  object literal — if n8n re-serialises with different key order, the
  signature is invalid.

Success returns `{ ok: true, applied: <number> }`. Row moves to
`applied`, owner gets an email, out-of-scope items trigger an admin
notice.

Failure returns 400/401/409/500 with `{ error }`. On our side, the row
is moved to `failed` and admin is emailed for path-allowlist / schema
failures. Auth / shape failures don't touch the row — treat them as
"workflow bug, fix in n8n and retry".

## 9. Function — final logging

Log the outcome. This is where you'd fire a chat notification / Discord
hook if you want live visibility.

```js
if ($json.ok) {
  console.log(`Applied ${$json.applied} patches for ${$('4. HTTP').item.json.tenantName}`);
} else {
  console.error(`Apply failed: ${$json.error}`);
}
return { json: $json };
```

## Error branches

Wire each `Function` and `HTTP` node's "Error" output to a shared
**Function** node that constructs an out-of-scope-only body:

```js
return {
  json: {
    editRequestId: $('2. Function').item.json.editRequestId,
    body: JSON.stringify({
      patches: [],
      summary: 'Workflow error — no changes applied.',
      outOfScope: [`Workflow crashed at ${$node.name}: ${$json.error?.message ?? 'unknown'}`],
    }),
    signature: 'stub', // sign it inline
  },
};
```

Then re-use node 7's HMAC sign + node 8's HTTP POST. The row still ends
in an operator-friendly state (`applied` with an empty patch and a
`outOfScope` line surfacing the failure to admin), so you'll get a
"partial edit" email instead of a silent stall.

## Testing checklist

Before pointing this at a real customer request:

1. Vercel env vars set (both secrets, plus the webhook URL now that
   this workflow is deployed).
2. Send yourself a test edit request from a tenant dashboard.
3. Click the "Review this request" button in the concierge email.
4. Add an admin note and click Approve.
5. Watch the n8n execution — check every node in order.
6. Confirm the row moves to `applied` in Supabase.
7. Confirm the owner gets the "changes are live" email.
8. Confirm the actual site reflects the change (open the tenant preview).

## Cost & rate limits

Each run is one `claude -p` call. With Sonnet on a subscription plan
each edit is a few thousand output tokens. Watch monthly usage in the
Anthropic console; a runaway workflow can burn the quota that keeps
your day-to-day Claude Code use fast.

The Vercel side rate-limits the concierge inbox (10 edit requests /
tenant / day) so an infinite-loop tenant can't spam the queue.
