/**
 * app/api/edit-request/route.ts
 * POST /api/edit-request
 *
 * Receives a plain-English edit request from the owner dashboard and:
 *   1. Saves it with status="pending"
 *   2. Emails the concierge inbox (hello@launcharoo.online) so a human can action it
 *   3. Returns immediately with a friendly success payload
 *
 * The admin marks it applied later via /admin/edit-requests, which triggers the
 * customer notification email.
 *
 * Body: { tenantId: string, request: string }
 * Returns: { id, status: "pending" }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { saveEditRequest } from "@/lib/edit-requests-store";
import { assertOwnsTenant, type MutableCookies } from "@/lib/session";
import { applyRateLimit } from "@/lib/rate-limit";
import { getTenant } from "@/lib/tenant-store";
import { sendEmail } from "@/lib/resend-client";
import { signApprovalToken } from "@/lib/edit-request-tokens";

export const runtime = "nodejs";

const CONCIERGE_INBOX =
  process.env.EDIT_REQUEST_INBOX ?? "hello@launcharoo.online";

const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_ORIGIN?.trim() || "https://launcharoo.online";

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

  // Human concierge caps at 10/tenant/day. Enough for legitimate iteration,
  // tight enough that a compromised session can't flood the inbox overnight.
  const limited = await applyRateLimit({
    key: `edit-request:tenant:${tenantId}`,
    limit: 10,
    windowSeconds: 86_400,
  });
  if (limited) return limited;

  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const id = crypto.randomUUID();
  const trimmedRequest = requestText.trim();
  const createdAt = new Date().toISOString();

  await saveEditRequest({
    id,
    tenantId,
    request: trimmedRequest,
    status: "pending",
    createdAt,
  });

  console.log(`[edit-request] queued id=${id} tenant=${tenantId} for concierge review`);

  // Sign a review token that unlocks the admin page + approve/reject
  // endpoints without a session. 7-day TTL; the state machine handles
  // single-use (post-approve status is no longer "pending"). If signing
  // fails (env misconfig), fall back to a plain link — the recipient can
  // still open the admin page via session auth.
  let reviewUrl = `${APP_ORIGIN}/admin/edit-requests/${id}`;
  try {
    const token = signApprovalToken(id);
    reviewUrl += `?token=${encodeURIComponent(token)}`;
  } catch (err) {
    console.error(
      `[edit-request] token sign failed for ${id}, falling back to plain link:`,
      err,
    );
  }

  // Fire the concierge notification. If sending fails we still return success
  // — the row is saved and visible in the admin queue, and the founder can
  // reconcile from there. Blocking the owner's request on Resend's uptime
  // would be worse UX than eventual consistency.
  try {
    await sendEmail({
      to: CONCIERGE_INBOX,
      subject: `New change request — ${tenant.name}`,
      html: buildConciergeEmailHtml({
        tenantName: tenant.name,
        tenantId,
        ownerEmail: tenant.ownerEmail,
        requestText: trimmedRequest,
        createdAt,
        reviewUrl,
      }),
      text: buildConciergeEmailText({
        tenantName: tenant.name,
        tenantId,
        ownerEmail: tenant.ownerEmail,
        requestText: trimmedRequest,
        createdAt,
        reviewUrl,
      }),
    });
  } catch (err) {
    console.error(`[edit-request] concierge email failed id=${id}:`, err);
  }

  return NextResponse.json({ id, status: "pending" });
}

/* ------------------------------------------------------------ email helpers */

interface ConciergeEmailInput {
  tenantName: string;
  tenantId: string;
  ownerEmail?: string;
  requestText: string;
  createdAt: string;
  reviewUrl: string;
}

function buildConciergeEmailHtml(input: ConciergeEmailInput): string {
  const owner = input.ownerEmail
    ? `<a href="mailto:${escapeAttr(input.ownerEmail)}">${escapeText(input.ownerEmail)}</a>`
    : "(not claimed yet)";
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px">
    <h2 style="margin:0 0 12px">New change request</h2>
    <p style="margin:0 0 8px"><strong>Business:</strong> ${escapeText(input.tenantName)}</p>
    <p style="margin:0 0 8px"><strong>Owner:</strong> ${owner}</p>
    <p style="margin:0 0 8px"><strong>Received:</strong> ${escapeText(new Date(input.createdAt).toLocaleString("en-AU"))}</p>
    <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #3b82f6;background:#f8fafc;white-space:pre-wrap">${escapeText(input.requestText)}</blockquote>
    <p style="margin:24px 0 12px">
      <a href="${escapeAttr(input.reviewUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px">Review this request</a>
    </p>
    <p style="color:#6b7280;font-size:12px;margin:16px 0 0">Link expires in 7 days.</p>
    <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
    <p style="color:#6b7280;font-size:12px;margin:0">Tenant ID: ${escapeText(input.tenantId)}</p>
  </div>`;
}

function buildConciergeEmailText(input: ConciergeEmailInput): string {
  return `New change request

Business: ${input.tenantName}
Owner: ${input.ownerEmail ?? "(not claimed yet)"}
Received: ${new Date(input.createdAt).toLocaleString("en-AU")}

${input.requestText}

Review this request: ${input.reviewUrl}
(Link expires in 7 days.)

Tenant ID: ${input.tenantId}
`;
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;");
}
