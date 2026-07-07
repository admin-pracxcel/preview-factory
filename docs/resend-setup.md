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
Resend account email (`admin@pracxcel.com.au`). That's fine for verifying the
end-to-end flow.

**Production:** verify a domain.

- Resend → Domains → **Add domain** → enter your domain (e.g. `pracxcel.com.au`).
- Resend gives you 3 DNS records to add (usually SPF, DKIM, DMARC). If your
  DNS is at Cloudflare/GoDaddy/etc., paste them into the DNS panel.
- Wait for Resend to verify (usually 5-30 min).
- Once verified, use `hello@pracxcel.com.au` (or any address on that domain)
  as the sender.

## 3. Vercel env vars

Project → Settings → Environment Variables — **Production**:

| Name | Value |
|---|---|
| `RESEND_API_KEY` | `re_...` from step 1 |
| `RESEND_FROM_EMAIL` | Dev: `onboarding@resend.dev` — Prod: your verified sender |

Redeploy so the app picks them up.

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

## Going to production

1. Verify a real domain in Resend (step 2 "Production").
2. Set `RESEND_FROM_EMAIL` to that verified sender.
3. Redeploy.
4. Send a test to a real customer address to confirm inbox delivery, not spam.
