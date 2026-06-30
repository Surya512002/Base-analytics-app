import { WEEKLY_QUESTS } from "@/lib/constants/season";
import { CHECK_IN_TRACK_DAYS, dailyRewardPP } from "@/lib/utils/check-in-rewards";
import { todayUtcKey } from "@/lib/utils/check-in-status";
import { getWeekKey } from "@/lib/utils/dates";

/** Max activity points earnable per UTC day (boost, GM, GN, check-in). */
export const DAILY_POINTS_CAP = 200;

/** Extra bonus on top of daily cap — 7-day streak + all weekly quests done. */
export const SEVEN_DAY_ALL_TASKS_BONUS = 125;

export const POINTS_PER_BOOST = 15;
export const POINTS_PER_GM = 10;
export const POINTS_PER_GN = 10;

type DayEntry = {
  activity: number;
  bonus: number;
};

type WeekLedger = Record<string, DayEntry>;

function ledgerKey(address: string): string {
  const week = getWeekKey(new Date().toISOString());
  return `base_daily_pts_${address.toLowerCase()}_${week}`;
}

function allTasksBonusKey(address: string, day: string): string {
  return `base_all_tasks_bonus_${address.toLowerCase()}_${day}`;
}

function emptyDay(): DayEntry {
  return { activity: 0, bonus: 0 };
}

function readWeekLedger(address: string): WeekLedger {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ledgerKey(address));
    if (!raw) return {};
    return JSON.parse(raw) as WeekLedger;
  } catch {
    return {};
  }
}

function writeWeekLedger(address: string, ledger: WeekLedger): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ledgerKey(address), JSON.stringify(ledger));
  } catch {
    // quota / private mode
  }
}

function getDayEntry(ledger: WeekLedger, day: string): DayEntry {
  return ledger[day] ?? emptyDay();
}

/** Credit activity points toward today's cap. Returns how much was actually added. */
export function addActivityPoints(
  address: string,
  points: number
): { credited: number; hitCap: boolean } {
  if (!address || points <= 0) return { credited: 0, hitCap: false };

  const today = todayUtcKey();
  const ledger = readWeekLedger(address);
  const day = getDayEntry(ledger, today);
  const room = Math.max(0, DAILY_POINTS_CAP - day.activity);
  const credited = Math.min(points, room);
  day.activity += credited;
  ledger[today] = day;
  writeWeekLedger(address, ledger);

  return {
    credited,
    hitCap: credited < points || day.activity >= DAILY_POINTS_CAP,
  };
}

/** Activity first, then overflow stacks as bonus (still counts for week/today). */
function creditActivityWithOverflow(address: string, points: number): number {
  const { credited, hitCap } = addActivityPoints(address, points);
  if (hitCap && credited < points) {
    addBonusPoints(address, points - credited);
  }
  return points;
}

function syncedCountKey(address: string, action: string): string {
  const week = getWeekKey(new Date().toISOString());
  return `base_act_synced_${action}_${address.toLowerCase()}_${week}`;
}

function readSyncedCount(address: string, action: string): number {
  if (typeof window === "undefined") return 0;
  const n = parseInt(localStorage.getItem(syncedCountKey(address, action)) || "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function writeSyncedCount(address: string, action: string, count: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(syncedCountKey(address, action), String(Math.max(0, count)));
  } catch {
    // quota / private mode
  }
}

function creditActionDelta(
  address: string,
  action: "boost" | "gm" | "gn",
  txCount: number,
  pointsEach: number
): boolean {
  const synced = readSyncedCount(address, action);
  const delta = Math.max(0, txCount - synced);
  if (delta === 0) return false;

  for (let i = 0; i < delta; i++) {
    creditActivityWithOverflow(address, pointsEach);
  }
  writeSyncedCount(address, action, txCount);
  return true;
}

/**
 * Backfill activity ledger from in-app session counters (boost/GM/GN/check-in).
 * Points only record when txs succeed; this catches prior actions + chain-synced check-ins.
 */
export function syncActivityPointsFromSession(
  address: string,
  txKeys: Record<string, number>,
  streak: number,
  checkedToday: boolean
): boolean {
  if (!address) return false;

  let changed = false;

  if (checkedToday) {
    const flag = `base_ci_pts_${address.toLowerCase()}_${todayUtcKey()}`;
    if (typeof window !== "undefined" && !localStorage.getItem(flag)) {
      recordCheckInPoints(address, streak);
      localStorage.setItem(flag, "1");
      changed = true;
    }
  }

  if (creditActionDelta(address, "boost", txKeys.boost ?? 0, POINTS_PER_BOOST)) {
    changed = true;
  }
  if (creditActionDelta(address, "gm", txKeys.gm ?? 0, POINTS_PER_GM)) {
    changed = true;
  }
  if (creditActionDelta(address, "gn", txKeys.gn ?? 0, POINTS_PER_GN)) {
    changed = true;
  }

  return changed;
}

/** Bonus points stack above the daily activity cap. */
export function addBonusPoints(address: string, points: number): number {
  if (!address || points <= 0) return 0;

  const today = todayUtcKey();
  const ledger = readWeekLedger(address);
  const day = getDayEntry(ledger, today);
  day.bonus += points;
  ledger[today] = day;
  writeWeekLedger(address, ledger);
  return points;
}

export function getTodayPointsSummary(address: string): {
  activity: number;
  bonus: number;
  total: number;
  cap: number;
  remaining: number;
} {
  const today = todayUtcKey();
  const day = getDayEntry(readWeekLedger(address), today);
  const remaining = Math.max(0, DAILY_POINTS_CAP - day.activity);
  return {
    activity: day.activity,
    bonus: day.bonus,
    total: day.activity + day.bonus,
    cap: DAILY_POINTS_CAP,
    remaining,
  };
}

export function getWeekPointsTotal(address: string): number {
  const ledger = readWeekLedger(address);
  return Object.values(ledger).reduce(
    (sum, d) => sum + d.activity + d.bonus,
    0
  );
}

/** Award 7-day streak + all-quests bonus once per UTC day (uncapped). */
export function tryAwardSevenDayAllTasksBonus(
  address: string,
  streak: number,
  doneQuests: number
): number {
  if (streak < CHECK_IN_TRACK_DAYS || doneQuests < WEEKLY_QUESTS.length) {
    return 0;
  }

  const today = todayUtcKey();
  const flagKey = allTasksBonusKey(address, today);
  if (typeof window !== "undefined" && localStorage.getItem(flagKey)) {
    return 0;
  }

  const credited = addBonusPoints(address, SEVEN_DAY_ALL_TASKS_BONUS);
  if (credited > 0 && typeof window !== "undefined") {
    localStorage.setItem(flagKey, "1");
  }
  return credited;
}

export function recordBoostPoints(address: string): {
  credited: number;
  hitCap: boolean;
} {
  return addActivityPoints(address, POINTS_PER_BOOST);
}

export function recordGmPoints(address: string): {
  credited: number;
  hitCap: boolean;
} {
  return addActivityPoints(address, POINTS_PER_GM);
}

export function recordGnPoints(address: string): {
  credited: number;
  hitCap: boolean;
} {
  return addActivityPoints(address, POINTS_PER_GN);
}

export function recordCheckInPoints(
  address: string,
  streak: number
): { credited: number; hitCap: boolean } {
  const day = Math.max(1, Math.min(streak, CHECK_IN_TRACK_DAYS));
  return addActivityPoints(address, dailyRewardPP(day));
}
