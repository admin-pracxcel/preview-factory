/**
 * app/api/health/worker/route.ts
 * POST /api/health/worker
 *
 * Heartbeat endpoint for the n8n worker (Phase 5). A separate schedule trigger
 * on n8n hits this every 5 minutes so Vercel can tell if the box has died.
 * Independent of the generation flow: a stuck generation must not stop
 * heartbeats, and a missed heartbeat must not stop generation.
 *
 * Verifies `x-worker-secret` matches WORKER_SHARED_SECRET, then upserts
 * `worker_health.last_seen_at`. GET /api/health (Phase 9) reads this row and
 * marks the worker stale if the beat is older than 15 min.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.WORKER_SHARED_SECRET;
  if (!expected) {
    console.error("[health/worker] WORKER_SHARED_SECRET not configured");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }
  const supplied = request.headers.get("x-worker-secret");
  if (supplied !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Optional meta from the worker (n8n version, box hostname, queue depth…).
  // We don't validate the shape; it's for humans reading /api/health.
  let meta: unknown = null;
  try {
    const body = await request.json();
    if (body && typeof body === "object") meta = body;
  } catch {
    // Empty body is fine.
  }

  const { error } = await supabase()
    .from("worker_health")
    .update({ last_seen_at: new Date().toISOString(), meta })
    .eq("id", "worker");
  if (error) {
    console.error("[health/worker] failed to update worker_health:", error);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
