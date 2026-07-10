/**
 * app/api/admin/edit-requests/[id]/context/route.ts
 * GET /api/admin/edit-requests/:id/context
 *
 * Called by the n8n workflow after it receives an approve webhook.
 * Returns everything needed to run claude:
 *   - the tenant's current siteProps
 *   - the owner's request text
 *   - the admin note (optional)
 *   - the ready-to-pipe prompt string
 *
 * Auth: HMAC-signed like /apply-patches (EDIT_WORKFLOW_HMAC_SECRET,
 * X-Launcharoo-Signature: t=…,v1=…). GETs sign an empty body — the
 * signature protects the ID in the URL.
 *
 * Returns 401 if the signature is missing / bad, 404 if the row or
 * tenant doesn't exist, 409 if the request is no longer in the right
 * state to be worked on.
 */

import { NextRequest, NextResponse } from "next/server";
import { getEditRequest } from "@/lib/edit-requests-store";
import { getTenant } from "@/lib/tenant-store";
import { verifyInboundSignature } from "@/lib/n8n-edit-webhook";
import { buildEditPrompt } from "@/lib/edit-prompt";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Signature is computed over an empty string body — the ID in the URL
  // is what needs protecting.
  const verify = verifyInboundSignature(
    request.headers.get("x-launcharoo-signature"),
    "",
  );
  if (!verify.ok) {
    console.warn(
      `[context] rejected editRequest ${id}: ${verify.reason ?? "unknown"}`,
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const editReq = await getEditRequest(id);
  if (!editReq) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (editReq.status !== "approved" && editReq.status !== "processing") {
    return NextResponse.json(
      { error: `Cannot fetch context in status ${editReq.status}` },
      { status: 409 },
    );
  }

  const tenant = await getTenant(editReq.tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant missing" }, { status: 404 });
  }
  if (!tenant.siteProps) {
    return NextResponse.json(
      { error: "Tenant not ready" },
      { status: 409 },
    );
  }

  const prompt = buildEditPrompt({
    siteProps: tenant.siteProps,
    request: editReq.request,
    adminNote: editReq.adminNote,
  });

  return NextResponse.json({
    editRequestId: editReq.id,
    tenantId: tenant.id,
    tenantName: tenant.name,
    request: editReq.request,
    adminNote: editReq.adminNote ?? null,
    // Not shipping siteProps separately — it's baked into `prompt`. Ship
    // it too if the n8n workflow ever needs it for anything else.
    prompt,
  });
}
