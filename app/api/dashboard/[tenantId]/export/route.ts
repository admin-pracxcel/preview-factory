/**
 * GET /api/dashboard/[tenantId]/export
 *
 * Returns a full JSON bundle of everything we hold about this tenant.
 * Session-gated; caller must own the tenant.
 *
 * Purpose:
 *   1. Customer courtesy: "give me my data" is a one-click download.
 *   2. Regulatory: Australian Privacy Principle 13 (correction of personal
 *      information) requires access on request; GDPR pulls the same lever.
 *   3. Restore aid: paired with docs/tenant-restore.md, a fresh export can
 *      be the source of truth when reverting an accidental change.
 *
 * Output shape:
 *   {
 *     exportedAt: ISO,
 *     tenant: { ...TenantRecord },
 *     leads: LeadRecord[],
 *     editRequests: EditRequest[]
 *   }
 *
 * NOTE on completeness: we do NOT include sessions, magic_tokens,
 * processed_events, worker_health, rate_limits, or jobs. Those are
 * infrastructure state — not the customer's data.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertOwnsTenant, type MutableCookies } from "@/lib/session";
import { getTenant } from "@/lib/tenant-store";
import { listLeads } from "@/lib/leads-store";
import { listEditRequests } from "@/lib/edit-requests-store";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  const { tenantId } = await params;

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
  if (!tenant) {
    return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  }

  const [leads, editRequests] = await Promise.all([
    listLeads(tenantId),
    listEditRequests(tenantId),
  ]);

  const bundle = {
    exportedAt: new Date().toISOString(),
    tenant,
    leads,
    editRequests,
  };

  const safeName = tenant.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const filename = `launcharoo-${safeName}-${tenantId.slice(0, 8)}.json`;

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
