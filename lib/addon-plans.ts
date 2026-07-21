/**
 * lib/addon-plans.ts
 *
 * Single source of truth for the three upsell addons the customer sees in
 * the post-domain-connect walkthrough and on the dashboard:
 *
 *   - SEO           three tiers × two cycles = 6 plan keys
 *   - Google Ads    one tier × two cycles     = 2 plan keys
 *   - Social Ads    one tier × two cycles     = 2 plan keys
 *
 * All prices are AUD cents, ex-GST.
 *
 * Plan-key shape:
 *   SEO   → "seo-<tier>-<cycle>"          e.g. "seo-growth-monthly"
 *   Ads   → "<addon>-<cycle>"             e.g. "google_ads-annual"
 *
 * Env var mapping is mechanical: uppercase, dashes → underscores, prefix
 * with `STRIPE_PRICE_ADDON_`. So `seo-growth-annual` →
 * `STRIPE_PRICE_ADDON_SEO_GROWTH_ANNUAL`. Missing env vars fall back to
 * inline `price_data` in the checkout call so dev works without Stripe
 * setup.
 */

export type AddonKey = "seo" | "google_ads" | "social_ads";
export type SeoTier = "starter" | "growth" | "pro";
export type BillingCycle = "monthly" | "annual";

export type SeoPlanKey = `seo-${SeoTier}-${BillingCycle}`;
export type AdsPlanKey = `${"google_ads" | "social_ads"}-${BillingCycle}`;
export type AddonPlanKey = SeoPlanKey | AdsPlanKey;

/* -------------------------------------------------------------------- SEO */

export interface SeoTierSpec {
  id: SeoTier;
  name: string;
  features: string[];
  /** AUD cents, monthly billing */
  monthly: number;
  /** AUD cents, annual billing (billed once per year) */
  annual: number;
  /** Marketing accent — highlight one tier in the picker */
  popular?: boolean;
}

export const SEO_TIERS: readonly SeoTierSpec[] = [
  {
    id: "starter",
    name: "Starter",
    features: [
      "Local citations across 30+ AU directories",
      "4 blog posts per month, written and published for you",
      "4 Google Business Profile posts per month",
    ],
    monthly: 2900,
    annual: 29900,
  },
  {
    id: "growth",
    name: "Growth",
    features: [
      "Everything in Starter",
      "8 blog posts per month",
      "8 Google Business Profile posts per month",
    ],
    monthly: 5900,
    annual: 59900,
    popular: true,
  },
  {
    id: "pro",
    name: "Pro",
    features: [
      "Everything in Growth",
      "16 blog posts per month",
      "16 Google Business Profile posts per month",
    ],
    monthly: 7900,
    annual: 79900,
  },
] as const;

/* -------------------------------------------------------------------- Ads */
/**
 * Google Ads and Social Ads share pricing shape — a flat management fee,
 * plus the customer's own ad spend (billed by Google/Meta directly to the
 * customer's card). Only the management fee flows through Stripe.
 */
export const ADS_PRICING = {
  /** $150/mo, AUD cents */
  monthly: 15000,
  /** $1500/yr, AUD cents — 17% off vs. monthly x 12 */
  annual: 150000,
} as const;

export interface AdsSpec {
  addonKey: "google_ads" | "social_ads";
  name: string;
  headline: string;
  features: string[];
}

export const ADS_ADDONS: readonly AdsSpec[] = [
  {
    addonKey: "google_ads",
    name: "Google Ads",
    headline: "$150/month management + your ad spend",
    features: [
      "Campaign strategy, keyword research, and ad creative",
      "Ongoing bid optimisation and negative-keyword pruning",
      "Ad spend billed to your Google Ads account (not to us)",
      "Monthly performance report",
    ],
  },
  {
    addonKey: "social_ads",
    name: "Social Ads",
    headline: "$150/month management + your ad spend",
    features: [
      "Meta (Facebook & Instagram) or TikTok — you choose",
      "Creative, targeting, and A/B testing built in",
      "Ad spend billed to your Meta / TikTok Business account (not to us)",
      "Monthly performance report",
    ],
  },
] as const;

/* ----------------------------------------------------------- key registry */

export const ADDON_KEYS: readonly AddonKey[] = [
  "seo",
  "google_ads",
  "social_ads",
] as const;

/**
 * Every valid AddonPlanKey. Used by /api/checkout/addon to validate the
 * caller-supplied plan_key, and by the human-handoff Stripe setup doc to
 * enumerate the exact env vars the founder must set.
 */
