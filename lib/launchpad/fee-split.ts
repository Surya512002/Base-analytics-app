import { LAUNCHPAD_TREASURY } from "@/lib/constants/launchpad";

function parseShareBps(key: string, fallback: number): number {
  const raw = process.env[key] ?? process.env[`NEXT_PUBLIC_${key}`];
  if (raw == null || raw === "") return fallback;
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(10000, n);
}

/**
 * Share of the platform fee (bps of fee amount, must sum to 10000).
 * Default favors creators — 60% creator, 20% platform, 20% referrer.
 */
export const FEE_SHARE_CREATOR_BPS = parseShareBps("LAUNCHPAD_FEE_SHARE_CREATOR_BPS", 6000);
export const FEE_SHARE_PLATFORM_BPS = parseShareBps("LAUNCHPAD_FEE_SHARE_PLATFORM_BPS", 2000);
export const FEE_SHARE_REFERRER_BPS = parseShareBps("LAUNCHPAD_FEE_SHARE_REFERRER_BPS", 2000);

const FEE_SHARE_SUM =
  FEE_SHARE_CREATOR_BPS + FEE_SHARE_PLATFORM_BPS + FEE_SHARE_REFERRER_BPS;

if (FEE_SHARE_SUM !== 10000 && process.env.NODE_ENV !== "production") {
  console.warn(
    `[fee-split] shares sum to ${FEE_SHARE_SUM} bps (expected 10000) — check LAUNCHPAD_FEE_SHARE_* env`
  );
}

export type FeeSplitRecipients = {
  creator: `0x${string}`;
  platform: `0x${string}`;
  referrer: `0x${string}` | null;
};

export type FeeSplitAmounts = {
  creator: bigint;
  platform: bigint;
  referrer: bigint;
  total: bigint;
};

export function splitPlatformFee(
  fee: bigint,
  opts: {
    creator: `0x${string}`;
    referrer?: `0x${string}` | null;
    platform?: `0x${string}`;
    /** Extra bps of total fee shifted from platform → referrer (on-chain stake boost). */
    referrerBoostBps?: number;
  }
): FeeSplitAmounts & { transfers: Array<{ to: `0x${string}`; amount: bigint }> } {
  if (fee <= BigInt(0)) {
    return { creator: BigInt(0), platform: BigInt(0), referrer: BigInt(0), total: BigInt(0), transfers: [] };
  }

  const platformAddr = opts.platform ?? LAUNCHPAD_TREASURY;
  const creatorAmt = (fee * BigInt(FEE_SHARE_CREATOR_BPS)) / BigInt(10000);
  let platformAmt = (fee * BigInt(FEE_SHARE_PLATFORM_BPS)) / BigInt(10000);
  let referrerAmt = (fee * BigInt(FEE_SHARE_REFERRER_BPS)) / BigInt(10000);

  const ref = opts.referrer?.toLowerCase();
  const creator = opts.creator.toLowerCase() as `0x${string}`;
  const isValidRef =
    ref &&
    ref.startsWith("0x") &&
    ref.length === 42 &&
    ref !== creator &&
    ref !== platformAddr.toLowerCase();

  if (!isValidRef) {
    platformAmt += referrerAmt;
    referrerAmt = BigInt(0);
  } else {
    const boostBps = Math.min(1500, Math.max(0, opts.referrerBoostBps ?? 0));
    if (boostBps > 0) {
      const boostAmt = (fee * BigInt(boostBps)) / BigInt(10000);
      const maxBoost = platformAmt;
      const applied = boostAmt > maxBoost ? maxBoost : boostAmt;
      referrerAmt += applied;
      platformAmt -= applied;
    }
  }

  const allocated = creatorAmt + platformAmt + referrerAmt;
  if (allocated < fee) {
    platformAmt += fee - allocated;
  }

  const transfers: Array<{ to: `0x${string}`; amount: bigint }> = [];
  if (creatorAmt > BigInt(0)) transfers.push({ to: creator, amount: creatorAmt });
  if (platformAmt > BigInt(0)) transfers.push({ to: platformAddr, amount: platformAmt });
  if (referrerAmt > BigInt(0) && isValidRef) {
    transfers.push({ to: ref as `0x${string}`, amount: referrerAmt });
  }

  return {
    creator: creatorAmt,
    platform: platformAmt,
    referrer: referrerAmt,
    total: fee,
    transfers,
  };
}

export function feeShareLabels() {
  return {
    creator: `${FEE_SHARE_CREATOR_BPS / 100}%`,
    platform: `${FEE_SHARE_PLATFORM_BPS / 100}%`,
    referrer: `${FEE_SHARE_REFERRER_BPS / 100}%`,
  };
}
