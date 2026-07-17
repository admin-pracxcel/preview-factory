-- 2026-07-17 — tenants.phone
--
-- Adds a nullable phone column to tenants so the intake confirm step can
-- persist the owner's mobile at generation-start time (rather than the old
-- mid-animation capture that never went anywhere).
--
-- Nullable + idempotent. Safe to re-run.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS tenants_phone_idx
  ON tenants (phone)
  WHERE phone IS NOT NULL;
