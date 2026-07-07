/**
 * lib/housekeeping.ts
 * Weekly cleanup sweep. Deletes stale rows and blanks site_props on tenants
 * that expired more than 30 days ago.
 *
 * Retention windows:
 *   jobs                     7 days
 *   processed_events        60 days
 *   magic_tokens (used)      7 days
 *   magic_tokens (expired)   7 days past expires_at
 *   sessions (orphaned)     90 days, only if no tenant references them
 *   tenants site_props      30 days after status='expired' (row kept)
 *
 * Every step is a straight DELETE — no cascades outside the schema's own
 * on-delete rules. Sessions are the only sweep that runs in two hops because
 * we need "not referenced by any tenant" and Supabase JS doesn't expose raw
 * SQL for a single-statement WHERE NOT EXISTS.
 */

import { supabase } from "@/lib/supabase";

const JOBS_TTL_DAYS = 7;
const PROCESSED_EVENTS_TTL_DAYS = 60;
const MAGIC_TOKENS_TTL_DAYS = 7;
const SESSIONS_TTL_DAYS = 90;
const SITE_PROPS_HARD_DELETE_DAYS = 30;

export interface HousekeepingResult {
  jobsDeleted: number;
  processedEventsDeleted: number;
  magicTokensDeleted: number;
  sessionsDeleted: number;
  sitePropsBlanked: number;
  ranAt: string;
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

export async function runHousekeeping(): Promise<HousekeepingResult> {
  const now = new Date();

  const { data: jobs, error: jobsErr } = await supabase()
    .from("jobs")
    .delete()
    .lt("created_at", daysAgo(JOBS_TTL_DAYS))
    .select("id");
  if (jobsErr) throw new Error(`housekeeping jobs sweep: ${jobsErr.message}`);

  const { data: events, error: eventsErr } = await supabase()
    .from("processed_events")
    .delete()
    .lt("seen_at", daysAgo(PROCESSED_EVENTS_TTL_DAYS))
    .select("event_id");
  if (eventsErr) throw new Error(`housekeeping processed_events sweep: ${eventsErr.message}`);

  // magic_tokens: drop rows that are used OR expired past the grace window.
  // Two deletes because the .or() call would need cross-column syntax that
  // supabase-js escapes awkwardly.
  const { data: usedTokens, error: usedErr } = await supabase()
    .from("magic_tokens")
    .delete()
    .not("used_at", "is", null)
    .lt("used_at", daysAgo(MAGIC_TOKENS_TTL_DAYS))
    .select("token");
  if (usedErr) throw new Error(`housekeeping used-tokens sweep: ${usedErr.message}`);

  const { data: expiredTokens, error: expErr } = await supabase()
    .from("magic_tokens")
    .delete()
    .lt("expires_at", daysAgo(MAGIC_TOKENS_TTL_DAYS))
    .select("token");
  if (expErr) throw new Error(`housekeeping expired-tokens sweep: ${expErr.message}`);

  // Sessions: fetch candidates first, then filter down to those with no
  // tenants pointing at them, then delete.
  const { data: candidateSessions, error: candErr } = await supabase()
    .from("sessions")
    .select("id")
    .lt("last_seen_at", daysAgo(SESSIONS_TTL_DAYS))
    .limit(500);
  if (candErr) throw new Error(`housekeeping session candidate lookup: ${candErr.message}`);

  let sessionsDeleted = 0;
  if (candidateSessions && candidateSessions.length > 0) {
    const candidateIds = candidateSessions.map((r) => r.id as string);
    const { data: liveRefs, error: refErr } = await supabase()
      .from("tenants")
      .select("session_id")
      .in("session_id", candidateIds);
    if (refErr) throw new Error(`housekeeping session ref lookup: ${refErr.message}`);
    const referenced = new Set(
      (liveRefs ?? []).map((r) => r.session_id as string).filter(Boolean)
    );
    const orphaned = candidateIds.filter((id) => !referenced.has(id));

    if (orphaned.length > 0) {
      const { data: deleted, error: delErr } = await supabase()
        .from("sessions")
        .delete()
        .in("id", orphaned)
        .select("id");
      if (delErr) throw new Error(`housekeeping session delete: ${delErr.message}`);
      sessionsDeleted = deleted?.length ?? 0;
    }
  }

  // Expired tenants: after the 30-day grace, drop the big site_props JSON to
  // reclaim storage. Keep the row for the audit trail. updated_at is bumped
  // when the reaper flipped status to 'expired' — so it's a fine expiry
  // clock, no need for a separate expired_at column.
  const { data: blanked, error: blankErr } = await supabase()
    .from("tenants")
    .update({ site_props: null })
    .eq("status", "expired")
    .not("site_props", "is", null)
    .lt("updated_at", daysAgo(SITE_PROPS_HARD_DELETE_DAYS))
    .select("id");
  if (blankErr) throw new Error(`housekeeping site_props blank: ${blankErr.message}`);

  return {
    jobsDeleted: jobs?.length ?? 0,
    processedEventsDeleted: events?.length ?? 0,
    magicTokensDeleted: (usedTokens?.length ?? 0) + (expiredTokens?.length ?? 0),
    sessionsDeleted,
    sitePropsBlanked: blanked?.length ?? 0,
    ranAt: now.toISOString(),
  };
}
