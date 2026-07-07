/**
 * GET /api/tenant/by-domain/<domain>
 *
 * Called by the Cloudflare Worker when a request lands on a customer's
 * custom domain (not launcharoo.online). Returns { tenantId, expired }
 * when we own an active custom domain matching the host.
 *
 * Cache-friendly: upstream Cache-Control tells CF to edge-cache for 5 min.
 * We accept a bit of staleness in exchange for one round-trip per (domain,
 * 5-min window).
 */

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ domain: string }>;
}

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { domain } = await context.params;
  const normalized = domain.trim().toLowerCase();

  if (!normalized || normalized.length > 253 || !/^[a-z0-9.-]+$/.test(normalized)) {
    return NextResponse.json({ error: "invalid domain" }, { status: 400 });
  }

  // Strip a leading "www." — customers usually reach us on the apex, but
  // may also hit www.<domain>. Both belong to the same tenant.
  const bare = normalized.startsWith("www.") ? normalized.slice(4) : normalized;

  const { data, error } = await supabase()
    .from("tenants")
    .select("id, status, custom_domain_status")
    .eq("custom_domain", bare)
    .maybeSingle();

  if (error) {
    console.error("[by-domain] lookup failed:", error);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "not found" },
      { status: 404, headers: { "Cache-Control": "public, max-age=60" } },
    );
  }
  if (data.custom_domain_status !== "active") {
    return NextResponse.json(
      { error: "domain not active yet", status: data.custom_domain_status },
      { status: 404, headers: { "Cache-Control": "public, max-age=30" } },
    );
  }

  return NextResponse.json(
    {
      tenantId: data.id as string,
      expired: data.status === "expired",
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
