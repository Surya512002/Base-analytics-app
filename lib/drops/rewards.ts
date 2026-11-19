/**
 * Reward rules for task drops (pure functions): streak bonuses, random "lucky" amounts, and
 * fair raffle draws. The ticket the app signs carries the final amount; the contract caps it at
 * the drop's maxAmountPerClaim.
 */
import { concat, keccak256, toHex, type Hex } from "viem";

export interface RewardRules {
  mode: "fixed" | "random" | "split";
  /** Random mode: inclusive range in base units. */
  min?: string;
  max?: string;
  /** Streak: each consecutive claim adds bonusBps (100 = +1%) up to maxDays. */
  streak?: { bonusBps: number; maxDays: number; windowHours: number };
}

/**
 * Next streak length for the claim the wallet is about to make.
 * `prev` is the streak recorded when the wallet's previous claim's ticket was issued.
 */
export function nextStreak(args: {
  claimIndex: number;
  lastClaimAt: number;
  now: number;
  windowHours: number;
  prev: { forClaimIndex: number; streak: number } | null;
}): number {
  const { claimIndex, lastClaimAt, now, windowHours, prev } = args;
  if (claimIndex === 0 || !prev || prev.forClaimIndex !== claimIndex - 1) return 1;
  return now - lastClaimAt <= windowHours * 3600 ? prev.streak + 1 : 1;
}

/** Uniform random bigint in [0, n) from 32 random bytes (bias < 2^-128 for n < 2^128). */
export function randomBelow(n: bigint, bytes?: Uint8Array): bigint {
  if (n <= BigInt(0)) return BigInt(0);
  const b = bytes ?? globalThis.crypto.getRandomValues(new Uint8Array(32));
  return BigInt(toHex(b)) % n;
}

/** Streak multiplier in basis points (10000 = ×1). */
export function streakMultiplierBps(rules: RewardRules | undefined, streak: number): number {
  if (!rules?.streak) return 10_000;
  const extra = Math.max(0, Math.min(streak, rules.streak.maxDays) - 1);
  return 10_000 + extra * rules.streak.bonusBps;
}

/** Final ticket amount (never 0) given the tier/base amount, rules, streak and the drop's cap. */
export function computeReward(args: {
  base: bigint;
  rules?: RewardRules;
  streak: number;
  cap: bigint;
  random?: (n: bigint) => bigint;
}): bigint {
  const { rules, streak, cap } = args;
  let amount = args.base;
  if (rules?.mode === "random" && rules.min !== undefined && rules.max !== undefined) {
    const lo = BigInt(rules.min);
    const hi = BigInt(rules.max);
    amount = lo + (args.random ?? randomBelow)(hi - lo + BigInt(1));
  }
  amount = (amount * BigInt(streakMultiplierBps(rules, streak))) / BigInt(10_000);
  if (amount > cap) amount = cap;
  return amount > BigInt(0) ? amount : BigInt(1);
}

/** Largest amount these rules can produce (used to validate against the drop's onchain cap). */
export function maxPossibleReward(base: bigint, rules?: RewardRules): bigint {
  const top = rules?.mode === "random" && rules.max !== undefined ? BigInt(rules.max) : base;
  const bps = rules?.streak ? 10_000 + (rules.streak.maxDays - 1) * rules.streak.bonusBps : 10_000;
  return (top * BigInt(bps)) / BigInt(10_000);
}

// ───────────────────────────── raffle ─────────────────────────────

export function raffleCommit(seed: Hex): Hex {
  return keccak256(seed);
}

/**
 * Pick `count` winners from `entrants`, deterministically from (seed, blockHash), so anyone can
 * re-run the draw once the seed is revealed. The seed is committed (hash published) when the
 * raffle is set up, before anyone enters; the block hash is unknown until the draw.
 */
export function drawWinners(entrants: readonly string[], count: number, seed: Hex, blockHash: Hex): string[] {
  const pool = [...new Set(entrants.map((e) => e.toLowerCase()))].sort();
  const k = Math.min(count, pool.length);
  let r = keccak256(concat([seed, blockHash]));
  for (let i = 0; i < k; i++) {
    r = keccak256(concat([r, toHex(i, { size: 32 })]));
    const j = i + Number(BigInt(r) % BigInt(pool.length - i));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, k);
}
