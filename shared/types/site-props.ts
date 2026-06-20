import { z } from "zod";
import {
  businessSchema,
  brandingSchema,
  ctaSchema,
  heroSchema,
  serviceSchema,
  aboutSchema,
  serviceAreaSchema,
  galleryItemSchema,
  testimonialSchema,
  socialProofSchema,
  contactSchema,
  offerSchema,
  seoSchema,
  previewSchema,
  overridesSchema,
} from "./template-props";

/**
 * Canonical SiteProps schema — the MULTI-PAGE successor to TemplateProps.
 *
 * Where `TemplateProps` describes ONE page, `SiteProps` describes a whole
 * customer site: a homepage plus collections of service-detail pages,
 * location pages, service-in-area landing pages, an FAQ page and an about
 * page — the 20–40 indexable pages per customer that the programmatic
 * local-SEO strategy depends on (see strategy/_master/business-context.md).
 *
 * Design notes:
 * - Re-uses the canonical TemplateProps primitives (business, branding, hero,
 *   service, about, testimonial, etc.) so the two schemas never drift.
 * - The homepage (`home`) mirrors the old single-page content shape, so the
 *   existing section components render it unchanged.
 * - Every page entity carries a URL `slug` and its own `seo` block.
 * - All page collections are optional / default to [] so a site can ship with
 *   just a homepage and grow its page count over time.
 * - Page components must render gracefully when any collection is empty.
 */

/* ------------------------------------------------------------- shared atoms */

export const navLinkSchema = z.object({
  label: z.string(),
  /** Path segment relative to the site root, e.g. "services" or "about". Empty = home. */
  href: z.string(),
});
export type NavLink = z.infer<typeof navLinkSchema>;

/** Per-page SEO/meta. Superset of the single-page `seo` block. */
export const pageSeoSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  /** schema.org @type for this page's JSON-LD; falls back to the site default. */
  schema_org_type: z.string().optional(),
  canonical: z.string().optional(),
  og_image: z.string().optional(),
});
export type PageSeo = z.infer<typeof pageSeoSchema>;

/** A heading + body content block used to build out long-form pages. */
export const contentBlockSchema = z.object({
  heading: z.string().optional(),
  body: z.string(),
});
export type ContentBlock = z.infer<typeof contentBlockSchema>;

export const faqItemSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
});
export type FaqItem = z.infer<typeof faqItemSchema>;

/** Home service cards may link to a matching service-detail page via `slug`. */
export const homeServiceSchema = serviceSchema.extend({
  slug: z.string().optional(),
});

/* ----------------------------------------------------------------- homepage */

export const homeSchema = z.object({
  hero: heroSchema,
  services: z.array(homeServiceSchema).default([]),
  about: aboutSchema.optional(),
  service_area: serviceAreaSchema.optional(),
  gallery: z.array(galleryItemSchema).optional(),
  testimonials: z.array(testimonialSchema).optional(),
  social_proof: socialProofSchema.optional(),
  offer: offerSchema.optional(),
  contact: contactSchema.optional(),
});
export type Home = z.infer<typeof homeSchema>;

/* -------------------------------------------------- service-detail page */

export const servicePageSchema = z.object({
  slug: z.string(),
  title: z.string(),
  /** Short one-liner used in cards / meta. */
  summary: z.string(),
  /** lucide-react icon name. */
  icon: z.string().optional(),
  starting_price: z.string().optional(),
  hero_image: z.string().optional(),
  /** Lead paragraph(s) for the page body (supports \n line breaks). */
  intro: z.string(),
  /** Bullet benefits / inclusions. */
  benefits: z.array(z.string()).default([]),
  /** Long-form content blocks. */
  sections: z.array(contentBlockSchema).default([]),
  /** Service-specific FAQs (also feed FAQPage JSON-LD). */
  faqs: z.array(faqItemSchema).default([]),
  seo: pageSeoSchema,
});
export type ServicePage = z.infer<typeof servicePageSchema>;

