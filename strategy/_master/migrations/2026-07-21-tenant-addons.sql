-- Addons (upsell) — Phase 1 data model.
--
-- One row per addon subscription. The partial unique index on
-- (tenant_id, addon_key) WHERE status='active' means each tenant can have at
-- most ONE active subscription per addon at a time. Cancel + resubscribe
-- creates a new row (the old one lives on with status='cancelled' as an
-- audit trail).
--
-- onboarding_data JSONB holds addon-specific setup values captured post-
-- checkout. For Google Ads, e.g. { "customer_id": "123-456-7890",
-- "manager_access_granted_at": "..." }. Kept schemaless so we don't need
-- another migration every time we ask for one more field.

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

-- Idempotency guard for the post-domain-connect walkthrough. The funnel
-- fires exactly once per tenant: when funnel_shown_at is NULL AND
-- custom_domain_verified_at IS NOT NULL. On mount we set funnel_shown_at
-- so it never opens automatically again.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS funnel_shown_at TIMESTAMPTZ;
