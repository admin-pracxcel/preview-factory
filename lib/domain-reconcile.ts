/**
 * lib/domain-reconcile.ts
 * Advance one tenant's custom-domain state machine.
 *
 * Called from:
 *   POST /api/dashboard/custom-domain/check     — owner clicks "Refresh"
 *   POST /api/cron/domain-reconcile             — every 5 minutes
 *
 * State transitions handled here:
 *   pending_ns    → pending_ssl / active   (when Cloudflare zone.status = active)
 *   pending_ssl   → active                  (once Universal SSL provisions)
 *
 * "active" means: DNS records imported, site A/AAAA + www CNAME added,
 * Worker route bound to both apex and wildcard. The visitor's browser
 * can now load the site at the custom domain.
 *
 * Idempotent — safe to re-run. Skips work that's already done.
 */

import { getTenant, saveTenant, type TenantRecord } from "@/lib/tenant-store";
import {
  getZone,
  listDnsRecords,
  createDnsRecord,
  bindWorkerToCustomerDomain,
  type Zone,
  type DnsRecord,
} from "@/lib/cloudflare-api";
import { applySnapshotToZone, type DnsSnapshot } from "@/lib/dns-scan";

const APEX_PLACEHOLDER_IP = "100::"; // discard address; requests hit CF proxy first
const APEX_RECORD_TYPE = "AAAA";

export type ReconcileOutcome =
  | { changed: false; state: string; reason: string }
  | { changed: true; state: string; details: Record<string, unknown> };

export async function reconcileTenantDomain(tenantId: string): Promise<ReconcileOutcome> {
  const tenant = await getTenant(tenantId);
  if (!tenant) return { changed: false, state: "unknown", reason: "tenant not found" };
  if (!tenant.customDomain || !tenant.cloudflareZoneId) {
    return { changed: false, state: "no_domain", reason: "no custom domain configured" };
  }
  const currentStatus = tenant.customDomainStatus ?? null;
  if (currentStatus === "failed") {
    return { changed: false, state: "failed", reason: "previously failed — needs support intervention" };
  }

  // 1. Fetch zone state from Cloudflare.
  let zone: Zone;
  try {
    zone = await getZone(tenant.cloudflareZoneId);
  } catch (err) {
    console.error(`[reconcile] tenant=${tenantId} getZone failed:`, err);
    return { changed: false, state: currentStatus ?? "unknown", reason: "cloudflare unreachable" };
  }

  if (zone.status !== "active") {
    return { changed: false, state: currentStatus ?? "pending_ns", reason: `zone.status=${zone.status}` };
  }

  // If already active, still re-assert Worker route binding. Routes can
  // be missing after a disconnect+reconnect cycle because disconnect
  // unbinds them but reconnect doesn't force re-check when DNS records
  // are already in place. Idempotent — CF returns "already exists" for
  // routes that are still bound.
  if (currentStatus === "active") {
    try {
      await bindWorkerToCustomerDomain(tenant.cloudflareZoneId, tenant.customDomain);
    } catch (err) {
      console.error(`[reconcile] tenant=${tenantId} route re-bind failed:`, err);
      return { changed: false, state: "active", reason: "route re-bind failed" };
    }
    return { changed: false, state: "active", reason: "already active, routes reasserted" };
  }

  // 2. Zone is active — do the one-time setup work if we haven't already.
  //    "Already done" here means the DNS side (snapshot import + apex/www
  //    records) is in place. We track that via a site record at apex.
  //
  //    Worker routes are handled separately: they can be unbound at any
  //    time by the disconnect flow, so we always ensure they're bound
  //    whenever the zone is active. bindWorkerToCustomerDomain is
  //    idempotent — the "route already exists" case is swallowed.
  const existingRecords = await listDnsRecords(tenant.cloudflareZoneId);
  const dnsAlreadySetup = hasSiteRecord(existingRecords, tenant.customDomain);
  const details: Record<string, unknown> = { zoneStatus: zone.status };

  if (!dnsAlreadySetup) {
    // 2a. Import the pre-migration DNS snapshot so email etc keeps working.
    const snapshot = normaliseSnapshot(tenant.dnsRecordsSnapshot);
    if (snapshot) {
      const applied = await applySnapshotToZone(
        tenant.cloudflareZoneId,
        snapshot,
        createDnsRecord,
      );
      details.snapshotApplied = applied.applied;
      details.snapshotSkipped = applied.skipped;
      details.snapshotErrors = applied.errors.length;
      if (applied.errors.length > 0) {
        console.warn(
          `[reconcile] tenant=${tenantId} snapshot had ${applied.errors.length} record errors:`,
          applied.errors.slice(0, 5),
        );
      }
    }

    // 2b. Add our site records: AAAA @ 100:: proxied, CNAME www → @ proxied.
    try {
      await createDnsRecord(tenant.cloudflareZoneId, {
        type: APEX_RECORD_TYPE,
        name: "@",
        content: APEX_PLACEHOLDER_IP,
        proxied: true,
      });
    } catch (err) {
      // If a record already exists at @ (from the snapshot importing an old A
      // record they had), Cloudflare returns an error. We tolerate that —
      // whatever's at @ will still be proxied through the Worker route.
      console.warn(`[reconcile] tenant=${tenantId} apex AAAA add failed (may already exist):`, err);
    }
    try {
      await createDnsRecord(tenant.cloudflareZoneId, {
        type: "CNAME",
        name: "www",
        content: tenant.customDomain,
        proxied: true,
      });
    } catch (err) {
      console.warn(`[reconcile] tenant=${tenantId} www CNAME add failed:`, err);
    }
  } else {
    details.dnsAlreadySetup = true;
  }

  // 2c. Always ensure Worker routes are bound. Idempotent — a reconnect
  //    after a disconnect (which unbinds routes) relies on this branch
  //    running even when DNS records are still present from the first
  //    connect.
  await bindWorkerToCustomerDomain(tenant.cloudflareZoneId, tenant.customDomain);
  details.workerRoutesBound = true;

  // 3. Flip status to active. We collapse pending_ssl → active because
  //    Cloudflare's Universal SSL provisions in parallel with zone
  //    activation for proxied records; there's no meaningful gap for our
  //    case where we don't run separate DCV.
  const next: TenantRecord = {
    ...tenant,
    customDomainStatus: "active",
    customDomainVerifiedAt: tenant.customDomainVerifiedAt ?? new Date().toISOString(),
  };
  await saveTenant(next);

  console.log(
    `[reconcile] tenant=${tenantId} domain=${tenant.customDomain} → active`,
    details,
  );

  return { changed: true, state: "active", details };
}

