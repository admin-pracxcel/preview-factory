import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sitePropsSchema, enumerateSitePaths } from "@/shared/types/site-props";
import { renderAlliedHealthPage, alliedHealthPageMetadata } from "@/templates/categories/allied-health";
import siteData from "@/templates/categories/allied-health/example-data/physio-site.json";

/**
 * Multi-page preview route for the ALLIED-HEALTH category.
 *
 * Renders the Restore Physio example site as a navigable, multi-page website:
 *   /preview/allied-health                       -> home
 *   /preview/allied-health/services/[slug]       -> service-detail page
 *   /preview/allied-health/locations/[slug]      -> location (suburb) page
 *   /preview/allied-health/areas/[slug]          -> service-in-area landing page
 *   /preview/allied-health/faq                   -> FAQ page
 *   /preview/allied-health/about                 -> about page
 *
 * The raw JSON is validated/normalised through the canonical SiteProps schema,
 * so defaults are applied and the data is guaranteed to match `SiteProps`.
 */
const site = sitePropsSchema.parse(siteData);
const BASE_PATH = "/preview/allied-health";

type RouteParams = { slug?: string[] };

export function generateStaticParams(): Array<{ slug: string[] }> {
  // Skip the home entry ({slug: []}); the root renders on demand.
  return enumerateSitePaths(site).filter((p) => p.slug.length > 0);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug = [] } = await params;
  const meta = alliedHealthPageMetadata(site, slug);
  return { title: meta.title, description: meta.description };
}

export default async function AlliedHealthPreviewPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug = [] } = await params;
  const page = renderAlliedHealthPage(site, slug, BASE_PATH);
  if (!page) notFound();
  return page;
}
