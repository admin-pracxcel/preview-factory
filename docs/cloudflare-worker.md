# Cloudflare Worker deploy runbook (Phase 10a-iii)

This is the piece that makes `<slug>.launcharoo.online` actually resolve
to a customer's website.

## How it works (60-second read)

```
Visitor's browser
   │
   │  https://johnsplumbing.launcharoo.online/services/emergency
   ▼
Cloudflare (SSL termination, wildcard cert on *.launcharoo.online)
   │
   ▼
Cloudflare Worker  ← this runbook deploys this
   │
   │  1. Reads slug from Host header: "johnsplumbing"
   │  2. Calls preview-factory.vercel.app/api/tenant/by-slug/johnsplumbing
   │     → { tenantId: "abc-123", expired: false }
   │  3. Proxies the request to:
   │     preview-factory.vercel.app/preview/site/abc-123/services/emergency
   │
   ▼
Vercel (Next.js app)
   │
   ▼
Response flows back to the browser, still branded as launcharoo.online
```

The customer's browser only ever sees `launcharoo.online`. Vercel only
ever sees `preview-factory.vercel.app`. Neither knows the other exists.

Time to complete: 15-20 minutes for a first-time setup.

---

## Prerequisites

Before you start, confirm you have all four:

- [ ] `launcharoo.online` is on Cloudflare (nameservers changed at the
      registrar, zone status **Active** in the Cloudflare dashboard).
- [ ] You can log in to the Cloudflare dashboard as the account that
      owns the zone.
- [ ] Node 18 or newer installed locally (`node --version`).
- [ ] You've pushed the current branch — the code Phase 10a-i landed
      needs to be live on Vercel so the Worker's lookup call resolves.
      Verify with:

  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" \
    https://preview-factory.vercel.app/api/tenant/by-slug/nonexistent
  ```

  Expected: `404`. If you see `500` or `403`, redeploy Vercel first.

---

## Step 1 — install wrangler and log in

Wrangler is Cloudflare's CLI. It lives inside the `worker/` folder as a
local dev-dependency so you don't need a global install.

```bash
cd worker
npm install
```

Expected: no errors. Creates `worker/node_modules/`.

Now authenticate:

```bash
npx wrangler login
```

What happens:

1. Wrangler prints something like `Attempting to login via OAuth...` and
   opens your default browser.
2. The browser lands on `https://dash.cloudflare.com/oauth2/...`. Log in
   if you're not already.
3. Cloudflare asks you to authorise wrangler. Click **Allow**.
4. Browser shows "You have granted authorization". Terminal shows
   `Successfully logged in.`

Verify:

```bash
npx wrangler whoami
```

Expected output includes:
- Your email
- The account name(s) you have access to
- Account ID(s)

**Multiple Cloudflare accounts?** Wrangler picks the first account by
default. If `launcharoo.online` lives in a different one, you'll need to
add `"account_id": "<the-right-one>"` to `worker/wrangler.jsonc` before
deploying (get the ID from `wrangler whoami` output).

---

## Step 2 — add the wildcard DNS record

The Worker only fires on requests to hostnames that Cloudflare actually
knows about. So we need to tell Cloudflare "any subdomain of
launcharoo.online should be handled by our infrastructure".

In the Cloudflare dashboard:

1. Click **Websites** in the left nav → select `launcharoo.online`.
2. Left nav → **DNS** → **Records**.
3. Click **Add record**.

Fill in:

| Field | Value | Why |
|---|---|---|
| **Type** | `AAAA` | IPv6 record. We use AAAA because the placeholder we set is an IPv6 discard address (see below). |
| **Name** | `*` | Wildcard — matches every subdomain. |
| **IPv6 address** | `100::` | Placeholder. See explanation below. |
| **Proxy status** | **Proxied** (orange cloud toggle ON) | Critical. Only proxied records go through the Worker. If this is a grey cloud, the Worker will never fire. |
| **TTL** | Auto | Cloudflare-managed. Leave as default. |

Click **Save**.

**Why `100::`?** DNS records need *some* address. `100::` is the IPv6
"discard prefix" — RFC 6666 formalises it as an address that must never
receive real traffic. It's a common convention when the record only exists
to satisfy Cloudflare's proxy layer and the actual routing happens at the
Worker. You will never see a request reach this address; Cloudflare's
proxy intercepts everything before then.

Verify the record works:

```bash
dig +short test123.launcharoo.online
```

Expected: two or three IPv4 addresses (Cloudflare's edge IPs like
`104.21.x.x`, `172.67.x.x`). That confirms Cloudflare is answering for
the wildcard — the Worker still needs to be deployed for it to do
anything useful.

