/**
 * GET /api/tenants/[tenantId]/status
 *
 * Small, fast poll endpoint for the /building page. Returns the raw DB
 * status ('queued' | 'running' | 'done' | 'failed' | 'claimed' | ...) so
 * the client can drive its own state machine.
 *
 * The building page polls this every 2s during async generation (Phase 4).
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

interface StatusResponse {
  status: string;
  error?: string;
  /** Business trading name (Phase 10a: for welcome/dashboard URL rendering). */
  name?: string;
  /** Public subdomain fragment (Phase 10a). */
  slug?: string;
  /** Custom domain, if the tenant configured one. */
  customDomain?: string;
  /** DNS/verification state of the custom domain. */
  customDomainStatus?: string;
  /** True when site_props is a non-empty object. The /building page uses this
   *  in addition to status=done to decide when it's safe to redirect —
   *  otherwise a race between status flipping and the app-side read can send
   *  the user to the preview before there's anything to render. */
  hasSiteProps?: boolean;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse<StatusResponse | { error: string }>> {
  const { tenantId } = await params;

  const { data, error } = await supabase()
    .from("tenants")
    .select("status,error,name,slug,custom_domain,custom_domain_status,site_props")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Whether the SiteProps blob has actually landed. The n8n "Finish tenant"
  // node writes status + site_props in one atomic PATCH, but a client that
  // polls and reads through Supabase's REST API can still observe status=done
  // before site_props catches up (network reorder / different connections /
  // Postgres visibility). The /building page uses this to hold the redirect
  // until we're sure the preview iframe will actually render.
  const hasSiteProps =
    data.site_props != null &&
    typeof data.site_props === "object" &&
    Object.keys(data.site_props as object).length > 0;

  return NextResponse.json(
    {
      status: data.status as string,
      hasSiteProps,
      ...(data.error ? { error: data.error as string } : {}),
      ...(data.name ? { name: data.name as string } : {}),
      ...(data.slug ? { slug: data.slug as string } : {}),
      ...(data.custom_domain ? { customDomain: data.custom_domain as string } : {}),
      ...(data.custom_domain_status
        ? { customDomainStatus: data.custom_domain_status as string }
        : {}),
    },
    {
      // Never cache — status changes every few seconds.
      headers: { "cache-control": "no-store" },
    },
  );
}
