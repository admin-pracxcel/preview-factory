/**
 * app/api/marketing-intake/route.ts
 * POST /api/marketing-intake
 *
 * Server-side proxy for the marketing-landing NicheForm. Previously the
 * form POSTed straight to n8n using NEXT_PUBLIC_N8N_WEBHOOK_URL, which
 * exposed the webhook URL in the client bundle — anyone viewing source
 * could farm it. Now the browser POSTs here, we validate + rate-limit,
 * then forward from the server using the private N8N_MARKETING_WEBHOOK_URL.
 *
 * NOT to be confused with /api/intake — that's the async generation
 * pipeline (creates tenants, enqueues generator jobs). This endpoint is
 * a lightweight "someone filled the marketing form" ping.
 *
 * Body: { lead_id, business_name, niche, category, suburb, timestamp? }
 * Returns: { ok: true, forwarded: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

interface MarketingPayload {
  lead_id?: unknown;
  business_name?: unknown;
  niche?: unknown;
  category?: unknown;
  suburb?: unknown;
  timestamp?: unknown;
}

function stringField(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > max) return null;
  return t;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 5 marketing submissions per hour per IP. Real users submit once
  // ever; 5 gives room for typo retries without opening a bot farm.
  const limited = await applyRateLimit({
    key: `marketing-intake:ip:${clientIp(request)}`,
    limit: 5,
    windowSeconds: 3600,
  });
  if (limited) return limited;

  let body: MarketingPayload;
  try {
    body = (await request.json()) as MarketingPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Strict field validation — server trusts nothing from the browser.
  const leadId = stringField(body.lead_id, 64);
  const businessName = stringField(body.business_name, 200);
  const niche = stringField(body.niche, 100);
  const category = stringField(body.category, 100);
  const suburb = stringField(body.suburb, 100);
  const timestamp = stringField(body.timestamp, 64);
  if (!leadId || !businessName || !niche || !category || !suburb) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const payload = {
    lead_id: leadId,
    business_name: businessName,
    niche,
    category,
    suburb,
    timestamp: timestamp ?? new Date().toISOString(),
  };

  // Prefer a dedicated marketing webhook URL; fall back to the general
  // one so existing single-webhook setups keep working.
  const webhookUrl =
    process.env.N8N_MARKETING_WEBHOOK_URL ?? process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("[marketing-intake] no webhook configured — payload:", payload);
    return NextResponse.json({ ok: true, forwarded: false });
  }

  // Fire and don't block navigation. The browser navigates to /building
  // immediately after this returns; n8n handles the async pickup.
  fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err: unknown) =>
    console.error("[marketing-intake] n8n forward failed:", err),
  );

  return NextResponse.json({ ok: true, forwarded: true });
}
