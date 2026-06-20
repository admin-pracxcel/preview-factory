import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sitePropsSchema, enumerateSitePaths } from "@/shared/types/site-props";
import { renderFitnessPage, fitnessPageMetadata } from "@/templates/categories/fitness-wellness";
import siteData from "@/templates/categories/fitness-wellness/example-data/trainer-site.json";

/**
 * Multi-page preview route for the FITNESS-WELLNESS category.
 *
 * Renders the full personal trainer example site as a navigable, multi-page website:
 *   /preview/fitness-wellness                       -> home
 *   /preview/fitness-wellness/services/[slug]       -> service-detail page
 *   /preview/fitness-wellness/locations/[slug]      -> location (suburb) page
 *   /preview/fitness-wellness/areas/[slug]          -> service-in-area landing page
 *   /preview/fitness-wellness/faq                   -> FAQ page
 *   /preview/fitness-wellness/about                 -> about page
 *
 * The raw JSON is validated/normalised through the canonical SiteProps schema,
 * so defaults are applied and the data is guaranteed to match `SiteProps`.
 */
const site = sitePropsSchema.parse(siteData);
const BASE_PATH = "/preview/fitness-wellness";

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
  const meta = fitnessPageMetadata(site, slug);
  return { title: meta.title, description: meta.description };
}

export default async function FitnessWellnessPreviewPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug = [] } = await params;
  const page = renderFitnessPage(site, slug, BASE_PATH);
  if (!page) notFound();
  return page;
}
