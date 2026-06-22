/**
 * app/api/tenant/[id]/route.ts
 * GET /api/tenant/[id]
 *
 * Returns the stored tenant record (including SiteProps) for a given tenant ID.
 * Used by the client dashboard and preview shell to resolve tenant data.
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenant } from "@/lib/tenant-store";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid tenant ID" }, { status: 400 });
  }

  const tenant = getTenant(id);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json(tenant);
}
