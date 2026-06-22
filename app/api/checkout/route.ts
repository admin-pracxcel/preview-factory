/**
 * app/api/checkout/route.ts
 * POST /api/checkout
 *
 * Creates a Stripe Checkout session for a tenant and returns the redirect URL.
 * Falls back to a local mock-success URL when STRIPE_SECRET_KEY is not set,
 * so the full payment flow is testable without real Stripe credentials.
 *
 * Body: { tenantId: string }
 * Returns: { checkoutUrl: string, mock: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenant } from "@/lib/tenant-store";
import { createCheckoutSession } from "@/lib/stripe-client";

export const runtime = "nodejs";

function resolveBaseUrl(request: NextRequest): string {
  // Prefer the explicit env var (required in production)
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  // Derive from the incoming request origin (works in local dev)
  const host = request.headers.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { tenantId?: string };
  try {
    body = (await request.json()) as { tenantId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tenantId } = body;
  if (!tenantId || typeof tenantId !== "string") {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const tenant = getTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (tenant.status === "published") {
    // Already paid — skip checkout, send straight to welcome
    return NextResponse.json({
      checkoutUrl: `/welcome/${tenantId}`,
      mock: true,
      alreadyPaid: true,
    });
  }

  try {
    const baseUrl = resolveBaseUrl(request);
    const result = await createCheckoutSession(tenant.id, tenant.name, baseUrl);

    return NextResponse.json({
      checkoutUrl: result.url,
      sessionId: result.sessionId,
      mock: result.mock,
    });
  } catch (err) {
    console.error("[checkout]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout creation failed" },
      { status: 500 }
    );
  }
}
