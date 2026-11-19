/**
 * Random-split pool (server only): the private shuffled list of shares for a "split" drop, and
 * the reservation of one share per claim. Kept out of service.ts so it can be tested alone.
 *
 * - The pool is created once when the creator saves the drop's rules. It sums to the drop's
 *   budget exactly, every share is within [min, max], and the order is random.
 * - A wallet asking for a ticket reserves ONE share. Asking again returns the same share
 *   (no re-rolling). An unclaimed reservation expires after POOL_RESERVE_SEC and the share
 *   goes back into the pool; shares of confirmed claims become permanent.
 * - Reservation uses set-if-absent per share, so two wallets can never hold the same share.
 */
import type { TaskKv } from "./types";
import { checkSplit, generateSplit } from "./split";

export interface SplitPool {
  total: string;
  count: number;
  min: string;
  max: string;
  /** Shuffled shares in base units; they add up to `total` exactly. Never sent to clients. */
  amounts: string[];
}

/** How long a share stays reserved for a wallet that asked for a ticket but hasn't claimed. */
export const POOL_RESERVE_SEC = 30 * 60;

export interface PoolKeys {
  pool: string;
  slot(k: number): string;
  ptr(wallet: string, claimIndex: number): string;
}

export class PoolError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

/** Build a pool for a drop. Throws PoolError when the numbers can't work. */
export function buildPool(args: { budget: bigint; count: number; min: bigint; max: bigint; cap: bigint }): SplitPool {
  if (args.count < 1) throw new PoolError("A random split needs a fixed number of claims.", 400);
  if (args.max > args.cap) throw new PoolError("The largest share is above the drop's max per claim.", 400);
  const check = checkSplit(args.budget, args.count, args.min, args.max);
  if (!check.ok) throw new PoolError(check.error, 400);
  return {
    total: args.budget.toString(),
    count: args.count,
    min: args.min.toString(),
    max: args.max.toString(),
    amounts: generateSplit(args.budget, args.count, args.min, args.max).map(String),
  };
}

/**
 * Give this wallet's next claim one share. Asking again returns the same share while the
 * reservation is alive. Returns the share in base units.
 */
export async function allocateShare(
  kv: TaskKv,
  keys: PoolKeys,
  pool: SplitPool,
  wallet: string,
  claimIndex: number
): Promise<bigint> {
  const w = wallet.toLowerCase();
  const ptr = keys.ptr(w, claimIndex);
  const mine = await kv.get(ptr);
  if (mine !== null) {
    const k = Number(mine);
    const rec = await kv.get(keys.slot(k));
    if (rec && (JSON.parse(rec) as { w: string }).w === w && pool.amounts[k] !== undefined) return BigInt(pool.amounts[k]!);
  }
  for (let k = 0; k < pool.amounts.length; k++) {
    if (await kv.setIfAbsent(keys.slot(k), JSON.stringify({ w, ci: claimIndex }), POOL_RESERVE_SEC)) {
      await kv.set(ptr, String(k), POOL_RESERVE_SEC + 60);
      return BigInt(pool.amounts[k]!);
    }
  }
  throw new PoolError("Every share of this drop is reserved right now. Try again in a few minutes.", 409);
}

/** Shares the wallet has already claimed (claims before `claimIndex`) become permanent. */
export async function settleShares(kv: TaskKv, keys: PoolKeys, wallet: string, claimIndex: number): Promise<void> {
  const w = wallet.toLowerCase();
  for (let ci = Math.max(0, claimIndex - 10); ci < claimIndex; ci++) {
    const k = await kv.get(keys.ptr(w, ci));
    if (k === null) continue;
    const rec = await kv.get(keys.slot(Number(k)));
    if (rec && (JSON.parse(rec) as { w: string }).w === w) {
      await kv.set(keys.slot(Number(k)), rec); // no expiry
      await kv.set(keys.ptr(w, ci), k);
    }
  }
}
