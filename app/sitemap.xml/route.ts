/**
 * app/sitemap.xml/route.ts
 * Dynamic per-host sitemap.
 *
 * Every host we serve (the marketing site + every claimed tenant subdomain +
 * every active custom domain) gets its own sitemap. Google + Bing follow the
 * `Sitemap:` line in robots.txt back to /sitemap.xml on the same host, so
 * this one route handles all three cases via the X-Forwarded-Host that the
 * Cloudflare Worker sets on proxied traffic.
 *
 * Behaviour:
 *   - launcharoo.online (marketing)  → marketing sitemap
 *   - <slug>.launcharoo.online       → tenant sitemap (looked up by slug)
 *   - customer.tld (custom domain)   → tenant sitemap (looked up by domain)
 *   - preview-factory.vercel.app     → 404 (origin is X-Robots-Tag noindex)
 *
 * Cached at the edge for 1 hour — a small amount of staleness is fine for a
 * sitemap, and keeps Supabase read pressure down when a big crawl kicks in.
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getTenant } from "@/lib/tenant-store";
import { tenantIdBySlug } from "@/lib/slug";
import { supabase } from "@/lib/supabase";
import { sitePropsSchema, type SiteProps } from "@/shared/types/site-props";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MARKETING_HOST = "launcharoo.online";
const VERCEL_ORIGIN = "preview-factory.vercel.app";
// One route serves every host, and Vercel's edge caches by URL path alone
// unless we opt out. Without this, the first host to hit /sitemap.xml gets
// its response cached and every other host sees the wrong sitemap. Vary
// alone is unreliable on Vercel's shared cache — safest bet is to skip the
// shared cache entirely and let the browser hold onto the response briefly.
const CACHE_HEADER = "private, max-age=300, must-revalidate";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
}

export async function GET(): Promise<Response> {
  const h = await headers();
  const host = resolvePublicHost(h);

  if (!host || host === VERCEL_ORIGIN) {
    return notFound();
  }

  const bareHost = host.startsWith("www.") ? host.slice(4) : host;

  // Marketing site
  if (bareHost === MARKETING_HOST) {
    return xmlResponse(marketingEntries(), MARKETING_HOST);
  }

  // Slug subdomain of the marketing host — treated as a staging URL, not
  // an indexable destination. Robots.txt on this host already disallows
  // everything; a 404 sitemap tells any crawler that follows the sitemap
  // path directly there's nothing to enumerate.
  if (bareHost.endsWith(`.${MARKETING_HOST}`)) {
    return notFound();
  }

  // Anything else → try as a custom domain
  const { data } = await supabase()
    .from("tenants")
    .select("id, custom_domain_status")
    .eq("custom_domain", bareHost)
    .maybeSingle();
  if (!data || data.custom_domain_status !== "active") {
    return notFound();
  }
  return await tenantResponse(data.id as string, bareHost);
}

/**
 * Resolve the public-facing host in the presence of multi-hop proxies.
 *
 * The Cloudflare Worker sets a custom X-Launcharoo-Host header with the
 * hostname the customer typed, because Vercel's edge strips or replaces
 * X-Forwarded-Host with its own hostname before it reaches this function.
 * Prefer the custom header; fall back to X-Forwarded-Host (list-aware) and
 * finally the immediate Host header. Then strip any stray port and lowercase.
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

/* ---------------------------------------------------------------- tenant */

async function tenantResponse(tenantId: string, host: string): Promise<Response> {
  const tenant = await getTenant(tenantId);
  if (!tenant || tenant.isExpired) return notFound();

  const parsed = sitePropsSchema.safeParse(tenant.siteProps);
  if (!parsed.success) return notFound();

  const entries = tenantEntries(parsed.data, tenant.updatedAt);
  return xmlResponse(entries, host);
}

function tenantEntries(site: SiteProps, updatedAt?: string): SitemapEntry[] {
  const lastmod = updatedAt ?? new Date().toISOString();
  const entries: SitemapEntry[] = [
    { path: "/", lastmod, changefreq: "weekly", priority: 1.0 },
  ];

  for (const service of site.services ?? []) {
    if (service.slug) {
      entries.push({
        path: `/services/${service.slug}`,
        lastmod,
        changefreq: "monthly",
        priority: 0.8,
      });
    }
  }

  for (const location of site.locations ?? []) {
    if (location.slug) {
      entries.push({
        path: `/locations/${location.slug}`,
        lastmod,
        changefreq: "monthly",
        priority: 0.8,
      });
    }
  }

  for (const area of site.service_areas ?? []) {
    if (area.slug) {
      entries.push({
        path: `/areas/${area.slug}`,
        lastmod,
        changefreq: "monthly",
        priority: 0.6,
      });
    }
  }

  if (site.faq) {
    entries.push({
      path: "/faq",
      lastmod,
      changefreq: "monthly",
      priority: 0.5,
    });
  }
  if (site.about) {
    entries.push({
      path: "/about",
      lastmod,
      changefreq: "monthly",
      priority: 0.5,
    });
  }

  return entries;
}

/* ------------------------------------------------------------- marketing */

function marketingEntries(): SitemapEntry[] {
  const now = new Date().toISOString();
  const entry = (
    path: string,
    priority: number,
    changefreq: SitemapEntry["changefreq"],
  ): SitemapEntry => ({ path, lastmod: now, priority, changefreq });

  return [
    entry("/", 1.0, "weekly"),
    entry("/for/trades", 0.9, "monthly"),
    entry("/for/allied-health", 0.9, "monthly"),
    entry("/for/beauty", 0.9, "monthly"),
    entry("/for/fitness", 0.9, "monthly"),
    entry("/websites-for-tradies", 0.9, "monthly"),
    entry("/websites-for-allied-health", 0.9, "monthly"),
    entry("/websites-for-beauty", 0.9, "monthly"),
    entry("/websites-for-fitness", 0.9, "monthly"),
    entry("/privacy", 0.3, "yearly"),
    entry("/terms", 0.3, "yearly"),
  ];
}

/* ---------------------------------------------------------------- render */

function xmlResponse(entries: SitemapEntry[], host: string): Response {
  const origin = `https://${host}`;
  const urls = entries
    .map((e) => {
      const parts: string[] = [`    <loc>${escapeXml(origin + e.path)}</loc>`];
      if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`);
      if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (e.priority !== undefined) {
        parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
      }
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": CACHE_HEADER,
    },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
