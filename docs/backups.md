# Backups (Phase 11e)

What backups Preview Factory has, what happens if something goes wrong, and
when to spend money on more.

## What you have on the Supabase free tier

- **Daily automated backups**, retained for **7 days**.
- Backups are of the whole Postgres database (all tables, all rows).
- **No** point-in-time restore (PITR) — that's Pro+ only.
- **No** per-table restore — restore is all-or-nothing.

Practical read: if something bad happens today, you can restore to any of the
last 7 nightly snapshots. The most data you can lose is ~24 hours (from the
last snapshot to the incident).

## What Preview Factory-specific data lives where

| Store | Location | In backup? |
|---|---|---|
| Tenants, leads, edit-requests, sessions, magic tokens | Supabase Postgres | Yes |
| Uploaded logos + hero images | Supabase Storage (`previews` bucket) | Yes (Storage is included in DB backups) |
| Cloudflare custom-domain zones + DNS records | Cloudflare (their infra) | Not our concern — CF is authoritative |
| Sentry issues + traces | Sentry (their infra) | 90-day free-tier retention |
| Vercel deploy history + logs | Vercel (their infra) | ~30 days |

Rule of thumb: everything customer-facing is either in Supabase (backed up)
or in a vendor account (you don't manage backups for them).

## How to verify backups are actually running

Supabase → your project → **Database** → **Backups**. You should see 7 rows
labelled "Daily backup", each with a timestamp roughly 24 hours apart.

If the list is empty or last backup is older than 48h — that's a bug in
Supabase, not you. Open a support ticket. Free tier gets email support with
a slower SLA than paid, so if this matters, upgrading is warranted.

## Restore posture

### Full DB restore (rare — catastrophic case only)

Supabase Backups → click the backup → **Restore**. This overwrites the
current DB. Downtime while it copies (5-30 min depending on size). All
tenants freeze at the backup timestamp; anything between the backup and
now is lost.

**Do NOT use this to fix a single tenant.** Use the per-tenant runbook
in [docs/tenant-restore.md](tenant-restore.md) instead.

### Per-tenant restore (the actual use case)

Almost always what you actually want. See `docs/tenant-restore.md` — SQL
recipes for the 4 common bad states: accidental disconnect, corrupted
site_props, reaper flip, stuck domain.

## RTO / RPO commitments

- **RTO** (recovery time objective — how fast can you be back up): ~30 min
  for a full DB restore, ~2 min for a per-tenant SQL fix.
- **RPO** (recovery point objective — max data loss): ~24h on full DB
  restore (the gap since the last snapshot).

For local service businesses this is fine. If you eventually onboard a
customer whose leads are worth $1k+ each, PITR becomes worth the money.

## When to upgrade to paid PITR

Reasons that would push you off the free tier:

1. **Any single tenant's data is worth more than the RPO gap.** If losing
   24h of leads for one customer is a $5k problem, PITR (which cuts RPO
   to ~5 min) is a bargain.
2. **You take payments larger than your Supabase Pro tier cost.** Roughly:
   > $25/mo in revenue = the Pro cost stops being a rounding error.
3. **You do a lot of edit-request rollbacks.** PITR lets you dial back to
   30 minutes ago instead of yesterday's snapshot.

Not reasons to upgrade (yet):

- "Feels safer" — Supabase free-tier daily backups are enough for a pre-launch
  product with <10 tenants.
- "Compliance says so" — APP + GDPR require *some* backup, not PITR.

## What Preview Factory does NOT back up

- **Vercel env vars** — write them down in `docs/env.md` and keep the
  passwords in a password manager. Vercel doesn't restore lost env vars.
- **Third-party account state** — Stripe subscriptions, Resend domain,
  Cloudflare zones. Those live on the vendors' backups.
- **n8n workflows** — export them from n8n → Workflows → Download every
  time you edit one, and check the JSON into `strategy/_master/n8n-workflows/`.

## Customer data export

Owners can download their own tenant's full data at any time from the
dashboard "Your data" card. Two formats:

- **Full JSON**: `GET /api/dashboard/[tenantId]/export` — everything.
- **Leads CSV**: `GET /api/dashboard/[tenantId]/export/leads.csv` — Excel-friendly.

Both are session-gated. This is not a backup for you, it's a service for
the customer (and an APP 13 obligation).
