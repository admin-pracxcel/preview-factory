/**
 * app/preview/site/[tenantId]/[[...slug]]/page.tsx
 *
 * Universal per-tenant site renderer.
 * Loads the tenant record from the file store, validates the SiteProps, and
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
 * This is a server component — it reads from the local file store directly.
 */

import { notFound } from "next/navigation";
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

function renderPage(
  category: string,
  site: SiteProps,
  slug: string[],
  tenantId: string
): React.ReactElement | null {
  const bp = basePath(tenantId);
  switch (category) {
    case "allied-health":
      return renderAlliedHealthPage(site, slug, bp);
    case "beauty-aesthetics":
      return renderBeautyPage(site, slug, bp);
    case "fitness-wellness":
      return renderFitnessPage(site, slug, bp);
    default:
      // "trades" and any unknown category fall through to trades renderer
      return renderTradesPage(site, slug, bp);
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
  const tenant = getTenant(tenantId);
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

  const tenant = getTenant(tenantId);
  if (!tenant) notFound();

  const parseResult = sitePropsSchema.safeParse(tenant.siteProps);
  if (!parseResult.success) {
    // Schema changed after generation — render a simple error page
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

  const site = parseResult.data;
  const page = renderPage(tenant.category, site, slug, tenantId);
  if (!page) notFound();
  return page;
}
