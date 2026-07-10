/**
 * app/api/admin/edit-requests/[id]/approve/route.ts
 * POST /api/admin/edit-requests/:id/approve
 *
 * Admin approves a pending edit request. Transitions the row to `approved`,
 * records who approved it + an optional context note, and fires the signed
 * n8n webhook. The n8n workflow picks it up, runs claude, and calls back
 * into /apply-patches (Phase 4) to persist the change.
 *
 * If the webhook is unset (N8N_APPROVE_WEBHOOK_URL blank), the row still
 * moves to `approved` — treat that as "queued for manual pickup".
 *
 * Body: { adminNote?: string }
 * Returns: { ok: true, webhook: "sent" | "skipped" | "failed" }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminEmail, isAdminSession } from "@/lib/admin";
import { getEditRequest, saveEditRequest } from "@/lib/edit-requests-store";
import { fireApproveWebhook } from "@/lib/n8n-edit-webhook";
import type { MutableCookies } from "@/lib/session";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const cookieStore = (await cookies()) as unknown as MutableCookies;
  const admin = await isAdminSession(cookieStore);
  // 404 (not 403) so an attacker probing for admin endpoints can't distinguish
  // "wrong auth" from "wrong URL".
  if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { adminNote?: unknown };
  try {
    body = (await request.json()) as { adminNote?: unknown };
  } catch {
    body = {};
  }
  const adminNote =
    typeof body.adminNote === "string" && body.adminNote.trim().length > 0
      ? body.adminNote.trim()
      : undefined;

  const editReq = await getEditRequest(id);
  if (!editReq) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (editReq.status !== "pending") {
    return NextResponse.json(
      { error: `Already ${editReq.status}` },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  await saveEditRequest({
    ...editReq,
    status: "approved",
    approvedAt: now,
    approvedBy: adminEmail() ?? undefined,
    adminNote,
  });

  const webhook = await fireApproveWebhook({ editRequestId: id });
  const webhookOutcome = !webhook.ok && webhook.reason === "webhook_url_unset"
    ? "skipped"
    : webhook.ok
    ? "sent"
    : "failed";

  console.log(
    `[approve] editRequest ${id} approved by ${adminEmail() ?? "?"} — webhook ${webhookOutcome}${webhook.reason ? ` (${webhook.reason})` : ""}`,
  );

  return NextResponse.json({
    ok: true,
    webhook: webhookOutcome,
    // Surfaced only for admin routes so the caller can debug env / n8n
    // problems without digging through Vercel logs.
    ...(webhook.reason ? { webhookReason: webhook.reason } : {}),
  });
}
