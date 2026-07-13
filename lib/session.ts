/**
 * lib/session.ts
 * Anonymous session cookie helper. httpOnly, SameSite=Lax, 30-day.
 *
 * The session is the identity of an unauthenticated visitor. It links a
 * browser to the tenants they created before they claim (Phase 7.5). One
 * session can own many tenants. After claim, the tenant is additionally
 * indexable by owner_email — sessions stay valid but authorisation shifts to
 * the magic-link cookie.
 *
 * Usage in a route handler:
 *   const sessionId = await ensureSession(cookies());
 *
 * The helper writes the session row lazily — only the FIRST time a cookie
 * arrives with no matching row. Subsequent hits just touch last_seen_at.
 */

import { supabase } from "@/lib/supabase";

const COOKIE_NAME = "pf_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Return the visitor's session id. If the cookie is missing or unknown to
 * the DB, mint a new session row and set the cookie. The `cookies()` object
 * passed in must be the mutable one from `next/headers` — a readonly copy
 * won't be able to persist the new cookie.
 */
export async function ensureSession(
  cookies: MutableCookies,
  meta?: { ip?: string; userAgent?: string },
): Promise<string> {
  const existing = cookies.get(COOKIE_NAME)?.value;
  if (existing && isUuid(existing)) {
    // Cheap touch of last_seen_at. Fire-and-forget — a lost update doesn't
    // matter here, and blocking the request path on it would be wasteful.
    void touchSession(existing);
    return existing;
  }

  const { data, error } = await supabase()
    .from("sessions")
    .insert({
      ip: meta?.ip ?? null,
      user_agent: meta?.userAgent ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`ensureSession failed: ${error?.message ?? "no row returned"}`);
  }

  const id = data.id as string;
  cookies.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    // Secure in prod; harmless off in local http dev.
    secure: process.env.NODE_ENV === "production",
  });
  return id;
}

/**
 * Read-only version — returns the session id if a valid cookie is present,
 * otherwise null. Used by endpoints that shouldn't mint a new session (e.g.
 * background reconciliation or read-only preview flows).
 */
export function readSession(
  cookies: MutableCookies | ReadonlyCookies,
): string | null {
  const value = cookies.get(COOKIE_NAME)?.value;
  if (!value || !isUuid(value)) return null;
  return value;
}

/**
 * Verify the session cookie owns a given tenant. Used by /api/claim, custom
 * domain endpoints, and anywhere else that needs "this browser created this
 * tenant" as a lightweight auth check pre-magic-link.
 *
 * Admin bypass: if ADMIN_EMAIL is configured and this session owns any
 * tenant claimed under that email, the check passes regardless of which
 * tenant is being accessed. This lets the founder support / edit any
 * client's site from the same UI clients use.
 */
export async function assertOwnsTenant(
  cookies: MutableCookies | ReadonlyCookies,
  tenantId: string,
): Promise<void> {
  const sessionId = readSession(cookies);
  if (!sessionId) throw new Error("no session cookie");

  const { data, error } = await supabase()
    .from("tenants")
    .select("session_id")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw new Error(`tenant lookup failed: ${error.message}`);
  if (!data) throw new Error(`tenant ${tenantId} not found`);
  if (data.session_id !== sessionId) {
    // Not the owning session — is this session an admin? Inlined (rather
    // than importing lib/admin) to avoid a module cycle: admin already
    // depends on session.
    if (await isSessionAdmin(sessionId)) return;
    throw new Error("session does not own this tenant");
  }
}

async function isSessionAdmin(sessionId: string): Promise<boolean> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return false;
  const { data, error } = await supabase()
    .from("tenants")
    .select("id")
    .eq("session_id", sessionId)
    .eq("owner_email", email)
    .not("claimed_at", "is", null)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn(`[session] admin lookup failed: ${error.message}`);
    return false;
  }
  return Boolean(data);
}

/**
 * Return the most recently created tenant owned by this session, or null
 * if the session doesn't own any. Used by the preview / dashboard auth
 * gates to redirect a signed-in visitor to *their* tenant when they land
 * on someone else's URL, rather than bouncing them to /login.
 */
export async function findLatestTenantForSession(
  sessionId: string,
): Promise<string | null> {
  const { data, error } = await supabase()
    .from("tenants")
    .select("id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn(`[session] latest-tenant lookup failed: ${error.message}`);
    return null;
  }
  return data ? (data.id as string) : null;
}

/* ------------------------------------------------------------------ internals */

async function touchSession(id: string): Promise<void> {
  const { error } = await supabase()
    .from("sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    // Non-fatal — we log and move on rather than fail the request.
    // eslint-disable-next-line no-console
    console.warn(`[session] touch ${id} failed: ${error.message}`);
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Structural types for the cookies objects Next returns. Kept narrow — we
 * don't want to leak Next internals across consumers, and this avoids the
 * fragile deep-import path.
 */
export interface ReadonlyCookies {
  get(name: string): { value: string } | undefined;
}

export interface MutableCookies extends ReadonlyCookies {
  set(
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      sameSite?: "lax" | "strict" | "none";
      path?: string;
      maxAge?: number;
      secure?: boolean;
    },
  ): void;
}
