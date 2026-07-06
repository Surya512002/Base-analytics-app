import { WEEKLY_QUESTS } from "@/lib/constants/season";
import {
  CHECK_IN_TRACK_DAYS,
  weeklyStreakBonusPP,
} from "@/lib/utils/check-in-rewards";
import { todayUtcKey } from "@/lib/utils/check-in-status";
import { getWeekKey } from "@/lib/utils/dates";

/** Max activity PP per UTC day — check-in, boost, GM, GN, and other in-app txs. */
export const DAILY_POINTS_CAP = 200;

/** Weekly bonus when 7-day cap streak + all quests done. */
export const SEVEN_DAY_ALL_TASKS_BONUS = 100;

/** Target in-app txs per day for a strong activity score. */
export const TARGET_TXS_MIN = 5;
export const TARGET_TXS_IDEAL = 10;

/** Daily activity cap — counts toward 200 PP/day. */
export const POINTS_PER_CHECKIN = 15;
export const POINTS_PER_BOOST = 15;
export const POINTS_PER_GM = 10;
export const POINTS_PER_GN = 10;

/** Extra in-app actions that help reach the daily cap. */
export const POINTS_PER_REDEEM = 18;
export const POINTS_PER_VOUCHER = 20;
export const POINTS_PER_X402 = 22;
export const POINTS_PER_CHALLENGE = 15;
export const POINTS_PER_PREDICTION = 28;

type DayEntry = {
  activity: number;
  streak: number;
  bonus: number;
  txs: number;
  capBonusAwarded: boolean;
};

type WeekLedger = Record<string, DayEntry>;

type ActivityAction =
  | "boost"
  | "gm"
  | "gn"
  | "redeem"
  | "voucher"
  | "x402"
  | "challenge"
  | "prediction";

const ACTIVITY_POINTS: Record<ActivityAction, number> = {
  boost: POINTS_PER_BOOST,
  gm: POINTS_PER_GM,
  gn: POINTS_PER_GN,
  redeem: POINTS_PER_REDEEM,
  voucher: POINTS_PER_VOUCHER,
  x402: POINTS_PER_X402,
  challenge: POINTS_PER_CHALLENGE,
  prediction: POINTS_PER_PREDICTION,
};

function ledgerKey(address: string): string {
  const week = getWeekKey(new Date().toISOString());
  return `base_daily_pts_v3_${address.toLowerCase()}_${week}`;
}

function allTasksBonusKey(address: string, day: string): string {
  return `base_all_tasks_bonus_${address.toLowerCase()}_${day}`;
}

function capCycleKey(address: string): string {
  return `base_cap_cycle_${address.toLowerCase()}`;
}

function capLastHitKey(address: string): string {
  return `base_cap_last_hit_${address.toLowerCase()}`;
}

