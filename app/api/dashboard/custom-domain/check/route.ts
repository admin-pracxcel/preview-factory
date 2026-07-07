/**
 * POST /api/dashboard/custom-domain/check
 * Body: { tenantId }
 *
 * Runs one reconcile pass on the tenant's custom domain state. Called
 * from the dashboard "Refresh status" button so the owner can advance
 * the state machine on demand instead of waiting for the 5-minute cron.
 *
 * Gated by the same assertOwnsTenant check as the parent endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertOwnsTenant, type MutableCookies } from "@/lib/session";
import { reconcileTenantDomain } from "@/lib/domain-reconcile";

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

  try {
    const outcome = await reconcileTenantDomain(tenantId);
    return NextResponse.json({ ok: true, outcome });
  } catch (err) {
    console.error(`[custom-domain/check] tenant=${tenantId} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "reconcile failed" },
      { status: 500 },
    );
  }
}
