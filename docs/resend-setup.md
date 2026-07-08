# Resend setup (Phase 7.5b)

Magic-link login for returning owners. Sends the sign-in email that closes the
"I closed the tab, how do I get back in?" gap.

Time: 10 minutes for dev, +15 for a verified domain in prod.

## 1. Sign up + API key

Resend → https://resend.com → sign in with GitHub or email.

Developers → **API Keys** → **Create API Key**.

- Name: `preview-factory-prod` (or `-dev`)
- Permission: **Full access** (Sending access is enough for now, but Full lets
  you inspect logs from the same key).
- Copy the `re_...` key.

## 2. Sender address

**Dev / smoke test (fastest):** use `onboarding@resend.dev` as the `from`
address. This works with zero domain setup, BUT it can only send to your own
Resend account email (`admin@pracxcel.com.au`). Fine for verifying the
end-to-end flow, not fine for real customers.

**Production:** verify `launcharoo.online` as a sending domain. Full walkthrough
in **Section 6** below.

## 3. Vercel env vars

Project → Settings → Environment Variables — **Production**:

| Name | Value |
|---|---|
| `RESEND_API_KEY` | `re_...` from step 1 |
| `RESEND_FROM_EMAIL` | Dev: `onboarding@resend.dev` — Prod: `Launcharoo <hello@launcharoo.online>` |

Redeploy so the app picks them up.

> Note: the sender can be either a bare address (`hello@launcharoo.online`) or
> RFC-style with a display name (`Launcharoo <hello@launcharoo.online>`). The
> latter is what recipients see in their inbox.

## 4. Local testing (optional)

Add the same two vars to `.env.local`, restart `npm run dev`. If you don't
set `RESEND_API_KEY` at all, the app runs in **log-only mode** — sign-in
links are written to the server console instead of emailed, so you can still
click through them in dev.

## 5. End-to-end smoke test

Only works in dev with the Resend dev address if you send TO your own
Resend-account email. For prod-domain sending, any address works.

1. Complete a Stripe checkout (Phase 7.5a) so a tenant has an `owner_email`.
2. Log out (or open an incognito window).
3. Visit `https://preview-factory.vercel.app/login`.
4. Enter the same email you used at checkout. Submit.
5. Check inbox — a "Your Preview Factory login link" email arrives within
   seconds. If not, check Resend → Logs.
6. Click the link. Should land at `/dashboard/<tenantId>` signed in.
7. Try the same link again — should redirect to `/login?error=...already been used`.
8. Try requesting a second link within 60 seconds — the request returns 200
   but no second email arrives (rate limit).
9. Wait 60s, request again — new email arrives.

If any step fails, check:
- **Vercel function logs** for `[auth:request-link]` or `[auth:verify]` lines
- **Resend → Logs** for send failures (bounced, rejected, quota)
- **Supabase → magic_tokens table** — a row should exist per request with
  `used_at` filled in after verification

## What Phase 7.5b does NOT cover

- Password fallback / passkeys — magic-link only.
- SSO (Google, Microsoft) — out of scope.
- Multi-tenant chooser: if the same email owns multiple sites, we redirect to
  the most recently claimed one and rewire all of them to the new session.
  Good enough for launch.
- Email templating (React Email, etc.) — plain HTML string for now.

## 6. Production: verify `launcharoo.online` in Resend

This is the Phase 11a hardening step. Until you finish this section, magic-link
sign-in only works for `admin@pracxcel.com.au` — every other customer will hit
the log-only fallback (Resend rejects sends to unverified recipients on the
`resend.dev` sender).

Time: about 20 minutes of clicking + up to 30 minutes waiting for DNS.

Choice recap: we're using the **apex** `launcharoo.online` (not a subdomain),
sending as `Launcharoo <hello@launcharoo.online>`, with **no reply-to header**.
Replies would land at `hello@launcharoo.online` which nobody reads — that's
fine because magic-link emails aren't the kind users reply to.

### 6a. Add the domain in Resend

1. Resend dashboard → **Domains** → **Add domain**.
2. Domain: `launcharoo.online`.
3. Region: pick the closest — for AU, `us-east-1` or `eu-west-1` are the only
   Resend regions today; either is fine.
4. Click **Add**.

Resend now shows a table of DNS records you need to add. There are typically
three groups:

| Purpose | Type | Name (host) | Value (rdata) |
|---|---|---|---|
| Return-Path (bounce handling) | `MX` | `send.launcharoo.online` | `feedback-smtp.<region>.amazonses.com` (priority 10) |
| SPF | `TXT` | `send.launcharoo.online` | `v=spf1 include:amazonses.com ~all` |
| DKIM | `TXT` | `resend._domainkey.launcharoo.online` | `p=MIGfMA0GCSqGSIb3DQEBAQ...` (long key) |
| DMARC (optional but recommended) | `TXT` | `_dmarc.launcharoo.online` | `v=DMARC1; p=none;` |

