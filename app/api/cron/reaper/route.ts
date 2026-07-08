/**
 * app/api/cron/reaper/route.ts
 * POST /api/cron/reaper
 *
 * Runs the reaper sweep. Called daily by an n8n schedule workflow.
 * Reuses the WORKER_SHARED_SECRET header pattern from /api/health/worker so
 * we don't have another secret to rotate.
 *
 * Idempotent — safe to re-run within the same day if a schedule fires twice.
 */

import { NextRequest, NextResponse } from "next/server";
import { runReaper } from "@/lib/reaper";
import { captureCronError } from "@/lib/telemetry";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.WORKER_SHARED_SECRET;
  if (!expected) {
    console.error("[cron/reaper] WORKER_SHARED_SECRET not configured");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }
  const supplied = request.headers.get("x-worker-secret");
  if (supplied !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runReaper();
    console.log(
      `[cron/reaper] unclaimed=${result.unclaimedExpired} cancelled=${result.cancelledExpired}`
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/reaper] failed:", err);
    captureCronError("reaper", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "reaper failed" },
      { status: 500 }
    );
  }
}
