/**
 * app/api/billing/portal/route.ts
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session and returns the URL.
 * The client redirects to this URL so the customer can manage their subscription.
 *
 * Body: { tenantId: string }
 * Returns: { url: string, mock: boolean }
 *
 * Human deploy note:
 *   In the Stripe dashboard → Customers → Billing portal → configure the portal
 *   (allowed features: cancel subscription, update payment method).
 *   The portal session is tied to the Stripe customer ID stored in the tenant record.
 *   See strategy/_master/deployment-checklist.md section "Stripe".
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenant } from "@/lib/tenant-store";

export const runtime = "nodejs";

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

  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;

  // Mock mode — no Stripe key or no customer ID yet
  if (!secretKey || !tenant.stripeCustomerId) {
    return NextResponse.json({
      url: null,
      mock: true,
      reason: !secretKey
        ? "STRIPE_SECRET_KEY not configured"
        : "No Stripe customer ID on record (tenant not yet paid via real Stripe)",
    });
  }

  // Build the return URL from the request origin
  const host = request.headers.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;
  const returnUrl = `${baseUrl}/dashboard/${encodeURIComponent(tenantId)}`;

  const params = new URLSearchParams();
  params.set("customer", tenant.stripeCustomerId);
  params.set("return_url", returnUrl);

  const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[billing/portal] Stripe error:", err);
    return NextResponse.json(
      { error: `Stripe portal creation failed: ${res.status}` },
      { status: 500 }
    );
  }

  const session = (await res.json()) as { url: string };
  return NextResponse.json({ url: session.url, mock: false });
}
