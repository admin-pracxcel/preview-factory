/**
 * lib/feature-flags.ts
 *
 * Small, env-driven feature flags. Kept as a single module so every gate
 * reads the same env-var interpretation and defaults are obvious.
 */

/**
 * Addons (SEO / Google Ads / Social Ads) are hidden by default until the
 * addon workflows and Stripe SKUs are ready to ship. Set `ADDONS_ENABLED=true`
 * to reveal the dashboard funnel + accept addon checkout requests.
 */
export function addonsEnabled(): boolean {
  return process.env.ADDONS_ENABLED === "true";
}
