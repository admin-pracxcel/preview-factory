/**
 * app/api/cron/cleanup/route.ts
 * POST /api/cron/cleanup
 *
 * Weekly housekeeping sweep. Same x-worker-secret pattern as reaper +
 * heartbeat.
 */

import { NextRequest, NextResponse } from "next/server";
import { runHousekeeping } from "@/lib/housekeeping";
import { captureCronError } from "@/lib/telemetry";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.WORKER_SHARED_SECRET;
  if (!expected) {
    console.error("[cron/cleanup] WORKER_SHARED_SECRET not configured");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }
  const supplied = request.headers.get("x-worker-secret");
  if (supplied !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runHousekeeping();
    console.log(
      `[cron/cleanup] jobs=${result.jobsDeleted} events=${result.processedEventsDeleted} tokens=${result.magicTokensDeleted} sessions=${result.sessionsDeleted} siteProps=${result.sitePropsBlanked} rateLimits=${result.rateLimitsDeleted}`
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/cleanup] failed:", err);
    captureCronError("cleanup", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "cleanup failed" },
      { status: 500 }
    );
  }
}
