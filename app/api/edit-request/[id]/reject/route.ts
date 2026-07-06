/**
 * app/api/edit-request/[id]/reject/route.ts
 * POST /api/edit-request/:id/reject
 *
 * Marks an edit request as "rejected".
 *
 * Returns: { success: true }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getEditRequest, saveEditRequest } from "@/lib/edit-requests-store";
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

  if (editReq.status === "applied" || editReq.status === "rejected") {
    return NextResponse.json(
      { error: `Edit request is already ${editReq.status}` },
      { status: 400 }
    );
  }

  await saveEditRequest({
    ...editReq,
    status: "rejected",
    resolvedAt: new Date().toISOString(),
  });

  console.log(`[edit-request/reject] rejected id=${id}`);

  return NextResponse.json({ success: true });
}
