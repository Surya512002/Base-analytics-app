import { describe, expect, it } from "vitest";
import {
  cycleDayFromStreak,
  getTrackDayStatuses,
  rewardDayForToday,
  weeklyStreakBonusPP,
} from "@/lib/utils/check-in-rewards";

describe("check-in weekly bonus track", () => {
  it("awards 10 → 100 across the 7-day cycle", () => {
    expect(weeklyStreakBonusPP(1)).toBe(10);
    expect(weeklyStreakBonusPP(2)).toBe(25);
    expect(weeklyStreakBonusPP(7)).toBe(100);
  });

  it("maps absolute streak onto cycle day", () => {
    expect(cycleDayFromStreak(0)).toBe(0);
    expect(cycleDayFromStreak(1)).toBe(1);
    expect(cycleDayFromStreak(7)).toBe(7);
    expect(cycleDayFromStreak(8)).toBe(1);
  });

  it("marks today and done days from on-chain streak", () => {
    expect(getTrackDayStatuses(0, false)[0]).toBe("today");
    expect(getTrackDayStatuses(2, false)[0]).toBe("done");
    expect(getTrackDayStatuses(2, false)[1]).toBe("done");
    expect(getTrackDayStatuses(2, false)[2]).toBe("today");
    expect(getTrackDayStatuses(3, true)[2]).toBe("done");
    expect(getTrackDayStatuses(3, true)[3]).toBe("upcoming");
  });

  it("picks the reward day for the next or current check-in", () => {
    expect(rewardDayForToday(0, false)).toBe(1);
    expect(rewardDayForToday(2, false)).toBe(3);
    expect(rewardDayForToday(3, true)).toBe(3);
    expect(rewardDayForToday(7, true)).toBe(7);
  });
});
