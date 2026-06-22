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
import { saveEditRequest } from "@/lib/edit-requests-store";
import { applyEditRequest } from "@/lib/edit-engine";

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

  const id = crypto.randomUUID();
  const trimmedRequest = requestText.trim();

  // Step 1: save as pending
  saveEditRequest({
    id,
    tenantId,
    request: trimmedRequest,
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  // Step 2: mark as processing
  saveEditRequest({
    id,
    tenantId,
    request: trimmedRequest,
    status: "processing",
    createdAt: new Date().toISOString(),
  });

  console.log(`[edit-request] processing id=${id} for tenant=${tenantId}`);

  try {
    // Step 3: run the mutation engine
    const { proposedSiteProps, changeSummary } = await applyEditRequest(
      tenantId,
      trimmedRequest
    );

    // Step 4: save as preview
    saveEditRequest({
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

    saveEditRequest({
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
