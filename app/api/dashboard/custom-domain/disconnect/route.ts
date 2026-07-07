/**
 * POST /api/dashboard/custom-domain/disconnect
 * Body: { tenantId }
 *
 * Owner-initiated disconnect of a custom domain. What it does:
 *   1. Unbinds every Worker route we bound to the customer's Cloudflare
 *      zone. This is what actually stops traffic to <domain> from being
 *      served by us — as soon as routes are gone, Cloudflare falls back
 *      to serving the zone's DNS as an ordinary proxied host, which
 *      returns nothing (no origin) and shows a Cloudflare error page.
 *   2. Clears the tenant's custom_domain fields on our side so the
 *      dashboard shows the "Connect a domain" form again.
 *
 * What it deliberately does NOT do:
 *   - Delete the Cloudflare zone. The zone contains MX/DKIM/TXT records
 *     we imported plus any records the customer added; blowing them away
 *     could break their email. Support can delete the zone later if the
 *     customer explicitly wants us to.
 *   - Restore their pre-migration nameservers. We never captured them;
 *     the customer has to point their registrar somewhere new manually.
 *
 * Session-gated: caller must own the tenant.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertOwnsTenant, type MutableCookies } from "@/lib/session";
import { getTenant, saveTenant } from "@/lib/tenant-store";
import { unbindWorkerFromZone } from "@/lib/cloudflare-api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { tenantId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  try {
    const store = (await cookies()) as unknown as MutableCookies;
    await assertOwnsTenant(store, tenantId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unauthorized" },
      { status: 403 },
    );
  }

  const tenant = await getTenant(tenantId);
  if (!tenant) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  if (!tenant.customDomain) {
    return NextResponse.json({ error: "no custom domain configured" }, { status: 409 });
  }

  const domain = tenant.customDomain;
  const zoneId = tenant.cloudflareZoneId;
  let unbound = 0;

  // 1. Unbind Worker routes. Non-fatal on error — we still want to clear
  //    our side of the state so the dashboard doesn't get stuck.
  if (zoneId) {
    try {
      unbound = await unbindWorkerFromZone(zoneId);
    } catch (err) {
      console.error(`[custom-domain/disconnect] tenant=${tenantId} zone=${zoneId} unbind failed:`, err);
    }
  }

  // 2. Clear tenant-side custom-domain state. The zone stays where it is
  //    on Cloudflare so any MX/DKIM records survive.
  await saveTenant({
    ...tenant,
    customDomain: undefined,
    customDomainStatus: undefined,
    cloudflareZoneId: undefined,
    assignedNameservers: undefined,
    customDomainVerifiedAt: undefined,
    dnsRecordsSnapshot: undefined,
  });

  console.log(
    `[custom-domain/disconnect] tenant=${tenantId} domain=${domain} zone=${zoneId ?? "(none)"} unbound=${unbound}`,
  );

  return NextResponse.json({ ok: true, disconnected: domain, routesUnbound: unbound });
}
