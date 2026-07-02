/**
 * app/api/edit-request/[id]/approve/route.ts
 * POST /api/edit-request/:id/approve
 *
 * Applies the proposed SiteProps to the tenant record and marks the edit
 * request as "applied".
 *
 * Returns: { success: true, tenantId, message }
 */

import { NextRequest, NextResponse } from "next/server";
import { getEditRequest, saveEditRequest } from "@/lib/edit-requests-store";
import { getTenant, saveTenant } from "@/lib/tenant-store";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const editReq = getEditRequest(id);
  if (!editReq) {
    return NextResponse.json({ error: "Edit request not found" }, { status: 404 });
  }

  if (editReq.status !== "preview") {
    return NextResponse.json(
      { error: "Edit request is not in preview state" },
      { status: 400 }
    );
  }

  const tenant = await getTenant(editReq.tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (!editReq.proposedSiteProps) {
    return NextResponse.json(
      { error: "No proposed site props found on this edit request" },
      { status: 400 }
    );
  }

  // Apply the proposed changes to the tenant record
  await saveTenant({ ...tenant, siteProps: editReq.proposedSiteProps });

  // Mark the edit request as applied
  saveEditRequest({
    ...editReq,
    status: "applied",
    resolvedAt: new Date().toISOString(),
  });

  console.log(
    `[edit-request/approve] applied id=${id} to tenant=${editReq.tenantId}`
  );

  return NextResponse.json({
    success: true,
    tenantId: editReq.tenantId,
    message: "Change applied and site updated.",
  });
}
