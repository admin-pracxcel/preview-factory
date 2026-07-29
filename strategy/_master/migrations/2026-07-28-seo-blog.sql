-- 2026-07-28 SEO blog automation: storage + idempotency guard.
-- Companion migration for GBP posting (last_gbp_tick_at, tenant_gbp_connections)
-- lives in the GBP plan.

CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  body_md TEXT NOT NULL,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'published',
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generation_meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_tenant_slug
  ON blog_posts(tenant_id, slug);

CREATE INDEX IF NOT EXISTS idx_blog_posts_tenant_published
  ON blog_posts(tenant_id, published_at DESC);

CREATE TABLE IF NOT EXISTS seo_publish_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('blog', 'gbp')),
  status TEXT NOT NULL CHECK (status IN ('success', 'skipped', 'failed')),
  reason TEXT,
  blog_post_id UUID REFERENCES blog_posts(id) ON DELETE SET NULL,
  cron_run_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_publish_log_tenant_time
  ON seo_publish_log(tenant_id, cron_run_at DESC);

ALTER TABLE tenant_addons
  ADD COLUMN IF NOT EXISTS last_blog_tick_at TIMESTAMPTZ;

-- RLS: service_role only. Blog posts are served to the public via the SSR
-- route using the service_role client; no anon reads.
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_publish_log ENABLE ROW LEVEL SECURITY;

-- No policies added — service_role bypasses RLS. Anon/authenticated cannot
-- read or write these tables directly.