export const ADDON_PLAN_KEYS: readonly AddonPlanKey[] = [
  "seo-starter-monthly",
  "seo-starter-annual",
  "seo-growth-monthly",
  "seo-growth-annual",
  "seo-pro-monthly",
  "seo-pro-annual",
  "google_ads-monthly",
  "google_ads-annual",
  "social_ads-monthly",
  "social_ads-annual",
] as const;

/* ---------------------------------------------------------------- parsing */

interface ParsedSeoPlan {
  addonKey: "seo";
  tier: SeoTier;
  cycle: BillingCycle;
}
interface ParsedAdsPlan {
  addonKey: "google_ads" | "social_ads";
  cycle: BillingCycle;
}
export type ParsedAddonPlan = ParsedSeoPlan | ParsedAdsPlan;

function isSeoTier(v: string): v is SeoTier {
  return v === "starter" || v === "growth" || v === "pro";
}
function isBillingCycle(v: string): v is BillingCycle {
  return v === "monthly" || v === "annual";
}

export function parseAddonPlanKey(key: string | null | undefined): ParsedAddonPlan | null {
  if (!key) return null;

  if (key.startsWith("seo-")) {
    const rest = key.slice(4);
    const dash = rest.lastIndexOf("-");
    if (dash < 0) return null;
    const tier = rest.slice(0, dash);
    const cycle = rest.slice(dash + 1);
    if (!isSeoTier(tier) || !isBillingCycle(cycle)) return null;
    return { addonKey: "seo", tier, cycle };
  }

  if (key.startsWith("google_ads-") || key.startsWith("social_ads-")) {
    const dash = key.lastIndexOf("-");
    const addonKey = key.slice(0, dash) as "google_ads" | "social_ads";
    const cycle = key.slice(dash + 1);
    if (!isBillingCycle(cycle)) return null;
    return { addonKey, cycle };
  }

  return null;
}

/* ----------------------------------------------------------- price lookup */

export interface AddonPriceInfo {
  priceId?: string;
  /** Amount charged this cycle, in AUD cents */
  unitAmount: number;
  interval: "month" | "year";
  /** Human display name, e.g. "SEO Growth" or "Google Ads" */
  displayName: string;
  addonKey: AddonKey;
  cycle: BillingCycle;
}

/**
 * Given a plan key, return the Stripe price info + a human-friendly label.
 * `priceId` is set when the corresponding env var is populated. If not,
 * checkout falls back to inline `price_data` so dev/staging work without
 * touching Stripe.
 */
export function priceForAddon(key: AddonPlanKey): AddonPriceInfo {
  const parsed = parseAddonPlanKey(key);
  if (!parsed) throw new Error(`addon-plans: unknown plan key "${key}"`);

  const envVar = `STRIPE_PRICE_ADDON_${key.replace(/-/g, "_").toUpperCase()}`;
  const priceId = process.env[envVar];
  const interval: "month" | "year" =
    parsed.cycle === "monthly" ? "month" : "year";

  if (parsed.addonKey === "seo") {
    const tier = SEO_TIERS.find((t) => t.id === parsed.tier);
    if (!tier) throw new Error(`addon-plans: no SEO tier "${parsed.tier}"`);
    return {
      priceId,
      unitAmount: parsed.cycle === "monthly" ? tier.monthly : tier.annual,
      interval,
      displayName: `SEO ${tier.name}`,
      addonKey: "seo",
      cycle: parsed.cycle,
    };
  }

  const unitAmount =
    parsed.cycle === "monthly" ? ADS_PRICING.monthly : ADS_PRICING.annual;
  const displayName =
    parsed.addonKey === "google_ads" ? "Google Ads" : "Social Ads";
  return {
    priceId,
    unitAmount,
    interval,
    displayName,
    addonKey: parsed.addonKey,
    cycle: parsed.cycle,
  };
}

/** Human label for admin surfaces + dashboard, e.g. "SEO Growth · $59/month". */
export function labelForAddonPlanKey(key: AddonPlanKey): string {
  const info = priceForAddon(key);
  const dollars = (info.unitAmount / 100).toFixed(0);
  return `${info.displayName} · $${dollars}/${info.cycle === "monthly" ? "month" : "year"}`;
}

/** Annual discount label used on the picker toggle. */
export const ADDON_ANNUAL_DISCOUNT_LABEL = "Save 15–17%";
