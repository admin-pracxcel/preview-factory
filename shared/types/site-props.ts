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
  socialProofItemSchema,
  contactSchema,
  hoursSchema,
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
  /** Optional distinct image rendered inside the page body (mid-page banner).
   *  Falls back to hero_image at render time if not set — legacy sites only
   *  had one image, and this lets the owner swap the body one independently
   *  without breaking older tenants. */
  body_image: z.string().optional(),
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
  /** Optional page headline (e.g. "Plumber in Southbank"). */
  headline: z.string().optional(),
  /** Lead paragraph for the suburb page. */
  intro: z.string(),
  body: z.string().optional(),
  hero_image: z.string().optional(),
  /** Local landmarks / context to make the page genuinely local. */
  landmarks: z.array(z.string()).default([]),
  /** Titles (or slugs) of services highlighted for this suburb. */
  services_offered: z.array(z.string()).default([]),
  /** Bullet benefits / inclusions for this location. */
  benefits: z.array(z.string()).default([]),
  /** Long-form content blocks that build out the page body. */
  sections: z.array(contentBlockSchema).default([]),
  /** Location-specific FAQs (also feed FAQPage JSON-LD). */
  faqs: z.array(faqItemSchema).default([]),
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
  /** Lead paragraph for this service-in-area page. */
  intro: z.string().optional(),
  body: z.string(),
  benefits: z.array(z.string()).default([]),
  /** Long-form content blocks that build out the page body. */
  sections: z.array(contentBlockSchema).default([]),
  /** Service-area-specific FAQs. */
  faqs: z.array(faqItemSchema).default([]),
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

/* ------------------------------------------ generation-only strict schema */

/**
 * Generation-time schema with stricter minimums. Drives the JSON Schema sent
 * to the LLM via `--json-schema` so structured output enforces these counts at
 * the API level. The runtime parse uses the permissive `sitePropsSchema` so
 * older tenant records (saved before these rules) continue to render.
 *
 * Differences from `sitePropsSchema`:
 * - `home.gallery`: required, 4–8 items (was optional)
 * - `home.social_proof.items`: required, 3–6 items (was optional, no min)
 * - `home.service_area.suburbs`: required, 4–12 strings (was 0+)
 * - `home.about`: required (was optional)
 * - `home.contact`: required (was optional)
 * - `about` page: required (was optional)
 * - `about.values`: required, 3–6 items
 * - Image URL fields stay optional — the image-assembler populates them
 *   post-generation; the LLM no longer invents URLs.
 */
const generationGallerySchema = z.array(galleryItemSchema.extend({
  // The assembler fills image_url after generation — LLM may omit.
  image_url: z.string().optional(),
})).min(4).max(6);

// In generation: every social-proof item MUST have a meaningful label —
// otherwise the renderer shows "5" with a star icon and nothing else.
const generationSocialProofItemSchema = socialProofItemSchema.extend({
  label: z.string(),
});
const generationSocialProofSchema = socialProofSchema.extend({
  items: z.array(generationSocialProofItemSchema).min(3).max(4),
});

const generationServiceAreaSchema = serviceAreaSchema.extend({
  suburbs: z.array(z.string()).min(4).max(6),
});

const generationContactSchema = contactSchema.extend({
  hours: z.array(hoursSchema).min(7).max(7),
});

const generationHomeAboutSchema = aboutSchema.extend({
  heading: z.string(),
  // Surface values on the homepage too — they're required on the about page.
  values: z.array(aboutValueSchema).min(3).max(3),
});

const generationAboutPageSchema = aboutPageSchema.extend({
  heading: z.string(),
  values: z.array(aboutValueSchema).min(3).max(3),
});

const generationHomeSchema = homeSchema.extend({
  gallery: generationGallerySchema,
  social_proof: generationSocialProofSchema,
  service_area: generationServiceAreaSchema,
  about: generationHomeAboutSchema,
  contact: generationContactSchema,
});

export const sitePropsGenerationSchema = sitePropsSchema.extend({
  home: generationHomeSchema,
  about: generationAboutPageSchema,
  // Hard caps to bound generation time. Preview only needs a few of each.
  services: z.array(servicePageSchema).min(4).max(4),
  locations: z.array(locationPageSchema).min(4).max(4),
  service_areas: z.array(serviceAreaPageSchema).max(0),
});

/* ------------------------------------------ phased generation schemas */

/**
 * Phase A — homepage + skeleton stubs. The LLM produces full home/about/faq,
 * plus 4 service stubs (slug + title + summary + icon) and 4 location stubs
 * (slug + suburb + state). Detail content for each page is filled in by
 * phase B/C calls. This split keeps any single call under ~12K output chars.
 */
const serviceStubSchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  icon: z.string().optional(),
});

const locationStubSchema = z.object({
  slug: z.string(),
  suburb: z.string(),
  state: z.string().optional(),
});

export const phaseAGenerationSchema = sitePropsSchema.extend({
  home: generationHomeSchema,
  about: generationAboutPageSchema,
  services: z.array(serviceStubSchema).min(4).max(4),
  locations: z.array(locationStubSchema).min(4).max(4),
  service_areas: z.array(serviceAreaPageSchema).max(0),
});

/**
 * Phase B — detail content for each of the 4 service stubs from phase A.
 * The LLM gets the business context + the stubs, and produces an array of
 * detail blocks keyed by the same slugs.
 */
const serviceDetailSchema = z.object({
  slug: z.string(),
  intro: z.string(),
  benefits: z.array(z.string()).min(3).max(3),
  faqs: z.array(faqItemSchema).min(2).max(2),
  seo: pageSeoSchema,
});

export const phaseBGenerationSchema = z.object({
  services: z.array(serviceDetailSchema).min(4).max(4),
});

/**
 * Phase C — detail content for each of the 4 location stubs from phase A.
 */
const locationDetailSchema = z.object({
  slug: z.string(),
  intro: z.string(),
  benefits: z.array(z.string()).min(3).max(3),
  faqs: z.array(faqItemSchema).min(1).max(1),
  seo: pageSeoSchema,
});

export const phaseCGenerationSchema = z.object({
  locations: z.array(locationDetailSchema).min(4).max(4),
});

export type PhaseAResult = z.infer<typeof phaseAGenerationSchema>;
export type PhaseBResult = z.infer<typeof phaseBGenerationSchema>;
export type PhaseCResult = z.infer<typeof phaseCGenerationSchema>;

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
