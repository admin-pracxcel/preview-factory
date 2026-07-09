/**
 * app/api/leads/route.ts
 * POST /api/leads
 *
 * Captures a lead from a site contact form or call-click event.
 *
 * Body (all optional except source): {
 *   tenantId?: string    — which site the lead came from
 *   name?: string        — submitter's name
 *   phone?: string       — phone number
 *   email?: string       — email address
 *   message?: string     — free-text enquiry
 *   source: "contact-form" | "call-click" | "email-click"
 *   page?: string        — URL path the lead was captured from
 * }
 *
 * Returns: { id: string, success: true }
 *
 * n8n notify:
 *   Set N8N_LEAD_WEBHOOK_URL to the n8n webhook trigger URL. If not set,
 *   lead is logged to console only (dev mode).
 *   See strategy/_master/n8n-workflows/02-lead-notification.json.
 *
 * Human deploy note: set N8N_LEAD_WEBHOOK_URL in your Vercel env vars.
 */

import { NextRequest, NextResponse } from "next/server";
import { saveLead, type LeadRecord, type LeadSource } from "@/lib/leads-store";
import { applyRateLimit, clientIp } from "@/lib/rate-limit";
import { getTenant, type TenantRecord } from "@/lib/tenant-store";
import { sendEmail } from "@/lib/resend-client";

export const runtime = "nodejs";

const VALID_SOURCES: LeadSource[] = ["contact-form", "call-click", "email-click"];

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tenantIdForKey = typeof body.tenantId === "string" ? body.tenantId : "notenant";
  const limited = await applyRateLimit({
    key: `leads:ip:${clientIp(request)}:tenant:${tenantIdForKey}`,
    limit: 10,
    windowSeconds: 60,
  });
  if (limited) return limited;

  const source: LeadSource =
    VALID_SOURCES.includes(body.source as LeadSource)
      ? (body.source as LeadSource)
      : "contact-form";

  const lead: LeadRecord = {
    id: crypto.randomUUID(),
    tenantId: typeof body.tenantId === "string" ? body.tenantId : undefined,
    name: typeof body.name === "string" ? body.name.trim() || undefined : undefined,
    phone: typeof body.phone === "string" ? body.phone.trim() || undefined : undefined,
    email:
      typeof body.email === "string"
        ? body.email.trim().toLowerCase() || undefined
        : undefined,
    message:
      typeof body.message === "string" ? body.message.trim() || undefined : undefined,
    source,
    page: typeof body.page === "string" ? body.page : undefined,
    createdAt: new Date().toISOString(),
  };

  try {
    await saveLead(lead);
  } catch (err) {
    console.error("[leads] save error:", err);
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
  }

  // Fire n8n webhook — fire-and-forget, never blocks the response
  const webhookUrl = process.env.N8N_LEAD_WEBHOOK_URL;
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    }).catch((err: unknown) =>
      console.error("[leads] n8n webhook error:", err)
    );
  } else {
    console.log("[leads] captured (N8N_LEAD_WEBHOOK_URL not set):", {
      id: lead.id,
      source: lead.source,
      tenantId: lead.tenantId,
      name: lead.name,
      phone: lead.phone,
    });
  }

  // Notify the tenant owner — fire-and-forget so a slow Resend response
  // doesn't stall the customer's form submission.
  if (lead.tenantId) {
    void notifyOwnerOfLead(lead).catch((err) =>
      console.error(`[leads] owner notify failed lead=${lead.id}:`, err),
    );
  }

  return NextResponse.json({ id: lead.id, success: true });
}

/* ------------------------------------------------------ owner notification */

async function notifyOwnerOfLead(lead: LeadRecord): Promise<void> {
  if (!lead.tenantId) return;

  const tenant = await getTenant(lead.tenantId);
  if (!tenant?.ownerEmail) {
    console.log(
      `[leads] no ownerEmail for tenant=${lead.tenantId} — skipping notification`,
    );
    return;
  }

  await sendEmail({
    to: tenant.ownerEmail,
    subject: buildSubject(tenant, lead),
    html: buildOwnerHtml(tenant, lead),
    text: buildOwnerText(tenant, lead),
  });
}

function buildSubject(tenant: TenantRecord, lead: LeadRecord): string {
  const who = lead.name ?? "someone";
  if (lead.source === "call-click") {
    return `${who} just tapped your phone number — ${tenant.name}`;
  }
  return `New enquiry from ${who} — ${tenant.name}`;
}

function sourceLabel(source: LeadSource): string {
  if (source === "call-click") return "Phone tap";
  if (source === "email-click") return "Email click";
  return "Enquiry form";
}

function buildOwnerHtml(tenant: TenantRecord, lead: LeadRecord): string {
  const rows: string[] = [];
  if (lead.name) rows.push(row("Name", lead.name));
  if (lead.phone) rows.push(row("Phone", lead.phone, `tel:${lead.phone}`));
  if (lead.email) rows.push(row("Email", lead.email, `mailto:${lead.email}`));
  rows.push(row("Type", sourceLabel(lead.source)));
  if (lead.page) rows.push(row("Page", lead.page));
  rows.push(row("Received", new Date(lead.createdAt).toLocaleString("en-AU")));

  const messageBlock = lead.message
    ? `<p style="margin:16px 0 8px"><strong>Message:</strong></p>
       <blockquote style="margin:0;padding:12px 16px;border-left:3px solid #3b82f6;background:#f8fafc;white-space:pre-wrap">${escapeText(lead.message)}</blockquote>`
    : "";

  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px">
    <h2 style="margin:0 0 12px">New enquiry for ${escapeText(tenant.name)}</h2>
    <p style="margin:0 0 16px;color:#374151">Reply within a few minutes to win the job — most local searches convert to whoever calls back first.</p>
    <table style="border-collapse:collapse;width:100%">${rows.join("")}</table>
    ${messageBlock}
    <p style="margin:20px 0 8px"><a href="https://launcharoo.online/dashboard/${escapeAttr(tenant.id)}" style="color:#2563eb">See all enquiries in your dashboard</a></p>
    <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
    <p style="color:#6b7280;font-size:12px;margin:0">Launcharoo — hello@launcharoo.online</p>
  </div>`;
}

function row(label: string, value: string, href?: string): string {
  const rendered = href
    ? `<a href="${escapeAttr(href)}" style="color:#2563eb">${escapeText(value)}</a>`
    : escapeText(value);
  return `<tr>
    <td style="padding:6px 12px 6px 0;color:#6b7280;font-size:13px;vertical-align:top;white-space:nowrap">${escapeText(label)}</td>
    <td style="padding:6px 0;color:#111827;font-size:14px">${rendered}</td>
  </tr>`;
}

function buildOwnerText(tenant: TenantRecord, lead: LeadRecord): string {
  const lines: string[] = [`New enquiry for ${tenant.name}`, ""];
  if (lead.name) lines.push(`Name:  ${lead.name}`);
  if (lead.phone) lines.push(`Phone: ${lead.phone}`);
  if (lead.email) lines.push(`Email: ${lead.email}`);
  lines.push(`Type:  ${sourceLabel(lead.source)}`);
  if (lead.page) lines.push(`Page:  ${lead.page}`);
  lines.push(`Time:  ${new Date(lead.createdAt).toLocaleString("en-AU")}`);
  if (lead.message) {
    lines.push("", "Message:", lead.message);
  }
  lines.push(
    "",
    `Dashboard: https://launcharoo.online/dashboard/${tenant.id}`,
    "",
    "— Launcharoo",
  );
  return lines.join("\n");
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
