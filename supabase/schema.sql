-- Preview Factory — schema (Phase 2)
--
-- Source of truth for the "preview-factory" Supabase project. Doubles as dev
-- until a separate prod project is created before Phase 7 launch. Paste this
-- entire file into the Supabase SQL Editor and hit Run — it's idempotent, so
-- re-running is safe.
--
-- Follows docs/backend-plan.md Phase 2. See supabase/README.md for the manual
-- checklist (storage bucket, RLS confirmation, env vars).

-- =========================================================================
-- 1. Extensions
-- =========================================================================

create extension if not exists "pgcrypto";       -- gen_random_uuid()
create extension if not exists "moddatetime";    -- updated_at auto-touch

-- =========================================================================
-- 2. Tables
-- =========================================================================

-- Anonymous browser sessions. One row per intake visitor; a session can
-- own N tenants. Retained even after magic-link claim because the same
-- browser might still touch this session cookie.
create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ip           inet,
  user_agent   text
);

-- The tenant is the account. Pre-claim: identified by session_id. Post-claim:
-- identified by owner_email + billing_* columns. Reaper (Phase 8) skips rows
-- where claimed_at is not null and subscription_status is active.
create table if not exists public.tenants (
  id                        uuid primary key default gen_random_uuid(),
  session_id                uuid references public.sessions(id) on delete set null,
  category                  text not null,
  status                    text not null default 'queued'
                              check (status in ('queued','running','done','failed','claimed','past_due','cancelled','expired')),
  site_props                jsonb,
  error                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- Denormalised business context (cached on the row for list views).
  name                      text,
  niche                     text,
  place_id                  text,
  gbp_photos                jsonb,

  -- Claim + billing (Phase 7.5). Nullable until the tenant is claimed.
  claimed_at                timestamptz,
  owner_email               text,
  billing_provider          text,
  billing_customer_id       text,
  billing_subscription_id   text,
  subscription_status       text,
  cancelled_at              timestamptz,

  -- Custom domain (Phase 11). All nullable until the tenant sets a domain.
  custom_domain             text unique,
  custom_domain_status      text
                              check (custom_domain_status is null or custom_domain_status in
                                ('none','choosing','purchasing','pending_ns','pending_ssl','active','failed')),
  cloudflare_zone_id        text,
  assigned_nameservers      text[],
  dns_records_snapshot      jsonb,
  custom_domain_verified_at timestamptz,
  custom_domain_purchased_via text
                              check (custom_domain_purchased_via is null or custom_domain_purchased_via in
                                ('existing','crazy_domains_affiliate'))
);

-- Retrofit missing columns on tenants when the table already exists from an
-- earlier schema apply. `create table if not exists` above is a no-op if the
-- table exists, so column additions need their own idempotent step here.
alter table public.tenants add column if not exists name text;
alter table public.tenants add column if not exists niche text;
alter table public.tenants add column if not exists place_id text;
alter table public.tenants add column if not exists gbp_photos jsonb;

-- Widen the status check to include 'expired' (Phase 8b reaper). Drop-and-add
-- is safe because the constraint is only enforced on writes and the values
-- are a proper superset of the previous set.
alter table public.tenants drop constraint if exists tenants_status_check;
alter table public.tenants add constraint tenants_status_check
  check (status in ('queued','running','done','failed','claimed','past_due','cancelled','expired'));

-- Job queue for async generation (Phase 4+). n8n pulls status='queued' rows.
-- Retained after completion for the observability + retry story; weekly
-- cleanup cron (Phase 8) drops anything older than 7 days.
create table if not exists public.jobs (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  status       text not null default 'queued'
                 check (status in ('queued','running','done','failed')),
  payload      jsonb not null,
  result       jsonb,
  error        text,
  attempts     int not null default 0,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);

-- Contact-form leads on rendered customer sites. Populated by /api/leads
-- (Phase 3). Cascades on tenant delete.
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references public.tenants(id) on delete cascade,
  name        text,
  email       text,
  phone       text,
  message     text,
  source      text check (source is null or source in ('contact-form','call-click','email-click')),
  page        text,
  created_at  timestamptz not null default now()
);

-- Retrofit source + page + drop the tenant_id NOT NULL constraint for legacy
-- static-demo leads. Idempotent.
alter table public.leads add column if not exists source text;
alter table public.leads add column if not exists page text;
alter table public.leads alter column tenant_id drop not null;

-- One-time-use magic link tokens (Phase 7.5). 15-min expiry. Rows are marked
-- used_at rather than deleted so we can audit login history for a week or two.
create table if not exists public.magic_tokens (
  token       text primary key,
  email       text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);

-- Webhook idempotency guard. Every provider (Stripe, plus future ones) writes
-- event.id here before processing. Duplicate deliveries insert-conflict and
-- the handler short-circuits. Weekly cleanup drops rows older than 60 days.
create table if not exists public.processed_events (
  event_id    text primary key,
  provider    text not null,
  seen_at     timestamptz not null default now()
);

