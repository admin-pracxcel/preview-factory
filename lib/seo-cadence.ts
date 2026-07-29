/**
 * lib/seo-cadence.ts
 *
 * Pure scheduling functions for the SEO add-on. Given a tenant's SEO tier
 * and its subscribed_at anchor, compute which days of a rolling 30-day
 * cycle are publish days — for both the blog automation and (later) the
 * GBP automation, which fire in lockstep off the same schedule.
 *
 * No side effects, no I/O. Fully unit-testable.
 */

export type SeoTier = "starter" | "growth" | "pro";

export function postsPerMonth(tier: SeoTier): 4 | 8 | 16 {
  return { starter: 4 as const, growth: 8 as const, pro: 16 as const }[tier];
}

/** Whole days between two Dates, floored (a=Mon 00:00, b=Tue 23:59 → 1). */
export function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.floor((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/**
 * The day-of-cycle offsets (0-based) on which posts should fire, for a
 * rolling 30-day cycle.
 *
 * - starter (4): [0, 7, 14, 21]           — every ~7 days
 * - growth  (8): [0, 3, 6, 9, 12, 15, 18, 21] — every 3 days
 * - pro    (16): [0, 2, 4, ..., 30]       — every 2 days
 *
 * Pro is special-cased away from the naive `floor(30/16) = 1` spacing,
 * which would publish 16 consecutive days then rest — bad look.
 */
export function publishScheduleForTier(tier: SeoTier): readonly number[] {
  if (tier === "starter") return [0, 7, 14, 21] as const;
  if (tier === "growth") return [0, 3, 6, 9, 12, 15, 18, 21] as const;
  // pro
  return [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] as const;
}

export function isPublishDay(args: {
  subscribedAt: Date;
  tier: SeoTier;
  today: Date;
}): boolean {
  const totalDays = daysBetween(args.subscribedAt, args.today);
  if (totalDays < 0) return false;
  const dayOfCycle = totalDays % 30;
  return publishScheduleForTier(args.tier).includes(dayOfCycle);
}
