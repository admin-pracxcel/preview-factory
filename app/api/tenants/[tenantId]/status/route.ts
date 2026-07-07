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
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse<StatusResponse | { error: string }>> {
  const { tenantId } = await params;

  const { data, error } = await supabase()
    .from("tenants")
    .select("status,error,name,slug")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      status: data.status as string,
      ...(data.error ? { error: data.error as string } : {}),
      ...(data.name ? { name: data.name as string } : {}),
      ...(data.slug ? { slug: data.slug as string } : {}),
    },
    {
      // Never cache — status changes every few seconds.
      headers: { "cache-control": "no-store" },
    },
  );
}
