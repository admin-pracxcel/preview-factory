-- Timestamp of the "your preview is ready" SMS.
-- Nullable — set when the ClickSend send succeeds. Used as an idempotency
-- guard so a duplicate n8n webhook call doesn't double-SMS the customer.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS preview_notified_at TIMESTAMPTZ;
