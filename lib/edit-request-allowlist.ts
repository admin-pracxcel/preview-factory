/**
 * lib/edit-request-allowlist.ts
 *
 * The dotted siteProps paths that admin-approved edit requests can touch.
 * Consumed by:
 *   - the prompt builder (Phase 5) — tells Claude what it may propose
 *   - the patch applier (Phase 4) — refuses anything outside this list
 *     regardless of what Claude said
 *
 * The applier is the source of truth. The prompt hint is just a courtesy
 * to reduce out-of-scope suggestions.
 *
 * Rule of thumb for what belongs here: content the owner already sees and
 * types (headlines, copy, contact fields, images). NOT: schema shape,
 * business identity fields (name, slug), branding overrides that already
 * have their own endpoint, or anything that changes routing / URLs.
 */

/**
 * Regex allowlist. Each entry must match the full path. Numeric segments
 * (array indexes) use `\d+`.
 */
export const EDIT_REQUEST_PATH_ALLOWLIST: readonly RegExp[] = [
  // ---- Home
  /^home\.hero\.headline$/,
  /^home\.hero\.subheadline$/,
  /^home\.hero\.tagline$/,
  /^home\.about\.heading$/,
  /^home\.about\.body$/,
  /^home\.about\.years_in_business$/,
  /^home\.about\.licence$/,
  /^home\.about\.photo_url$/,
  /^home\.service_area\.heading$/,
  /^home\.service_area\.intro$/,
  /^home\.service_area\.suburbs\.\d+$/,
  /^home\.gallery\.\d+\.image_url$/,
  /^home\.gallery\.\d+\.caption$/,
  /^home\.testimonials\.\d+\.quote$/,
  /^home\.testimonials\.\d+\.author$/,
  /^home\.testimonials\.\d+\.location$/,
  /^home\.testimonials\.\d+\.rating$/,
  /^home\.offer\.title$/,
  /^home\.offer\.body$/,
  /^home\.contact\.phone$/,
  /^home\.contact\.email$/,
  /^home\.contact\.address$/,

  // ---- Services
  /^services\.\d+\.title$/,
  /^services\.\d+\.summary$/,
  /^services\.\d+\.intro$/,
  /^services\.\d+\.starting_price$/,
  /^services\.\d+\.hero_image$/,
  /^services\.\d+\.body_image$/,
  /^services\.\d+\.benefits\.\d+$/,
  /^services\.\d+\.faqs\.\d+\.question$/,
  /^services\.\d+\.faqs\.\d+\.answer$/,

  // ---- Locations
  /^locations\.\d+\.headline$/,
  /^locations\.\d+\.intro$/,
  /^locations\.\d+\.body$/,
  /^locations\.\d+\.hero_image$/,
  /^locations\.\d+\.benefits\.\d+$/,
  /^locations\.\d+\.landmarks\.\d+$/,

  // ---- FAQ
  /^faq\.heading$/,
  /^faq\.intro$/,
  /^faq\.items\.\d+\.question$/,
  /^faq\.items\.\d+\.answer$/,

  // ---- About
  /^about\.heading$/,
  /^about\.body$/,
  /^about\.photo_url$/,
  /^about\.years_in_business$/,
  /^about\.licence$/,
  /^about\.values\.\d+\.title$/,
  /^about\.values\.\d+\.body$/,

  // ---- Business identity fields owners edit (mirror of home.contact for
  // legacy consumers that read business.* directly).
  /^business\.phone$/,
  /^business\.email$/,
];

export function isEditablePath(path: string): boolean {
  return EDIT_REQUEST_PATH_ALLOWLIST.some((re) => re.test(path));
}
