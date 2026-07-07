/**
 * launcharoo-router
 *
 * Cloudflare Worker that maps `<slug>.launcharoo.online/*` onto the
 * Preview Factory Next.js app on Vercel.
 *
 * Design goal: the visitor's browser only ever sees the launcharoo.online
 * hostname. All origin URLs (preview-factory.vercel.app) are contained
 * inside the Worker's fetch calls. Redirect responses from upstream are
 * intercepted and rewritten so nothing leaks.
 *
 * Flow:
 *   1. Extract slug from Host.
 *   2. Asset paths (/_next/*, /favicon.ico, etc.) proxy through unchanged.
 *   3. Look up { tenantId, expired } from GET /api/tenant/by-slug/<slug>.
 *      Cached at Cloudflare edge for 5 min (upstream Cache-Control).
 *   4. If expired → proxy /expired/<tenantId> under the customer host.
 *   5. Otherwise → proxy /preview/site/<tenantId>/<path> under the customer host.
 *   6. Any 3xx response from Vercel has its Location header rewritten if it
 *      would send the browser to preview-factory.vercel.app.
 */

interface Env {
  VERCEL_ORIGIN: string;
  SITE_DOMAIN: string;
}

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

const PASSTHROUGH_PREFIXES = ["/_next/", "/api/", "/__nextjs_", "/@vercel/"];
const PASSTHROUGH_EXACT = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.json",
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
  if (!res.ok) throw new Error(`by-slug lookup returned ${res.status}`);
  return (await res.json()) as { tenantId: string; expired: boolean };
}

/**
 * If the upstream 3xx Location leaks the origin, rewrite it to be relative
 * to the customer host. Handles both absolute-URL Locations (a bug we
 * shouldn't emit but defend against) and paths under /preview/site/<id>
 * (which we present as clean paths on launcharoo.online).
 */
function rewriteLocationHeader(
  response: Response,
  vercelOrigin: string,
  tenantId: string | null,
): Response {
  if (response.status < 300 || response.status >= 400) return response;
  const location = response.headers.get("location");
  if (!location) return response;

  let rewritten = location;

  // Strip the vercel origin if present.
  if (rewritten.startsWith(vercelOrigin)) {
    rewritten = rewritten.slice(vercelOrigin.length) || "/";
  }

  // Strip the /preview/site/<tenantId> prefix so links stay clean.
  if (tenantId) {
    const prefix = `/preview/site/${tenantId}`;
    if (rewritten === prefix) rewritten = "/";
    else if (rewritten.startsWith(prefix + "/"))
      rewritten = rewritten.slice(prefix.length);
    else if (rewritten.startsWith(prefix + "?"))
      rewritten = "/" + rewritten.slice(prefix.length + 1);
  }

  if (rewritten === location) return response;

  const headers = new Headers(response.headers);
  headers.set("location", rewritten);
  // Redirect responses shouldn't be cached — state can flip
  // (expired → active on support intervention).
  headers.set("cache-control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function proxy(
  request: Request,
  origin: string,
  upstreamPath: string,
  originalHost: string,
  tenantId: string | null,
): Promise<Response> {
  const url = new URL(request.url);
  const upstream = new URL(upstreamPath, origin);
  upstream.search = url.search;

  const headers = new Headers(request.headers);
  headers.set("X-Forwarded-Host", originalHost);
  headers.set("X-Forwarded-Proto", "https");

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  const upstreamReq = new Request(upstream.toString(), {
    method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: "manual",
  });

  const res = await fetch(upstreamReq);
  return rewriteLocationHeader(res, origin, tenantId);
}

/* ----------------------------------------------- branded error responses */

const BRAND_STYLES = `
  body { margin:0; padding:0; background:#0A0F1E; color:#fff;
         font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
         min-height:100vh; display:flex; align-items:center; justify-content:center; }
  .card { max-width:520px; padding:48px 32px; text-align:center; }
  h1 { font-size:28px; font-weight:800; margin:0 0 12px; letter-spacing:-0.02em; }
  p  { font-size:16px; line-height:1.5; color:rgba(255,255,255,0.6); margin:0 0 24px; }
  a  { color:#60a5fa; text-decoration:none; font-weight:600; }
  a:hover { text-decoration:underline; }
  .small { font-size:12px; color:rgba(255,255,255,0.3); margin-top:32px; }
`;

function brandedHtml(status: number, title: string, body: string, ctaHref?: string): Response {
  const cta = ctaHref
    ? `<p><a href="${ctaHref}">Get your own website in 60 seconds →</a></p>`
    : "";
  return new Response(
    `<!doctype html><html lang="en"><head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>${title}</title>
      <meta name="robots" content="noindex"/>
      <style>${BRAND_STYLES}</style>
    </head><body>
      <div class="card">
        <h1>${title}</h1>
        <p>${body}</p>
        ${cta}
        <div class="small">launcharoo.online</div>
      </div>
    </body></html>`,
    {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

function notFoundResponse(): Response {
  return brandedHtml(
    404,
    "Site not found",
    "This address doesn't point to a live website.",
  );
}

function apexLandingResponse(): Response {
  return brandedHtml(
    200,
    "Launcharoo",
    "Fast websites for local service businesses.",
  );
}

function upstreamErrorResponse(): Response {
  return brandedHtml(
    502,
    "Temporarily unavailable",
    "We're having trouble reaching this website. Please try again in a moment.",
  );
}

/* ----------------------------------------------- main handler */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();

    const slug = extractSlug(host, env.SITE_DOMAIN);
    if (slug === null || slug === "www") {
      // Apex or www — serve a small landing placeholder, no origin leak.
      return apexLandingResponse();
    }

    if (RESERVED_SLUGS.has(slug) || slug.includes(".")) {
      // Nested subdomain (e.g. foo.bar.launcharoo.online) or a reserved
      // word (e.g. api.launcharoo.online). Refuse cleanly.
      return notFoundResponse();
    }

    // Asset requests always proxy through with path unchanged. We don't
    // know the tenantId yet — the Next.js chunks are shared across all
    // tenants, and static file paths don't need rewriting.
    if (isPassthroughPath(url.pathname)) {
      return proxy(request, env.VERCEL_ORIGIN, url.pathname, host, null);
    }

    let lookup;
    try {
      lookup = await lookupTenant(env.VERCEL_ORIGIN, slug);
    } catch (err) {
      console.error(`[launcharoo-router] slug=${slug} lookup failed:`, err);
      return upstreamErrorResponse();
    }
    if (!lookup) {
      return notFoundResponse();
    }

    if (lookup.expired) {
      // Serve Vercel's /expired/<tenantId> page under the customer host so
      // the URL doesn't leak. The page itself has an internal 302 to
      // /preview/site/<id> which the rewriteLocation helper will strip.
      return proxy(
        request,
        env.VERCEL_ORIGIN,
        `/expired/${lookup.tenantId}`,
        host,
        lookup.tenantId,
      );
    }

    const rewritten =
      url.pathname === "/"
        ? `/preview/site/${lookup.tenantId}`
        : `/preview/site/${lookup.tenantId}${url.pathname}`;

    return proxy(request, env.VERCEL_ORIGIN, rewritten, host, lookup.tenantId);
  },
} satisfies ExportedHandler<Env>;
