/**
 * middleware.ts
 * Runs before every response. Currently used for one thing: prevent search
 * engines from indexing the raw Vercel origin (preview-factory.vercel.app).
 *
 * Customer traffic reaches Vercel via the Cloudflare Worker at
 * launcharoo.online (or a customer's own domain). Those requests carry
 * X-Forwarded-Host = launcharoo.online / customer.tld. Anyone hitting
 * preview-factory.vercel.app directly has no X-Forwarded-Host header
 * (Vercel doesn't set it) or has host === preview-factory.vercel.app.
 * In either case we tag the response noindex so it drops out of Google.
 *
 * The static robots.txt in public/ handles the launcharoo.online case
 * (disallow internal paths). This middleware handles the vercel.app case
 * (block everything).
 */

import { NextResponse, type NextRequest } from "next/server";

const ORIGIN_HOST = "preview-factory.vercel.app";

export function middleware(request: NextRequest): NextResponse {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host") ?? "";

  const isDirectOriginHit =
    !forwardedHost ||
    forwardedHost === ORIGIN_HOST ||
    host === ORIGIN_HOST;

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