-- Plain-English edit requests submitted from the client dashboard (Phase L).
-- The engine reads pending rows, produces a proposed SiteProps mutation, and
-- flips status to 'preview' for the owner to approve or reject.
create table if not exists public.edit_requests (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  request              text not null,
  status               text not null default 'pending'
                         check (status in ('pending','processing','preview','applied','rejected','error')),
  created_at           timestamptz not null default now(),
  resolved_at          timestamptz,
  change_summary       text,
  proposed_site_props  jsonb
);

create index if not exists edit_requests_tenant_id_idx
  on public.edit_requests (tenant_id, created_at desc);

alter table public.edit_requests enable row level security;

-- Worker heartbeat singleton (Phase 5). n8n hits POST /api/health/worker every
-- 5 minutes; Vercel writes the timestamp here. /api/health reads it to decide
-- whether the worker is stale (>15 min since last beat). One row, id='worker'.
create table if not exists public.worker_health (
  id            text primary key,
  last_seen_at  timestamptz not null default now(),
  meta          jsonb
);
insert into public.worker_health (id) values ('worker')
  on conflict (id) do nothing;

-- =========================================================================
-- 3. Indexes
-- =========================================================================
-- Only indexes that support real query paths — every one has a caller in
-- docs/backend-plan.md. Postgres reindexes are cheap; adding speculative
-- indexes is not.

-- tenant lookups by session (browsing + reaper), by owner (magic-link login),
-- by status (queue polling), and the reaper's hot partial index.
create index if not exists tenants_session_id_idx
  on public.tenants (session_id);
create index if not exists tenants_owner_email_idx
  on public.tenants (owner_email);
create index if not exists tenants_status_idx
  on public.tenants (status);
create index if not exists tenants_unclaimed_created_idx
  on public.tenants (created_at)
  where claimed_at is null;

-- job lookups by tenant (dashboard) and by hot status (worker + cron).
create index if not exists jobs_tenant_id_idx
  on public.jobs (tenant_id);
create index if not exists jobs_active_status_idx
  on public.jobs (status)
  where status in ('queued','running');

-- leads read + magic-link lookups.
create index if not exists leads_tenant_id_idx
  on public.leads (tenant_id);
create index if not exists magic_tokens_email_idx
  on public.magic_tokens (email);

-- =========================================================================
-- 4. Triggers — auto updated_at on tenants
-- =========================================================================

drop trigger if exists tenants_set_updated_at on public.tenants;
create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute procedure moddatetime(updated_at);

-- =========================================================================
-- 5. Row-Level Security
-- =========================================================================
-- Locked to service_role. The Vercel server holds the service_role key;
-- clients never talk to Supabase directly. Enabling RLS with zero policies
-- means the anon key can access nothing — a safety net if the anon key
-- ever leaks.

alter table public.sessions          enable row level security;
alter table public.tenants           enable row level security;
alter table public.jobs              enable row level security;
alter table public.leads             enable row level security;
alter table public.magic_tokens      enable row level security;
alter table public.processed_events  enable row level security;
alter table public.worker_health     enable row level security;

-- =========================================================================
-- 6. Storage — previews bucket
-- =========================================================================
-- User-uploaded logos + images (Phase 6). Public bucket with unguessable
-- UUID paths (previews/<tenant_id>/<uuid>.<ext>). Public is fine because
-- paths themselves are the capability — random guess space is 128-bit.

insert into storage.buckets (id, name, public)
values ('previews', 'previews', true)
on conflict (id) do update set public = excluded.public;

-- =========================================================================
-- 7. Comments (schema documentation surfaced in the Supabase UI)
-- =========================================================================

comment on table public.sessions is
  'Anonymous browser sessions. One row per intake visitor. Retained after claim.';
comment on table public.tenants is
  'The account. Pre-claim: session_id. Post-claim: owner_email + billing_*.';
comment on column public.tenants.site_props is
  'Full SiteProps blob produced by the generator. Rendered by /preview/[id].';
comment on column public.tenants.status is
  'Lifecycle: queued -> running -> (done|failed) -> claimed -> (past_due|cancelled).';
comment on table public.jobs is
  'Generation job queue. n8n picks status=queued rows via webhook + cron.';
comment on table public.leads is
  'Contact-form submissions on customer sites.';
comment on table public.magic_tokens is
  'One-time-use magic-link tokens for magic-link auth (Phase 7.5).';
comment on table public.processed_events is
  'Webhook idempotency guard. Insert-conflict = duplicate delivery, skip.';
comment on table public.worker_health is
  'Singleton row (id=worker). n8n heartbeat writes last_seen_at every 5 min.';
