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
import { verifyApprovalToken } from "@/lib/edit-request-tokens";
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
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Auth: either an admin session, or a valid signed token whose payload
  // matches this route param. The token path lets us action approvals
  // straight from the concierge email without requiring the recipient to
  // already be signed in on that device.
  const cookieStore = (await cookies()) as unknown as MutableCookies;
  const authOutcome = await authoriseApproval(request, cookieStore, id);
  if (!authOutcome.ok) {
    // 404 (not 403) so an attacker probing for admin endpoints can't
    // distinguish "wrong auth" from "wrong URL".
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

  const approver = authOutcome.actor;
  const now = new Date().toISOString();
  await saveEditRequest({
    ...editReq,
    status: "approved",
    approvedAt: now,
    approvedBy: approver,
    adminNote,
  });

  const webhook = await fireApproveWebhook({ editRequestId: id });
  const webhookOutcome = !webhook.ok && webhook.reason === "webhook_url_unset"
    ? "skipped"
    : webhook.ok
    ? "sent"
    : "failed";

  console.log(
    `[approve] editRequest ${id} approved by ${approver} — webhook ${webhookOutcome}${webhook.reason ? ` (${webhook.reason})` : ""}`,
  );

  return NextResponse.json({
    ok: true,
    webhook: webhookOutcome,
    // Surfaced only for admin routes so the caller can debug env / n8n
    // problems without digging through Vercel logs.
    ...(webhook.reason ? { webhookReason: webhook.reason } : {}),
  });
}

/* ------------------------------------------------------------- auth helper */

type AuthResult =
  | { ok: true; actor: string }
  | { ok: false };

/**
 * Accept EITHER a valid admin session OR a valid signed token in ?token=
 * whose payload matches this route's edit request id. `actor` is what we
 * store on `approved_by` for the audit trail — the admin email if session
 * auth, or "email-token" if the token path was used.
 */
async function authoriseApproval(
  request: NextRequest,
  cookieStore: MutableCookies,
  editRequestId: string,
): Promise<AuthResult> {
  if (await isAdminSession(cookieStore)) {
    return { ok: true, actor: adminEmail() ?? "admin" };
  }
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (token) {
    try {
      const verified = verifyApprovalToken(token);
      if (verified.editRequestId === editRequestId) {
        return { ok: true, actor: "email-token" };
      }
    } catch {
      // Fall through to "not authorised".
    }
  }
  return { ok: false };
}
