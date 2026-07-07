# Stripe setup (Phase 7.5a)

Wiring the sandbox Stripe account to the deployed app so a real Checkout flow
runs end-to-end: intake → preview → "Save my site" → Stripe test card → welcome
page → dashboard.

Time: 15–25 minutes.

## 1. Product + price (test mode)

Stripe → **test mode toggle on** → Products → Add product.

- Name: `Preview Factory subscription` (customer sees the product name on the
  checkout page; you can change it later — the app currently uses a dynamic
  price and passes the business name into the checkout, so this only matters
  if you set `STRIPE_PRICE_ID`).
- Pricing: recurring, monthly, **AUD $49.00**.
- Billing period: monthly.
- Save.

Optional: copy the price ID (`price_...`) if you want the app to reference a
fixed price instead of building one on the fly. If you skip this, the app
generates the price per session using the values in `lib/stripe-client.ts`
(currently $49 AUD/mo).

## 2. API keys

Stripe → Developers → API keys (still in test mode).

- **Secret key** (`sk_test_...`) → this goes in Vercel as `STRIPE_SECRET_KEY`.
- Publishable key isn't needed — the app uses hosted Checkout, not Elements.

## 3. Webhook endpoint (production)

Stripe → Developers → Webhooks → Add endpoint.

- Endpoint URL: `https://preview-factory.vercel.app/api/webhooks/stripe`
- Events to send:
  - `checkout.session.completed` (Phase 7.5a — payment landed)
  - `customer.subscription.updated` (Phase 8a — status transitions)
  - `customer.subscription.deleted` (Phase 8a — final cancel)
  - `invoice.payment_failed` (Phase 8a — dunning past_due)
- Save. Reveal the **signing secret** (`whsec_...`) → Vercel env as
  `STRIPE_WEBHOOK_SECRET`.

## 4. Vercel env vars

Project → Settings → Environment Variables — set for **Production**:

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` from step 2 |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from step 3 |
| `STRIPE_PRICE_ID` | `price_...` from step 1 (optional; leave blank for dynamic pricing) |

Redeploy so the app picks them up.

## 5. Local testing with Stripe CLI (optional but recommended)

Before hitting prod, verify against your local dev server:

```
brew install stripe/stripe-cli/stripe   # macOS
stripe login                            # opens browser
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

The CLI prints a webhook signing secret starting with `whsec_...`. Set it in
`.env.local` as `STRIPE_WEBHOOK_SECRET` and restart `npm run dev`.

In another tab, trigger a test event:

```
stripe trigger checkout.session.completed
```

This won't hit your app's checkout flow (no tenantId in metadata), but it
confirms the signature verification works and the handler responds 200.

## 6. End-to-end smoke test

On `https://preview-factory.vercel.app`:

1. Submit intake, wait for preview.
2. Click **Save my site** on the preview.
3. Stripe hosted Checkout page opens. Fill in the test card
   `4242 4242 4242 4242`, any future expiry, any 3-digit CVC, any postcode,
   and your real email.
4. Submit. You should redirect to `/welcome/<tenantId>`.
5. In Supabase → Table Editor → `tenants` row: verify
   - `status` = `claimed`
   - `owner_email` = the email you used
   - `billing_customer_id` = `cus_...`
   - `billing_subscription_id` = `sub_...`
   - `claimed_at` = recent timestamp
6. In Supabase → `processed_events`: one new row with `event_id = evt_...`,
   `provider = stripe`.
7. Trigger the webhook again from Stripe dashboard (test event) — logs should
   say "duplicate delivery — skipping" and NO second row appears in
   `processed_events`.
8. Open `/dashboard/<tenantId>` — should render, showing the owner's email
   and a working Billing Portal button (assuming Stripe Customer Portal is
   enabled — Stripe → Settings → Billing → Customer Portal → Activate).

If any step fails, capture the tenantId + timestamp and check Vercel function
logs for `[webhook]` lines.

## What Phase 7.5a does NOT cover

- Subscription lifecycle events (past_due, cancelled, renewals) — those come
  in Phase 8 with the reaper.
- Customer support flows (refunds, disputes) — Stripe dashboard for now.
- Magic-link auth — that's Phase 7.5b.

Going to production (live keys) is a separate step at the end of the launch
checklist. Keep test mode until you've smoke-tested everything else.
