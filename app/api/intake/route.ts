/**
 * app/api/intake/route.ts
 * POST /api/intake
 *
 * Intake pipeline for a new business:
 *   1. Accept { placeId?, businessName?, niche }
 *   2. Fetch GBP data from Google Places API (fixture if key not set)
 *   3. Run generator to produce validated SiteProps (fixture if key not set)
 *   4. Store tenant record under data/tenants/<uuid>.json
 *   5. Return { tenantId, name, previewUrl, sitePreviewUrl }
 *
 * Expected latency: 60–90 s when ANTHROPIC_API_KEY is set (Claude generation).
 * With fixture fallback: < 100 ms.
 *
 * Human deploy note: set ANTHROPIC_API_KEY and GOOGLE_PLACES_API_KEY.
 * Set maxDuration = 120 in your Vercel project for this route.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchByPlaceId, fetchByName } from "@/lib/places-client";
import { generateSiteForApi, nicheToCategory } from "@/lib/generator-api";
import { saveTenant } from "@/lib/tenant-store";

export const runtime = "nodejs";
// Note: maxDuration requires Vercel Pro+. Local dev has no timeout.
// export const maxDuration = 120;

interface IntakeBody {
  placeId?: string;
  businessName?: string;
  niche: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: IntakeBody;
  try {
    body = (await request.json()) as IntakeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { placeId, businessName, niche } = body;

  if (!niche || typeof niche !== "string") {
    return NextResponse.json({ error: "niche is required" }, { status: 400 });
  }
  if (!placeId && !businessName) {
    return NextResponse.json(
      { error: "Either placeId or businessName is required" },
      { status: 400 }
    );
  }

  try {
    // 1. Fetch GBP data
    console.log(`[intake] fetching GBP for niche="${niche}"...`);
    const gbpData = placeId
      ? await fetchByPlaceId(placeId, niche)
      : await fetchByName(businessName!, niche);

    // 2. Generate SiteProps
    console.log(`[intake] generating SiteProps for "${gbpData.name}"...`);
    const siteProps = await generateSiteForApi(gbpData);

    // 3. Store tenant
    const id = crypto.randomUUID();
    const category = nicheToCategory(niche);
    saveTenant({
      id,
      name: gbpData.name,
      niche,
      category,
      siteProps,
      createdAt: new Date().toISOString(),
      status: "preview",
      placeId: placeId,
    });

    console.log(`[intake] tenant ${id} stored. category=${category}`);

    return NextResponse.json({
      tenantId: id,
      name: gbpData.name,
      niche,
      category,
      previewUrl: `/preview/${id}`,
      sitePreviewUrl: `/preview/site/${id}`,
    });
  } catch (err) {
    console.error("[intake] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
