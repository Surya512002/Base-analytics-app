// What a wallet's recurring plans have actually done, from the contract's own DcaExecuted events.
// Pure (viem decoding only), so the app and tests share it. Amounts stay as base units until shown.
//
// Tokenized stocks: dividends raise a display multiplier and do not change raw token balances, and the
// Chainlink price already includes it. So "average price per token" and "price per token now" compare
// like with like.

import { decodeEventLog, type Hex } from "viem";
import { orderBookAbi } from "./abi";

export interface RawLog {
  address: string;
  topics: string[];
  data: string;
}

/** One run of a plan. Amounts are base-unit integers as strings (JSON safe). */
export interface PlanFill {
  planId: string;
  /** Put in: USDC for a recurring buy, stock for a recurring sell. */
  amountIn: string;
  /** Received by the owner after the execution fee: stock for a buy, USDC for a sell. */
  received: string;
  /** Runs left after this one. */
  remaining: number;
  txHash: string;
  /** Unix seconds, or null when unknown. */
  time: number | null;
}

/** The plan runs for this owner inside one transaction receipt, ignoring everything else in it. */
export function fillsFromLogs(logs: RawLog[], orderBook: string, owner: string, txHash: string, time: number | null): PlanFill[] {
  const out: PlanFill[] = [];
  for (const log of logs) {
    if (log.address.toLowerCase() !== orderBook.toLowerCase()) continue; // only our contract's events count
    try {
      const ev = decodeEventLog({ abi: orderBookAbi, data: log.data as Hex, topics: log.topics as [Hex, ...Hex[]] });
      if (ev.eventName !== "DcaExecuted") continue;
      const a = ev.args as unknown as { id: bigint; owner: string; amountIn: bigint; stockToOwner: bigint; remaining: bigint | number };
      if (a.owner.toLowerCase() !== owner.toLowerCase()) continue;
      out.push({ planId: String(a.id), amountIn: String(a.amountIn), received: String(a.stockToOwner), remaining: Number(a.remaining), txHash, time });
    } catch {
      /* an event we do not know */
    }
  }
  return out;
}

export interface PlanState {
  id: string;
  /** 1 open, 2 finished, 3 cancelled. */
  status: number;
  remaining: number;
  isSell: boolean;
  /** Input per run: USDC for buys, stock for sells. */
  amountPerRun: bigint;
}

export interface PlanProgress {
  planId: string;
  runsDone: number;
  runsTotal: number;
  spent: bigint;
  received: bigint;
  /** USD per whole token over all runs (fee included), or null before the first run. */
  avgPrice: number | null;
  lastRunAt: number | null;
  /** False when the runs we found do not add up to what the plan says, so totals may be short. */
  complete: boolean;
}

const toNum = (v: bigint, decimals: number) => Number(v) / 10 ** decimals;

export function planProgress(plan: PlanState, fills: PlanFill[], decimals: { stock: number; quote: number }): PlanProgress {
  const seen = new Set<string>();
  const mine = fills.filter((f) => {
    const k = `${f.txHash}:${f.remaining}`;
    if (f.planId !== plan.id || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const spent = mine.reduce((s, f) => s + BigInt(f.amountIn), 0n);
  const received = mine.reduce((s, f) => s + BigInt(f.received), 0n);
  const left = mine.map((f) => f.remaining);
  // Runs count down one at a time to what the plan still has; a gap or a mismatch means something is missing.
  const complete =
    mine.length === 0
      ? plan.status !== 2
      : Math.min(...left) === plan.remaining && new Set(left).size === mine.length && Math.max(...left) - Math.min(...left) + 1 === mine.length;

  const inDec = plan.isSell ? decimals.stock : decimals.quote;
  const outDec = plan.isSell ? decimals.quote : decimals.stock;
  const usd = plan.isSell ? toNum(received, outDec) : toNum(spent, inDec);
  const tokens = plan.isSell ? toNum(spent, inDec) : toNum(received, outDec);
  const times = mine.map((f) => f.time).filter((t): t is number => t !== null);

  return {
    planId: plan.id,
    runsDone: mine.length,
    runsTotal: mine.length + plan.remaining,
    spent,
    received,
    avgPrice: tokens > 0 && usd > 0 ? usd / tokens : null,
    lastRunAt: times.length ? Math.max(...times) : null,
    complete,
  };
}

export interface SummaryRow {
  plan: PlanState;
  progress: PlanProgress;
  /** Current price of the plan's stock in USD, or null. */
  priceNow: number | null;
  decimals: { stock: number; quote: number };
}

export interface PlansSummary {
  /** USDC spent by recurring buys so far. */
  invested: number;
  /** Today's value of the tokens those buys delivered; null if any of their prices is missing. */
  valueNow: number | null;
  changePct: number | null;
  /** USDC received by recurring sells so far. */
  soldFor: number;
  /** USDC still waiting in the contract for open recurring buys. */
  waiting: number;
  runsDone: number;
  complete: boolean;
}

export function summarize(rows: SummaryRow[]): PlansSummary {
  let invested = 0;
  let value = 0;
  let priced = true;
  let soldFor = 0;
  let waiting = 0;
  let runsDone = 0;
  let complete = true;
  for (const r of rows) {
    runsDone += r.progress.runsDone;
    complete = complete && r.progress.complete;
    if (r.plan.isSell) {
      soldFor += toNum(r.progress.received, r.decimals.quote);
      continue;
    }
    if (r.plan.status === 1) waiting += toNum(r.plan.amountPerRun * BigInt(r.plan.remaining), r.decimals.quote);
    const spent = toNum(r.progress.spent, r.decimals.quote);
    if (spent === 0) continue;
    invested += spent;
    if (r.priceNow === null || !(r.priceNow > 0)) priced = false;
    else value += toNum(r.progress.received, r.decimals.stock) * r.priceNow;
  }
  const valueNow = priced && invested > 0 ? value : null;
  return { invested, valueNow, changePct: valueNow === null ? null : (valueNow / invested - 1) * 100, soldFor, waiting, runsDone, complete };
}
