# Addons (upsell) — Stripe setup

Your one-time human setup for the SEO / Google Ads / Social Ads upsells.
Everything below happens in the Stripe Dashboard + Vercel env vars + Supabase.
Nothing here is code — code (Phase 2 onwards) reads these Price IDs from env
vars.

Total: **3 Products, 10 Prices, 10 env vars, 1 migration.** ~20 minutes.

## Step 1 — Run the Supabase migration

Open **Supabase → SQL Editor**, paste and run:

```sql
-- addons: subscriptions + funnel idempotency
CREATE TABLE IF NOT EXISTS tenant_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  addon_key TEXT NOT NULL,
  plan_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  stripe_subscription_id TEXT,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  onboarding_data JSONB,
  campaigns_live_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_addons_tenant_id
  ON tenant_addons(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_addons_stripe_sub
  ON tenant_addons(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_addons_one_active_per_addon
  ON tenant_addons(tenant_id, addon_key)
  WHERE status = 'active';

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS funnel_shown_at TIMESTAMPTZ;
```

(Also lives in `strategy/_master/migrations/2026-07-21-tenant-addons.sql`.)

## Step 2 — Create the three Products in Stripe

Open **Stripe Dashboard → Products → + Add product**. Repeat 3 times.

| Product name              | Description shown on invoices                    |
| ------------------------- | ------------------------------------------------- |
| `Launcharoo SEO`          | Local citations, blog posts, and GBP posts.       |
| `Launcharoo Google Ads`   | Google Ads campaign management. Ad spend billed directly to your Google Ads account. |
| `Launcharoo Social Ads`   | Meta Ads (Facebook and Instagram) campaign management. Ad spend billed directly to your Meta Business account. |

For each Product, leave "One time" **unchecked** and set the type to
**Recurring**. Currency = **AUD**. Tax behaviour = **exclusive** (matches
the "ex-GST" pricing you're advertising).

## Step 3 — Add Prices to each Product

For each Product, click **Add another price** until you have all of these.
Every Price is Recurring, AUD, exclusive-of-tax.

### SEO — 6 prices

| Nickname                | Amount    | Interval | Copy this Price ID into env var                    |
| ----------------------- | --------- | -------- | -------------------------------------------------- |
| SEO Starter monthly     | $29.00    | Monthly  | `STRIPE_PRICE_ADDON_SEO_STARTER_MONTHLY`           |
| SEO Starter annual      | $299.00   | Yearly   | `STRIPE_PRICE_ADDON_SEO_STARTER_ANNUAL`            |
| SEO Growth monthly      | $59.00    | Monthly  | `STRIPE_PRICE_ADDON_SEO_GROWTH_MONTHLY`            |
| SEO Growth annual       | $599.00   | Yearly   | `STRIPE_PRICE_ADDON_SEO_GROWTH_ANNUAL`             |
| SEO Pro monthly         | $79.00    | Monthly  | `STRIPE_PRICE_ADDON_SEO_PRO_MONTHLY`               |
| SEO Pro annual          | $799.00   | Yearly   | `STRIPE_PRICE_ADDON_SEO_PRO_ANNUAL`                |

### Google Ads — 2 prices

| Nickname                | Amount    | Interval | Copy this Price ID into env var                    |
| ----------------------- | --------- | -------- | -------------------------------------------------- |
| Google Ads monthly      | $150.00   | Monthly  | `STRIPE_PRICE_ADDON_GOOGLE_ADS_MONTHLY`            |
| Google Ads annual       | $1500.00  | Yearly   | `STRIPE_PRICE_ADDON_GOOGLE_ADS_ANNUAL`             |

### Social Ads — 2 prices

| Nickname                | Amount    | Interval | Copy this Price ID into env var                    |
| ----------------------- | --------- | -------- | -------------------------------------------------- |
| Social Ads monthly      | $150.00   | Monthly  | `STRIPE_PRICE_ADDON_SOCIAL_ADS_MONTHLY`            |
| Social Ads annual       | $1500.00  | Yearly   | `STRIPE_PRICE_ADDON_SOCIAL_ADS_ANNUAL`             |

**Every Price ID starts with `price_...`.** Copy the ID from the Prices
list on each Product page. Don't paste the `prod_...` ID — that's the
Product, not the Price.

## Step 4 — Paste the 10 env vars into Vercel

Project → **Settings → Environment Variables**. Add each of the 10 keys
above with the corresponding `price_...` value. Enable for **Production +
Preview + Development**.

When you're done, this list should be complete:

```
STRIPE_PRICE_ADDON_SEO_STARTER_MONTHLY
STRIPE_PRICE_ADDON_SEO_STARTER_ANNUAL
STRIPE_PRICE_ADDON_SEO_GROWTH_MONTHLY
STRIPE_PRICE_ADDON_SEO_GROWTH_ANNUAL
STRIPE_PRICE_ADDON_SEO_PRO_MONTHLY
STRIPE_PRICE_ADDON_SEO_PRO_ANNUAL
STRIPE_PRICE_ADDON_GOOGLE_ADS_MONTHLY
STRIPE_PRICE_ADDON_GOOGLE_ADS_ANNUAL
STRIPE_PRICE_ADDON_SOCIAL_ADS_MONTHLY
STRIPE_PRICE_ADDON_SOCIAL_ADS_ANNUAL
```

Trigger a redeploy after adding, so the values are available in the
Serverless Function environment.

## Step 5 — Confirm the webhook covers addon events

Your existing webhook endpoint (`/api/webhooks/stripe`) will pick up the
new events automatically because we listen to
`checkout.session.completed`, `customer.subscription.updated`, and
`customer.subscription.deleted` at the account level. **No new webhook
signing secret needed** — same `STRIPE_WEBHOOK_SECRET` you already have.

Phase 2 will extend the webhook handler to route events whose
`metadata.addonKey` is set to the `tenant_addons` table instead of the
main `tenants` row.

## What Phase 2 will add on top of this

Once you've done the above:

- `POST /api/checkout/addon` — creates a Checkout Session for an addon,
  reuses the tenant's existing Stripe Customer if we have one.
- Webhook routing for `metadata.addonKey` → write `tenant_addons` row.
- Admin email on Ads-addon subscribe so you know to onboard.

## Notes worth reading

- **Tax behaviour is exclusive** — Stripe adds GST at checkout time based
  on the customer's address. Advertised prices stay ex-GST as promised.
- **Annual discount range** — SEO Starter is 14% off, SEO Growth 15%, SEO
  Pro 16%, Ads 17%. That's why the picker chip says "Save 15–17%".
- **Ad spend is not billed through us.** Google Ads / Social Ads addons
  are strictly the management fee. Customers add their own card to their
  own Google/Meta account. This is spelled out in the addon copy and
  will be reinforced in the post-checkout onboarding page (Phase 4).
- **Product IDs vs Price IDs** — a Product can have many Prices. Env vars
  point at the specific Price. Never paste `prod_...`.
