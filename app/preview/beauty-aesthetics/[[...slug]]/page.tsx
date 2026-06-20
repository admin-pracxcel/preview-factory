import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sitePropsSchema, enumerateSitePaths } from "@/shared/types/site-props";
import { renderBeautyPage, beautyPageMetadata } from "@/templates/categories/beauty-aesthetics";
import siteData from "@/templates/categories/beauty-aesthetics/example-data/salon-site.json";

/**
 * Multi-page preview route for the BEAUTY-AESTHETICS category.
 *
 * Renders the Studio Luma hair salon example site as a navigable, multi-page website:
 *   /preview/beauty-aesthetics                       -> home
 *   /preview/beauty-aesthetics/services/[slug]       -> service-detail page
 *   /preview/beauty-aesthetics/locations/[slug]      -> location (suburb) page
 *   /preview/beauty-aesthetics/areas/[slug]          -> service-in-area landing page
 *   /preview/beauty-aesthetics/faq                   -> FAQ page
 *   /preview/beauty-aesthetics/about                 -> about page
 *
 * The raw JSON is validated/normalised through the canonical SiteProps schema,
 * so defaults are applied and the data is guaranteed to match `SiteProps`.
 */
const site = sitePropsSchema.parse(siteData);
const BASE_PATH = "/preview/beauty-aesthetics";

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
  const meta = beautyPageMetadata(site, slug);
  return { title: meta.title, description: meta.description };
}

export default async function BeautyPreviewPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug = [] } = await params;
  const page = renderBeautyPage(site, slug, BASE_PATH);
  if (!page) notFound();
  return page;
}
