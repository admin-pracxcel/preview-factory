/**
 * lib/reaper.ts
 * Marks unclaimed and post-grace-period cancelled tenants as expired.
 *
 * Policy:
 *   - Unclaimed:  claimed_at IS NULL AND created_at < now() - 24h.
 *                 Flip status='expired' AND blank site_props in a single
 *                 sweep — no separate 30-day hard-delete step. The public
 *                 slug page already shows /expired from the 3-hour mark
 *                 based on age alone (see app/preview/site/... page.tsx),
 *                 so 24h is purely the storage-reclaim cutoff.
 *   - Cancelled:  status='cancelled' AND cancelled_at < now() - 7d.
 *                 Status flip only — cancelled subscribers keep their
 *                 site_props through the housekeeping 30-day grace.
 *
 * Keeps the row (owner_email, phone, name, timestamps) for follow-up +
 * analytics. Idempotent, safe to re-run.
 */

import { supabase } from "@/lib/supabase";

const UNCLAIMED_TTL_HOURS = 24;
const CANCELLED_GRACE_DAYS = 7;

export interface ReaperResult {
  unclaimedExpired: number;
  cancelledExpired: number;
  ranAt: string;
}

export async function runReaper(): Promise<ReaperResult> {
  const now = new Date();
  const unclaimedCutoff = new Date(now.getTime() - UNCLAIMED_TTL_HOURS * 3600_000);
  const cancelledCutoff = new Date(now.getTime() - CANCELLED_GRACE_DAYS * 86400_000);

  // Unclaimed tenants past the 24-hour window. We look at claimed_at rather
  // than status because status can be 'done' or 'failed' or 'queued' for an
  // unclaimed row — claimed_at IS NULL is the single truth for "hasn't paid".
  const { data: unclaimed, error: unclaimedErr } = await supabase()
    .from("tenants")
    .update({ status: "expired", site_props: null })
    .is("claimed_at", null)
    .lt("created_at", unclaimedCutoff.toISOString())
    .neq("status", "expired")
    .select("id");
  if (unclaimedErr) {
    throw new Error(`reaper unclaimed sweep failed: ${unclaimedErr.message}`);
  }

  // Cancelled subscribers past the 7-day grace. cancelled_at is set by the
  // subscription-lifecycle handler when Stripe reports canceled.
  const { data: cancelled, error: cancelledErr } = await supabase()
    .from("tenants")
    .update({ status: "expired" })
    .eq("status", "cancelled")
    .not("cancelled_at", "is", null)
    .lt("cancelled_at", cancelledCutoff.toISOString())
    .select("id");
  if (cancelledErr) {
    throw new Error(`reaper cancelled sweep failed: ${cancelledErr.message}`);
  }

  const result = {
    unclaimedExpired: unclaimed?.length ?? 0,
    cancelledExpired: cancelled?.length ?? 0,
    ranAt: now.toISOString(),
  };

  // Record the run in worker_health so /api/health can surface when the
  // reaper last completed. Non-fatal on error — the sweep is already done.
  const { error: telemetryErr } = await supabase()
    .from("worker_health")
    .upsert(
      {
        id: "reaper",
        last_seen_at: result.ranAt,
        meta: {
          unclaimedExpired: result.unclaimedExpired,
          cancelledExpired: result.cancelledExpired,
        },
      },
      { onConflict: "id" }
    );
  if (telemetryErr) {
    console.warn(`[reaper] telemetry upsert warned: ${telemetryErr.message}`);
  }

  return result;
}
