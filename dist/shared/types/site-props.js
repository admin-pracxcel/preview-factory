"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sitePropsSchema = exports.aboutPageSchema = exports.aboutValueSchema = exports.faqPageSchema = exports.serviceAreaPageSchema = exports.locationPageSchema = exports.servicePageSchema = exports.homeSchema = exports.homeServiceSchema = exports.faqItemSchema = exports.contentBlockSchema = exports.pageSeoSchema = exports.navLinkSchema = void 0;
exports.enumerateSitePaths = enumerateSitePaths;
const zod_1 = require("zod");
const template_props_1 = require("./template-props");
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
exports.navLinkSchema = zod_1.z.object({
    label: zod_1.z.string(),
    /** Path segment relative to the site root, e.g. "services" or "about". Empty = home. */
    href: zod_1.z.string(),
});
/** Per-page SEO/meta. Superset of the single-page `seo` block. */
exports.pageSeoSchema = zod_1.z.object({
    title: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    /** schema.org @type for this page's JSON-LD; falls back to the site default. */
    schema_org_type: zod_1.z.string().optional(),
    canonical: zod_1.z.string().optional(),
    og_image: zod_1.z.string().optional(),
});
/** A heading + body content block used to build out long-form pages. */
exports.contentBlockSchema = zod_1.z.object({
    heading: zod_1.z.string().optional(),
    body: zod_1.z.string(),
});
exports.faqItemSchema = zod_1.z.object({
    id: zod_1.z.string(),
    question: zod_1.z.string(),
    answer: zod_1.z.string(),
});
/** Home service cards may link to a matching service-detail page via `slug`. */
exports.homeServiceSchema = template_props_1.serviceSchema.extend({
    slug: zod_1.z.string().optional(),
});
/* ----------------------------------------------------------------- homepage */
exports.homeSchema = zod_1.z.object({
    hero: template_props_1.heroSchema,
    services: zod_1.z.array(exports.homeServiceSchema).default([]),
    about: template_props_1.aboutSchema.optional(),
    service_area: template_props_1.serviceAreaSchema.optional(),
    gallery: zod_1.z.array(template_props_1.galleryItemSchema).optional(),
    testimonials: zod_1.z.array(template_props_1.testimonialSchema).optional(),
    social_proof: template_props_1.socialProofSchema.optional(),
    offer: template_props_1.offerSchema.optional(),
    contact: template_props_1.contactSchema.optional(),
});
/* -------------------------------------------------- service-detail page */
exports.servicePageSchema = zod_1.z.object({
    slug: zod_1.z.string(),
    title: zod_1.z.string(),
    /** Short one-liner used in cards / meta. */
    summary: zod_1.z.string(),
    /** lucide-react icon name. */
    icon: zod_1.z.string().optional(),
    starting_price: zod_1.z.string().optional(),
    hero_image: zod_1.z.string().optional(),
    /** Lead paragraph(s) for the page body (supports \n line breaks). */
    intro: zod_1.z.string(),
    /** Bullet benefits / inclusions. */
    benefits: zod_1.z.array(zod_1.z.string()).default([]),
    /** Long-form content blocks. */
    sections: zod_1.z.array(exports.contentBlockSchema).default([]),
    /** Service-specific FAQs (also feed FAQPage JSON-LD). */
    faqs: zod_1.z.array(exports.faqItemSchema).default([]),
    seo: exports.pageSeoSchema,
});
/* -------------------------------------------------------- location page */
exports.locationPageSchema = zod_1.z.object({
    slug: zod_1.z.string(),
    suburb: zod_1.z.string(),
    state: zod_1.z.string().optional(),
    /** Optional page headline (e.g. "Plumber in Southbank"). */
    headline: zod_1.z.string().optional(),
    /** Lead paragraph for the suburb page. */
    intro: zod_1.z.string(),
    body: zod_1.z.string().optional(),
    hero_image: zod_1.z.string().optional(),
    /** Local landmarks / context to make the page genuinely local. */
    landmarks: zod_1.z.array(zod_1.z.string()).default([]),
    /** Titles (or slugs) of services highlighted for this suburb. */
    services_offered: zod_1.z.array(zod_1.z.string()).default([]),
    /** Bullet benefits / inclusions for this location. */
    benefits: zod_1.z.array(zod_1.z.string()).default([]),
    /** Long-form content blocks that build out the page body. */
    sections: zod_1.z.array(exports.contentBlockSchema).default([]),
    /** Location-specific FAQs (also feed FAQPage JSON-LD). */
    faqs: zod_1.z.array(exports.faqItemSchema).default([]),
    seo: exports.pageSeoSchema,
});
/* --------------------------------------- service-in-area landing page */
exports.serviceAreaPageSchema = zod_1.z.object({
    /** Typically `${service_slug}-${suburb-slug}`. */
    slug: zod_1.z.string(),
    service_slug: zod_1.z.string(),
    service_title: zod_1.z.string(),
    suburb: zod_1.z.string(),
    state: zod_1.z.string().optional(),
    headline: zod_1.z.string(),
    /** Lead paragraph for this service-in-area page. */
    intro: zod_1.z.string().optional(),
    body: zod_1.z.string(),
    benefits: zod_1.z.array(zod_1.z.string()).default([]),
    /** Long-form content blocks that build out the page body. */
    sections: zod_1.z.array(exports.contentBlockSchema).default([]),
    /** Service-area-specific FAQs. */
    faqs: zod_1.z.array(exports.faqItemSchema).default([]),
    seo: exports.pageSeoSchema,
});
/* ----------------------------------------------------------- faq page */
exports.faqPageSchema = zod_1.z.object({
    heading: zod_1.z.string().optional(),
    intro: zod_1.z.string().optional(),
    items: zod_1.z.array(exports.faqItemSchema).default([]),
    seo: exports.pageSeoSchema.optional(),
});
/* --------------------------------------------------------- about page */
exports.aboutValueSchema = zod_1.z.object({
    id: zod_1.z.string(),
    title: zod_1.z.string(),
    body: zod_1.z.string(),
    icon: zod_1.z.string().optional(),
});
exports.aboutPageSchema = zod_1.z.object({
    heading: zod_1.z.string().optional(),
    /** Rich body (supports \n paragraphs). Falls back to home.about.body if omitted. */
    body: zod_1.z.string(),
    photo_url: zod_1.z.string().optional(),
    years_in_business: zod_1.z.number().optional(),
    licence: zod_1.z.string().optional(),
    values: zod_1.z.array(exports.aboutValueSchema).default([]),
    seo: exports.pageSeoSchema.optional(),
});
/* -------------------------------------------------- canonical SiteProps */
exports.sitePropsSchema = zod_1.z.object({
    business: template_props_1.businessSchema,
    branding: template_props_1.brandingSchema,
    /** Optional explicit nav; if absent the renderer derives it from populated pages. */
    nav: zod_1.z.array(exports.navLinkSchema).optional(),
    home: exports.homeSchema,
    services: zod_1.z.array(exports.servicePageSchema).default([]),
    locations: zod_1.z.array(exports.locationPageSchema).default([]),
    service_areas: zod_1.z.array(exports.serviceAreaPageSchema).default([]),
    faq: exports.faqPageSchema.optional(),
    about: exports.aboutPageSchema.optional(),
    /** Site-level default SEO + schema.org type used as a fallback by every page. */
    seo: template_props_1.seoSchema.optional(),
    preview: template_props_1.previewSchema.optional(),
    overrides: template_props_1.overridesSchema.optional(),
});
/**
 * Enumerate every routable page in a site as `{ kind, slug[] }`, for use with
 * Next.js `generateStaticParams` and sitemap generation.
 */
function enumerateSitePaths(site) {
    const paths = [{ slug: [] }]; // home
    for (const s of site.services)
        paths.push({ slug: ["services", s.slug] });
    for (const l of site.locations)
        paths.push({ slug: ["locations", l.slug] });
    for (const a of site.service_areas)
        paths.push({ slug: ["areas", a.slug] });
    if (site.faq)
        paths.push({ slug: ["faq"] });
    if (site.about)
        paths.push({ slug: ["about"] });
    return paths;
}
