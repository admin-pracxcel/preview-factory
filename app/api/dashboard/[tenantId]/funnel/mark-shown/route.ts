/**
 * POST /api/dashboard/[tenantId]/funnel/mark-shown
 *
 * Stamps `tenants.funnel_shown_at = now()` so the addon walkthrough only
 * auto-opens once — on the first dashboard load after the customer's
 * custom domain is verified. Idempotent: the underlying update is
 * `WHERE funnel_shown_at IS NULL` so repeat calls are silent no-ops.
 *
 * Session-gated. Admin sessions can call it too (useful for QA re-testing
 * flow — pair with an admin-only "reset walkthrough" affordance later).
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";
import { markFunnelShown } from "@/lib/tenant-store";
import { assertOwnsTenant, type MutableCookies } from "@/lib/session";
import { isAdminSession } from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  const { tenantId } = await params;

  const cookieStore = (await nextCookies()) as unknown as MutableCookies;
  const admin = await isAdminSession(cookieStore);
  if (!admin) {
    try {
      await assertOwnsTenant(cookieStore, tenantId);
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  try {
    await markFunnelShown(tenantId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[funnel-mark-shown]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "mark-shown failed" },
      { status: 500 },
    );
  }
}
