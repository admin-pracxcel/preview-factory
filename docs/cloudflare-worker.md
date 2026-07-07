# Cloudflare Worker deploy (Phase 10a-iii)

Routes `<slug>.launcharoo.online/*` at Cloudflare's edge, proxies to
`preview-factory.vercel.app/preview/site/<tenantId>/*`. Wildcard SSL on
Cloudflare, no Vercel plan change required.

Time: 15 minutes for a fresh setup.

## 0. Prerequisites

- `launcharoo.online` is on Cloudflare (nameservers pointed, zone active).
- A DNS record for `*.launcharoo.online` exists (see step 2 below).
- Node 18+ locally for `wrangler`.
- Cloudflare account with Workers enabled (free tier fine).

## 1. Install wrangler locally

```bash
cd worker
npm install
npx wrangler login
```

`login` opens a browser and issues a token tied to your Cloudflare account.

## 2. DNS: wildcard A record

Cloudflare dashboard → `launcharoo.online` → DNS → Records → **Add record**.

| Field | Value |
|---|---|
| Type | AAAA (or A) |
| Name | `*` |
| IPv4 / IPv6 address | `100::` (any placeholder — the Worker route intercepts) |
| Proxy status | **Proxied** (orange cloud) |
| TTL | Auto |

The `100::` address is a discard address per RFC 6666 — it never receives
traffic, but Cloudflare needs *something* to satisfy the record. Because
the record is proxied, the Worker route rule fires and the origin address
is never contacted.

Also add (or verify) the apex + www records if you want the marketing
landing to answer on `launcharoo.online` and `www.launcharoo.online`:

- `launcharoo.online` → CNAME → `cname.vercel-dns.com` (Proxied off / DNS
  only). You'd also add the apex to your Vercel project's Domains list.
  For MVP, you can skip this — the Worker redirects apex/www hits to
  `https://preview-factory.vercel.app/`.

## 3. Deploy the Worker

```bash
cd worker
npm run deploy
```

`wrangler deploy` reads `wrangler.jsonc`, uploads `src/index.ts`, and
attaches the route pattern `*.launcharoo.online/*` on the `launcharoo.online`
zone.

Expected output includes:
- `Uploaded launcharoo-router (...)`
- `Deployed launcharoo-router triggers (...)`
- `*.launcharoo.online/* (zone: launcharoo.online)`

## 4. Smoke test

Pick any existing tenant slug from Supabase (`select slug from tenants
where slug is not null limit 5;`).

```bash
curl -I https://<slug>.launcharoo.online/
```

Expected: `HTTP/2 200` and Vercel headers (`x-vercel-cache`, `server: Vercel`).

Then in a browser:
- `https://<slug>.launcharoo.online/` — should render the tenant's home page.
- Click an internal link — the URL should stay
  `https://<slug>.launcharoo.online/services/plumbing`, not
  `.../preview/site/<tenantId>/services/plumbing`.
- Static assets under `/_next/*` should load without 404s.

## 5. Watching logs

```bash
cd worker
npm run tail
```

Streams live invocations. Each request logs the incoming host, extracted
slug, and the upstream URL. Useful when something 502s.

## 6. Rolling back

```bash
cd worker
npx wrangler versions list
npx wrangler rollback <VERSION_ID>
```

Rollback is instant.

## What this does NOT cover

- **BYO customer domains** (customer's own `johnsplumbing.com.au`) — that's
  Phase 10b via Cloudflare SSL-for-SaaS.
- **Rate-limiting** at the Worker level — Cloudflare's built-in rate-limit
  rules can be added in the Cloudflare dashboard if abuse becomes an issue.
- **A/B routing or canary Workers** — single production route.
- **Setting apex / www** — see step 2 note. Redirect via Worker is fine
  for MVP; a Vercel-attached apex is nicer for SEO but adds a domain to
  the Hobby quota.

## Cost check

- Cloudflare Workers Free: 100,000 requests/day, 10ms CPU per invocation.
  Ample for pre-launch and first year.
- No KV cost — we rely on Cloudflare's HTTP cache from the upstream
  Cache-Control header (5-minute TTL on `/api/tenant/by-slug/<slug>`).
- No Vercel plan change.
