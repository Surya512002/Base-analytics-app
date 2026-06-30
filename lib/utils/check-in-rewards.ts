export const CHECK_IN_TRACK_DAYS = 7;

/** Base daily points — scales +10 PP per consecutive day in the 7-day cycle. */
export const BASE_DAILY_PP = 50;
export const PP_PER_STREAK_DAY = 10;

export type TrackDayStatus = "done" | "today" | "upcoming";

export function dailyRewardPP(streakDay: number): number {
  const d = Math.max(1, Math.min(streakDay, CHECK_IN_TRACK_DAYS));
  return BASE_DAILY_PP + (d - 1) * PP_PER_STREAK_DAY;
}

/** +0% on day 1 → +60% on day 7 (miss a day → contract streak resets → back to day 1). */
export function streakBoostPercent(streakDay: number): number {
  const d = Math.max(1, Math.min(streakDay, CHECK_IN_TRACK_DAYS));
  return (d - 1) * 10;
}

/** Which day in the 7-day cycle the next / current check-in pays out. */
export function rewardDayForToday(streak: number, checkedToday: boolean): number {
  const nextStreak = checkedToday ? streak : streak + 1;
  if (nextStreak <= 0) return 1;
  return ((nextStreak - 1) % CHECK_IN_TRACK_DAYS) + 1;
}

export function getTrackDayStatuses(
  streak: number,
  checkedToday: boolean
): TrackDayStatus[] {
  return Array.from({ length: CHECK_IN_TRACK_DAYS }, (_, i) => {
    const day = i + 1;
    if (checkedToday) {
      if (day <= streak) return "done";
      return "upcoming";
    }
    if (day <= streak) return "done";
    if (day === streak + 1 || (streak === 0 && day === 1)) return "today";
    return "upcoming";
  });
}

export function trackProgressLabel(streak: number, checkedToday: boolean): string {
  const done = checkedToday ? Math.min(streak, CHECK_IN_TRACK_DAYS) : Math.min(streak, CHECK_IN_TRACK_DAYS);
  return `${done}/${CHECK_IN_TRACK_DAYS}`;
}
