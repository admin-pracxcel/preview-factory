-- 2026-07-17 — tenants.plan_key
--
-- Records which paid plan the tenant subscribed to (starter/growth/pro ×
-- monthly/annual). Written by the Stripe webhook on
-- checkout.session.completed. Read by the quota-check on edit-request
-- submission and by the dashboard billing card.
--
-- Nullable — a tenant may be pre-claim (no plan yet) or on a legacy $49
-- one-price flow. Idempotent + safe to re-run.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan_key TEXT;

CREATE INDEX IF NOT EXISTS tenants_plan_key_idx
  ON tenants (plan_key)
  WHERE plan_key IS NOT NULL;
