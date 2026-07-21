/**
 * app/api/checkout/addon/route.ts
 * POST /api/checkout/addon
 *
 * Creates a Stripe Checkout session for an addon subscription (SEO,
 * Google Ads, or Social Ads). Body:
 *   { tenantId: string, addonPlanKey: AddonPlanKey }
 *
 * Auth: session cookie must own the tenant (or admin bypass). Same rule
 * we use everywhere else that touches a tenant row.
 *
 * The customer must have completed the main-plan checkout (i.e. tenant
 * status === 'published'). Addons are strictly upsells — no addon
 * without a base subscription.
 *
 * Falls through to a mock-success URL when STRIPE_SECRET_KEY isn't set,
 * so the flow is testable end-to-end in dev without touching Stripe.
 *
 * Returns: { checkoutUrl, mock, sessionId? }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";
import { getTenant } from "@/lib/tenant-store";
import { createAddonCheckoutSession } from "@/lib/stripe-client";
import { applyRateLimit, clientIp } from "@/lib/rate-limit";
import {
  ADDON_PLAN_KEYS,
  type AddonPlanKey,
  parseAddonPlanKey,
} from "@/lib/addon-plans";
import { assertOwnsTenant, type MutableCookies } from "@/lib/session";
import { isAdminSession } from "@/lib/admin";

export const runtime = "nodejs";

function resolveBaseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  const host = request.headers.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { tenantId?: string; addonPlanKey?: string };
  try {
    body = (await request.json()) as {
      tenantId?: string;
      addonPlanKey?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tenantId, addonPlanKey } = body;
  if (!tenantId || typeof tenantId !== "string") {
    return NextResponse.json(
      { error: "tenantId is required" },
      { status: 400 },
    );
  }
  if (
    !addonPlanKey ||
    typeof addonPlanKey !== "string" ||
    !ADDON_PLAN_KEYS.includes(addonPlanKey as AddonPlanKey)
  ) {
    return NextResponse.json(
      {
        error:
          "addonPlanKey is required and must be one of the supported addon plans.",
      },
      { status: 400 },
    );
  }
  const parsed = parseAddonPlanKey(addonPlanKey);
  if (!parsed) {
    return NextResponse.json(
      { error: "addonPlanKey failed shape parse (unreachable)" },
      { status: 400 },
    );
  }

  const limited = await applyRateLimit({
    key: `checkout-addon:ip:${clientIp(request)}`,
    limit: 20,
    windowSeconds: 3600,
  });
  if (limited) return limited;

  const cookieStore = (await nextCookies()) as unknown as MutableCookies;
  const admin = await isAdminSession(cookieStore);
  if (!admin) {
    try {
      await assertOwnsTenant(cookieStore, tenantId);
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (tenant.isExpired) {
    return NextResponse.json(
      {
        error: "This preview has expired.",
        expiredUrl: `/expired/${tenantId}`,
      },
      { status: 410 },
    );
  }

  if (tenant.status !== "published") {
    return NextResponse.json(
      {
        error:
          "Addons require an active main subscription. Complete your main plan checkout first.",
      },
      { status: 409 },
    );
  }

  try {
    const baseUrl = resolveBaseUrl(request);
    const result = await createAddonCheckoutSession({
      tenantId: tenant.id,
      businessName: tenant.name,
      baseUrl,
      addonPlanKey: addonPlanKey as AddonPlanKey,
      existingStripeCustomerId: tenant.stripeCustomerId,
      ownerEmail: tenant.ownerEmail,
    });
    console.log(
      `[checkout-addon] tenant=${tenant.id} addonPlanKey=${addonPlanKey} customer=${
        tenant.stripeCustomerId ?? "(new)"
      } mock=${result.mock}`,
    );
    return NextResponse.json({
      checkoutUrl: result.url,
      sessionId: result.sessionId,
      mock: result.mock,
    });
  } catch (err) {
    console.error("[checkout-addon]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Addon checkout creation failed",
      },
      { status: 500 },
    );
  }
}
