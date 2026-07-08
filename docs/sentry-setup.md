# Sentry setup (Phase 11c)

Error monitoring for the Next.js app. When something throws in prod — an
API route, a cron sweep, a client-side render — Sentry captures the stack
and emails you before a customer notices.

Time: 15 minutes.

## 1. Sign up + create the project

1. Sign up at https://sentry.io (free tier — 5k errors + 10k performance
   events per month; more than enough for Preview Factory).
2. **Create Project** → pick platform: **Next.js**.
3. Project name: `preview-factory`.
4. Team: default is fine.
5. Sentry shows a wizard with a DSN and copy-paste snippets. Ignore the
   snippets — the code is already wired. **Copy the DSN.** Format:
   `https://<publicKey>@o<orgId>.ingest.sentry.io/<projectId>`

## 2. Create an auth token for source-map upload

Sentry → **User Settings** → **Auth Tokens** → **Create New Token**.

- Name: `preview-factory-vercel-build`
- Scope: **`project:releases`** (that's it — nothing broader)
- Expiry: no expiration (rotate manually if compromised)

Copy the token. Format: `sntrys_...`

## 3. Grab the org + project slugs

- **Org slug**: Sentry → top-left dropdown showing your org name → the URL
  shows `sentry.io/organizations/<org-slug>/`. Copy `<org-slug>`.
- **Project slug**: the project name you set (usually `preview-factory`).

## 4. Vercel env vars

Vercel → Project → Settings → Environment Variables — **Production**:

| Name | Value | Scope |
|---|---|---|
| `SENTRY_DSN` | DSN from step 1 | Production |
| `NEXT_PUBLIC_SENTRY_DSN` | same DSN | Production |
| `SENTRY_ORG` | org slug from step 3 | Production + Build |
| `SENTRY_PROJECT` | `preview-factory` | Production + Build |
| `SENTRY_AUTH_TOKEN` | token from step 2 | Production + Build (leave "sensitive" toggle on) |

Then **redeploy** so the build picks them up.

## 5. Email alert setup

By default Sentry emails you when a new issue appears in prod. Confirm and tune:

Sentry → **Alerts** → the default rule "Send a notification for new issues".

- Environment: **production** only (don't page yourself on dev/preview).
- Rate limit: **1 per 30 minutes** — stops a broken cron from burying your
  inbox in duplicate emails.
- Action: **Email to `admin@pracxcel.com.au`** — should already be set from
  your Sentry account email.

## 6. Smoke test

You're going to trigger a fake error in prod and confirm Sentry catches it.

1. After redeploy, hit this from your terminal:
   ```bash
   curl -X POST https://launcharoo.online/api/health/sentry-check
   ```
   … oh wait, we haven't wired a check endpoint. Instead:
2. In prod, trigger an obvious 500 by hitting an endpoint with malformed
   input, e.g. a POST to `/api/leads` with a body that references a
   non-existent tenant AND a body that will throw somewhere (or use the
   Sentry `Try it` from the wizard: they give you a `throw new Error('Sentry Test Error')`
   button in the onboarding UI).
3. Refresh Sentry → **Issues**. You should see the new error within 60s.
4. Check your inbox — the alert email should arrive within 5 min of the
   first occurrence (Sentry batches per rule).

## 7. What Sentry gets

- **Every unhandled exception** from API routes, server components,
  middleware, and the browser bundle.
- **Every cron failure** — reaper, cleanup, domain-reconcile. Tagged with
  `source=cron` and `cron=<name>` for easy filtering.
- **Release grouping** — errors get tagged with the git SHA, so you can
  see when a regression started.
- **Source-mapped stack traces** — the token uploads `.map` files at
  build time so Sentry shows the original TypeScript, not minified JS.
- **Session replay is OFF** — free-tier quota is small and replay is
  privacy-heavy. Turn on later if you want it.

## 8. What Sentry does NOT get

- **PII** — no email addresses, IPs, or request bodies (`sendDefaultPii: false`).
- **The Worker** — Cloudflare Workers use a separate Sentry SDK not
  wired in 11c. Add when Worker error volume warrants it.
- **Business events** — checkout completions, magic-link fails as a
  rate. Track via Vercel Logs / analytics; Sentry is for errors only.

## Turning it off

If you want to disable Sentry temporarily (say, during a noisy deploy):

- **Fast**: unset `SENTRY_DSN` in Vercel Production and redeploy. All
  Sentry code short-circuits when the DSN is missing (`enabled: Boolean(SENTRY_DSN)`).
- **Slow**: uninstall the SDK (`npm uninstall @sentry/nextjs`) and remove
  the config files. Only do this if you're switching tools.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No events in Sentry after deploy | `SENTRY_DSN` unset or wrong scope | Confirm Production scope, redeploy |
| "Not found" in stack traces, minified JS | Source-map upload failed | Check `SENTRY_AUTH_TOKEN` scope is `project:releases`, redeploy, look for build-log warnings |
| Duplicate events | Retries or React re-mount | Sentry deduplicates by fingerprint automatically. If not, check for `Sentry.captureException` in retry loops |
| Local dev flooding Sentry | `.env.local` picked up production DSN | Unset locally — leave `SENTRY_DSN` blank in dev |
