/**
 * lib/plans.ts
 *
 * Single source of truth for pricing tiers. Every plan-aware surface —
 * PlanPicker modal, ChangeRequestsPanel, Stripe checkout, dashboard billing
 * card, quota checks — reads from here so a copy tweak or a Stripe price
 * rotation is a one-line edit.
 *
 * Shape:
 *   PLAN_TIERS  → three tiers (starter, growth, pro) with cap + features
 *   PLAN_KEYS   → six actual Stripe SKUs (tier × billing cycle)
 *   priceFor()  → resolves a plan key → { unitAmount, interval, priceId? }
 *   labelFor()  → resolves a plan key → human-readable label
 */

export type TierId = "starter" | "growth" | "pro";
export type BillingCycle = "monthly" | "annual";
export type PlanKey =
  | "starter-monthly"
  | "starter-annual"
  | "growth-monthly"
  | "growth-annual"
  | "pro-monthly"
  | "pro-annual";

export interface Tier {
  id: TierId;
  name: string;
  /** Bullet features. First line is the headline. */
  features: string[];
  /** Combined edit-request quota per calendar month. Infinity = "unlimited (fair use)". */
  editsCap: number;
  /** Soft cap on a Pro (fair-use unlimited) plan before we warn the user. */
  fairUseSoftCap?: number;
  /** Hard cap on a Pro plan — refuse new requests past this. */
  fairUseHardCap?: number;
  /** Marketing accent — highlight the middle tier. */
  popular?: boolean;
  /** Monthly billing (AUD cents). */
  monthly: number;
  /** Annual billing (AUD cents). Displayed with a "Save 15%" chip. */
  annual: number;
}

/**
 * The three tiers. Order = display order (left → right).
 * Amounts are AUD cents.
 */
export const TIERS: readonly Tier[] = [
  {
    id: "starter",
    name: "Starter",
    features: [
      "Full site with local SEO",
      "Google Business Profile sync",
      "Custom domain",
      "Support on genuine technical failures only",
    ],
    editsCap: 0,
    monthly: 2900,
    annual: 29900,
  },
  {
    id: "growth",
    name: "Growth",
    features: [
      "Everything in Starter",
      "20 edits per month",
      "Turnaround within 2 business days",
    ],
    editsCap: 20,
    popular: true,
    monthly: 5900,
    annual: 59900,
  },
  {
    id: "pro",
    name: "Pro",
    features: [
      "Everything in Growth",
      "Unlimited edits (fair use)",
      "Priority queue — same-day for most edits",
    ],
    editsCap: Infinity,
    fairUseSoftCap: 30,
    fairUseHardCap: 60,
    monthly: 9900,
    annual: 99900,
  },
] as const;

export const PLAN_KEYS: readonly PlanKey[] = [
  "starter-monthly",
  "starter-annual",
  "growth-monthly",
  "growth-annual",
  "pro-monthly",
  "pro-annual",
] as const;

/** Split a plan key into its tier + billing cycle. Returns null on malformed input. */
export function splitPlanKey(key: string | null | undefined): { tier: TierId; cycle: BillingCycle } | null {
  if (!key) return null;
  const [tier, cycle] = key.split("-");
  if (tier !== "starter" && tier !== "growth" && tier !== "pro") return null;
  if (cycle !== "monthly" && cycle !== "annual") return null;
  return { tier, cycle };
}

/** Resolve a tier id → the Tier record (never null for a valid TierId). */
export function tierOf(id: TierId): Tier {
  const t = TIERS.find((t) => t.id === id);
  if (!t) throw new Error(`plans.ts: no tier with id "${id}"`);
  return t;
}

/**
 * Resolve a plan key → what Stripe needs to create the line item.
 *
 * `priceId` comes from an env var when set (production), falls back to
 * inline `price_data` (dev / pre-Stripe-setup). The env var lookup is a
 * mechanical translation: `growth-monthly` → `STRIPE_PRICE_GROWTH_MONTHLY`.
 */
export function priceFor(key: PlanKey): {
  priceId?: string;
  unitAmount: number;
  interval: "month" | "year";
  tierName: string;
} {
  const parts = splitPlanKey(key);
  if (!parts) throw new Error(`plans.ts: unknown plan key "${key}"`);
  const tier = tierOf(parts.tier);
  const envVar = `STRIPE_PRICE_${parts.tier.toUpperCase()}_${parts.cycle.toUpperCase()}`;
  return {
    priceId: process.env[envVar],
    unitAmount: parts.cycle === "monthly" ? tier.monthly : tier.annual,
    interval: parts.cycle === "monthly" ? "month" : "year",
    tierName: tier.name,
  };
}

/** Human label for admin surfaces + dashboard, e.g. "Growth · $59/month". */
export function labelFor(key: PlanKey): string {
  const parts = splitPlanKey(key);
  if (!parts) return "Unknown plan";
  const tier = tierOf(parts.tier);
  const amount = parts.cycle === "monthly" ? tier.monthly : tier.annual;
  const dollars = (amount / 100).toFixed(0);
  return `${tier.name} · $${dollars}/${parts.cycle === "monthly" ? "month" : "year"}`;
}

/** 15% annual discount, presented as a chip on the picker. */
export const ANNUAL_DISCOUNT_LABEL = "Save 15%";
