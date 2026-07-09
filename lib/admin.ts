/**
 * lib/admin.ts
 * Admin gate for concierge routes (/admin/*, /api/admin/*).
 *
 * The admin authenticates using the same magic-link flow as any owner. The
 * gate matches the session cookie against a tenant owned by ADMIN_EMAIL —
 * so the founder must claim at least one tenant with that email before
 * they can access the admin routes.
 *
 * If ADMIN_EMAIL is unset, the gate denies every request. Set it in Vercel
 * env to the address you use for magic-link sign-in (e.g.
 * hello@launcharoo.online).
 */

import { supabase } from "@/lib/supabase";
import { readSession, type MutableCookies, type ReadonlyCookies } from "@/lib/session";

export function adminEmail(): string | null {
  const raw = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return raw && raw.length > 0 ? raw : null;
}

/**
 * Resolve whether the current session belongs to the admin.
 * Returns true only when ADMIN_EMAIL is configured AND the session owns
 * at least one tenant claimed under that email.
 */
export async function isAdminSession(
  cookies: MutableCookies | ReadonlyCookies,
): Promise<boolean> {
  const email = adminEmail();
  if (!email) return false;

  const sessionId = readSession(cookies);
  if (!sessionId) return false;

  const { data, error } = await supabase()
    .from("tenants")
    .select("id")
    .eq("session_id", sessionId)
    .eq("owner_email", email)
    .not("claimed_at", "is", null)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[admin] lookup failed:", error);
    return false;
  }
  return Boolean(data);
}
