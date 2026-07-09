/**
 * middleware.ts
 * Runs before every response. Job: prevent search engines from indexing
 * the raw Vercel origin (preview-factory.vercel.app) without touching the
 * customer-facing hosts we route through the Cloudflare Worker.
 *
 * How we distinguish Worker traffic from a direct-origin hit:
 *   The Worker sets a custom X-Launcharoo-Host header on every proxied
 *   request, carrying the customer-facing hostname. Vercel's edge strips
 *   X-Forwarded-Host and rewrites it to the Vercel origin, so we can't
 *   rely on that. The custom header is preserved end to end.
 *
 * If X-Launcharoo-Host is present → Worker-proxied traffic → do nothing
 * (the response is served on a real customer host and should be indexable).
 * If it's absent → someone hit preview-factory.vercel.app directly →
 * add X-Robots-Tag: noindex so the response drops out of Google.
 *
 * The dynamic /robots.txt route reinforces this on the vercel.app origin
 * with a full Disallow.
 */

import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest): NextResponse {
  const launcharooHost = request.headers.get("x-launcharoo-host");
  const response = NextResponse.next();
  if (!launcharooHost || launcharooHost.trim().length === 0) {
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
