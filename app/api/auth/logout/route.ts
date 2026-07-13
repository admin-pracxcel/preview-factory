/**
 * app/api/auth/logout/route.ts
 * POST /api/auth/logout
 *
 * Clears the pf_session cookie so this browser is no longer authenticated
 * against any tenant. Anonymous tenant rows remain in the DB — logout only
 * severs the browser→session link. The next visit mints a fresh session.
 *
 * Accepts POST (from a form or fetch) and GET (so a plain <a href> works
 * too — useful for the concierge nav). Both end with a 303 redirect to
 * /login.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";
import type { MutableCookies } from "@/lib/session";

export const runtime = "nodejs";

const COOKIE_NAME = "pf_session";

async function clearAndRedirect(request: NextRequest): Promise<NextResponse> {
  const cookieStore = (await nextCookies()) as unknown as MutableCookies;
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
  return NextResponse.redirect(new URL("/login", request.url), 303);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return clearAndRedirect(request);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return clearAndRedirect(request);
}
