import { describe, it, expect } from "vitest";
import {
  postsPerMonth,
  isPublishDay,
  publishScheduleForTier,
} from "./seo-cadence";

const SUBSCRIBED = new Date("2026-08-01T00:00:00+10:00"); // 1 Aug AEST

function dayOffset(days: number): Date {
  return new Date(SUBSCRIBED.getTime() + days * 24 * 60 * 60 * 1000);
}

describe("postsPerMonth", () => {
  it("returns 4/8/16 by tier", () => {
    expect(postsPerMonth("starter")).toBe(4);
    expect(postsPerMonth("growth")).toBe(8);
    expect(postsPerMonth("pro")).toBe(16);
  });
});

describe("publishScheduleForTier", () => {
  it("starter: [0, 7, 14, 21]", () => {
    expect(publishScheduleForTier("starter")).toEqual([0, 7, 14, 21]);
  });
  it("growth: [0, 3, 6, 9, 12, 15, 18, 21]", () => {
    expect(publishScheduleForTier("growth")).toEqual([0, 3, 6, 9, 12, 15, 18, 21]);
  });
  it("pro: even days 0..30 (16 posts)", () => {
    expect(publishScheduleForTier("pro")).toEqual([
      0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30,
    ]);
  });
});

describe("isPublishDay", () => {
  const scheduleForTier = {
    starter: publishScheduleForTier("starter"),
    growth: publishScheduleForTier("growth"),
    pro: publishScheduleForTier("pro"),
  } as const;

  (["starter", "growth", "pro"] as const).forEach((tier) => {
    it(`${tier}: publishes on schedule days across three cycles`, () => {
      const schedule = scheduleForTier[tier];
      for (let cycle = 0; cycle < 3; cycle++) {
        for (let dayOfCycle = 0; dayOfCycle < 30; dayOfCycle++) {
          const today = dayOffset(cycle * 30 + dayOfCycle);
          const expected = schedule.includes(dayOfCycle);
          expect(
            isPublishDay({ subscribedAt: SUBSCRIBED, tier, today }),
            `tier=${tier} cycle=${cycle} dayOfCycle=${dayOfCycle}`,
          ).toBe(expected);
        }
      }
    });
  });

  it("day 0 is always a publish day (subscribe day, all tiers)", () => {
    (["starter", "growth", "pro"] as const).forEach((tier) => {
      expect(
        isPublishDay({ subscribedAt: SUBSCRIBED, tier, today: SUBSCRIBED }),
      ).toBe(true);
    });
  });

  it("day 22 for starter (past its 4 posts) is NOT a publish day", () => {
    expect(
      isPublishDay({
        subscribedAt: SUBSCRIBED,
        tier: "starter",
        today: dayOffset(22),
      }),
    ).toBe(false);
  });
});
