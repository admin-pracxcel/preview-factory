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
const CACHE_HEADER = "public, s-maxage=3600, stale-while-revalidate=86400";

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
  // Snapshot of the header inputs, used for diagnostics on 404 paths until
  // this route is confirmed working across every host we serve.
  const diag = {
    xForwardedHost: h.get("x-forwarded-host") ?? "",
    host: h.get("host") ?? "",
    vercelHost: h.get("x-vercel-deployment-url") ?? "",
    forwarded: h.get("forwarded") ?? "",
    resolved: host,
  };

  console.log(`[sitemap] request ${JSON.stringify(diag)}`);

  if (!host || host === VERCEL_ORIGIN) {
    return notFound("origin_or_empty", diag);
  }

  const bareHost = host.startsWith("www.") ? host.slice(4) : host;

  // Marketing site
  if (bareHost === MARKETING_HOST) {
    return xmlResponse(marketingEntries(), MARKETING_HOST);
  }

  // Subdomain of the marketing host → tenant by slug
  if (bareHost.endsWith(`.${MARKETING_HOST}`)) {
    const slug = bareHost.slice(0, bareHost.length - MARKETING_HOST.length - 1);
    const tenantId = await tenantIdBySlug(slug);
    if (!tenantId) return notFound("slug_not_found", { ...diag, slug });
    return await tenantResponse(tenantId, bareHost);
  }

  // Anything else → try as a custom domain
  const { data } = await supabase()
    .from("tenants")
    .select("id, custom_domain_status")
    .eq("custom_domain", bareHost)
    .maybeSingle();
  if (!data || data.custom_domain_status !== "active") {
    return notFound("custom_domain_not_active", {
      ...diag,
      bareHost,
      customDomainStatus: data?.custom_domain_status ?? null,
    });
  }
  return await tenantResponse(data.id as string, bareHost);
}

/**
 * Resolve the public-facing host in the presence of multi-hop proxies.
 *
 * Vercel's edge appends its own hostname to X-Forwarded-Host, so a request
 * flowing through the Cloudflare Worker arrives as e.g.
 *   "launcharoo.online, preview-factory.vercel.app"
 * We want the FIRST value in the list — that's the customer-facing host set
 * by the Worker before Vercel got involved. If nothing usable is in
 * x-forwarded-host, fall back to the immediate Host header. Then strip any
 * stray port and lowercase.
 */
function resolvePublicHost(h: Headers): string {
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
  if (!tenant || tenant.isExpired) {
    return notFound("tenant_missing_or_expired", { tenantId, host });
  }

  const parsed = sitePropsSchema.safeParse(tenant.siteProps);
  if (!parsed.success) {
    return notFound("siteprops_invalid", { tenantId, host });
  }

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

function notFound(
  reason: string,
  diag: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    { error: "Not found", reason, diag },
    { status: 404 },
  );
}
