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
import { getTenant, saveTenant } from "@/lib/tenant-store";
import { createCheckoutSession } from "@/lib/stripe-client";
import { applyRateLimit, clientIp } from "@/lib/rate-limit";
import { PLAN_KEYS, type PlanKey } from "@/lib/plans";

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
  let body: { tenantId?: string; planKey?: string };
  try {
    body = (await request.json()) as { tenantId?: string; planKey?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tenantId, planKey } = body;
  if (!tenantId || typeof tenantId !== "string") {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }
  if (!planKey || typeof planKey !== "string" || !PLAN_KEYS.includes(planKey as PlanKey)) {
    return NextResponse.json(
      { error: "planKey is required and must be one of the supported tiers." },
      { status: 400 },
    );
  }

  // Guards Stripe session churn. Mostly annoyance-prevention: 20/hour per
  // IP is well above any legitimate flow (typical is 1-2 sessions total).
  const limited = await applyRateLimit({
    key: `checkout:ip:${clientIp(request)}`,
    limit: 20,
    windowSeconds: 3600,
  });
  if (limited) return limited;

  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (tenant.isExpired) {
    // Reaper (Phase 8b) has flagged this site as expired. Don't take money
    // for a preview we've soft-deleted.
    return NextResponse.json(
      { error: "This preview has expired.", expiredUrl: `/expired/${tenantId}` },
      { status: 410 }
    );
  }

  if (tenant.status === "published") {
    // Already paid — skip checkout, send straight to welcome
    return NextResponse.json({
      checkoutUrl: `/welcome/${tenantId}`,
      mock: true,
      alreadyPaid: true,
    });
  }

  // Persist the chosen plan on the tenant BEFORE the Stripe session is
  // created. Two reasons:
  //   1. Stripe's webhook may point at a different deployment (e.g. prod)
  //      that doesn't yet know how to read `metadata.planKey`. Writing here
  //      makes the tier stick regardless of which environment handles the
  //      subscription lifecycle event.
  //   2. Idempotent: if the user opens the picker, picks Growth, backs out,
  //      then picks Pro, the last /api/checkout call wins.
  // Non-fatal: if the write fails we still let checkout proceed — the
  // tenant just ends up on the legacy fallback quota rather than blocking
  // payment.
  try {
    await saveTenant({ ...tenant, planKey: planKey as PlanKey });
    console.log(`[checkout] persisted planKey=${planKey} on tenant ${tenant.id}`);
  } catch (err) {
    console.warn(`[checkout] failed to persist planKey on ${tenant.id}:`, err);
  }

  try {
    const baseUrl = resolveBaseUrl(request);
    const result = await createCheckoutSession(
      tenant.id,
      tenant.name,
      baseUrl,
      planKey as PlanKey,
    );

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
