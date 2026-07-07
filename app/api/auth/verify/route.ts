/**
 * app/api/auth/verify/route.ts
 * GET /api/auth/verify?token=...
 *
 * Consumes a magic-link token, mints a fresh session for the current browser,
 * points every tenant owned by that email at the new session, and redirects to
 * the most recently claimed tenant's dashboard.
 *
 * Multi-tenant rule: if the owner has more than one claimed tenant, they all
 * get rewired to the new session so `assertOwnsTenant` continues to hold for
 * all of them. Trade-off: the previous browser is silently signed out. For
 * now that's a feature — one active browser per owner keeps the story simple.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";
import { verifyMagicToken } from "@/lib/magic-tokens";
import { supabase } from "@/lib/supabase";
import type { MutableCookies } from "@/lib/session";

export const runtime = "nodejs";

const COOKIE_NAME = "pf_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days, matches lib/session.ts

function redirectTo(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token") ?? "";

  let verified;
  try {
    verified = await verifyMagicToken(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid link";
    return redirectTo(request, `/login?error=${encodeURIComponent(message)}`);
  }

  const { email } = verified;

  const { data: tenants, error: listError } = await supabase()
    .from("tenants")
    .select("id, claimed_at")
    .eq("owner_email", email)
    .not("claimed_at", "is", null)
    .order("claimed_at", { ascending: false });
  if (listError) {
    console.error("[auth:verify] tenant lookup failed:", listError);
    return redirectTo(request, "/login?error=Something%20went%20wrong");
  }
  if (!tenants || tenants.length === 0) {
    return redirectTo(request, "/login?error=No%20site%20found%20for%20this%20email");
  }

  const { data: session, error: sessionError } = await supabase()
    .from("sessions")
    .insert({ ip: null, user_agent: request.headers.get("user-agent") ?? null })
    .select("id")
    .single();
  if (sessionError || !session) {
    console.error("[auth:verify] session mint failed:", sessionError);
    return redirectTo(request, "/login?error=Something%20went%20wrong");
  }
  const newSessionId = session.id as string;

  const tenantIds = tenants.map((t) => t.id as string);
  const { error: updateError } = await supabase()
    .from("tenants")
    .update({ session_id: newSessionId })
    .in("id", tenantIds);
  if (updateError) {
    console.error("[auth:verify] tenant rewire failed:", updateError);
    return redirectTo(request, "/login?error=Something%20went%20wrong");
  }

  const cookieStore = (await nextCookies()) as unknown as MutableCookies;
  cookieStore.set(COOKIE_NAME, newSessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });

  const target = tenantIds[0];
  console.log(`[auth:verify] signed in ${email} → tenant ${target} (rewired ${tenantIds.length})`);
  return redirectTo(request, `/dashboard/${target}`);
}
