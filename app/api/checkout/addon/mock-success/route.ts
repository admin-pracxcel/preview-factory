/**
 * app/api/checkout/addon/mock-success/route.ts
 * GET /api/checkout/addon/mock-success?tenantId=<id>&addonPlanKey=<key>
 *
 * Dev-only. Called instead of the real Stripe hosted page when
 * STRIPE_SECRET_KEY is not set. Writes an active tenant_addons row and
 * redirects to the dashboard with the success flag set so the UI can
 * celebrate the same way it would in production.
 */

import { NextRequest, NextResponse } from "next/server";
import { createOrRefreshAddonSubscription } from "@/lib/addon-store";
import {
  ADDON_PLAN_KEYS,
  parseAddonPlanKey,
  type AddonPlanKey,
} from "@/lib/addon-plans";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const tenantId = request.nextUrl.searchParams.get("tenantId");
  const addonPlanKey = request.nextUrl.searchParams.get("addonPlanKey");

  if (!tenantId) {
    return NextResponse.json(
      { error: "tenantId query param required" },
      { status: 400 },
    );
  }
  if (
    !addonPlanKey ||
    !ADDON_PLAN_KEYS.includes(addonPlanKey as AddonPlanKey)
  ) {
    return NextResponse.json(
      { error: "addonPlanKey query param invalid or missing" },
      { status: 400 },
    );
  }
  const parsed = parseAddonPlanKey(addonPlanKey);
  if (!parsed) {
    return NextResponse.json(
      { error: "addonPlanKey shape parse failed" },
      { status: 400 },
    );
  }

  try {
    const row = await createOrRefreshAddonSubscription({
      tenantId,
      addonKey: parsed.addonKey,
      planKey: addonPlanKey as AddonPlanKey,
    });
    console.log(
      `[addon-mock-success] tenant=${tenantId} addonPlanKey=${addonPlanKey} rowId=${row.id}`,
    );
  } catch (err) {
    console.error("[addon-mock-success]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "addon subscription write failed",
      },
      { status: 500 },
    );
  }

  return NextResponse.redirect(
    new URL(
      `/dashboard/${tenantId}?addon_success=${encodeURIComponent(addonPlanKey)}`,
      request.url,
    ),
  );
}
