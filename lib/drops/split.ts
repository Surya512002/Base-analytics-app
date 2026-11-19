/**
 * Random split: share a fixed total across N claims so every claim lands between min and max,
 * the amounts are random, and they add up to the total EXACTLY (no dust, nothing left over).
 * Pure functions, bigint math only. The server keeps the shuffled list private and hands one
 * amount to each claimer (see service.ts), so nobody can see or pick what is coming.
 */
import { toHex } from "viem";
import { randomBelow } from "./rewards";

export type SplitCheck = { ok: true } | { ok: false; error: string };

/** Can `total` be split into `count` amounts each within [min, max]? */
export function checkSplit(total: bigint, count: number, min: bigint, max: bigint): SplitCheck {
  if (!Number.isInteger(count) || count < 1) return { ok: false, error: "Set how many claims share the total." };
  if (count > 1000) return { ok: false, error: "A random split supports up to 1,000 claims." };
  if (min <= BigInt(0)) return { ok: false, error: "The smallest amount must be above 0." };
  if (max < min) return { ok: false, error: "The largest amount is below the smallest." };
  const n = BigInt(count);
  if (total < n * min) return { ok: false, error: "The total is too small: even the smallest amount for every claim needs more." };
  if (total > n * max) return { ok: false, error: "The total is too big for these limits: raise the largest amount, or add claims." };
  return { ok: true };
}

/**
 * Random amounts summing to exactly `total`, each in [min, max], in random order.
 * Stick-breaking within the feasible range at every step, then a Fisher-Yates shuffle.
 */
export function generateSplit(total: bigint, count: number, min: bigint, max: bigint, random: (n: bigint) => bigint = randomBelow): bigint[] {
  const check = checkSplit(total, count, min, max);
  if (!check.ok) throw new Error(check.error);
  const span = max - min;
  let rest = total - BigInt(count) * min; // what is left to hand out above the minimums
  const out: bigint[] = [];
  for (let i = 0; i < count; i++) {
    const remaining = BigInt(count - i - 1);
    // The others can absorb at most remaining*span, so this one must take the rest of that.
    const lo = rest > remaining * span ? rest - remaining * span : BigInt(0);
    const hi = rest < span ? rest : span;
    const extra = lo + random(hi - lo + BigInt(1));
    out.push(min + extra);
    rest -= extra;
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Number(random(BigInt(i + 1)));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** 32 fresh random bytes as hex (for tests that want a seed). */
export function randomSeed(): `0x${string}` {
  return toHex(globalThis.crypto.getRandomValues(new Uint8Array(32)));
}
