/**
 * app/api/edit-request/[id]/route.ts
 * GET /api/edit-request/:id
 *
 * Returns the status and metadata of an edit request. Does NOT expose
 * proposedSiteProps in the response — that is internal to the engine.
 */

import { NextRequest, NextResponse } from "next/server";
import { getEditRequest } from "@/lib/edit-requests-store";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const editReq = getEditRequest(id);
  if (!editReq) {
    return NextResponse.json({ error: "Edit request not found" }, { status: 404 });
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
