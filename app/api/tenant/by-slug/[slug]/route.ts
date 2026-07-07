/**
 * app/api/tenant/by-slug/[slug]/route.ts
 * GET /api/tenant/by-slug/<slug>
 *
 * Called by the Cloudflare Worker to resolve a subdomain slug to a
 * tenantId, then proxy to /preview/site/<tenantId>/... on Vercel.
 *
 * Public but no PII in the response — just { tenantId, expired }.
 * The Worker caches this in KV so the round-trip only happens on cache
 * miss (typically once per (slug, 5-min window)).
 */

import { NextResponse } from "next/server";
import { tenantIdBySlug } from "@/lib/slug";
import { getTenant } from "@/lib/tenant-store";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { slug } = await context.params;
  if (!slug || slug.length > 30) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  try {
    const tenantId = await tenantIdBySlug(slug.toLowerCase());
    if (!tenantId) {
      return NextResponse.json(
        { error: "not found" },
        { status: 404, headers: { "Cache-Control": "public, max-age=60" } },
      );
    }

    // Also surface expired flag so the Worker can route to /expired without
    // an extra hop. Cheap because getTenant is already indexed by id.
    const tenant = await getTenant(tenantId);
    const expired = tenant?.isExpired ?? false;

    return NextResponse.json(
      { tenantId, expired },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (err) {
    console.error("[by-slug] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "lookup failed" },
      { status: 500 },
    );
  }
}
