/**
 * app/api/tenants/[tenantId]/domain-help/route.ts
 * POST — owner asks for hands-on help with domain setup.
 *
 * Non-technical owners stall at "log in to your registrar and change
 * nameservers". This endpoint lets them submit a short "what's going on"
 * message from the Custom Domain card and lands it in the concierge inbox
 * with enough context (tenant name, owner email, domain in progress) that
 * the founder can reply straight away.
 *
 * Body: { message?: string }
 * Returns: { ok: true }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTenant } from "@/lib/tenant-store";
import { assertOwnsTenant, type MutableCookies } from "@/lib/session";
import { applyRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/resend-client";

export const runtime = "nodejs";

const CONCIERGE_INBOX =
  process.env.EDIT_REQUEST_INBOX ?? "hello@launcharoo.online";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  const { tenantId } = await params;

  const cookieStore = (await cookies()) as unknown as MutableCookies;
  try {
    await assertOwnsTenant(cookieStore, tenantId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "not allowed" },
      { status: 403 },
    );
  }

  const limited = await applyRateLimit({
    key: `domain-help:tenant:${tenantId}`,
    limit: 3,
    windowSeconds: 3600,
  });
  if (limited) return limited;

  let body: { message?: unknown };
  try {
    body = (await request.json()) as { message?: unknown };
  } catch {
    body = {};
  }
  const message =
    typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";

  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const receivedAt = new Date().toISOString();
  console.log(
    `[domain-help] request tenant=${tenantId} owner=${tenant.ownerEmail ?? "(unclaimed)"} domain=${tenant.customDomain ?? "(none)"} status=${tenant.customDomainStatus ?? "(none)"}`,
  );

  try {
    await sendEmail({
      to: CONCIERGE_INBOX,
      subject: `Domain setup help — ${tenant.name}`,
      html: buildHtml({
        tenantName: tenant.name,
        tenantId,
        ownerEmail: tenant.ownerEmail,
        customDomain: tenant.customDomain,
        customDomainStatus: tenant.customDomainStatus,
        message,
        receivedAt,
      }),
      text: buildText({
        tenantName: tenant.name,
        tenantId,
        ownerEmail: tenant.ownerEmail,
        customDomain: tenant.customDomain,
        customDomainStatus: tenant.customDomainStatus,
        message,
        receivedAt,
      }),
    });
  } catch (err) {
    console.error(`[domain-help] send failed tenant=${tenantId}:`, err);
    return NextResponse.json(
      { error: "Couldn't send your request — try again in a minute." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

/* ------------------------------------------------------------ email helpers */

interface HelpEmailInput {
  tenantName: string;
  tenantId: string;
  ownerEmail?: string;
  customDomain?: string;
  customDomainStatus?: string;
  message: string;
  receivedAt: string;
}

function buildHtml(i: HelpEmailInput): string {
  const owner = i.ownerEmail
    ? `<a href="mailto:${escapeAttr(i.ownerEmail)}">${escapeText(i.ownerEmail)}</a>`
    : "(not claimed yet)";
  const messageBlock = i.message
    ? `<p style="margin:16px 0 8px"><strong>Their message:</strong></p>
       <blockquote style="margin:0;padding:12px 16px;border-left:3px solid #3b82f6;background:#f8fafc;white-space:pre-wrap">${escapeText(i.message)}</blockquote>`
    : `<p style="margin:16px 0;color:#6b7280;font-style:italic">No message — they just hit "send" to say they need a hand.</p>`;
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px">
    <h2 style="margin:0 0 12px">Domain setup help requested</h2>
    <p style="margin:0 0 8px"><strong>Business:</strong> ${escapeText(i.tenantName)}</p>
    <p style="margin:0 0 8px"><strong>Owner:</strong> ${owner}</p>
    <p style="margin:0 0 8px"><strong>Domain:</strong> ${escapeText(i.customDomain ?? "(not entered yet)")}</p>
    <p style="margin:0 0 8px"><strong>Status:</strong> ${escapeText(i.customDomainStatus ?? "(none)")}</p>
    <p style="margin:0 0 8px"><strong>Received:</strong> ${escapeText(new Date(i.receivedAt).toLocaleString("en-AU"))}</p>
    ${messageBlock}
    <p style="margin:16px 0 8px">Reply to this email to reach the owner directly — the reply-to is set to their address.</p>
    <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
    <p style="color:#6b7280;font-size:12px;margin:0">Tenant ID: ${escapeText(i.tenantId)}</p>
  </div>`;
}

function buildText(i: HelpEmailInput): string {
  const messagePart = i.message
    ? `\nTheir message:\n${i.message}\n`
    : `\nNo message — they just hit "send" to say they need a hand.\n`;
  return `Domain setup help requested

Business: ${i.tenantName}
Owner: ${i.ownerEmail ?? "(not claimed yet)"}
Domain: ${i.customDomain ?? "(not entered yet)"}
Status: ${i.customDomainStatus ?? "(none)"}
Received: ${new Date(i.receivedAt).toLocaleString("en-AU")}
${messagePart}
Tenant ID: ${i.tenantId}
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
