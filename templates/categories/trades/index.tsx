/**
 * Trades category — multi-page site renderer.
 *
 * Given a validated `SiteProps` object, a `basePath` (where the site is mounted,
 * e.g. "/preview/trades") and a `slug[]` from the catch-all route, this resolves
 * and renders the correct page. Also exposes per-page `<title>/<description>`
 * metadata for Next.js `generateMetadata`.
 *
 * Covers the seven required niches in this category (electrician, plumber,
 * house-cleaning, HVAC, carpenter, etc.) — niche differences are handled at
 * generation time via the category system prompt, not by separate components.
 */
import type { SiteProps } from "@/shared/types/site-props";
import { HomePage } from "./pages/HomePage";
import { ServiceDetailPage } from "./pages/ServiceDetailPage";
import { LocationPage } from "./pages/LocationPage";
import { ServiceAreaPage } from "./pages/ServiceAreaPage";
import { FaqPage } from "./pages/FaqPage";
import { AboutPage } from "./pages/AboutPage";

export { HomePage, ServiceDetailPage, LocationPage, ServiceAreaPage, FaqPage, AboutPage };

/** Resolve a slug[] to a rendered page element, or null if not found. */
export function renderTradesPage(
  site: SiteProps,
  slug: string[],
  basePath: string,
): React.ReactElement | null {
  // Home
  if (!slug || slug.length === 0) return <HomePage site={site} basePath={basePath} />;

  const [section, key] = slug;

  if (section === "services" && key) {
    const page = site.services.find((s) => s.slug === key);
    return page ? <ServiceDetailPage site={site} basePath={basePath} page={page} /> : null;
  }
  if (section === "locations" && key) {
    const page = site.locations.find((l) => l.slug === key);
    return page ? <LocationPage site={site} basePath={basePath} page={page} /> : null;
  }
  if (section === "areas" && key) {
    const page = site.service_areas.find((a) => a.slug === key);
    return page ? <ServiceAreaPage site={site} basePath={basePath} page={page} /> : null;
  }
  if (section === "faq" && site.faq) return <FaqPage site={site} basePath={basePath} />;
  if (section === "about" && site.about) return <AboutPage site={site} basePath={basePath} />;

  return null;
}

/** Resolve a slug[] to page metadata (title/description) for SEO. */
export function tradesPageMetadata(
  site: SiteProps,
  slug: string[],
): { title: string; description?: string } {
  const fallback = {
    title: site.seo?.title ?? site.business.name,
    description: site.seo?.description ?? site.business.tagline,
  };
  if (!slug || slug.length === 0) return fallback;
  const [section, key] = slug;
  if (section === "services" && key) {
    const p = site.services.find((s) => s.slug === key);
    if (p) return { title: p.seo.title, description: p.seo.description ?? p.summary };
  }
  if (section === "locations" && key) {
    const p = site.locations.find((l) => l.slug === key);
    if (p) return { title: p.seo.title, description: p.seo.description ?? p.intro };
  }
  if (section === "areas" && key) {
    const p = site.service_areas.find((a) => a.slug === key);
    if (p) return { title: p.seo.title, description: p.seo.description ?? p.headline };
  }
  if (section === "faq" && site.faq?.seo) return { title: site.faq.seo.title, description: site.faq.seo.description };
  if (section === "about" && site.about?.seo) return { title: site.about.seo.title, description: site.about.seo.description };
  return fallback;
}
