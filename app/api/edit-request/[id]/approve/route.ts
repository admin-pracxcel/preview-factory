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
import { cookies } from "next/headers";
import { getEditRequest, saveEditRequest } from "@/lib/edit-requests-store";
import { getTenant, saveTenant } from "@/lib/tenant-store";
import { assertOwnsTenant, type MutableCookies } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
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

  await saveTenant({ ...tenant, siteProps: editReq.proposedSiteProps });

  await saveEditRequest({
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