/* -------------------------------------------------------- location page */

export const locationPageSchema = z.object({
  slug: z.string(),
  suburb: z.string(),
  state: z.string().optional(),
  /** Lead paragraph for the suburb page. */
  intro: z.string(),
  body: z.string().optional(),
  hero_image: z.string().optional(),
  /** Local landmarks / context to make the page genuinely local. */
  landmarks: z.array(z.string()).default([]),
  /** Titles (or slugs) of services highlighted for this suburb. */
  services_offered: z.array(z.string()).default([]),
  seo: pageSeoSchema,
});
export type LocationPage = z.infer<typeof locationPageSchema>;

/* --------------------------------------- service-in-area landing page */

export const serviceAreaPageSchema = z.object({
  /** Typically `${service_slug}-${suburb-slug}`. */
  slug: z.string(),
  service_slug: z.string(),
  service_title: z.string(),
  suburb: z.string(),
  state: z.string().optional(),
  headline: z.string(),
  body: z.string(),
  benefits: z.array(z.string()).default([]),
  seo: pageSeoSchema,
});
export type ServiceAreaPage = z.infer<typeof serviceAreaPageSchema>;

/* ----------------------------------------------------------- faq page */

export const faqPageSchema = z.object({
  heading: z.string().optional(),
  intro: z.string().optional(),
  items: z.array(faqItemSchema).default([]),
  seo: pageSeoSchema.optional(),
});
export type FaqPage = z.infer<typeof faqPageSchema>;

/* --------------------------------------------------------- about page */

export const aboutValueSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  icon: z.string().optional(),
});

export const aboutPageSchema = z.object({
  heading: z.string().optional(),
  /** Rich body (supports \n paragraphs). Falls back to home.about.body if omitted. */
  body: z.string(),
  photo_url: z.string().optional(),
  years_in_business: z.number().optional(),
  licence: z.string().optional(),
  values: z.array(aboutValueSchema).default([]),
  seo: pageSeoSchema.optional(),
});
export type AboutPage = z.infer<typeof aboutPageSchema>;

/* -------------------------------------------------- canonical SiteProps */

export const sitePropsSchema = z.object({
  business: businessSchema,
  branding: brandingSchema,
  /** Optional explicit nav; if absent the renderer derives it from populated pages. */
  nav: z.array(navLinkSchema).optional(),
  home: homeSchema,
  services: z.array(servicePageSchema).default([]),
  locations: z.array(locationPageSchema).default([]),
  service_areas: z.array(serviceAreaPageSchema).default([]),
  faq: faqPageSchema.optional(),
  about: aboutPageSchema.optional(),
  /** Site-level default SEO + schema.org type used as a fallback by every page. */
  seo: seoSchema.optional(),
  preview: previewSchema.optional(),
  overrides: overridesSchema.optional(),
});

export type SiteProps = z.infer<typeof sitePropsSchema>;

/* ---------------------------------------------------------------- routing */

/** Logical page kinds in a site. */
export type SitePageKind =
  | "home"
  | "service"
  | "location"
  | "service-area"
  | "faq"
  | "about";

/**
 * Enumerate every routable page in a site as `{ kind, slug[] }`, for use with
 * Next.js `generateStaticParams` and sitemap generation.
 */
export function enumerateSitePaths(
  site: SiteProps,
): Array<{ slug: string[] }> {
  const paths: Array<{ slug: string[] }> = [{ slug: [] }]; // home
  for (const s of site.services) paths.push({ slug: ["services", s.slug] });
  for (const l of site.locations) paths.push({ slug: ["locations", l.slug] });
  for (const a of site.service_areas) paths.push({ slug: ["areas", a.slug] });
  if (site.faq) paths.push({ slug: ["faq"] });
  if (site.about) paths.push({ slug: ["about"] });
  return paths;
}