---

## Step 3 — check `wrangler.jsonc` before deploying

Open `worker/wrangler.jsonc` and sanity-check:

```jsonc
{
  "name": "launcharoo-router",
  "main": "src/index.ts",
  "compatibility_date": "2026-06-15",
  "compatibility_flags": ["nodejs_compat"],
  "vars": {
    "VERCEL_ORIGIN": "https://preview-factory.vercel.app",
    "SITE_DOMAIN": "launcharoo.online"
  },
  "routes": [
    { "pattern": "*.launcharoo.online/*", "zone_name": "launcharoo.online" }
  ]
}
```

If your Vercel URL ever changes (e.g. you attach a custom production
domain to the Vercel project), update `VERCEL_ORIGIN` here.

---

## Step 4 — deploy

```bash
npm run deploy
```

What you'll see (roughly):

```
 ⛅️ wrangler 4.x.x
-------------------
Total Upload: 4.5 KiB / gzip: 1.8 KiB
Uploaded launcharoo-router (X.XX sec)
Deployed launcharoo-router triggers (X.XX sec)
  https://launcharoo-router.<your-subdomain>.workers.dev
  *.launcharoo.online/* (zone: launcharoo.online)
Current Version ID: <uuid>
```

Two important lines:

1. `https://launcharoo-router.<your-subdomain>.workers.dev` — a
   Cloudflare-provided direct URL for the Worker. Handy for debugging
   in isolation, but not what customers will hit.
2. `*.launcharoo.online/* (zone: launcharoo.online)` — this is the
   important one. Confirms the route pattern is bound.

If deploy fails with **"You need to specify an account for this
operation."**, run `wrangler whoami`, copy the correct account ID, add
`"account_id": "<id>"` to `wrangler.jsonc`, and retry.

If it fails with **"Zone `launcharoo.online` not found"**, the zone
isn't attached to the account wrangler is using — either you're in the
wrong Cloudflare account or the zone isn't active yet.

---

## Step 5 — smoke test

Pick a real slug from Supabase to test with. In the Supabase SQL editor:

```sql
select slug, name from public.tenants
 where slug is not null
 order by created_at desc
 limit 5;
```

Copy any slug from the results. In the examples below I'll use
`example-plumbing` — replace that with your real one.

### 5a. Confirm DNS + Worker are both live

```bash
curl -I https://example-plumbing.launcharoo.online/
```

Expected first line: `HTTP/2 200`.

Look for these headers in the response:
- `server: cloudflare` — request went through Cloudflare
- `x-vercel-cache: HIT` or `MISS` — upstream is Vercel, so the Worker
  proxy is working

If you get **`HTTP/2 522`** (connection timed out), the DNS record is
wrong or not proxied — go back to Step 2.

If you get **`HTTP/2 404`** with a Cloudflare error page, the Worker
route didn't match — check `wrangler.jsonc` route pattern.

If you get **`HTTP/2 502`** with body "Upstream lookup failed", the
Worker deployed but can't reach Vercel — check `VERCEL_ORIGIN` in
`wrangler.jsonc` and that the current Vercel deploy has
`/api/tenant/by-slug/[slug]`.

### 5b. Open in a browser

Visit `https://example-plumbing.launcharoo.online/`.

You should see the tenant's home page rendered. If the page looks broken
(no CSS, no images), open browser DevTools → Network tab and check
whether requests to `/_next/*` are 404-ing. If they are, the passthrough
logic in `src/index.ts` isn't catching them — file a bug and post the
failing request URL.

### 5c. Click an internal link

On the rendered page, click a service or location link. The URL in the
address bar should stay:

```
https://example-plumbing.launcharoo.online/services/plumbing
```

**Not:**

```
https://example-plumbing.launcharoo.online/preview/site/abc-123/services/plumbing
```

If you see the ugly `/preview/site/...` prefix, the site render page
isn't reading `X-Forwarded-Host` correctly. Check that Phase 10a-iii's
changes to `app/preview/site/[tenantId]/[[...slug]]/page.tsx` shipped —
specifically the `effectiveBasePath` helper.

### 5d. Try an unknown slug

```bash
curl -I https://this-slug-doesnt-exist.launcharoo.online/
```

Expected: `HTTP/2 404` with `content-type: text/html`. Open in a browser
— you should see the branded "Site not found" page. The URL stays on
launcharoo.online — no leak to `preview-factory.vercel.app`.

### 5e. Try an expired tenant

