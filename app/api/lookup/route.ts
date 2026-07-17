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
import { fetchByName, fetchByPlaceId, resolveFtidToPlaceId } from "@/lib/places-client";
import { parseMapsUrl } from "@/lib/maps-url";

export const runtime = "nodejs";

/**
 * Two callable shapes. `mapsUrl` variant is used by the intake confirm step
 * when the user hits "This isn't me →" and pastes their Google Maps link;
 * name variant is the original happy path from the intake form.
 */
interface LookupBody {
  businessName?: string;
  niche: string;
  suburb?: string;
  mapsUrl?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: LookupBody;
  try {
    body = (await request.json()) as LookupBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { businessName, niche, suburb, mapsUrl } = body;

  if (!niche || typeof niche !== "string") {
    return NextResponse.json({ error: "niche is required" }, { status: 400 });
  }
  if (!mapsUrl && !businessName) {
    return NextResponse.json(
      { error: "businessName or mapsUrl is required" },
      { status: 400 }
    );
  }

  try {
    // 1. mapsUrl variant — user pasted a Google Maps link.
    if (mapsUrl && typeof mapsUrl === "string") {
      console.log(`[lookup] resolving pasted mapsUrl="${mapsUrl}" niche="${niche}"...`);
      const parsed = await parseMapsUrl(mapsUrl);

      // Resolution order (each step only runs if the earlier ones didn't
      // produce a place_id):
      //   1. Direct ChIJ if the URL had one (rare)
      //   2. Feature ID → ChIJ via the legacy Place Details endpoint —
      //      this is the only *deterministic* path: no radius, no guessing
      //   3. Biased text-search on the scraped business name — fuzzy
      //      fallback for when neither ChIJ nor FID is present
      let resolvedPlaceId: string | undefined = parsed.placeId;

      if (!resolvedPlaceId && parsed.ftid) {
        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        if (apiKey) {
          const chij = await resolveFtidToPlaceId(parsed.ftid, apiKey);
          if (chij) {
            resolvedPlaceId = chij;
            console.log(`[lookup] ftid=${parsed.ftid} → ${chij}`);
          }
        }
      }

      const gbpData = resolvedPlaceId
        ? await fetchByPlaceId(resolvedPlaceId, niche)
        : await fetchByName(
            parsed.businessName,
            niche,
            suburb,
            parsed.lat != null && parsed.lng != null
              ? { lat: parsed.lat, lng: parsed.lng, radiusMeters: 10_000 }
              : undefined,
          );
      console.log(`[lookup] mapsUrl resolved to "${gbpData.name}".`);
      return NextResponse.json({ gbpData });
    }

    // 2. Name variant — the original intake form flow.
    console.log(`[lookup] fetching GBP for "${businessName}" niche="${niche}"...`);
    const gbpData = await fetchByName(businessName!, niche, suburb);
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
