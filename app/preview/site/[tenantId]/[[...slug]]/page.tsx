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
import { getTenant, type GenerationStatus } from "@/lib/tenant-store";
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
  if (!tenant.hasSiteProps) {
    return {
      title:
        tenant.generationStatus === "failed"
          ? `${tenant.name || "Your site"} — generation failed`
          : `${tenant.name || "Your site"} — building`,
    };
  }

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

  // Guard against rendering before generation has produced a site. Without
  // this branch, `siteProps` is the empty-object fallback from rowToRecord
  // and Zod reports every top-level key as "expected object, received
  // undefined" — misleading noise for what's really just a not-ready state.
  if (!tenant.hasSiteProps) {
    return renderNotReadyState(tenantId, tenant.generationStatus, tenant.name);
  }

  const parseResult = sitePropsSchema.safeParse(tenant.siteProps);
  if (!parseResult.success) {
    const issues = parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    console.error(
      `[site-render] SiteProps validation failed for tenant=${tenantId}`,
      { category: tenant.category, issues },
    );
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white p-8">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold mb-4 text-center">Preview Unavailable</h1>
          <p className="text-slate-400 mb-6 text-center">
            The generator produced a site that didn&apos;t match the current
            schema. Details below — share these so we can fix the root cause.
          </p>
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-4">
            <p className="text-xs font-mono text-red-300 mb-2">
              tenant: {tenantId} &middot; category: {tenant.category}
            </p>
            <ul className="text-xs font-mono text-red-200 space-y-1 max-h-96 overflow-y-auto">
              {issues.slice(0, 30).map((issue) => (
                <li key={issue}>&bull; {issue}</li>
              ))}
              {issues.length > 30 && (
                <li className="text-red-400/80">
                  &hellip; and {issues.length - 30} more
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const page = await renderPage(tenant.category, parseResult.data, slug, tenantId);
  if (!page) notFound();
  return page;
}

/**
 * Friendly page shown when we hit the site URL before generation has
 * populated site_props. Splits into three real cases:
 *   - queued / running → your site is still being built
 *   - failed           → generation failed, we've been notified
 *   - anything else with empty site_props (shouldn't happen in prod, but the
 *     housekeeping blank-out for expired sites could land here if the reaper
 *     step ran but the row wasn't flipped to 'expired' — cover it anyway)
 *
 * This deliberately does NOT auto-refresh — a running generation typically
 * takes 30-90s, and stapling a polling loop into a public site render is a
 * lot of complexity for a state that is normally resolved before anyone
 * visits this URL. Refresh instructions are enough.
 */
function renderNotReadyState(
  tenantId: string,
  status: GenerationStatus,
  tenantName: string,
): React.ReactElement {
  const isFailed = status === "failed";
  const isBuilding = status === "queued" || status === "running";
  // "done"/"claimed" but no site_props means the generation pipeline flipped
  // the tenant to done without a valid payload — treat it the same as a
  // failed run (it *is* failed) and shout in the server logs so we notice.
  const isBrokenDone =
    (status === "done" || status === "claimed") && !isBuilding && !isFailed;
  if (isBrokenDone) {
    console.error(
      `[site-render] tenant=${tenantId} status=${status} has NULL site_props — generation pipeline flipped status without writing content`,
    );
  }
  const displayName = tenantName?.trim() || "Your site";

  const title = isFailed || isBrokenDone
    ? "We couldn't finish building your site"
    : isBuilding
      ? `${displayName} is still being built`
      : `${displayName} isn't available yet`;

  const body = isFailed || isBrokenDone
    ? "Our generator ran into an error while producing this site. We've been notified and will get it back on track — please contact support if this persists."
    : isBuilding
      ? "This usually takes about a minute. Refresh the page shortly and your site will be here."
      : "There's no site content for this tenant yet. If you were expecting to see one, contact support.";

  const badgeClass = isFailed || isBrokenDone
    ? "border-red-500/30 bg-red-500/10 text-red-200"
    : isBuilding
      ? "border-blue-500/30 bg-blue-500/10 text-blue-200"
      : "border-white/10 bg-white/5 text-white/60";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-white">
      <div className="max-w-lg text-center">
        <span
          className={`inline-block rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${badgeClass}`}
        >
          {status}
        </span>
        <h1 className="mt-4 font-[family-name:var(--font-sora)] text-2xl font-extrabold sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-slate-400">{body}</p>
        <p className="mt-6 text-[11px] font-mono text-slate-600">
          tenant: {tenantId}
        </p>
      </div>
    </div>
  );
}
