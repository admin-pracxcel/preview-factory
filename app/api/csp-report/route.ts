/**
 * POST /api/csp-report
 *
 * Receives Content-Security-Policy violation reports and forwards them
 * to Sentry so they show up alongside other errors. Filter by tag
 * `source:csp` in the Sentry UI.
 *
 * Two body formats to handle:
 *   1. Legacy `report-uri` — Content-Type: application/csp-report,
 *      wrapped in { "csp-report": { ... } }
 *   2. Modern `report-to` — Content-Type: application/reports+json, an
 *      array of { type: "csp-violation", body: { ... } }
 *
 * We accept both because browsers vary. The interesting fields
 * (blocked-uri, violated-directive, document-uri) live in the body
 * regardless.
 *
 * Rate-limited via `applyRateLimit` — a page hitting a broken CSP
 * directive can fire dozens of reports per second across many browsers.
 * Sentry ingest is not free, and neither is Vercel invocation count.
 */

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { applyRateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

interface CspViolation {
  "blocked-uri"?: string;
  "document-uri"?: string;
  "violated-directive"?: string;
  "effective-directive"?: string;
  "original-policy"?: string;
  disposition?: string;
  "script-sample"?: string;
  referrer?: string;
  "status-code"?: number;
}

function extractViolations(raw: unknown): CspViolation[] {
  if (!raw || typeof raw !== "object") return [];

  // Legacy: { "csp-report": { ... } }
  const legacy = (raw as { "csp-report"?: unknown })["csp-report"];
  if (legacy && typeof legacy === "object") {
    return [legacy as CspViolation];
  }

  // Modern: array of { type, body }
  if (Array.isArray(raw)) {
    return raw
      .filter(
        (r) =>
          r &&
          typeof r === "object" &&
          (r as { type?: string }).type === "csp-violation",
      )
      .map((r) => (r as { body?: CspViolation }).body ?? {});
  }

  return [];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Cap volume in case a broken page storms us. 60/min per IP is far
  // above legitimate load; a real violation storm gets clamped.
  const limited = await applyRateLimit({
    key: `csp-report:ip:${clientIp(request)}`,
    limit: 60,
    windowSeconds: 60,
  });
  if (limited) return limited;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const violations = extractViolations(payload);
  if (violations.length === 0) {
    return NextResponse.json({ ok: true, received: 0 });
  }

  for (const v of violations) {
    const summary = `${v["violated-directive"] ?? "unknown"} blocked ${v["blocked-uri"] ?? "unknown"}`;
    Sentry.captureMessage(`CSP: ${summary}`, {
      level: "warning",
      tags: {
        source: "csp",
        directive: v["violated-directive"] ?? "unknown",
      },
      extra: {
        blockedUri: v["blocked-uri"],
        documentUri: v["document-uri"],
        violatedDirective: v["violated-directive"],
        effectiveDirective: v["effective-directive"],
        disposition: v.disposition,
        scriptSample: v["script-sample"],
        referrer: v.referrer,
      },
    });
  }

  return NextResponse.json({ ok: true, received: violations.length });
}
