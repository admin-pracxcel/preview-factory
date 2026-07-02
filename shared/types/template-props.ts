import { z } from "zod";

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

export const ctaSchema = z.object({
  label: z.string(),
  href: z.string(),
});
export type Cta = z.infer<typeof ctaSchema>;

/* ------------------------------------------------------------------- business */

export const businessSchema = z.object({
  name: z.string(),
  tagline: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  suburb: z.string().optional(),
  state: z.string().optional(),
  abn: z.string().optional(),
});

/* ------------------------------------------------------------------- branding */

export const brandingSchema = z.object({
  primary_color: z.string(),
  secondary_color: z.string().optional(),
  accent_color: z.string().optional(),
  logo_url: z.string().optional(),
  hero_image_url: z.string().optional(),
  font_heading: z.string().optional(),
});

/* ----------------------------------------------------------------------- hero */

export const heroSchema = z.object({
  headline: z.string(),
  subheadline: z.string().optional(),
  cta_primary: ctaSchema,
  cta_secondary: ctaSchema.optional(),
});

/* ------------------------------------------------------------------- services */

export const serviceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  /** lucide-react icon name, e.g. "Wrench", "Hammer". Resolved at render time. */
  icon: z.string().optional(),
  starting_price: z.string().optional(),
});

/* ---------------------------------------------------------------------- about */

export const aboutValueChipSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  icon: z.string().optional(),
});

export const aboutSchema = z.object({
  heading: z.string().optional(),
  body: z.string(),
  photo_url: z.string().optional(),
  years_in_business: z.number().optional(),
  licence: z.string().optional(),
  /** Optional value cards rendered as a grid below the about copy. */
  values: z.array(aboutValueChipSchema).optional(),
});

/* --------------------------------------------------------------- service area */

export const serviceAreaSchema = z.object({
  heading: z.string().optional(),
  intro: z.string().optional(),
  suburbs: z.array(z.string()).default([]),
});

/* -------------------------------------------------------------------- gallery */

export const galleryItemSchema = z.object({
  id: z.string(),
  image_url: z.string(),
  caption: z.string().optional(),
  alt: z.string().optional(),
});

/* --------------------------------------------------------------- testimonials */

export const testimonialSchema = z.object({
  id: z.string(),
  quote: z.string(),
  author: z.string(),
  location: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
});

/* --------------------------------------------------------------- social proof */

export const socialProofItemSchema = z.object({
  id: z.string(),
  /** Headline figure or label, e.g. "Licensed & Insured" or "500+". */
  value: z.string(),
  label: z.string().optional(),
  /** Optional lucide-react icon name. */
  icon: z.string().optional(),
});

export const socialProofSchema = z.object({
  heading: z.string().optional(),
  items: z.array(socialProofItemSchema).default([]),
});

/* -------------------------------------------------------------------- contact */

export const hoursSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const contactSchema = z.object({
  heading: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  hours: z.array(hoursSchema).optional(),
  cta: ctaSchema.optional(),
});

/* ---------------------------------------------------------------------- offer */

export const offerSchema = z.object({
  headline: z.string(),
  description: z.string().optional(),
  price: z.string().optional(),
  original_price: z.string().optional(),
  code: z.string().optional(),
  cta: ctaSchema.optional(),
});

/* ------------------------------------------------------------------------ seo */

export const seoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  /** schema.org type used for JSON-LD, e.g. "Plumber", "LocalBusiness". */
  schema_org_type: z.string().default("LocalBusiness"),
});

/* -------------------------------------------------------------------- preview */

export const previewSchema = z.object({
  countdown_enabled: z.boolean().optional(),
  /** ISO date-time string the countdown targets. */
  countdown_to: z.string().optional(),
  countdown_label: z.string().optional(),
});

/* ------------------------------------------------------------------ overrides */

export const overridesSchema = z.object({
  primary_color: z.string().optional(),
  secondary_color: z.string().optional(),
  accent_color: z.string().optional(),
  logo_url: z.string().optional(),
  hero_image_url: z.string().optional(),
  /** Light or dark chrome for header / footer / areas-we-service.
   *  Defaults to "light" (white bg, dark text). */
  chrome_theme: z.enum(["light", "dark"]).optional(),
  /** Rendered height of the header logo in CSS pixels. Defaults to 36. */
  logo_height_px: z.number().int().min(24).max(72).optional(),
});

/* ---------------------------------------------------------- canonical schema */

export const templatePropsSchema = z.object({
  business: businessSchema,
  branding: brandingSchema,
  hero: heroSchema,
  services: z.array(serviceSchema).default([]),
  about: aboutSchema.optional(),
  service_area: serviceAreaSchema.optional(),
  gallery: z.array(galleryItemSchema).optional(),
  testimonials: z.array(testimonialSchema).optional(),
  social_proof: socialProofSchema.optional(),
  contact: contactSchema.optional(),
  offer: offerSchema.optional(),
  seo: seoSchema.optional(),
  preview: previewSchema.optional(),
  overrides: overridesSchema.optional(),
});

export type TemplateProps = z.infer<typeof templatePropsSchema>;
export type Service = z.infer<typeof serviceSchema>;
export type Testimonial = z.infer<typeof testimonialSchema>;
export type GalleryItem = z.infer<typeof galleryItemSchema>;
export type SocialProofItem = z.infer<typeof socialProofItemSchema>;
