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

export const runtime = "nodejs";

const VALID_SOURCES: LeadSource[] = ["contact-form", "call-click", "email-click"];

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

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
    saveLead(lead);
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

  return NextResponse.json({ id: lead.id, success: true });
}
