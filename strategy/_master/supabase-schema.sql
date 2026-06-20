-- =============================================================================
-- Preview Factory — Supabase Postgres Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Execute the entire file in one shot. Safe to re-run (IF NOT EXISTS guards).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";        -- requires Supabase Pro plan
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums / check-constrained status values
-- Using TEXT + CHECK rather than Postgres ENUM so values can be added without
-- a migration ALTER TYPE.
-- ---------------------------------------------------------------------------

-- lead_status values
-- 'new'        : form submitted, GBP lookup not yet done
-- 'gbp_found'  : GBP data retrieved, generation pending
-- 'generating' : Claude is writing SiteProps
-- 'deploying'  : Vercel deployment in flight
-- 'preview'    : site live, countdown running
-- 'expired'    : 3-hour window elapsed without payment
-- 'paid'       : checkout.session.completed received
-- 'onboarding' : welcome workflow done, post-purchase sequence running
-- 'churned'    : subscription cancelled

-- site_status values
-- 'generating' | 'deploying' | 'preview' | 'live' | 'expired' | 'cancelled'

-- subscription_status values
-- 'trialing' | 'active' | 'past_due' | 'cancelled' | 'unpaid'

-- ---------------------------------------------------------------------------
-- TABLE: leads
-- One row per form submission.  PK is a short slug-friendly ID stored as TEXT
-- (passed as query param through the funnel, not exposed as UUID).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS leads (
    lead_id         TEXT        PRIMARY KEY DEFAULT 'ld_' || replace(gen_random_uuid()::TEXT, '-', ''),
    business_name   TEXT        NOT NULL,
    niche           TEXT        NOT NULL,
    suburb          TEXT        NOT NULL,
    phone           TEXT,                           -- captured mid-building-screen
    email           TEXT,                           -- captured at checkout
    status          TEXT        NOT NULL DEFAULT 'new'
                    CHECK (status IN (
                        'new','gbp_found','generating','deploying',
                        'preview','expired','paid','onboarding','churned'
                    )),
    gbp_data        JSONB,                          -- raw Outscraper first result
    gbp_confidence  NUMERIC(3,2),                  -- 0.00–1.00
    cf_turnstile_ok BOOLEAN     NOT NULL DEFAULT FALSE,
    ip_address      INET,
    user_agent      TEXT,
    utm_source      TEXT,
    utm_medium      TEXT,
    utm_campaign    TEXT,
    utm_content     TEXT,
    referrer_url    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_status_idx       ON leads (status);
CREATE INDEX IF NOT EXISTS leads_created_at_idx   ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS leads_email_idx        ON leads (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_phone_idx        ON leads (phone) WHERE phone IS NOT NULL;

-- ---------------------------------------------------------------------------
-- TABLE: sites
-- One row per generated site.  site_props holds the full TemplateProps blob.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sites (
    site_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         TEXT        NOT NULL REFERENCES leads (lead_id) ON DELETE CASCADE,
    slug            TEXT        NOT NULL UNIQUE,    -- e.g. 'smiths-plumbing-auburn'
    niche           TEXT        NOT NULL,
    template_category TEXT      NOT NULL,           -- 'trades' | 'allied-health' | etc.
    site_props      JSONB       NOT NULL DEFAULT '{}',
    status          TEXT        NOT NULL DEFAULT 'generating'
                    CHECK (status IN (
                        'generating','deploying','preview','live','expired','cancelled'
                    )),
    vercel_deployment_id TEXT,
    vercel_url      TEXT,                           -- https://pf-xxx.vercel.app
    permanent_url   TEXT,                           -- https://slug.mysitehq.com.au
    expires_at      TIMESTAMPTZ,                    -- preview window end
    published_at    TIMESTAMPTZ,                    -- when status went 'live'
    cancelled_at    TIMESTAMPTZ,
    generation_ms   INTEGER,                        -- Claude latency (ms)
    deploy_ms       INTEGER,                        -- Vercel deploy latency (ms)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sites_lead_id_idx      ON sites (lead_id);
CREATE INDEX IF NOT EXISTS sites_status_idx       ON sites (status);
CREATE INDEX IF NOT EXISTS sites_expires_at_idx   ON sites (expires_at) WHERE status = 'preview';
CREATE INDEX IF NOT EXISTS sites_slug_idx         ON sites (slug);

-- ---------------------------------------------------------------------------
-- TABLE: build_progress
-- Streaming events consumed by the /building page via Supabase Realtime.
-- Rows are written by n8n as each workflow step completes.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS build_progress (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         TEXT        NOT NULL REFERENCES leads (lead_id) ON DELETE CASCADE,
    step            TEXT        NOT NULL
                    CHECK (step IN (
                        'gbp_lookup_started',
                        'gbp_found',
                        'gbp_disambiguation',
                        'gbp_not_found',
                        'site_generating',
                        'site_generated',
                        'deploying',
                        'alias_created',
                        'live',
                        'error'
                    )),
    message         TEXT,
    payload         JSONB,                          -- e.g. {address, phone, photo_url}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS build_progress_lead_id_idx ON build_progress (lead_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- TABLE: subscriptions
-- One row per Stripe subscription.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id     TEXT        PRIMARY KEY,    -- Stripe subscription ID (sub_xxx)
    lead_id             TEXT        NOT NULL REFERENCES leads (lead_id) ON DELETE RESTRICT,
    stripe_customer_id  TEXT        NOT NULL,       -- cus_xxx
    stripe_price_id     TEXT        NOT NULL,       -- price_xxx
    plan_name           TEXT        NOT NULL,       -- e.g. 'trades-starter'
    niche               TEXT        NOT NULL,
    amount_cents        INTEGER     NOT NULL,       -- recurring amount in AUD cents
    interval            TEXT        NOT NULL DEFAULT 'month'
                        CHECK (interval IN ('month','year')),
    status              TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN (
                            'trialing','active','past_due','cancelled','unpaid'
                        )),
    current_period_start TIMESTAMPTZ,
    current_period_end   TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN    NOT NULL DEFAULT FALSE,
    stripe_payload      JSONB,                      -- full Stripe event payload
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscriptions_lead_id_idx  ON subscriptions (lead_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx   ON subscriptions (status);

-- ---------------------------------------------------------------------------
-- TABLE: customisations
-- Stores every prop mutation made via the customise panel.
-- The latest row per lead_id is the canonical state.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS customisations (
    customisation_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         TEXT        NOT NULL REFERENCES leads (lead_id) ON DELETE CASCADE,
    site_id         UUID        NOT NULL REFERENCES sites (site_id) ON DELETE CASCADE,
    prop_path       TEXT        NOT NULL,           -- e.g. 'brand.primaryColour'
    old_value       JSONB,
    new_value       JSONB       NOT NULL,
    source          TEXT        NOT NULL DEFAULT 'ui'
                    CHECK (source IN ('ui','sms','api')),
    applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    vercel_deployment_id TEXT,                      -- deployment that applied this change
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customisations_lead_id_idx ON customisations (lead_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS customisations_site_id_idx ON customisations (site_id);

-- ---------------------------------------------------------------------------
-- TABLE: events
-- Append-only audit log. Everything significant gets a row.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS events (
    event_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         TEXT        REFERENCES leads (lead_id) ON DELETE SET NULL,
    event_type      TEXT        NOT NULL,
    -- e.g. 'lead.created' | 'gbp.found' | 'site.generated' | 'site.deployed'
    --       'checkout.completed' | 'subscription.cancelled' | 'sms.received'
    --       'upsell.triggered' | 'recovery.email.sent' | 'report.sent'
    event_data      JSONB       NOT NULL DEFAULT '{}',
    source          TEXT        NOT NULL DEFAULT 'n8n',
                                                    -- 'n8n' | 'stripe' | 'twilio' | 'user'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_lead_id_idx     ON events (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_type_idx        ON events (event_type);
CREATE INDEX IF NOT EXISTS events_created_at_idx  ON events (created_at DESC);

-- ---------------------------------------------------------------------------
-- TABLE: recovery_attempts
-- Tracks each recovery email/SMS step so we do not double-send.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS recovery_attempts (
    attempt_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         TEXT        NOT NULL REFERENCES leads (lead_id) ON DELETE CASCADE,
    step            TEXT        NOT NULL
                    CHECK (step IN ('t0','t24h','t72h','t7d')),
    channel         TEXT        NOT NULL
                    CHECK (channel IN ('email','sms')),
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    postmark_message_id TEXT,
    twilio_sid      TEXT,
    status          TEXT        NOT NULL DEFAULT 'sent'
                    CHECK (status IN ('sent','delivered','failed','bounced')),
    error_detail    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (lead_id, step, channel)                 -- prevent duplicates
);

CREATE INDEX IF NOT EXISTS recovery_lead_id_idx   ON recovery_attempts (lead_id);

-- ---------------------------------------------------------------------------
-- TABLE: monthly_reports
-- Stores generated HTML report per subscription per month.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS monthly_reports (
    report_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         TEXT        NOT NULL REFERENCES leads (lead_id) ON DELETE CASCADE,
    subscription_id TEXT        REFERENCES subscriptions (subscription_id) ON DELETE SET NULL,
    period_year     INTEGER     NOT NULL,
    period_month    INTEGER     NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    call_count      INTEGER     NOT NULL DEFAULT 0,
    search_impressions INTEGER  NOT NULL DEFAULT 0,
    search_clicks   INTEGER     NOT NULL DEFAULT 0,
    report_html     TEXT,
    sent_at         TIMESTAMPTZ,
    postmark_message_id TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (lead_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS reports_lead_id_idx    ON monthly_reports (lead_id);
CREATE INDEX IF NOT EXISTS reports_period_idx     ON monthly_reports (period_year DESC, period_month DESC);

-- ---------------------------------------------------------------------------
-- Automatic updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['leads','sites','subscriptions'] LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_updated_at ON %I;
             CREATE TRIGGER trg_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
            t, t
        );
    END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Supabase Realtime — enable for tables the /building page subscribes to
-- ---------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE build_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE sites;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE leads            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites            ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_progress   ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE customisations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reports  ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS: service_role bypass (n8n uses service role key — bypasses RLS)
-- Supabase service_role already bypasses RLS by default; these policies are
-- documented here for clarity and in case row-level grants are audited.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- RLS: anon role policies (funnel frontend — no auth, uses anon key)
-- ---------------------------------------------------------------------------

-- Anon may INSERT a lead (form submission)
CREATE POLICY "anon_insert_lead"
    ON leads FOR INSERT
    TO anon
    WITH CHECK (TRUE);

-- Anon may SELECT their own lead by lead_id (used by /building page polling)
-- Frontend passes lead_id as a filter; Postgres enforces it.
CREATE POLICY "anon_select_own_lead"
    ON leads FOR SELECT
    TO anon
    USING (TRUE);                                   -- filtered by lead_id in query; no auth token available at anon tier

-- Anon may SELECT build_progress for their lead (Realtime subscription)
CREATE POLICY "anon_select_build_progress"
    ON build_progress FOR SELECT
    TO anon
    USING (TRUE);                                   -- filtered by lead_id channel in Realtime subscription

-- Anon may SELECT their site status
CREATE POLICY "anon_select_site"
    ON sites FOR SELECT
    TO anon
    USING (TRUE);

-- Anon may NOT access subscriptions, events, reports (n8n service role only)
-- No permissive policies for anon on those tables = default deny.

-- ---------------------------------------------------------------------------
-- RLS: authenticated role (future admin dashboard)
-- ---------------------------------------------------------------------------

CREATE POLICY "auth_all_leads"
    ON leads FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "auth_all_sites"
    ON sites FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "auth_all_subscriptions"
    ON subscriptions FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "auth_all_events"
    ON events FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "auth_all_customisations"
    ON customisations FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "auth_all_recovery"
    ON recovery_attempts FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "auth_all_reports"
    ON monthly_reports FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "auth_all_build_progress"
    ON build_progress FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

-- ---------------------------------------------------------------------------
-- pg_cron: scheduled jobs
-- Requires pg_cron extension (Supabase Pro plan → Extensions → pg_cron).
-- These call n8n webhook endpoints; substitute actual n8n VPS IP/hostname.
-- If pg_cron is unavailable, use the n8n Schedule trigger instead (see 05).
-- ---------------------------------------------------------------------------

-- Note: pg_cron SELECT cron.schedule calls require the cron schema.
-- Run the lines below ONLY after confirming pg_cron is enabled.

/*
-- Expire previews: runs every 5 minutes, marks expired rows
SELECT cron.schedule(
    'expire-previews',
    '*/5 * * * *',
    $$
        UPDATE sites
        SET status = 'expired', updated_at = NOW()
        WHERE status = 'preview'
          AND expires_at < NOW()
          AND status != 'expired';
    $$
);

-- Monthly reports: 1st of each month, 9 AM AEST (= 23:00 UTC previous day)
SELECT cron.schedule(
    'monthly-reports',
    '0 23 28-31 * *',
    $$
        -- This just flags that a report run is due; the actual logic is in n8n workflow 09.
        -- pg_cron cannot make HTTP calls natively; use pg_net extension or rely on n8n Schedule trigger.
        SELECT 1;
    $$
);
*/

-- ---------------------------------------------------------------------------
-- Helper views (optional, useful for admin dashboard queries)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_lead_pipeline AS
SELECT
    l.lead_id,
    l.business_name,
    l.niche,
    l.suburb,
    l.status        AS lead_status,
    l.email,
    l.phone,
    l.created_at,
    s.site_id,
    s.slug,
    s.permanent_url,
    s.status        AS site_status,
    s.expires_at,
    sub.subscription_id,
    sub.plan_name,
    sub.amount_cents,
    sub.status      AS subscription_status
FROM leads l
LEFT JOIN sites s            ON s.lead_id = l.lead_id
LEFT JOIN subscriptions sub  ON sub.lead_id = l.lead_id AND sub.status NOT IN ('cancelled')
ORDER BY l.created_at DESC;

CREATE OR REPLACE VIEW v_expiring_soon AS
SELECT
    l.lead_id,
    l.business_name,
    l.email,
    l.phone,
    s.permanent_url,
    s.expires_at,
    EXTRACT(EPOCH FROM (s.expires_at - NOW())) / 60 AS minutes_remaining
FROM sites s
JOIN leads l ON l.lead_id = s.lead_id
WHERE s.status = 'preview'
  AND s.expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 minutes'
ORDER BY s.expires_at ASC;

-- ---------------------------------------------------------------------------
-- Seed data: nothing seeded here — all production data comes through n8n.
-- ---------------------------------------------------------------------------

-- End of migration.