**Copy the exact values Resend shows you.** The DKIM key changes per Resend
account — do NOT copy the placeholder above.

### 6b. Add those records in Cloudflare

`launcharoo.online` is Cloudflare-managed (Phase 10a). Cloudflare → your
account → Websites → `launcharoo.online` → **DNS** → **Records**.

For each row Resend shows you, click **Add record**:

- **Type**: match Resend (`MX` or `TXT`)
- **Name**: paste the "Name" column from Resend. Cloudflare will strip the
  `.launcharoo.online` suffix automatically — just paste and it'll show the
  short form (e.g. `send`, `resend._domainkey`, `_dmarc`).
- **Content**: paste the "Value" column from Resend. For MX include the
  priority (usually 10).
- **Proxy status**: **DNS only** for all of these (grey cloud). Never proxy
  mail records — Cloudflare's proxy only handles HTTP.
- **TTL**: Auto is fine.

Save each one.

Watch out for:
- **Existing `send.launcharoo.online` MX record**: if you already added anything
  under the `send` subdomain, Resend will fail to verify. Delete conflicts.
- **Existing SPF record on apex**: if you ever added `v=spf1 ...` at
  `launcharoo.online` itself (unlikely — we haven't), you cannot have two SPF
  TXT records at the same name. Merge them into one.
- **DKIM key wrapping**: Cloudflare's TXT field will accept the whole long
  string. Do not split it with quotes.

### 6c. Verify

Back in Resend → your domain → click **Verify DNS records**. Each row flips to
green as Cloudflare propagates. Usually done in 1-5 minutes. If a row stays
red after 30 min:

```bash
dig +short TXT resend._domainkey.launcharoo.online @1.1.1.1
dig +short MX  send.launcharoo.online              @1.1.1.1
dig +short TXT send.launcharoo.online              @1.1.1.1
```

These should return exactly what Resend gave you. If empty, the Cloudflare
record hasn't propagated (rare past 15 min) — refresh, wait, or check for typos.

### 6d. Flip the Vercel env var

Vercel → Project → Settings → Environment Variables → **Production**:

- `RESEND_FROM_EMAIL` = `Launcharoo <hello@launcharoo.online>`

**Redeploy** so the running app picks it up (Deployments → last deploy → menu
→ **Redeploy**, or push any commit).

### 6e. Real-inbox smoke test

You now must test with an email address that is NOT `admin@pracxcel.com.au`,
because that one worked on the `resend.dev` sender anyway. Use a Gmail address
you own.

1. Buy a fresh Sandbox subscription with that Gmail address (or manually
   `update tenants set owner_email='...' where id='<test-tenant>'` in Supabase).
2. Log out (incognito).
3. Visit `https://launcharoo.online/login`.
4. Enter the Gmail address. Submit.
5. Inbox should show a **"Your Launcharoo sign-in link"** email from
   `Launcharoo <hello@launcharoo.online>` within 30 seconds.
6. **Check the spam folder if it's not in the inbox.** First-time sends from a
   fresh domain can be flagged. If it lands in spam:
   - Verify DMARC is present (Section 6a table).
   - Ask Gmail to "Not spam".
   - Warm the domain by sending a few emails per day for the first week.
7. Click the link → dashboard.
8. Repeat with a Yahoo or Outlook address to check delivery across providers.

### 6f. Failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Resend "Domain not verified" after 30 min | DNS records missing/typo | Re-check `dig` output matches exactly. Watch for extra quotes. |
| Email sends fine but lands in spam | DMARC missing, or fresh domain | Add DMARC, or wait 24-48h for reputation to warm |
| Vercel logs show `Resend send failed: 403 domain not verified` | Env var still points at old sender | Confirm Vercel env var was updated in **Production** scope, then Redeploy |
| Vercel logs show `[resend-client] RESEND_API_KEY not set — log-only mode` | Env var missing | Add `RESEND_API_KEY` to Vercel Production, redeploy |
| Some recipients get it, others don't | Provider-specific spam filter | Check Resend → Logs → click the delivery → look at bounce/complaint reason |

### 6g. What you get after this

- Any owner email address on the internet can receive a magic link.
- Sender identity is on your brand (`launcharoo.online`), not Resend's.
- DKIM signs each message, SPF authorises the source IPs, DMARC tells receivers
  what to do with unauthorised mail — the three pieces email providers expect.
- Reputation belongs to `launcharoo.online`. Do not send bulk marketing from
  the same domain until you've built a track record — it can burn transactional
  deliverability.
