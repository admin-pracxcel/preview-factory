# Per-tenant restore runbook

When a single tenant is in a bad state, this file is what you reach for.
Almost always the right answer is targeted SQL, not a full DB restore.
Full DB restore is a nuclear option — see [docs/backups.md](backups.md).

## Before touching anything

1. **Get the tenantId.** Ask the customer, or:
   ```sql
   select id, name, owner_email, status, created_at
   from tenants
   where owner_email = 'them@example.com'
   order by created_at desc;
   ```
2. **Grab a fresh export** — hit the customer's dashboard link
   `/api/dashboard/<tenantId>/export`. Save the JSON somewhere safe.
   Do not skip this. If your fix makes things worse, this JSON is what
   you replay from.
3. **Announce the maintenance in your head** — customer-facing changes
   below can flash content briefly. Off-hours if possible.

## Scenario 1 — accidental custom-domain disconnect

Symptom: owner clicked Disconnect, wants their domain back. The
`disconnect` endpoint cleared the tenant-side fields (custom_domain,
custom_domain_status, cloudflare_zone_id, assigned_nameservers,
custom_domain_verified_at, dns_records_snapshot) but the Cloudflare zone
itself is intact.

Fix (fastest): owner enters the same domain again in the dashboard. The
POST /api/dashboard/custom-domain endpoint reuses the existing zone via
`findZoneByName` and re-runs reconcile, which re-binds Worker routes.

If the owner wants YOU to do it without them logging in:

```sql
-- Find the CF zone id from your Cloudflare account first (Cloudflare →
-- launcharoo.online → not this one, the customer domain zone → Overview
-- → Zone ID). Substitute below.
update tenants set
  custom_domain = 'their-domain.com.au',
  custom_domain_status = 'pending_ns',
  cloudflare_zone_id = '<zone-id-from-cf>',
  updated_at = now()
where id = '<tenant-id>';
```

Then hit `POST /api/cron/domain-reconcile` (or wait 5 min) — reconcile
sweeps status='pending_ns', binds Worker routes, flips to active.

## Scenario 2 — corrupted or unwanted site_props change

Symptom: owner approved an edit request that broke something. They want
the previous version back.

Every applied edit request writes a `proposed_site_props` on the
edit_requests row. Look at their history:

```sql
select id, request, change_summary, status, resolved_at
from edit_requests
where tenant_id = '<tenant-id>'
order by resolved_at desc nulls last
limit 20;
```

The `status='applied'` row second from the top is the version to roll
back to. Or if a specific request broke it, target that one.

Restore that version:

```sql
update tenants
set site_props = (
  select proposed_site_props from edit_requests where id = '<edit-request-id>'
)
where id = '<tenant-id>';
```

If they want to go back further than any recorded edit request, use the
JSON export you saved in step 2. Load `tenant.siteProps` from the JSON
and paste:

```sql
update tenants set site_props = '<paste jsonb>'::jsonb
where id = '<tenant-id>';
```

## Scenario 3 — reaper flipped tenant to expired incorrectly

Symptom: `status='expired'` and a paying customer's site is showing the
/expired page. The reaper (24h unclaimed OR 7d post-cancel grace) has
overstepped.

Diagnose:

```sql
select id, name, owner_email, status, stripe_customer_id,
       stripe_subscription_id, claimed_at, updated_at
from tenants where id = '<tenant-id>';
```

If `stripe_subscription_id` is present and Stripe shows the sub as
`active` — reaper is wrong.

Fix:

```sql
update tenants set status = 'claimed', updated_at = now()
where id = '<tenant-id>';
```

Also confirm the reaper isn't going to re-flip on next run. It only
flips 'cancelled' → 'expired' after 7 days. If the sub is active,
Stripe webhooks will move status back to 'claimed' on the next event.
Should be safe.

## Scenario 4 — stuck custom-domain status

Symptom: dashboard shows the domain sitting in `pending_ns` or
`pending_ssl` forever and nameservers ARE pointing at Cloudflare.

Diagnose:

```sql
select id, custom_domain, custom_domain_status, cloudflare_zone_id,
       assigned_nameservers, updated_at
from tenants where id = '<tenant-id>';
```

Cross-check on Cloudflare:

1. CF → the customer zone → status should say **Active** (green).
2. If Active but tenant.custom_domain_status is not 'active', reconcile
   hasn't caught it. Trigger manually via the dashboard Refresh button
   (owner) or:
   ```bash
   curl -X POST https://launcharoo.online/api/cron/domain-reconcile \
     -H "x-worker-secret: $WORKER_SHARED_SECRET"
   ```
3. If CF says "Pending nameserver update", the customer hasn't finished
   the registrar change. Nothing to fix on your side.

## Scenario 5 — tenant wants to reset to a fresh preview

Occasional case: they generated a preview, hate it, want to try again.

Simplest is a fresh intake — they resubmit through the marketing form.
The old tenant sticks around and either gets claimed (paid) or reaped
(24h unclaimed).

If they insist you nuke the current one:

```sql
-- Only do this if the tenant has NOT been paid for.
delete from tenants where id = '<tenant-id>' and status = 'preview';
```

Foreign key cascades handle leads + edit_requests + magic_tokens.

## Scenario 6 — full DB restore (last resort)

Only justified when:

- Multiple tenants are broken by a schema-level mistake, or
- The database is unrecoverably corrupt, or
- You accidentally ran a destructive migration in prod.

See [docs/backups.md](backups.md) section "Full DB restore".

## After any fix

1. **Verify the fix from the customer's perspective** — visit their
   live site, open their dashboard, run a test enquiry.
2. **Log what you did** — commit a note in `docs/incidents.md` (create
   the file if missing). Even a one-liner. Future-you needs the trail.
3. **If you learned something new** — add a scenario to this file.
