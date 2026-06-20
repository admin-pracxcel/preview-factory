import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sitePropsSchema, enumerateSitePaths } from "@/shared/types/site-props";
import { renderTradesPage, tradesPageMetadata } from "@/templates/categories/trades";
import siteData from "@/generator/output/clearflow-plumbing.json";

/**
 * Live preview of the GENERATOR OUTPUT for Clearflow Plumbing (Melbourne plumber).
 *
 * This route renders the JSON produced by `node generator/run.mjs`, using the
 * same trades template as /preview/trades. It lets you compare the AI-generated
 * site against the hand-crafted electrician example.
 *
 *   /preview/plumber                       -> home
 *   /preview/plumber/services/[slug]       -> service-detail page
 *   /preview/plumber/locations/[slug]      -> location (suburb) page
 *   /preview/plumber/areas/[slug]          -> service-in-area landing page
 *   /preview/plumber/faq                   -> FAQ page
 *   /preview/plumber/about                 -> about page
 */
const site = sitePropsSchema.parse(siteData);
const BASE_PATH = "/preview/plumber";

type RouteParams = { slug?: string[] };

export function generateStaticParams(): Array<{ slug: string[] }> {
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

export default async function PlumberPreviewPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug = [] } = await params;
  const page = renderTradesPage(site, slug, BASE_PATH);
  if (!page) notFound();
  return page;
}
