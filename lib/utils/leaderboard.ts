import type { LeaderboardEntry } from "@/lib/types/leaderboard";
import { getISOWeekNumber } from "@/lib/utils/dates";

export type BoardMode = "weekly" | "global";

/** Weekly XP only counts if the entry was updated in the current ISO week. */
export function effectiveWeeklyXP(
  entry: LeaderboardEntry,
  currentWeek = getISOWeekNumber()
): number {
  if ((entry.weekNumber ?? 0) !== currentWeek) return 0;
  return entry.weeklyXP ?? 0;
}

export function weeklyParticipants(
  entries: LeaderboardEntry[],
  currentWeek = getISOWeekNumber()
): LeaderboardEntry[] {
  return entries.filter((e) => (e.weekNumber ?? 0) === currentWeek);
}

export function sortBoard(
  entries: LeaderboardEntry[],
  mode: BoardMode,
  currentWeek = getISOWeekNumber()
): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (mode === "weekly") {
      return effectiveWeeklyXP(b, currentWeek) - effectiveWeeklyXP(a, currentWeek);
    }
    return (b.totalXP ?? b.weeklyXP ?? 0) - (a.totalXP ?? a.weeklyXP ?? 0);
  });
}

export function xpForEntry(
  entry: LeaderboardEntry,
  mode: BoardMode,
  currentWeek = getISOWeekNumber()
): number {
  return mode === "weekly"
    ? effectiveWeeklyXP(entry, currentWeek)
    : entry.totalXP ?? entry.weeklyXP ?? 0;
}

export function participationCount(
  entries: LeaderboardEntry[],
  mode: BoardMode,
  currentWeek = getISOWeekNumber()
): number {
  return mode === "weekly"
    ? weeklyParticipants(entries, currentWeek).length
    : entries.length;
}

export function findRank(
  entries: LeaderboardEntry[],
  address: string,
  mode: BoardMode,
  currentWeek = getISOWeekNumber()
): number {
  const pool =
    mode === "weekly" ? weeklyParticipants(entries, currentWeek) : entries;
  const sorted = sortBoard(pool, mode, currentWeek);
  return sorted.findIndex((e) => e.address.toLowerCase() === address.toLowerCase());
}

export function topEntries(
  entries: LeaderboardEntry[],
  mode: BoardMode,
  limit: number,
  currentWeek = getISOWeekNumber()
): LeaderboardEntry[] {
  const pool =
    mode === "weekly" ? weeklyParticipants(entries, currentWeek) : entries;
  return sortBoard(pool, mode, currentWeek).slice(0, limit);
}
