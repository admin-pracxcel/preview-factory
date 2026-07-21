/**
 * app/api/admin/edit-requests/[id]/retry/route.ts
 * POST /api/admin/edit-requests/:id/retry
 *
 * Admin re-runs a failed edit request with additional context so Claude has
 * more to go on the second time. Flow:
 *   1. Require admin session (no token path — retries are always from the
 *      admin dashboard, never from a stale concierge email).
 *   2. Only allowed when status === "failed".
 *   3. Body: { adminNote: string }. The new context is APPENDED to the
 *      existing adminNote — Claude sees the full history (original note +
 *      each retry's context) so it can course-correct.
 *   4. Clear `error`, flip status back to `approved`, refresh `approvedAt`,
 *      and refire the signed n8n webhook — same path as the initial approve.
 *
 * Returns: { ok: true, webhook: "sent" | "skipped" | "failed" }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";
import { adminEmail, isAdminSession } from "@/lib/admin";
import { getEditRequest, saveEditRequest } from "@/lib/edit-requests-store";
import { fireApproveWebhook } from "@/lib/n8n-edit-webhook";
import type { MutableCookies } from "@/lib/session";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NOTE_LENGTH = 2000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cookieStore = (await nextCookies()) as unknown as MutableCookies;
  if (!(await isAdminSession(cookieStore))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { adminNote?: unknown };
  try {
    body = (await request.json()) as { adminNote?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const newContext =
    typeof body.adminNote === "string" && body.adminNote.trim().length > 0
      ? body.adminNote.trim().slice(0, MAX_NOTE_LENGTH)
      : null;
  if (!newContext) {
    return NextResponse.json(
      { error: "adminNote is required — add context so Claude knows what changed" },
      { status: 400 },
    );
  }

  const editReq = await getEditRequest(id);
  if (!editReq) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (editReq.status !== "failed") {
    return NextResponse.json(
      { error: `Cannot retry from status ${editReq.status} — only failed rows can be retried` },
      { status: 409 },
    );
  }

  // Append the new context to the accumulated adminNote so Claude sees the
  // full history on this attempt. The divider is a plain string; the prompt
  // template renders adminNote verbatim.
  const attemptNumber = countRetries(editReq.adminNote) + 1;
  const divider = editReq.adminNote
    ? `${editReq.adminNote}\n\n--- retry ${attemptNumber} ---\n`
    : `--- retry ${attemptNumber} ---\n`;
  const nextAdminNote = `${divider}${newContext}`;

  const approver = adminEmail() ?? "admin";
  const now = new Date().toISOString();
  await saveEditRequest({
    ...editReq,
    status: "approved",
    approvedAt: now,
    approvedBy: approver,
    adminNote: nextAdminNote,
    error: undefined,
    resolvedAt: undefined,
    changeSummary: undefined,
  });

  const webhook = await fireApproveWebhook({ editRequestId: id });
  const webhookOutcome = !webhook.ok && webhook.reason === "webhook_url_unset"
    ? "skipped"
    : webhook.ok
    ? "sent"
    : "failed";

  console.log(
    `[retry] editRequest ${id} retry #${attemptNumber} by ${approver} — webhook ${webhookOutcome}${webhook.reason ? ` (${webhook.reason})` : ""}`,
  );

  return NextResponse.json({
    ok: true,
    webhook: webhookOutcome,
    attempt: attemptNumber,
    ...(webhook.reason ? { webhookReason: webhook.reason } : {}),
  });
}

function countRetries(adminNote: string | undefined): number {
  if (!adminNote) return 0;
  const matches = adminNote.match(/--- retry \d+ ---/g);
  return matches ? matches.length : 0;
}
