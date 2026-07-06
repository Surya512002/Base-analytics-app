import { getWeekKey } from "@/lib/utils/dates";
import { todayUtcKey } from "@/lib/utils/check-in-status";

export type CalendarKeys = {
  day: string;
  week: string;
};

export function getCalendarKeys(): CalendarKeys {
  const now = new Date().toISOString();
  return { day: todayUtcKey(), week: getWeekKey(now) };
}

/** Milliseconds until the next UTC midnight (for scheduling rollover checks). */
export function msUntilNextUtcDay(): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  return Math.max(1000, next.getTime() - now.getTime());
}
