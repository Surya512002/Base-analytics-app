import {
  APP_BADGE_CATEGORIES,
  XP_PER_APP_BADGE_CLAIM,
} from "@/lib/constants/app-badges";

function storageKey(address: string): string {
  return `base_app_badge_levels_${address.toLowerCase()}`;
}

function xpKey(address: string): string {
  return `base_app_badge_xp_${address.toLowerCase()}`;
}

export function readAppBadgeLevels(address: string): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(address));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeAppBadgeLevels(
  address: string,
  levels: Record<string, number>
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(address), JSON.stringify(levels));
  } catch {
    /* quota */
  }
}

export function sumAppBadges(levels: Record<string, number>): number {
  return Object.values(levels).reduce((s, n) => s + (n > 0 ? n : 0), 0);
}

export function totalAppBadgeTiers(): number {
  return APP_BADGE_CATEGORIES.reduce((n, c) => n + c.thresholds.length, 0);
}

export function appBadgeCollectionPct(levels: Record<string, number>): number {
  const total = totalAppBadgeTiers();
  if (total <= 0) return 0;
  return Math.round((sumAppBadges(levels) / total) * 100);
}

export type AppBadgeMetrics = {
  stake: number;
  swap: number;
  launch: number;
  ethStakeTier: number;
  checkin: number;
  streak: number;
  boost: number;
  voucher: number;
  redeem: number;
  gm: number;
  gn: number;
  x402: number;
  challenge: number;
  prediction: number;
  referral: number;
  trade_actions: number;
  social_ping: number;
  voucher_actions: number;
  activity_total: number;
};

export function buildAppBadgeMetrics(input: {
  txKeys: Record<string, number>;
  streak: number;
  referralInvites: number;
  ethStakeTier: number;
  checkedToday?: boolean;
}): AppBadgeMetrics {
  const swap = input.txKeys.swap ?? 0;
  const launch = input.txKeys.launch ?? 0;
  const checkin = Math.max(
    input.txKeys.checkin ?? 0,
    input.checkedToday ? 1 : 0
  );

  return {
    stake: input.txKeys.stake ?? 0,
    swap,
    launch,
    ethStakeTier: input.ethStakeTier,
    checkin,
    streak: input.streak,
    boost: input.txKeys.boost ?? 0,
    voucher: input.txKeys.voucher ?? 0,
    redeem: input.txKeys.redeem ?? 0,
    gm: input.txKeys.gm ?? 0,
    gn: input.txKeys.gn ?? 0,
    x402: input.txKeys.x402 ?? 0,
    challenge: input.txKeys.challenge ?? 0,
    prediction: input.txKeys.prediction ?? 0,
    referral: input.referralInvites,
    trade_actions: swap + launch,
    social_ping: (input.txKeys.gm ?? 0) + (input.txKeys.gn ?? 0),
    voucher_actions: (input.txKeys.voucher ?? 0) + (input.txKeys.redeem ?? 0),
    activity_total: 0,
  };
}

export function getAppBadgeMetricValue(
  metric: string,
  metrics: AppBadgeMetrics
): number {
  if (metric in metrics) {
    return metrics[metric as keyof AppBadgeMetrics] ?? 0;
  }
  return 0;
}

export function recordAppBadgeClaims(address: string, count: number): number {
  if (!address || count <= 0) return 0;
  if (typeof window === "undefined") return 0;
  const prev = parseInt(localStorage.getItem(xpKey(address)) || "0", 10) || 0;
  const next = prev + count;
  try {
    localStorage.setItem(xpKey(address), String(next));
  } catch {
    /* quota */
  }
  return count * XP_PER_APP_BADGE_CLAIM;
}

export function getAppBadgeXpTotal(address: string): number {
  if (typeof window === "undefined") return 0;
  const n = parseInt(localStorage.getItem(xpKey(address)) || "0", 10) || 0;
  return n * XP_PER_APP_BADGE_CLAIM;
}
