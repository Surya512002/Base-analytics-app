/** Cumulative in-app stats — badges use lifetime totals, not just this week. */

import type { AppBadgeMetrics } from "@/lib/utils/app-badge-levels";

export const LIFETIME_INCREMENT_FIELDS = [
  "swap",
  "launch",
  "checkin",
  "boost",
  "voucher",
  "redeem",
  "gm",
  "gn",
  "x402",
  "challenge",
  "prediction",
] as const;

export type LifetimeIncrementField = (typeof LIFETIME_INCREMENT_FIELDS)[number];

const LIFETIME_FIELDS: (keyof AppBadgeMetrics)[] = [
  ...LIFETIME_INCREMENT_FIELDS,
  "trade_actions",
  "social_ping",
  "voucher_actions",
  "activity_total",
];

function storageKey(address: string): string {
  return `base_app_lifetime_${address.toLowerCase()}`;
}

export function readLifetimeAppStats(address: string): Partial<AppBadgeMetrics> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(address));
    if (!raw) return {};
    return JSON.parse(raw) as Partial<AppBadgeMetrics>;
  } catch {
    return {};
  }
}

function writeLifetimeAppStats(
  address: string,
  stats: Partial<AppBadgeMetrics>
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(address), JSON.stringify(stats));
  } catch {
    /* quota */
  }
}

export function incrementLifetimeAppStat(
  address: string,
  field: LifetimeIncrementField | keyof AppBadgeMetrics,
  amount = 1
): void {
  if (!address || amount <= 0) return;
  const prev = readLifetimeAppStats(address);
  const nextVal = (Number(prev[field]) || 0) + amount;
  const next = { ...prev, [field]: nextVal };

  if (field === "swap" || field === "launch") {
    const swap = field === "swap" ? nextVal : Number(prev.swap) || 0;
    const launch = field === "launch" ? nextVal : Number(prev.launch) || 0;
    next.trade_actions = swap + launch;
  }

  recomputeDerived(next);
  writeLifetimeAppStats(address, next);
}

/** Raise lifetime floors from on-chain / session totals without double-counting. */
export function ensureLifetimeFloors(
  address: string,
  floors: Partial<AppBadgeMetrics>
): void {
  if (!address) return;
  const prev = readLifetimeAppStats(address);
  const next: Partial<AppBadgeMetrics> = { ...prev };
  let changed = false;
  for (const key of Object.keys(floors) as (keyof AppBadgeMetrics)[]) {
    const floor = Number(floors[key]);
    if (!Number.isFinite(floor) || floor <= 0) continue;
    const cur = Number(next[key]) || 0;
    if (floor > cur) {
      next[key] = floor;
      changed = true;
    }
  }
  if (!changed) return;
  recomputeDerived(next);
  writeLifetimeAppStats(address, next);
}

function recomputeDerived(stats: Partial<AppBadgeMetrics>): void {
  const gm = Number(stats.gm) || 0;
  const gn = Number(stats.gn) || 0;
  const voucher = Number(stats.voucher) || 0;
  const redeem = Number(stats.redeem) || 0;
  const swap = Number(stats.swap) || 0;
  const launch = Number(stats.launch) || 0;
  stats.trade_actions = Math.max(Number(stats.trade_actions) || 0, swap + launch);
  stats.social_ping = gm + gn;
  stats.voucher_actions = voucher + redeem;
  stats.activity_total =
    swap +
    launch +
    (Number(stats.checkin) || 0) +
    (Number(stats.boost) || 0) +
    voucher +
    redeem +
    gm +
    gn +
    (Number(stats.x402) || 0) +
    (Number(stats.challenge) || 0) +
    (Number(stats.prediction) || 0);
}

function maxNum(...vals: number[]): number {
  return vals.reduce((m, n) => (Number.isFinite(n) && n > m ? n : m), 0);
}

/** Merge lifetime totals with live session metrics (streak, referral). */
export function buildLifetimeBadgeMetrics(input: {
  address: string;
  streak: number;
  referralInvites: number;
  checkedToday?: boolean;
  weeklyTxKeys?: Record<string, number>;
  /** On-chain / session floors (check-ins, boosts, GM hits). */
  floors?: Partial<AppBadgeMetrics>;
}): AppBadgeMetrics {
  const lifetime = readLifetimeAppStats(input.address);
  const weekly = input.weeklyTxKeys ?? {};
  const floors = input.floors ?? {};

  const pick = (field: keyof AppBadgeMetrics): number =>
    maxNum(
      Number(lifetime[field]) || 0,
      Number(weekly[field as string]) || 0,
      Number(floors[field]) || 0
    );

  const swap = pick("swap");
  const launch = pick("launch");
  const checkin = maxNum(pick("checkin"), input.checkedToday ? 1 : 0);

  const metrics: AppBadgeMetrics = {
    swap,
    launch,
    checkin,
    streak: input.streak,
    boost: pick("boost"),
    voucher: pick("voucher"),
    redeem: pick("redeem"),
    gm: pick("gm"),
    gn: pick("gn"),
    x402: pick("x402"),
    challenge: pick("challenge"),
    prediction: pick("prediction"),
    referral: input.referralInvites,
    trade_actions: 0,
    social_ping: 0,
    voucher_actions: 0,
    activity_total: 0,
  };

  recomputeDerived(metrics);
  return metrics;
}

export { LIFETIME_FIELDS };
