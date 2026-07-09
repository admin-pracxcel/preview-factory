/**
 * app/robots.txt/route.ts
 * Dynamic per-host robots.txt.
 *
 * Every host (marketing + every tenant subdomain + every custom domain) needs
 * its own Sitemap: line pointing to the sitemap on the same host. The
 * Cloudflare Worker sets X-Forwarded-Host on proxied requests so we can tell
 * which one we're serving.
 *
 * The raw Vercel origin (preview-factory.vercel.app) gets a full disallow —
 * belt and braces with the X-Robots-Tag noindex header the middleware adds.
 *
 * NOTE: the previous static public/robots.txt has been removed. Static files
 * in public/ shadow app routes, so this route wouldn't fire while it was
 * still there.
 */

import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MARKETING_HOST = "launcharoo.online";
const VERCEL_ORIGIN = "preview-factory.vercel.app";
// One route serves every host, and Vercel's edge caches by URL path alone
// unless we opt out. Without this the first host to hit /robots.txt gets
// its response cached and every other host sees the wrong file. Skip the
// shared cache; browser can hold it briefly.
const CACHE_HEADER = "private, max-age=300, must-revalidate";

const DISALLOWS = [
  "/dashboard",
  "/admin",
  "/login",
  "/welcome",
  "/expired",
  "/building",
  "/upsell",
  "/api",
  "/monitoring",
];

export async function GET(): Promise<Response> {
  const h = await headers();
  const host = resolvePublicHost(h);

  console.log(
    `[robots] request xfh="${h.get("x-forwarded-host") ?? ""}" host="${h.get("host") ?? ""}" resolved="${host}"`,
  );

  if (host === VERCEL_ORIGIN) {
    return text(
      "# Origin — not indexable.\nUser-agent: *\nDisallow: /\n",
    );
  }

  const publicHost = host || MARKETING_HOST;
  const body = [
    "# Launcharoo robots policy.",
    "# Owner pages, transactional flows, and API endpoints are not indexable.",
    "# Everything else on this host is.",
    "",
    "User-agent: *",
    "",
    ...DISALLOWS.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: https://${publicHost}/sitemap.xml`,
    "",
  ].join("\n");

  return text(body);
}

function text(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": CACHE_HEADER,
    },
  });
}

/**
 * Resolve the public-facing host in the presence of multi-hop proxies.
 *
 * The Cloudflare Worker sets a custom X-Launcharoo-Host header with the
 * hostname the customer typed, because Vercel's edge strips or replaces
 * X-Forwarded-Host with its own hostname before it reaches this function.
 * Prefer the custom header; fall back to X-Forwarded-Host (list-aware) and
 * finally the immediate Host header.
 */
function resolvePublicHost(h: Headers): string {
  const launcharoo = (h.get("x-launcharoo-host") ?? "").trim();
  if (launcharoo) return launcharoo.toLowerCase().replace(/:\d+$/, "");

  const xfh = h.get("x-forwarded-host") ?? "";
  const candidates = xfh
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== VERCEL_ORIGIN);
  const first = candidates[0] ?? h.get("host") ?? "";
  return first.toLowerCase().replace(/:\d+$/, "");
}
