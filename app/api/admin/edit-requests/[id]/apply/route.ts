/**
 * app/api/admin/edit-requests/[id]/apply/route.ts
 * POST /api/admin/edit-requests/:id/apply
 *
 * Marks a pending edit request as applied and emails the owner. Admin-only.
 *
 * Body: { note?: string }  — optional free-text note appended to the email
 * Returns: { ok: true }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdminSession } from "@/lib/admin";
import { getEditRequest, saveEditRequest } from "@/lib/edit-requests-store";
import { getTenant } from "@/lib/tenant-store";
import { sendEmail } from "@/lib/resend-client";
import type { MutableCookies } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const cookieStore = (await cookies()) as unknown as MutableCookies;
  const admin = await isAdminSession(cookieStore);
  if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id } = await params;

  let body: { note?: unknown };
  try {
    body = (await request.json()) as { note?: unknown };
  } catch {
    body = {};
  }
  const note = typeof body.note === "string" ? body.note.trim() : "";

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
  if (!tenant) {
    return NextResponse.json({ error: "Tenant missing" }, { status: 404 });
  }

  const resolvedAt = new Date().toISOString();
  await saveEditRequest({
    ...editReq,
    status: "applied",
    resolvedAt,
    changeSummary: note || undefined,
  });

  if (tenant.ownerEmail) {
    try {
      await sendEmail({
        to: tenant.ownerEmail,
        subject: "Your Launcharoo changes are live",
        html: buildOwnerHtml({
          tenantName: tenant.name,
          tenantId: tenant.id,
          requestText: editReq.request,
          note,
        }),
        text: buildOwnerText({
          tenantName: tenant.name,
          tenantId: tenant.id,
          requestText: editReq.request,
          note,
        }),
      });
    } catch (err) {
      console.error(`[admin:edit-requests] owner notify failed id=${id}:`, err);
    }
  } else {
    console.warn(
      `[admin:edit-requests] applied id=${id} but tenant has no ownerEmail — no notification sent`,
    );
  }

  return NextResponse.json({ ok: true });
}

/* ------------------------------------------------------------ email helpers */

interface OwnerEmailInput {
  tenantName: string;
  tenantId: string;
  requestText: string;
  note: string;
}

function buildOwnerHtml(input: OwnerEmailInput): string {
  const notePart = input.note
    ? `<p style="margin:16px 0 8px"><strong>A note from us:</strong></p><p style="margin:0 0 8px;white-space:pre-wrap">${escapeText(input.note)}</p>`
    : "";
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px">
    <h2 style="margin:0 0 12px">Your changes are live</h2>
    <p style="margin:0 0 8px">Hi there,</p>
    <p style="margin:0 0 8px">We&rsquo;ve applied the change you requested for <strong>${escapeText(input.tenantName)}</strong>:</p>
    <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #3b82f6;background:#f8fafc;white-space:pre-wrap">${escapeText(input.requestText)}</blockquote>
    ${notePart}
    <p style="margin:16px 0 8px"><a href="https://launcharoo.online/dashboard/${escapeAttr(input.tenantId)}">Open your dashboard</a> to review — and hit reply if anything looks off.</p>
    <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
    <p style="color:#6b7280;font-size:12px;margin:0">Launcharoo — hello@launcharoo.online</p>
  </div>`;
}

function buildOwnerText(input: OwnerEmailInput): string {
  const notePart = input.note ? `\nA note from us:\n${input.note}\n` : "";
  return `Your changes are live

Hi there,

We've applied the change you requested for ${input.tenantName}:

${input.requestText}
${notePart}
Open your dashboard: https://launcharoo.online/dashboard/${input.tenantId}

Reply to this email if anything looks off.

— Launcharoo
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
