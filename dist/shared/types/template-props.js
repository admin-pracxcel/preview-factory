"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.templatePropsSchema = exports.overridesSchema = exports.previewSchema = exports.seoSchema = exports.offerSchema = exports.contactSchema = exports.hoursSchema = exports.socialProofSchema = exports.socialProofItemSchema = exports.testimonialSchema = exports.galleryItemSchema = exports.serviceAreaSchema = exports.aboutSchema = exports.serviceSchema = exports.heroSchema = exports.brandingSchema = exports.businessSchema = exports.ctaSchema = void 0;
const zod_1 = require("zod");
/**
 * Canonical TemplateProps schema.
 *
 * Single source of truth for the data shape that EVERY niche template
 * (tradies, mobile-services, allied-health, beauty-aesthetics, hospitality)
 * accepts and renders. Keep this schema stable and shared across all templates.
 *
 * Design notes:
 * - `branding` holds the base theme + asset URLs.
 * - `overrides` can shadow specific branding values (primary_color, accent_color,
 *   logo_url, hero_image_url) without mutating the canonical branding object.
 * - Optional sections (gallery, testimonials, service_area, social_proof, offer)
 *   may be omitted entirely; templates must render gracefully when they are absent.
 * - Every repeatable item carries a stable `id` for use as a React key.
 */
/* ---------------------------------------------------------------- primitives */
exports.ctaSchema = zod_1.z.object({
    label: zod_1.z.string(),
    href: zod_1.z.string(),
});
/* ------------------------------------------------------------------- business */
exports.businessSchema = zod_1.z.object({
    name: zod_1.z.string(),
    tagline: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    suburb: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    abn: zod_1.z.string().optional(),
});
/* ------------------------------------------------------------------- branding */
exports.brandingSchema = zod_1.z.object({
    primary_color: zod_1.z.string(),
    secondary_color: zod_1.z.string().optional(),
    accent_color: zod_1.z.string().optional(),
    logo_url: zod_1.z.string().optional(),
    hero_image_url: zod_1.z.string().optional(),
    font_heading: zod_1.z.string().optional(),
});
/* ----------------------------------------------------------------------- hero */
exports.heroSchema = zod_1.z.object({
    headline: zod_1.z.string(),
    subheadline: zod_1.z.string().optional(),
    cta_primary: exports.ctaSchema,
    cta_secondary: exports.ctaSchema.optional(),
});
/* ------------------------------------------------------------------- services */
exports.serviceSchema = zod_1.z.object({
    id: zod_1.z.string(),
    title: zod_1.z.string(),
    description: zod_1.z.string(),
    /** lucide-react icon name, e.g. "Wrench", "Hammer". Resolved at render time. */
    icon: zod_1.z.string().optional(),
    starting_price: zod_1.z.string().optional(),
});
/* ---------------------------------------------------------------------- about */
exports.aboutSchema = zod_1.z.object({
    heading: zod_1.z.string().optional(),
    body: zod_1.z.string(),
    photo_url: zod_1.z.string().optional(),
    years_in_business: zod_1.z.number().optional(),
    licence: zod_1.z.string().optional(),
});
/* --------------------------------------------------------------- service area */
exports.serviceAreaSchema = zod_1.z.object({
    heading: zod_1.z.string().optional(),
    intro: zod_1.z.string().optional(),
    suburbs: zod_1.z.array(zod_1.z.string()).default([]),
});
/* -------------------------------------------------------------------- gallery */
exports.galleryItemSchema = zod_1.z.object({
    id: zod_1.z.string(),
    image_url: zod_1.z.string(),
    caption: zod_1.z.string().optional(),
    alt: zod_1.z.string().optional(),
});
/* --------------------------------------------------------------- testimonials */
exports.testimonialSchema = zod_1.z.object({
    id: zod_1.z.string(),
    quote: zod_1.z.string(),
    author: zod_1.z.string(),
    location: zod_1.z.string().optional(),
    rating: zod_1.z.number().min(1).max(5).optional(),
});
/* --------------------------------------------------------------- social proof */
exports.socialProofItemSchema = zod_1.z.object({
    id: zod_1.z.string(),
    /** Headline figure or label, e.g. "Licensed & Insured" or "500+". */
    value: zod_1.z.string(),
    label: zod_1.z.string().optional(),
    /** Optional lucide-react icon name. */
    icon: zod_1.z.string().optional(),
});
exports.socialProofSchema = zod_1.z.object({
    heading: zod_1.z.string().optional(),
    items: zod_1.z.array(exports.socialProofItemSchema).default([]),
});
/* -------------------------------------------------------------------- contact */
exports.hoursSchema = zod_1.z.object({
    label: zod_1.z.string(),
    value: zod_1.z.string(),
});
exports.contactSchema = zod_1.z.object({
    heading: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    address: zod_1.z.string().optional(),
    hours: zod_1.z.array(exports.hoursSchema).optional(),
    cta: exports.ctaSchema.optional(),
});
/* ---------------------------------------------------------------------- offer */
exports.offerSchema = zod_1.z.object({
    headline: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    price: zod_1.z.string().optional(),
    original_price: zod_1.z.string().optional(),
    code: zod_1.z.string().optional(),
    cta: exports.ctaSchema.optional(),
});
/* ------------------------------------------------------------------------ seo */
exports.seoSchema = zod_1.z.object({
    title: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    /** schema.org type used for JSON-LD, e.g. "Plumber", "LocalBusiness". */
    schema_org_type: zod_1.z.string().default("LocalBusiness"),
});
/* -------------------------------------------------------------------- preview */
exports.previewSchema = zod_1.z.object({
    countdown_enabled: zod_1.z.boolean().optional(),
    /** ISO date-time string the countdown targets. */
    countdown_to: zod_1.z.string().optional(),
    countdown_label: zod_1.z.string().optional(),
});
/* ------------------------------------------------------------------ overrides */
exports.overridesSchema = zod_1.z.object({
    primary_color: zod_1.z.string().optional(),
    accent_color: zod_1.z.string().optional(),
    logo_url: zod_1.z.string().optional(),
    hero_image_url: zod_1.z.string().optional(),
});
/* ---------------------------------------------------------- canonical schema */
exports.templatePropsSchema = zod_1.z.object({
    business: exports.businessSchema,
    branding: exports.brandingSchema,
    hero: exports.heroSchema,
    services: zod_1.z.array(exports.serviceSchema).default([]),
    about: exports.aboutSchema.optional(),
    service_area: exports.serviceAreaSchema.optional(),
    gallery: zod_1.z.array(exports.galleryItemSchema).optional(),
    testimonials: zod_1.z.array(exports.testimonialSchema).optional(),
    social_proof: exports.socialProofSchema.optional(),
    contact: exports.contactSchema.optional(),
    offer: exports.offerSchema.optional(),
    seo: exports.seoSchema.optional(),
    preview: exports.previewSchema.optional(),
    overrides: exports.overridesSchema.optional(),
});
