/**
 * POST /api/cron/domain-reconcile
 * Reconciliation sweep — same x-worker-secret pattern as reaper + cleanup.
 * n8n hits this every 5 min so pending domains progress without the owner
 * having to sit on the dashboard.
 */

import { NextRequest, NextResponse } from "next/server";
import { reconcileAllPending } from "@/lib/domain-reconcile";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.WORKER_SHARED_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }
  if (request.headers.get("x-worker-secret") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await reconcileAllPending();
    console.log(
      `[cron/domain-reconcile] checked=${result.checked} advanced=${result.advanced} errors=${result.errors}`,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/domain-reconcile] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "reconcile failed" },
      { status: 500 },
    );
  }
}
