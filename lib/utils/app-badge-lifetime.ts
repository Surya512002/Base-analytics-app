/** Cumulative in-app stats — badges use lifetime totals, not just this week. */

import type { AppBadgeMetrics } from "@/lib/utils/app-badge-levels";

const LIFETIME_FIELDS: (keyof AppBadgeMetrics)[] = [
  "stake",
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
  field: keyof AppBadgeMetrics,
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

function recomputeDerived(stats: Partial<AppBadgeMetrics>): void {
  const gm = Number(stats.gm) || 0;
  const gn = Number(stats.gn) || 0;
  const voucher = Number(stats.voucher) || 0;
  const redeem = Number(stats.redeem) || 0;
  stats.social_ping = gm + gn;
  stats.voucher_actions = voucher + redeem;
  stats.activity_total =
    (Number(stats.swap) || 0) +
    (Number(stats.launch) || 0) +
    (Number(stats.stake) || 0) +
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

/** Merge lifetime totals with live session metrics (streak, eth tier, referral). */
export function buildLifetimeBadgeMetrics(input: {
  address: string;
  streak: number;
  referralInvites: number;
  ethStakeTier: number;
  checkedToday?: boolean;
  weeklyTxKeys?: Record<string, number>;
}): AppBadgeMetrics {
  const lifetime = readLifetimeAppStats(input.address);
  const swap = Number(lifetime.swap) || 0;
  const launch = Number(lifetime.launch) || 0;
  const checkin = Math.max(
    Number(lifetime.checkin) || 0,
    input.checkedToday ? 1 : 0
  );

  const metrics: AppBadgeMetrics = {
    stake: Number(lifetime.stake) || 0,
    swap,
    launch,
    ethStakeTier: input.ethStakeTier,
    checkin,
    streak: input.streak,
    boost: Number(lifetime.boost) || 0,
    voucher: Number(lifetime.voucher) || 0,
    redeem: Number(lifetime.redeem) || 0,
    gm: Number(lifetime.gm) || 0,
    gn: Number(lifetime.gn) || 0,
    x402: Number(lifetime.x402) || 0,
    challenge: Number(lifetime.challenge) || 0,
    prediction: Number(lifetime.prediction) || 0,
    referral: input.referralInvites,
    trade_actions: Number(lifetime.trade_actions) || swap + launch,
    social_ping: Number(lifetime.social_ping) || 0,
    voucher_actions: Number(lifetime.voucher_actions) || 0,
    activity_total: Number(lifetime.activity_total) || 0,
  };

  recomputeDerived(metrics);
  return metrics;
}

export { LIFETIME_FIELDS };
