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
  if (currentStatus === "active") {
    return { changed: false, state: "active", reason: "already active" };
  }
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

  // 2. Zone is active — do the one-time setup work if we haven't already.
  //    "Already done" = our site record + Worker route already exist. We
  //    check for the site record to detect this.
  const existingRecords = await listDnsRecords(tenant.cloudflareZoneId);
  const alreadySetup = hasSiteRecord(existingRecords, tenant.customDomain);
  const details: Record<string, unknown> = { zoneStatus: zone.status };

  if (!alreadySetup) {
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

    // 2c. Bind our Worker script to both apex/* and *.<domain>/*.
    await bindWorkerToCustomerDomain(tenant.cloudflareZoneId, tenant.customDomain);
    details.workerRoutesBound = true;
  } else {
    details.alreadySetup = true;
  }

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
 * Sweep all tenants that aren't yet active. Used by the cron worker.
 * Errors on a single tenant don't abort the sweep.
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
    .in("custom_domain_status", ["pending_ns", "pending_ssl"]);
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
