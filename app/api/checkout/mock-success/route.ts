/**
 * app/api/checkout/mock-success/route.ts
 * GET /api/checkout/mock-success?tenantId=<id>
 *
 * Simulates a successful Stripe Checkout in fixture/test mode.
 * Called instead of the real Stripe hosted page when STRIPE_SECRET_KEY is not set.
 *
 * Marks the tenant as published and redirects to /welcome/<tenantId>.
 * Safe to call multiple times (idempotent).
 */

import { NextRequest, NextResponse } from "next/server";
import { publishTenant } from "@/lib/publish";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const tenantId = request.nextUrl.searchParams.get("tenantId");
  const planKey = request.nextUrl.searchParams.get("planKey") ?? undefined;

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId query param required" }, { status: 400 });
  }

  try {
    const result = await publishTenant(tenantId, { planKey });
    console.log(
      `[mock-success] tenant ${tenantId} published. liveUrl=${result.liveUrl}${planKey ? ` plan=${planKey}` : ""}`
    );
  } catch (err) {
    console.error("[mock-success]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Publish failed" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(new URL(`/welcome/${tenantId}`, request.url));
}
