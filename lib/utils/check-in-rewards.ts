export const CHECK_IN_TRACK_DAYS = 7;

/**
 * Weekly streak bonus PP on consecutive daily check-ins.
 * Day 1 = 10 → Day 7 = 100 (+15 per day). Resets after day 7.
 */
export const BASE_STREAK_PP = 10;
export const PP_PER_STREAK_DAY = 15;

export type TrackDayStatus = "done" | "today" | "upcoming";

export function weeklyStreakBonusPP(cycleDay: number): number {
  const d = Math.max(1, Math.min(cycleDay, CHECK_IN_TRACK_DAYS));
  return BASE_STREAK_PP + (d - 1) * PP_PER_STREAK_DAY;
}

/** @deprecated Use weeklyStreakBonusPP */
export const dailyRewardPP = weeklyStreakBonusPP;

/** +0% on day 1 → +60% on day 7 (on-chain check-in streak → quest XP multiplier). */
export function streakBoostPercent(streakDay: number): number {
  const d = Math.max(1, Math.min(streakDay, CHECK_IN_TRACK_DAYS));
  return (d - 1) * 10;
}

/** Which tier in the 7-day check-in cycle pays out for today's check-in. */
export function rewardDayForToday(streak: number, checkedToday: boolean): number {
  const nextStreak = checkedToday ? streak : streak + 1;
  if (nextStreak <= 0) return 1;
  return ((nextStreak - 1) % CHECK_IN_TRACK_DAYS) + 1;
}

/** Map absolute on-chain streak onto the current 1–7 cycle position. */
export function cycleDayFromStreak(streak: number): number {
  if (streak <= 0) return 0;
  const mod = streak % CHECK_IN_TRACK_DAYS;
  return mod === 0 ? CHECK_IN_TRACK_DAYS : mod;
}

/** 7-day weekly bonus track — driven by consecutive on-chain check-ins. */
export function getTrackDayStatuses(
  streak: number,
  checkedToday: boolean
): TrackDayStatus[] {
  const cycleStreak = cycleDayFromStreak(streak);

  return Array.from({ length: CHECK_IN_TRACK_DAYS }, (_, i) => {
    const day = i + 1;
    if (checkedToday) {
      if (day <= cycleStreak) return "done";
      return "upcoming";
    }
    if (day <= cycleStreak) return "done";
    if (day === cycleStreak + 1 || (cycleStreak === 0 && day === 1)) return "today";
    return "upcoming";
  });
}

/**
 * @deprecated Cap-hit track — weekly bonus is check-in driven.
 * Kept for residual callers; prefer getTrackDayStatuses.
 */
export function getCapStreakTrackStatuses(
  nextAwardDay: number,
  capBonusAwardedToday: boolean
): TrackDayStatus[] {
  const next = Math.max(1, Math.min(nextAwardDay, CHECK_IN_TRACK_DAYS));
  const completed = capBonusAwardedToday
    ? next === 1
      ? CHECK_IN_TRACK_DAYS
      : next - 1
    : next - 1;

  return Array.from({ length: CHECK_IN_TRACK_DAYS }, (_, i) => {
    const day = i + 1;
    if (day <= completed) return "done";
    if (day === next && !capBonusAwardedToday) return "today";
    return "upcoming";
  });
}

export function capStreakProgressLabel(
  nextAwardDay: number,
  capBonusAwardedToday: boolean
): string {
  const next = Math.max(1, Math.min(nextAwardDay, CHECK_IN_TRACK_DAYS));
  const done = capBonusAwardedToday
    ? next === 1
      ? CHECK_IN_TRACK_DAYS
      : next - 1
    : Math.max(0, next - 1);
  return `${done}/${CHECK_IN_TRACK_DAYS}`;
}

export function trackProgressLabel(streak: number, _checkedToday: boolean): string {
  const done = cycleDayFromStreak(streak);
  return `${done}/${CHECK_IN_TRACK_DAYS}`;
}
