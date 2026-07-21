/**
 * app/api/tenants/[tenantId]/notify-preview-ready/route.ts
 * POST /api/tenants/:tenantId/notify-preview-ready
 *
 * n8n's Generate Real workflow calls this after PATCHing site_props onto
 * the tenant row, i.e. the moment the customer's preview is renderable.
 * We SMS the phone number captured at intake with the preview link.
 *
 * Auth: HMAC over the exact request body — same shared secret as the
 * edit-request workflow (EDIT_WORKFLOW_HMAC_SECRET). One less env var
 * for the founder to rotate, and both callers are the same n8n instance.
 *
 * Idempotent: if `preview_notified_at` is already set on the tenant row,
 * we return `{ ok: true, already: true }` without sending again. So an
 * n8n retry after a transient network failure never double-SMS's the
 * customer.
 *
 * Body: empty object `{}` — everything the endpoint needs is on the row.
 *   (The empty body is still HMAC'd so signature verification runs.)
 * Returns: { ok, sent, already?, reason? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenant, saveTenant } from "@/lib/tenant-store";
import { verifyInboundSignature } from "@/lib/n8n-edit-webhook";
import { sendSms } from "@/lib/clicksend-client";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_ORIGIN?.trim() || "https://launcharoo.online";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  const { tenantId } = await params;
  if (!UUID_RE.test(tenantId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rawBody = await request.text();
  const sig = request.headers.get("x-launcharoo-signature");
  const verify = verifyInboundSignature(sig, rawBody);
  if (!verify.ok) {
    console.warn(
      `[notify-preview-ready] rejected tenant ${tenantId}: ${verify.reason ?? "unknown"}`,
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (tenant.previewNotifiedAt) {
    console.log(
      `[notify-preview-ready] tenant ${tenantId} already notified at ${tenant.previewNotifiedAt} — skip`,
    );
    return NextResponse.json({ ok: true, sent: false, already: true });
  }

  if (!tenant.phone) {
    console.warn(
      `[notify-preview-ready] tenant ${tenantId} has no phone — skipping SMS`,
    );
    return NextResponse.json({
      ok: true,
      sent: false,
      reason: "no_phone",
    });
  }

  const previewUrl = `${APP_ORIGIN}/preview/${tenant.id}`;
  const businessName = tenant.name?.trim() || "your business";
  const body = `Your Launcharoo preview for ${businessName} is ready: ${previewUrl} — Reply STOP to opt out.`;

  const result = await sendSms({ to: tenant.phone, body });
  if (!result.ok) {
    console.error(
      `[notify-preview-ready] SMS failed for tenant ${tenantId}: ${result.reason ?? "unknown"}`,
    );
    // 200, not 5xx, so n8n doesn't retry-loop. Founder will see the row
    // still has null preview_notified_at and can resend manually later.
    return NextResponse.json({
      ok: false,
      sent: false,
      reason: result.reason ?? "send_failed",
    });
  }

  const notifiedAt = new Date().toISOString();
  await saveTenant({ ...tenant, previewNotifiedAt: notifiedAt });

  console.log(
    `[notify-preview-ready] tenant ${tenantId} → SMS ${result.messageId ?? "(no id)"}, notifiedAt=${notifiedAt}`,
  );
  return NextResponse.json({ ok: true, sent: true, messageId: result.messageId });
}
