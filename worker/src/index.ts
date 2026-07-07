/**
 * launcharoo-router
 *
 * Cloudflare Worker that maps `<slug>.launcharoo.online/*` onto the
 * Preview Factory Next.js app on Vercel.
 *
 * Flow:
 *   1. Extract slug from the Host header.
 *   2. Call the Vercel API GET /api/tenant/by-slug/<slug> (cached at the
 *      edge with Cache-Control from the upstream response).
 *   3. If found, proxy the request to
 *      https://preview-factory.vercel.app/preview/site/<tenantId>/<path>
 *      and forward the response.
 *   4. If not found, redirect to the marketing site.
 *   5. Asset paths (/_next/*, /favicon.ico, /robots.txt) pass through
 *      to the Vercel origin unchanged so relative asset URLs resolve.
 *
 * The site render page inspects the X-Forwarded-Host header this Worker
 * sets to render internal links without the /preview/site/<tenantId>
 * prefix — see app/preview/site/[tenantId]/[[...slug]]/page.tsx.
 */

interface Env {
  VERCEL_ORIGIN: string;
  SITE_DOMAIN: string;
}

/** Belt-and-braces: even if the slug generator lets these through, refuse. */
const RESERVED_SLUGS = new Set([
  "www",
  "api",
  "admin",
  "mail",
  "status",
  "health",
  "dashboard",
  "login",
  "welcome",
  "expired",
  "preview",
  "checkout",
  "billing",
  "app",
  "auth",
  "static",
  "cdn",
  "assets",
]);

/** Paths that should never be rewritten with the tenant prefix. */
const PASSTHROUGH_PREFIXES = ["/_next/", "/api/", "/__nextjs_", "/@vercel/"];
const PASSTHROUGH_EXACT = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.json",
  "/.well-known",
]);

function isPassthroughPath(pathname: string): boolean {
  if (PASSTHROUGH_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/.well-known/")) return true;
  for (const p of PASSTHROUGH_PREFIXES) {
    if (pathname.startsWith(p)) return true;
  }
  return false;
}

function extractSlug(host: string, siteDomain: string): string | null {
  const suffix = "." + siteDomain;
  if (host === siteDomain) return null;
  if (!host.endsWith(suffix)) return null;
  return host.slice(0, host.length - suffix.length);
}

async function lookupTenant(
  origin: string,
  slug: string,
): Promise<{ tenantId: string; expired: boolean } | null> {
  const res = await fetch(`${origin}/api/tenant/by-slug/${encodeURIComponent(slug)}`, {
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`by-slug lookup failed: ${res.status}`);
  return (await res.json()) as { tenantId: string; expired: boolean };
}

async function proxy(
  request: Request,
  origin: string,
  upstreamPath: string,
  originalHost: string,
): Promise<Response> {
  const url = new URL(request.url);
  const upstream = new URL(upstreamPath, origin);
  upstream.search = url.search;

  const headers = new Headers(request.headers);
  headers.set("X-Forwarded-Host", originalHost);
  headers.set("X-Forwarded-Proto", "https");
  // Vercel's routing needs the Host header to match the deployment; the
  // origin URL already sets it, so nothing to do here.

  const upstreamReq = new Request(upstream.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: "manual",
  });

  return fetch(upstreamReq);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();

    const slug = extractSlug(host, env.SITE_DOMAIN);
    if (!slug || slug === "www") {
      // Apex or www hit — punt to the marketing site.
      return Response.redirect(env.VERCEL_ORIGIN, 302);
    }

    if (RESERVED_SLUGS.has(slug) || slug.includes(".")) {
      // Nested subdomain or reserved word — 404 rather than leak internals.
      return new Response("Not found", { status: 404 });
    }

    // Asset requests: proxy through with path unchanged.
    if (isPassthroughPath(url.pathname)) {
      return proxy(request, env.VERCEL_ORIGIN, url.pathname, host);
    }

    let lookup;
    try {
      lookup = await lookupTenant(env.VERCEL_ORIGIN, slug);
    } catch (err) {
      console.error("[launcharoo-router] lookup failed:", err);
      return new Response("Upstream lookup failed", { status: 502 });
    }
    if (!lookup) {
      // Slug not found — redirect to landing.
      return Response.redirect(env.VERCEL_ORIGIN, 302);
    }

    if (lookup.expired) {
      return Response.redirect(
        `${env.VERCEL_ORIGIN}/expired/${lookup.tenantId}`,
        302,
      );
    }

    // Everything else: prepend /preview/site/<tenantId> and proxy.
    const rewritten =
      url.pathname === "/"
        ? `/preview/site/${lookup.tenantId}`
        : `/preview/site/${lookup.tenantId}${url.pathname}`;

    return proxy(request, env.VERCEL_ORIGIN, rewritten, host);
  },
} satisfies ExportedHandler<Env>;
