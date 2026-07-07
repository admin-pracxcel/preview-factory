/**
 * app/api/dashboard/custom-domain/route.ts
 *
 * POST /api/dashboard/custom-domain
 *   Body: { tenantId, domain }
 *   Starts the BYO domain flow: validates input, scans the customer's
 *   live DNS to snapshot MX/DKIM/DMARC records, creates a Cloudflare
 *   zone in our account, and persists { assignedNameservers, zoneId,
 *   snapshot } on the tenant.
 *
 * GET  /api/dashboard/custom-domain?tenantId=<id>
 *   Reads the tenant row and returns the current state so the
 *   dashboard card can render + poll.
 *
 * Both endpoints require the caller to own the tenant (session cookie
 * matches tenants.session_id).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertOwnsTenant, type MutableCookies } from "@/lib/session";
import { getTenant, saveTenant } from "@/lib/tenant-store";
import { validateCustomDomain } from "@/lib/custom-domain";
import { createZone, findZoneByName, CloudflareApiError } from "@/lib/cloudflare-api";
import { scanDomain } from "@/lib/dns-scan";

export const runtime = "nodejs";
export const maxDuration = 60; // DNS scan + zone create can take 15-30s.

/* ------------------------------------------------------------- helpers */

async function ownedTenant(tenantId: string) {
  const store = (await cookies()) as unknown as MutableCookies;
  await assertOwnsTenant(store, tenantId); // throws on mismatch
  const tenant = await getTenant(tenantId);
  if (!tenant) throw new Error("Tenant not found");
  return tenant;
}

function summarise(snapshot: Awaited<ReturnType<typeof scanDomain>>) {
  const byType: Record<string, number> = {};
  for (const r of snapshot.records) byType[r.type] = (byType[r.type] ?? 0) + 1;
  return {
    total: snapshot.records.length,
    byType,
    dkimSelectorsFound: snapshot.dkimSelectorsFound,
  };
}

/* --------------------------------------------------------------- POST */

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { tenantId?: unknown; domain?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
  const domainInput = typeof body.domain === "string" ? body.domain : "";
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const validation = validateCustomDomain(domainInput);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { domain } = validation;

  let tenant;
  try {
    tenant = await ownedTenant(tenantId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unauthorized";
    const status = msg.includes("not found") ? 404 : 403;
    return NextResponse.json({ error: msg }, { status });
  }

  // Don't allow overwriting an active domain from this endpoint. The
  // reset flow (future) is where an owner would change domains.
  if (tenant.customDomain && tenant.customDomainStatus !== "failed") {
    return NextResponse.json(
      {
        error: `A custom domain is already configured (${tenant.customDomain}). Contact support to change it.`,
        current: {
          domain: tenant.customDomain,
          status: tenant.customDomainStatus,
        },
      },
      { status: 409 },
    );
  }

  // 1. Scan the customer's live DNS. Fail hard if this doesn't work — we
  //    are NOT going to create a zone we can't seed safely.
  let snapshot;
  try {
    snapshot = await scanDomain(domain);
  } catch (err) {
    console.error(`[custom-domain] DNS scan failed for ${domain}:`, err);
    return NextResponse.json(
      { error: "We couldn't read your current DNS. Try again in a minute." },
      { status: 502 },
    );
  }

  // 2. Create (or reuse) the Cloudflare zone.
  let zone;
  try {
    zone = await createZone(domain);
  } catch (err) {
    if (err instanceof CloudflareApiError) {
      // 1061 = "zone already exists" — could be a leftover from a failed
      // earlier attempt. Reuse it rather than 5xx-ing the customer.
      const isDuplicate = err.cfErrors.some((e) => e.code === 1061 || e.code === 1097);
      if (isDuplicate) {
        const found = await findZoneByName(domain).catch(() => null);
        if (found) {
          zone = found;
        } else {
          return NextResponse.json(
            { error: "That domain is already registered somewhere else. Contact support." },
            { status: 409 },
          );
        }
      } else {
        console.error(`[custom-domain] zone create failed:`, err);
        return NextResponse.json(
          { error: `Cloudflare rejected the domain: ${err.message}` },
          { status: 502 },
        );
      }
    } else {
      console.error(`[custom-domain] zone create threw:`, err);
      return NextResponse.json({ error: "Cloudflare is unreachable right now." }, { status: 502 });
    }
  }

  // 3. Persist state on the tenant.
  await saveTenant({
    ...tenant,
    customDomain: domain,
    customDomainStatus: "pending_ns",
    cloudflareZoneId: zone.id,
    assignedNameservers: zone.name_servers,
    dnsRecordsSnapshot: {
      scannedAt: snapshot.scannedAt,
      domain: snapshot.domain,
      records: snapshot.records,
      dkimSelectorsFound: snapshot.dkimSelectorsFound,
    },
  });

  console.log(
    `[custom-domain] tenant=${tenantId} domain=${domain} zone=${zone.id} → pending_ns (${snapshot.records.length} records snapshotted)`,
  );

  return NextResponse.json({
    ok: true,
    domain,
    status: "pending_ns" as const,
    nameservers: zone.name_servers,
    scan: summarise(snapshot),
  });
}

/* ---------------------------------------------------------------- GET */

export async function GET(request: NextRequest): Promise<NextResponse> {
  const tenantId = request.nextUrl.searchParams.get("tenantId") ?? "";
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  let tenant;
  try {
    tenant = await ownedTenant(tenantId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unauthorized";
    const status = msg.includes("not found") ? 404 : 403;
    return NextResponse.json({ error: msg }, { status });
  }

  if (!tenant.customDomain) {
    return NextResponse.json({ status: null });
  }

  return NextResponse.json({
    domain: tenant.customDomain,
    status: tenant.customDomainStatus ?? null,
    nameservers: tenant.assignedNameservers ?? [],
    verifiedAt: tenant.customDomainVerifiedAt ?? null,
  });
}
