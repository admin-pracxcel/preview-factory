/**
 * lib/health.ts
 * Aggregates operational state for /api/health and /status.
 *
 * Reads:
 *   worker_health rows (id='worker', 'reaper', 'cleanup')
 *   tenant counts by lifecycle bucket
 *
 * Everything is best-effort. If a query fails we still return the partial
 * shape with the failing subtree marked null — the /status page renders "?"
 * rather than crashing.
 */

import { supabase } from "@/lib/supabase";

const WORKER_STALE_MS = 15 * 60 * 1000; // 15 min
const REAPER_STALE_MS = 26 * 60 * 60 * 1000; // 26h (daily + slack)
const CLEANUP_STALE_MS = 8 * 24 * 60 * 60 * 1000; // 8d (weekly + slack)

export interface JobHealth {
  lastSeenAt: string | null;
  ageMs: number | null;
  stale: boolean;
  meta: Record<string, unknown> | null;
}

export interface TenantCounts {
  total: number;
  claimed: number;
  pastDue: number;
  cancelled: number;
  expired: number;
  unclaimed: number;
}

export interface HealthSnapshot {
  ok: boolean;
  now: string;
  worker: JobHealth;
  reaper: JobHealth;
  cleanup: JobHealth;
  tenants: TenantCounts | null;
}

async function loadJobHealth(id: string, staleMs: number, now: number): Promise<JobHealth> {
  const { data, error } = await supabase()
    .from("worker_health")
    .select("last_seen_at, meta")
    .eq("id", id)
    .maybeSingle();
  if (error || !data || !data.last_seen_at) {
    return { lastSeenAt: null, ageMs: null, stale: true, meta: null };
  }
  const ageMs = now - new Date(data.last_seen_at).getTime();
  return {
    lastSeenAt: data.last_seen_at as string,
    ageMs,
    stale: ageMs > staleMs,
    meta: (data.meta as Record<string, unknown> | null) ?? null,
  };
}

async function loadTenantCounts(): Promise<TenantCounts | null> {
  try {
    // One round-trip: pull all lifecycle-relevant statuses. `head:true, count:'exact'`
    // could work per bucket but that's 5+ round trips. Fetching id+status is cheap.
    const { data, error } = await supabase()
      .from("tenants")
      .select("status, claimed_at")
      .limit(10000);
    if (error || !data) return null;

    const counts = {
      total: data.length,
      claimed: 0,
      pastDue: 0,
      cancelled: 0,
      expired: 0,
      unclaimed: 0,
    };
    for (const row of data) {
      const status = row.status as string;
      const claimedAt = (row as { claimed_at: string | null }).claimed_at;
      if (status === "claimed") counts.claimed++;
      else if (status === "past_due") counts.pastDue++;
      else if (status === "cancelled") counts.cancelled++;
      else if (status === "expired") counts.expired++;
      if (!claimedAt) counts.unclaimed++;
    }
    return counts;
  } catch {
    return null;
  }
}

export async function getHealth(): Promise<HealthSnapshot> {
  const now = Date.now();
  const [worker, reaper, cleanup, tenants] = await Promise.all([
    loadJobHealth("worker", WORKER_STALE_MS, now),
    loadJobHealth("reaper", REAPER_STALE_MS, now),
    loadJobHealth("cleanup", CLEANUP_STALE_MS, now),
    loadTenantCounts(),
  ]);
  const ok = !worker.stale && !reaper.stale && !cleanup.stale && tenants !== null;
  return {
    ok,
    now: new Date(now).toISOString(),
    worker,
    reaper,
    cleanup,
    tenants,
  };
}
