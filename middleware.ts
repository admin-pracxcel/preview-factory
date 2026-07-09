/**
 * middleware.ts
 * Runs before every response. Two jobs:
 *
 * 1. Redirect browser traffic hitting the raw Vercel origin
 *    (preview-factory.vercel.app) to the branded launcharoo.online domain,
 *    preserving path + query. API routes are exempted so any webhook still
 *    configured against the vercel.app URL (Stripe, cron, Cloudflare) keeps
 *    working — those services don't follow redirects.
 * 2. Add noindex to any direct-origin response that isn't redirected, so
 *    the vercel.app hostname drops out of search results.
 *
 * Customer traffic reaches Vercel via the Cloudflare Worker at
 * launcharoo.online (or a customer's own domain). Those requests carry
 * X-Forwarded-Host = launcharoo.online / customer.tld. Anyone hitting
 * preview-factory.vercel.app directly has no X-Forwarded-Host header
 * (Vercel doesn't set it) or has host === preview-factory.vercel.app.
 *
 * The static robots.txt in public/ handles the launcharoo.online case
 * (disallow internal paths).
 */

import { NextResponse, type NextRequest } from "next/server";

const ORIGIN_HOST = "preview-factory.vercel.app";
const CANONICAL_ORIGIN = "https://launcharoo.online";

export function middleware(request: NextRequest): NextResponse {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host") ?? "";

  const isDirectOriginHit =
    !forwardedHost ||
    forwardedHost === ORIGIN_HOST ||
    host === ORIGIN_HOST;

  if (isDirectOriginHit && !request.nextUrl.pathname.startsWith("/api/")) {
    const target = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      CANONICAL_ORIGIN,
    );
    return NextResponse.redirect(target, 308);
  }

  const response = NextResponse.next();
  if (isDirectOriginHit) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

/**
 * Skip static assets, Next internals, and the Sentry tunnel to keep
 * middleware overhead near zero on those hot paths.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|monitoring).*)",
  ],
};
