/**
 * app/api/edit-request/[id]/route.ts
 * GET /api/edit-request/:id
 *
 * Returns the status and metadata of an edit request. Does NOT expose
 * proposedSiteProps in the response — that is internal to the engine.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getEditRequest } from "@/lib/edit-requests-store";
import { assertOwnsTenant, type MutableCookies } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const editReq = await getEditRequest(id);
  if (!editReq) {
    return NextResponse.json({ error: "Edit request not found" }, { status: 404 });
  }

  const cookieStore = (await cookies()) as unknown as MutableCookies;
  try {
    await assertOwnsTenant(cookieStore, editReq.tenantId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "not allowed" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    id: editReq.id,
    tenantId: editReq.tenantId,
    request: editReq.request,
    status: editReq.status,
    changeSummary: editReq.changeSummary,
    createdAt: editReq.createdAt,
    resolvedAt: editReq.resolvedAt,
  });
}
