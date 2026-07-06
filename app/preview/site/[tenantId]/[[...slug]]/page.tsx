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
 * Phase L: if ?editRequest=<id> is present and the edit request is in
 * "preview" status, the proposed SiteProps are used instead of the stored
 * tenant SiteProps, and an EditPreviewBanner is overlaid at the bottom.
 *
 * This is a server component — it reads from the local file store directly.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTenant } from "@/lib/tenant-store";
import { getEditRequest } from "@/lib/edit-requests-store";
import { sitePropsSchema } from "@/shared/types/site-props";
import type { SiteProps } from "@/shared/types/site-props";
import { renderTradesPage, tradesPageMetadata } from "@/templates/categories/trades";
import { renderAlliedHealthPage, alliedHealthPageMetadata } from "@/templates/categories/allied-health";
import { renderBeautyPage, beautyPageMetadata } from "@/templates/categories/beauty-aesthetics";
import { renderFitnessPage, fitnessPageMetadata } from "@/templates/categories/fitness-wellness";
import { EditPreviewBanner } from "@/shared/ui/edit-preview-banner";

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

/**
 * Resolve the effective SiteProps: if an editRequestId is provided and the
 * edit request is in "preview" state with valid proposedSiteProps, return
 * those; otherwise fall back to tenant.siteProps.
 */
async function resolveProposedSite(
  tenant: { siteProps: SiteProps },
  editRequestId: string | undefined
): Promise<
  | { site: SiteProps; isPreview: true; editReqId: string; changeSummary: string; request: string }
  | { site: SiteProps; isPreview: false }
> {
  if (!editRequestId) return { site: tenant.siteProps, isPreview: false };

  const editReq = await getEditRequest(editRequestId);
  if (
    !editReq ||
    editReq.status !== "preview" ||
    !editReq.proposedSiteProps
  ) {
    return { site: tenant.siteProps, isPreview: false };
  }

  const parsed = sitePropsSchema.safeParse(editReq.proposedSiteProps);
  if (!parsed.success) {
    return { site: tenant.siteProps, isPreview: false };
  }

  return {
    site: parsed.data,
    isPreview: true,
    editReqId: editReq.id,
    changeSummary: editReq.changeSummary ?? "Proposed change",
    request: editReq.request,
  };
}

/* -------------------------------------------------------------------- routes */

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<{ editRequest?: string }>;
}): Promise<Metadata> {
  const { tenantId, slug = [] } = await params;
  const { editRequest: editRequestId } = await searchParams;

  const tenant = await getTenant(tenantId);
  if (!tenant) return { title: "Not Found" };

  const parseResult = sitePropsSchema.safeParse(tenant.siteProps);
  if (!parseResult.success) return { title: tenant.name };

  // Use proposed site props for metadata if in preview mode
  const resolved = await resolveProposedSite(tenant, editRequestId);
  const site = resolved.site;

  const meta = pageMetadata(tenant.category, site, slug);
  return { title: meta.title, description: meta.description };
}

export default async function TenantPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<{ editRequest?: string }>;
}): Promise<React.ReactElement> {
  const { tenantId, slug = [] } = await params;
  const { editRequest: editRequestId } = await searchParams;

  const tenant = await getTenant(tenantId);
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

  // Resolve effective site props (may be proposed edit preview)
  const resolved = await resolveProposedSite(tenant, editRequestId);

  const page = renderPage(tenant.category, resolved.site, slug, tenantId);
  if (!page) notFound();

  if (resolved.isPreview) {
    return (
      <>
        <EditPreviewBanner
          editRequestId={resolved.editReqId}
          changeSummary={resolved.changeSummary}
          request={resolved.request}
          tenantId={tenantId}
        />
        {page}
      </>
    );
  }

  return page;
}
