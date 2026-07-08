# Backups (Phase 11e)

What backups Preview Factory has, what happens if something goes wrong, and
when to spend money on more.

## What you have on the Supabase free tier

**Nothing automatic.** The free tier gives you:
- **No** automated daily backups (those start on Pro at $25/mo)
- **No** point-in-time restore (PITR — Team+ only)
- **No** managed disaster recovery of any kind

If Supabase has a database incident right now, or you accidentally drop a
table, or a migration goes wrong — you have no restore path. This is the
biggest single risk in the current stack.

## The three ways to fix this

### 1. Upgrade to Supabase Pro — $25/mo, one click

Gives you: 7-day daily automated backups, one-click restore, longer log
retention, better support SLA. Recommended once you have your first paying
customer (i.e. $60+/mo in revenue) — the Pro cost is under 50% of one
Sandbox subscription.

### 2. Roll your own pg_dump backups on the free tier

Free but manual. Options:

- **Local, ad-hoc**: run `pg_dump` from your laptop when you remember.
  Fine while there are 0-3 tenants; useless once you're busy.
- **GitHub Actions cron**: schedule a nightly workflow that runs `pg_dump`,
  encrypts the output with `gpg`, and uploads it as an artifact or a
  private release. Free. Ask me to build this if you want it.
- **Cloudflare R2 + a Worker cron**: same idea, better ergonomics. Also free.

If you want option 2, tell me which flavour and I'll build the runbook.

### 3. Live with the risk until you have paying customers

Genuinely reasonable stance while you're pre-revenue. The downside is
proportional to the value at risk — right now, that's a few test tenants.
Once real customers exist, decision changes.

## Recommendation

Wait until your first paying customer, then upgrade to Pro. Cheaper and
better than any DIY option, and comes with support you'll appreciate.

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

## How to verify backups are actually running (Pro plan only)

Supabase → your project → **Database** → **Backups**. You should see 7 rows
labelled "Daily backup", each with a timestamp roughly 24 hours apart.

On the free tier this page will be empty or show an upgrade prompt — that's
expected, not a bug.

If you're on Pro and the list is empty or last backup is older than 48h,
open a Supabase support ticket.

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

Depends on your plan:

| Plan | RPO (max data loss) | RTO (time to restore) |
|---|---|---|
| Free (current) | **All of it** if incident occurs, ~5 min if per-tenant SQL fix | Total loss possible |
| Pro (recommended when revenue justifies) | ~24h (last nightly) | ~30 min full DB, ~2 min per-tenant |
| Team+ (with PITR) | ~5 min | ~30 min |

For local service businesses on Pro this is fine. Free tier is only OK
pre-revenue.

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
