/**
 * app/api/admin/edit-requests/[id]/reject/route.ts
 * POST /api/admin/edit-requests/:id/reject
 *
 * Admin rejects a pending edit request. Transitions the row to `rejected`,
 * stores the reason, and emails the owner with the explanation.
 *
 * Body: { reason: string }   — non-empty; used as the rejection message
 * Returns: { ok: true }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminEmail, isAdminSession } from "@/lib/admin";
import { getEditRequest, saveEditRequest } from "@/lib/edit-requests-store";
import { getTenant } from "@/lib/tenant-store";
import { sendEmail } from "@/lib/resend-client";
import { verifyApprovalToken } from "@/lib/edit-request-tokens";
import type { MutableCookies } from "@/lib/session";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

const MIN_REASON_LEN = 3;
const MAX_REASON_LEN = 1000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Same dual-auth model as the approve endpoint: admin session, or a
  // signed token whose payload matches this route param.
  const cookieStore = (await cookies()) as unknown as MutableCookies;
  const authOutcome = await authoriseRejection(request, cookieStore, id);
  if (!authOutcome.ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { reason?: unknown };
  try {
    body = (await request.json()) as { reason?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const reason =
    typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < MIN_REASON_LEN) {
    return NextResponse.json(
      { error: "Rejection reason is required." },
      { status: 400 },
    );
  }
  if (reason.length > MAX_REASON_LEN) {
    return NextResponse.json(
      { error: `Reason is too long (max ${MAX_REASON_LEN} chars).` },
      { status: 400 },
    );
  }

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

  const tenant = await getTenant(editReq.tenantId);

  const now = new Date().toISOString();
  await saveEditRequest({
    ...editReq,
    status: "rejected",
    rejectedAt: now,
    rejectReason: reason,
    approvedBy: authOutcome.actor,
    resolvedAt: now,
  });

  // Best-effort notification to the owner. Non-fatal if it flops — the
  // state transition is what matters; admin can always resend.
  if (tenant?.ownerEmail) {
    try {
      await sendEmail({
        to: tenant.ownerEmail,
        subject: `Your change request for ${tenant.name}`,
        html: renderRejectHtml({
          businessName: tenant.name,
          request: editReq.request,
          reason,
        }),
        text: renderRejectText({
          businessName: tenant.name,
          request: editReq.request,
          reason,
        }),
      });
    } catch (err) {
      console.error(`[reject] owner email failed for ${id}:`, err);
    }
  }

  console.log(
    `[reject] editRequest ${id} rejected by ${authOutcome.actor}`,
  );

  return NextResponse.json({ ok: true });
}

/* ------------------------------------------------------------- auth helper */

type AuthResult =
  | { ok: true; actor: string }
  | { ok: false };

async function authoriseRejection(
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
      // Fall through.
    }
  }
  return { ok: false };
}

/* ---------------------------------------------------------------- email */

interface RejectContent {
  businessName: string;
  request: string;
  reason: string;
}

function renderRejectHtml(c: RejectContent): string {
  return `<!doctype html>
<html lang="en">
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0A0F1E;color:#fff;padding:32px;">
    <div style="max-width:520px;margin:0 auto;background:#111827;padding:32px;border-radius:16px;">
      <h1 style="font-size:20px;margin:0 0 16px;">About your change request</h1>
      <p style="color:rgba(255,255,255,0.7);line-height:1.55;margin:0 0 20px;">
        Thanks for the request on <strong>${escapeHtml(c.businessName)}</strong>.
        We weren&rsquo;t able to apply it &mdash; here&rsquo;s why:
      </p>
      <blockquote style="border-left:3px solid #60a5fa;padding:12px 16px;background:rgba(96,165,250,0.08);margin:0 0 20px;color:#fff;line-height:1.5;">
        ${escapeHtml(c.reason)}
      </blockquote>
      <p style="color:rgba(255,255,255,0.55);font-size:14px;line-height:1.55;margin:0 0 8px;">
        Your original request, for reference:
      </p>
      <p style="color:rgba(255,255,255,0.75);font-size:14px;line-height:1.5;margin:0 0 24px;white-space:pre-line;">
        ${escapeHtml(c.request)}
      </p>
      <p style="color:rgba(255,255,255,0.55);font-size:14px;line-height:1.5;margin:0;">
        Reply to this email if you&rsquo;d like to rework the request and we&rsquo;ll take another look.
      </p>
    </div>
    <p style="text-align:center;color:rgba(255,255,255,0.3);font-size:12px;margin-top:16px;">launcharoo.online</p>
  </body>
</html>`;
}

function renderRejectText(c: RejectContent): string {
  return `About your change request

Thanks for the request on ${c.businessName}. We weren't able to apply it. Here's why:

${c.reason}

Your original request:
${c.request}

Reply to this email if you'd like to rework the request and we'll take another look.

— Launcharoo`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
