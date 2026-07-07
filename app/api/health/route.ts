/**
 * app/api/health/route.ts
 * GET /api/health
 *
 * Public operational overview. No secret required — the payload names buckets
 * and timestamps only, no PII or business names.
 *
 * Returns 200 with { ok: true, ... } when everything is fresh, or 200 with
 * { ok: false, ... } when something's stale (worker heartbeat missed, reaper
 * hasn't run in >26h, cleanup hasn't run in >8d). Never 5xx — the whole point
 * is to always answer, even during an outage.
 */

import { NextResponse } from "next/server";
import { getHealth } from "@/lib/health";

export const runtime = "nodejs";
export const revalidate = 30;

export async function GET(): Promise<NextResponse> {
  try {
    const snapshot = await getHealth();
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "public, max-age=30" },
    });
  } catch (err) {
    // Belt-and-braces: if the aggregation itself throws, still respond.
    return NextResponse.json({
      ok: false,
      now: new Date().toISOString(),
      error: err instanceof Error ? err.message : "health check failed",
    });
  }
}