Take a tenant with `status='expired'`, hit its slug in a browser. Expected:
the `/expired` page renders **under `<slug>.launcharoo.online/`** (URL
does not change to `preview-factory.vercel.app`). The Worker proxies the
expired page from Vercel rather than redirecting.

### 5f. Apex + reserved subdomains

```bash
curl -I https://launcharoo.online/
curl -I https://www.launcharoo.online/
curl -I https://api.launcharoo.online/
```

- Apex + www → `HTTP/2 200` branded landing placeholder
- Reserved names (`api`, `admin`, `dashboard`, etc.) → `HTTP/2 404`
  branded "not found"

All under launcharoo.online, no origin leak.

---

## Watching live traffic

While the Worker is running:

```bash
cd worker
npm run tail
```

Streams every invocation to your terminal — you'll see the request URL,
extracted slug, and any `console.error` output. Useful when a specific
customer reports a broken URL.

Press Ctrl-C to stop tailing (doesn't affect the deployed Worker).

You can also see logs in the Cloudflare dashboard:
**Workers & Pages** → `launcharoo-router` → **Logs**.

---

## Rolling back

If a deploy goes wrong:

```bash
cd worker
npx wrangler versions list
```

Copy the version ID of the last known-good version, then:

```bash
npx wrangler rollback <VERSION_ID>
```

Rollback is instant — Cloudflare swaps the running code atomically.

You can also rollback via the dashboard: **Workers & Pages** →
`launcharoo-router` → **Deployments** → click **Rollback** on the target
version.

---

## Redeploying after code changes

Whenever you change `worker/src/index.ts` or `wrangler.jsonc`:

```bash
cd worker
npm run deploy
```

That's it. Cloudflare rolls the new version out across all edge locations
in a few seconds. No downtime.

---

## Environment variables

`VERCEL_ORIGIN` and `SITE_DOMAIN` are in `wrangler.jsonc` under `vars`.
They're public (baked into the deployed script), which is fine — they
aren't secrets.

If we ever need a real secret (API token, signing key), use:

```bash
npx wrangler secret put SOME_SECRET_NAME
```

Wrangler prompts for the value securely. Secrets are stored encrypted
and injected as `env.SOME_SECRET_NAME` in the Worker.

---

## What this runbook does NOT cover

- **BYO customer domains** (`johnsplumbing.com.au`) — that's Phase 10b,
  which needs Cloudflare SSL-for-SaaS. Separate deploy.
- **Setting up the apex `launcharoo.online`** — the Worker redirects apex
  hits to the marketing site. That's fine for MVP. If you later want a
  branded marketing page at the apex, add `launcharoo.online` as a Vercel
  custom domain and set a CNAME on Cloudflare.
- **Rate limiting** — Cloudflare has dashboard-based rate-limit rules
  under **Security → WAF → Rate limiting**. Add if abuse becomes an
  issue.
- **KV caching of slug lookups** — we rely on Cloudflare's HTTP cache
  from the upstream Cache-Control header. If lookup traffic becomes
  significant, we can add a KV binding to memoize the slug→tenantId
  mapping.

---

## Cost check

- **Cloudflare Workers Free tier**: 100,000 requests/day, 10ms CPU per
  invocation. Way past what a launch-phase or first-year customer base
  needs.
- **No KV cost** — we use the HTTP cache instead.
- **No Vercel plan change** — Vercel still serves under its own
  `preview-factory.vercel.app` hostname; the Worker is what makes it
  appear branded.

If we ever exceed the free tier, the Workers Paid plan is $5/mo for
10M requests/day. Same code, no changes needed.

---

## Troubleshooting cheat sheet

| Symptom | Likely cause | Fix |
|---|---|---|
| `curl` gets `522` timeout | DNS record not proxied (grey cloud) | Step 2, toggle to orange cloud |
| `curl` gets `404 Cloudflare` | Worker route not bound | Redeploy; check `wrangler.jsonc` `routes` |
| `curl` gets `502 Upstream lookup failed` | Vercel unreachable or endpoint missing | Verify `VERCEL_ORIGIN`, push Vercel |
| Page renders but assets 404 | Passthrough logic broken | Check `worker/src/index.ts` PASSTHROUGH_* |
| Internal links show `/preview/site/...` | `X-Forwarded-Host` not read | Verify `effectiveBasePath` in site page |
| `wrangler deploy` says "no account" | Multiple accounts / wrong login | Add `account_id` to `wrangler.jsonc` |
| `wrangler deploy` says "zone not found" | Zone not on the wrangler-logged-in account | Switch account or move zone |
| DNS `dig` returns nothing | Wildcard record not saved | Recheck Step 2, name field must be `*` |
