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
const CACHE_HEADER = "public, s-maxage=3600, stale-while-revalidate=86400";

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
  const rawHost = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase();
  const host = rawHost.replace(/:\d+$/, "");

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
