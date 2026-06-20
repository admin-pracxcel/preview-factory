import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sitePropsSchema, enumerateSitePaths } from "@/shared/types/site-props";
import { renderTradesPage, tradesPageMetadata } from "@/templates/categories/trades";
import siteData from "@/templates/categories/trades/example-data/electrician-site.json";

/**
 * Multi-page preview route for the TRADES category.
 *
 * Renders the full electrician example site as a navigable, multi-page website:
 *   /preview/trades                       -> home
 *   /preview/trades/services/[slug]       -> service-detail page
 *   /preview/trades/locations/[slug]      -> location (suburb) page
 *   /preview/trades/areas/[slug]          -> service-in-area landing page
 *   /preview/trades/faq                   -> FAQ page
 *   /preview/trades/about                 -> about page
 *
 * The raw JSON is validated/normalised through the canonical SiteProps schema,
 * so defaults are applied and the data is guaranteed to match `SiteProps`.
 */
const site = sitePropsSchema.parse(siteData);
const BASE_PATH = "/preview/trades";

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
  const meta = tradesPageMetadata(site, slug);
  return { title: meta.title, description: meta.description };
}

export default async function TradesPreviewPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug = [] } = await params;
  const page = renderTradesPage(site, slug, BASE_PATH);
  if (!page) notFound();
  return page;
}
