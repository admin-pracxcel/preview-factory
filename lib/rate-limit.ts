/**
 * lib/rate-limit.ts
 * Supabase-backed rate limiting. Fixed-window counters keyed by
 * (endpoint, actor) — cheap, race-safe via a Postgres upsert function.
 *
 * Usage in an API route:
 *
 *   const limited = await applyRateLimit({
 *     key: `auth:request-link:ip:${clientIp(request)}`,
 *     limit: 5,
 *     windowSeconds: 60,
 *   });
 *   if (limited) return limited;    // 429 response already built
 *
 * Fail-open policy: if Supabase is unreachable, we log and allow the
 * request. Rate limiting is defence in depth; taking sign-in offline
 * because the counter table can't be read is a worse outcome.
 *
 * Cleanup: rows expire naturally when their window_end passes, and the
 * weekly housekeeping cron deletes them. See app/api/cron/cleanup.
 */

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/* --------------------------------------------------------------- types */

export interface RateLimitInput {
  /** Uniquely identifies (endpoint, actor). e.g. `leads:tenant:<uuid>`. */
  key: string;
  /** Max requests per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/* ------------------------------------------------------------- helpers */

/**
 * Read the caller's IP from Vercel's forwarding headers. Behind a Cloudflare
 * Worker proxy we still see the original client through the standard
 * x-forwarded-for chain — the Worker doesn't strip it.
 *
 * Falls back to "unknown" if nothing is set (dev, curl-against-localhost).
 * Callers should treat this as an opaque token, not a real IP.
 */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/* --------------------------------------------------------- core check */

/**
 * Increment the counter for `key` and return whether we're under the limit.
 * Race-safe: uses a Postgres function that does insert-on-conflict inside
 * one statement.
 *
 * Throws on Supabase errors so the caller can decide to fail-open.
 */
export async function checkRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const { data, error } = await supabase().rpc("check_rate_limit", {
    p_key: input.key,
    p_limit: input.limit,
    p_window_seconds: input.windowSeconds,
  });
  if (error) throw new Error(`rate_limit rpc failed: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(row?.allowed ?? true),
    remaining: Number(row?.remaining ?? 0),
    resetAt: row?.reset_at ? new Date(row.reset_at) : new Date(),
  };
}

/* ------------------------------------------------------- route helper */

/**
 * Higher-level helper for API routes. Returns null when the request is
 * allowed (caller proceeds normally), or a fully-formed 429 NextResponse
 * when the caller should be rejected.
 *
 * Fail-open: on unexpected errors, logs and returns null.
 */
export async function applyRateLimit(
  input: RateLimitInput,
): Promise<NextResponse | null> {
  let result: RateLimitResult;
  try {
    result = await checkRateLimit(input);
  } catch (err) {
    console.warn(`[rate-limit] check failed for key=${input.key} — failing open:`, err);
    return null;
  }

  if (result.allowed) return null;

  const retryAfter = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
  return NextResponse.json(
    {
      error: `Too many requests. Try again in ${retryAfter} seconds.`,
      retryAfter,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.floor(result.resetAt.getTime() / 1000)),
      },
    },
  );
}
