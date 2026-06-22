/**
 * app/api/edit-request/route.ts
 * POST /api/edit-request
 *
 * Phase K: receives a plain-English edit request and stores it as "pending".
 * Phase L: adds the mutation engine — processes pending requests via Claude,
 *          mutates SiteProps, validates schema, queues for owner approval.
 *
 * Body: { tenantId: string, request: string }
 * Returns: { id: string, status: "pending" }
 */

import { NextRequest, NextResponse } from "next/server";
import { saveEditRequest } from "@/lib/edit-requests-store";

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
  saveEditRequest({
    id,
    tenantId,
    request: requestText.trim(),
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  console.log(`[edit-request] stored id=${id} for tenant=${tenantId}`);

  return NextResponse.json({ id, status: "pending" });
}
