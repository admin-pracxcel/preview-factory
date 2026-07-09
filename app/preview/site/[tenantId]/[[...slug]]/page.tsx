/**
 * app/preview/site/[tenantId]/[[...slug]]/page.tsx
 *
 * Universal per-tenant site renderer.
 * Loads the tenant record from the store, validates the SiteProps, and
 * dispatches to the correct category renderer based on `tenant.category`.
 *
 * Routes:
 *   /preview/site/<tenantId>                   → home page
 *   /preview/site/<tenantId>/services/<slug>   → service-detail page
 *   /preview/site/<tenantId>/locations/<slug>  → location page
 *   /preview/site/<tenantId>/areas/<slug>      → service-in-area page
 *   /preview/site/<tenantId>/faq              → FAQ page
 *   /preview/site/<tenantId>/about            → about page
 *
 * This is a server component — it reads from the store directly.
 */

import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getTenant } from "@/lib/tenant-store";
import { sitePropsSchema } from "@/shared/types/site-props";
import type { SiteProps } from "@/shared/types/site-props";
import { renderTradesPage, tradesPageMetadata } from "@/templates/categories/trades";
import { renderAlliedHealthPage, alliedHealthPageMetadata } from "@/templates/categories/allied-health";
import { renderBeautyPage, beautyPageMetadata } from "@/templates/categories/beauty-aesthetics";
import { renderFitnessPage, fitnessPageMetadata } from "@/templates/categories/fitness-wellness";

/* ----------------------------------------------------------------------- types */

type RouteParams = { tenantId: string; slug?: string[] };

/* -------------------------------------------------------------------- helpers */

function basePath(tenantId: string): string {
  return `/preview/site/${tenantId}`;
}

/**
 * When the request came in via the Cloudflare Worker (either at
 * <slug>.launcharoo.online OR a customer's own custom domain), use an
 * empty basePath so all internal hrefs render as clean paths. The Worker
 * sets a custom X-Launcharoo-Host header on every proxied request; Vercel's
 * edge strips X-Forwarded-Host and rewrites it to the Vercel origin, so
 * that header is unreliable behind the two-hop proxy — the custom header
 * is what survives.
 */
async function effectiveBasePath(tenantId: string): Promise<string> {
  const h = await headers();
  const launcharooHost = h.get("x-launcharoo-host") ?? "";
  if (launcharooHost.trim().length > 0) return "";
  return basePath(tenantId);
}

async function renderPage(
  category: string,
  site: SiteProps,
  slug: string[],
  tenantId: string,
): Promise<React.ReactElement | null> {
  const bp = await effectiveBasePath(tenantId);
  switch (category) {
    case "allied-health":
      return renderAlliedHealthPage(site, slug, bp, tenantId);
    case "beauty-aesthetics":
      return renderBeautyPage(site, slug, bp, tenantId);
    case "fitness-wellness":
      return renderFitnessPage(site, slug, bp, tenantId);
    default:
      // "trades" and any unknown category fall through to trades renderer
      return renderTradesPage(site, slug, bp, tenantId);
  }
}

function pageMetadata(
  category: string,
  site: SiteProps,
  slug: string[]
): { title: string; description?: string } {
  switch (category) {
    case "allied-health":
      return alliedHealthPageMetadata(site, slug);
    case "beauty-aesthetics":
      return beautyPageMetadata(site, slug);
    case "fitness-wellness":
      return fitnessPageMetadata(site, slug);
    default:
      return tradesPageMetadata(site, slug);
  }
}

/* -------------------------------------------------------------------- routes */

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { tenantId, slug = [] } = await params;

  const tenant = await getTenant(tenantId);
  if (!tenant) return { title: "Not Found" };

  const parseResult = sitePropsSchema.safeParse(tenant.siteProps);
  if (!parseResult.success) return { title: tenant.name };

  const meta = pageMetadata(tenant.category, parseResult.data, slug);
  return { title: meta.title, description: meta.description };
}

export default async function TenantPreviewPage({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<React.ReactElement> {
  const { tenantId, slug = [] } = await params;

  const tenant = await getTenant(tenantId);
  if (!tenant) notFound();
  if (tenant.isExpired) redirect(`/expired/${tenantId}`);

  const parseResult = sitePropsSchema.safeParse(tenant.siteProps);
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    console.error(
      `[site-render] SiteProps validation failed for tenant=${tenantId}`,
      { category: tenant.category, issues },
    );
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white p-8">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl font-bold mb-4">Preview Unavailable</h1>
          <p className="text-slate-400">
            This preview was generated with an older schema. Please re-generate.
          </p>
        </div>
      </div>
    );
  }

  const page = await renderPage(tenant.category, parseResult.data, slug, tenantId);
  if (!page) notFound();
  return page;
}
