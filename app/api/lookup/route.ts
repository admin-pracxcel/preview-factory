/**
 * app/api/lookup/route.ts
 * POST /api/lookup
 *
 * Fast Google Business Profile lookup, used by the building page to show real
 * business details in the "Found on Google" card BEFORE the slow generation
 * step (/api/intake) runs.
 *
 * Body:  { businessName: string, niche: string, suburb?: string }
 * Returns: { gbpData: GbpData }
 *
 * Latency: typically < 1s with Places API, instant with synthesis fallback.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchByName } from "@/lib/places-client";

export const runtime = "nodejs";

interface LookupBody {
  businessName: string;
  niche: string;
  suburb?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: LookupBody;
  try {
    body = (await request.json()) as LookupBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { businessName, niche, suburb } = body;

  if (!businessName || typeof businessName !== "string") {
    return NextResponse.json(
      { error: "businessName is required" },
      { status: 400 }
    );
  }
  if (!niche || typeof niche !== "string") {
    return NextResponse.json({ error: "niche is required" }, { status: 400 });
  }

  try {
    console.log(`[lookup] fetching GBP for "${businessName}" niche="${niche}"...`);
    const gbpData = await fetchByName(businessName, niche, suburb);
    console.log(`[lookup] resolved to "${gbpData.name}".`);
    return NextResponse.json({ gbpData });
  } catch (err) {
    console.error("[lookup] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lookup failed" },
      { status: 500 }
    );
  }
}