/* ------------------------------------------------------------- internals */

function hasSiteRecord(records: DnsRecord[], domain: string): boolean {
  return records.some((r) => {
    if (r.type !== "A" && r.type !== "AAAA") return false;
    const name = (r.name ?? "").replace(/\.$/, "").toLowerCase();
    return name === domain.toLowerCase() || name === "@";
  });
}

function normaliseSnapshot(raw: unknown): DnsSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.records)) return null;
  return {
    domain: typeof obj.domain === "string" ? obj.domain : "",
    scannedAt: typeof obj.scannedAt === "string" ? obj.scannedAt : new Date().toISOString(),
    records: obj.records as DnsRecord[],
    dkimSelectorsTried: Array.isArray(obj.dkimSelectorsTried) ? (obj.dkimSelectorsTried as string[]) : [],
    dkimSelectorsFound: Array.isArray(obj.dkimSelectorsFound) ? (obj.dkimSelectorsFound as string[]) : [],
  };
}

/**
 * Sweep all tenants that either aren't yet active OR are active but might
 * have drifted (routes unbound by a disconnect+reconnect race, etc.).
 * Errors on a single tenant don't abort the sweep.
 *
 * Sweeping active tenants is cheap: reconcileTenantDomain short-circuits
 * after one CF getZone + one bindWorkerToCustomerDomain call, both
 * idempotent. Cost is bounded and route drift self-heals within one cron
 * interval.
 */
export async function reconcileAllPending(): Promise<{
  checked: number;
  advanced: number;
  errors: number;
}> {
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase()
    .from("tenants")
    .select("id")
    .in("custom_domain_status", ["pending_ns", "pending_ssl", "active"]);
  if (error) throw new Error(`reconcileAllPending list failed: ${error.message}`);

  let advanced = 0;
  let errors = 0;
  for (const row of data ?? []) {
    try {
      const outcome = await reconcileTenantDomain(row.id as string);
      if (outcome.changed) advanced++;
    } catch (err) {
      errors++;
      console.error(`[reconcile] tenant=${row.id} threw:`, err);
    }
  }
  return { checked: data?.length ?? 0, advanced, errors };
}