function yesterdayUtcKey(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function emptyDay(): DayEntry {
  return { activity: 0, streak: 0, bonus: 0, txs: 0, capBonusAwarded: false };
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

function readCapCycleNext(address: string): number {
  if (typeof window === "undefined") return 1;
  const n = parseInt(localStorage.getItem(capCycleKey(address)) || "1", 10);
  return Number.isFinite(n) && n >= 1 && n <= CHECK_IN_TRACK_DAYS ? n : 1;
}

function writeCapCycleNext(address: string, day: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(capCycleKey(address), String(Math.max(1, Math.min(day, CHECK_IN_TRACK_DAYS))));
}

/** Weekly cap-streak UI state (10→100 PP when daily cap is hit). */
export function getCapStreakUIState(address: string): {
  nextAwardDay: number;
  capBonusAwardedToday: boolean;
  hitCapToday: boolean;
  nextBonusPP: number;
} {
  const today = todayUtcKey();
  const day = getDayEntry(readWeekLedger(address), today);
  const nextAwardDay = readCapCycleNext(address);
  return {
    nextAwardDay,
    capBonusAwardedToday: day.capBonusAwarded,
    hitCapToday: day.activity >= DAILY_POINTS_CAP,
    nextBonusPP: weeklyStreakBonusPP(nextAwardDay),
  };
}

/**
 * When daily cap is hit, grant weekly streak bonus (10→100 over 7 consecutive cap days).
 * Resets cycle to day 1 after day 7 is awarded.
 */
function tryAwardCapStreakBonus(address: string): number {
  if (!address || typeof window === "undefined") return 0;

  const today = todayUtcKey();
  const ledger = readWeekLedger(address);
  const day = getDayEntry(ledger, today);

  if (day.activity < DAILY_POINTS_CAP || day.capBonusAwarded) return 0;

  const lastHit = localStorage.getItem(capLastHitKey(address));
  let cycleDay = readCapCycleNext(address);

  if (lastHit && lastHit !== today && lastHit !== yesterdayUtcKey()) {
    cycleDay = 1;
    writeCapCycleNext(address, 1);
  }

  const points = weeklyStreakBonusPP(cycleDay);
  day.streak += points;
  day.capBonusAwarded = true;
  ledger[today] = day;
  writeWeekLedger(address, ledger);

  const nextCycle = cycleDay >= CHECK_IN_TRACK_DAYS ? 1 : cycleDay + 1;
  writeCapCycleNext(address, nextCycle);
  localStorage.setItem(capLastHitKey(address), today);

  return points;
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
  if (credited > 0) day.txs += 1;
  ledger[today] = day;
  writeWeekLedger(address, ledger);

  const hitCap = day.activity >= DAILY_POINTS_CAP;
  if (hitCap) tryAwardCapStreakBonus(address);

  return {
    credited,
    hitCap: credited < points || hitCap,
  };
}

export function addStreakPoints(address: string, points: number): number {
  if (!address || points <= 0) return 0;

  const today = todayUtcKey();
  const ledger = readWeekLedger(address);
  const day = getDayEntry(ledger, today);
  day.streak += points;
  ledger[today] = day;
  writeWeekLedger(address, ledger);
  return points;
}

function syncedCountKey(address: string, action: string): string {
  const week = getWeekKey(new Date().toISOString());
  return `base_act_synced_v3_${action}_${address.toLowerCase()}_${week}`;
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

function checkInPointsFlag(address: string): string {
  return `base_ci_pts_${address.toLowerCase()}_${todayUtcKey()}`;
}

/** Credit activity for an action up to totalCount without double-counting. */
export function creditActivityFromCount(
  address: string,
  action: ActivityAction,
  totalCount: number
): { credited: number; hitCap: boolean; changed: boolean } {
  const synced = readSyncedCount(address, action);
  const delta = Math.max(0, totalCount - synced);
  if (delta === 0) {
    return { credited: 0, hitCap: false, changed: false };
  }

  const pointsEach = ACTIVITY_POINTS[action];
  let credited = 0;
  let hitCap = false;
  for (let i = 0; i < delta; i++) {
    const result = addActivityPoints(address, pointsEach);
    credited += result.credited;
    hitCap = hitCap || result.hitCap;
  }
  writeSyncedCount(address, action, totalCount);
  return { credited, hitCap, changed: true };
}

function creditActionDelta(
  address: string,
  action: ActivityAction,
  txCount: number
): boolean {
  return creditActivityFromCount(address, action, txCount).changed;
}

export function syncActivityPointsFromSession(
  address: string,
  txKeys: Record<string, number>,
  _streak: number,
  checkedToday: boolean,
  _x402PayCount = 0,
  _voucherBatchCount = 0,
  didChallenge = false
): boolean {
  if (!address) return false;

  let changed = false;

  if (checkedToday) {
    const ci = recordCheckInPointsOnce(address);
    if (ci.credited > 0) changed = true;
  }

  const challengeCount = Math.max(
    txKeys.challenge ?? 0,
    didChallenge ? 1 : 0
  );

  const actions: Array<[ActivityAction, number]> = [
    ["boost", txKeys.boost ?? 0],
    ["gm", txKeys.gm ?? 0],
    ["gn", txKeys.gn ?? 0],
    ["redeem", txKeys.redeem ?? 0],
    ["voucher", txKeys.voucher ?? 0],
    ["x402", txKeys.x402 ?? 0],
    ["challenge", challengeCount],
    ["prediction", txKeys.prediction ?? 0],
  ];

  for (const [action, count] of actions) {
    if (creditActionDelta(address, action, count)) {
      changed = true;
    }
  }

  return changed;
}

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
  streak: number;
  bonus: number;
  total: number;
  cap: number;
  remaining: number;
  txs: number;
  capBonusAwarded: boolean;
} {
  const today = todayUtcKey();
  const day = getDayEntry(readWeekLedger(address), today);
  const remaining = Math.max(0, DAILY_POINTS_CAP - day.activity);
  return {
    activity: day.activity,
    streak: day.streak,
    bonus: day.bonus,
    total: day.activity + day.streak + day.bonus,
    cap: DAILY_POINTS_CAP,
    remaining,
    txs: day.txs,
    capBonusAwarded: day.capBonusAwarded,
  };
}

export function getWeekActivityTotal(address: string): number {
  const ledger = readWeekLedger(address);
  return Object.values(ledger).reduce((sum, d) => sum + d.activity, 0);
}

export function getWeekStreakTotal(address: string): number {
  const ledger = readWeekLedger(address);
  return Object.values(ledger).reduce(
    (sum, d) => sum + d.streak + d.bonus,
    0
  );
}

export function getWeekPointsTotal(address: string): number {
  return getWeekActivityTotal(address) + getWeekStreakTotal(address);
}

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

export function recordRedeemPoints(address: string): {
  credited: number;
  hitCap: boolean;
} {
  return addActivityPoints(address, POINTS_PER_REDEEM);
}

export function recordVoucherPoints(address: string): {
  credited: number;
  hitCap: boolean;
} {
  return addActivityPoints(address, POINTS_PER_VOUCHER);
}

export function recordX402Points(address: string): {
  credited: number;
  hitCap: boolean;
} {
  return addActivityPoints(address, POINTS_PER_X402);
}

export function recordChallengePoints(address: string): {
  credited: number;
  hitCap: boolean;
} {
  return addActivityPoints(address, POINTS_PER_CHALLENGE);
}

/** Daily check-in — 15 PP toward daily cap; weekly streak bonus is separate on cap hit. */
export function recordPredictionPoints(address: string): {
  credited: number;
  hitCap: boolean;
} {
  return addActivityPoints(address, POINTS_PER_PREDICTION);
}

export function recordCheckInPoints(
  address: string
): { credited: number; hitCap: boolean } {
  return addActivityPoints(address, POINTS_PER_CHECKIN);
}

/** Check-in points at most once per UTC day (avoids duplicate in-app tx count). */
export function recordCheckInPointsOnce(
  address: string
): { credited: number; hitCap: boolean } {
  if (!address || typeof window === "undefined") {
    return { credited: 0, hitCap: false };
  }
  const flag = checkInPointsFlag(address);
  if (localStorage.getItem(flag)) {
    return { credited: 0, hitCap: false };
  }
  const result = recordCheckInPoints(address);
  localStorage.setItem(flag, "1");
  return result;
}
