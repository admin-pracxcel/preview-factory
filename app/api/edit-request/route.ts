/**
 * app/api/edit-request/route.ts
 * POST /api/edit-request
 *
 * Phase L: receives a plain-English edit request, runs the mutation engine
 * (applyEditRequest), stores the proposed SiteProps for owner review, and
 * returns a previewUrl on success.
 *
 * Body: { tenantId: string, request: string }
 * Returns (success): { id, status: "preview", previewUrl }
 * Returns (error):   { id, status: "error" }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { saveEditRequest } from "@/lib/edit-requests-store";
import { applyEditRequest } from "@/lib/edit-engine";
import { assertOwnsTenant, type MutableCookies } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { tenantId?: string; request?: string };
  try {
    body = (await request.json()) as { tenantId?: string; request?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tenantId, request: requestText } = body;

  if (!tenantId || typeof tenantId !== "string") {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }
  if (!requestText || typeof requestText !== "string" || !requestText.trim()) {
    return NextResponse.json({ error: "request text is required" }, { status: 400 });
  }

  const cookieStore = (await cookies()) as unknown as MutableCookies;
  try {
    await assertOwnsTenant(cookieStore, tenantId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "not allowed" },
      { status: 403 },
    );
  }

  const id = crypto.randomUUID();
  const trimmedRequest = requestText.trim();

  await saveEditRequest({
    id,
    tenantId,
    request: trimmedRequest,
    status: "processing",
    createdAt: new Date().toISOString(),
  });

  console.log(`[edit-request] processing id=${id} for tenant=${tenantId}`);

  try {
    const { proposedSiteProps, changeSummary } = await applyEditRequest(
      tenantId,
      trimmedRequest
    );

    await saveEditRequest({
      id,
      tenantId,
      request: trimmedRequest,
      status: "preview",
      createdAt: new Date().toISOString(),
      changeSummary,
      proposedSiteProps,
    });

    console.log(`[edit-request] preview ready id=${id}`);

    const previewUrl = `/preview/site/${tenantId}?editRequest=${id}`;
    return NextResponse.json({ id, status: "preview", previewUrl });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    const truncated = message.slice(0, 200);

    await saveEditRequest({
      id,
      tenantId,
      request: trimmedRequest,
      status: "error",
      createdAt: new Date().toISOString(),
      changeSummary: truncated,
    });

    console.error(`[edit-request] engine error id=${id}: ${message}`);

    return NextResponse.json({ id, status: "error" });
  }
}
