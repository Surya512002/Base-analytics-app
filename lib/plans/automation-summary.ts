import type { OnChainPlan } from "@/src/lib/limitOrders/types";

const OPEN = 1;

/** What a wallet has running: plans, the USDC still held for buy plans, and when the next run is due. */
export function summarizeAutomation(plans: ReadonlyArray<OnChainPlan>) {
  const running = plans.filter((p) => p.status === OPEN && p.remaining > 0);
  return {
    running: running.length,
    /** USDC base units. Sell plans hold stock, not USDC, so they are left out. */
    heldForBuys: running.reduce((sum, p) => (p.isSell ? sum : sum + p.amountPerBuy * BigInt(p.remaining)), 0n),
    /** Unix seconds of the earliest next run, or null when nothing is running. */
    nextRun: running.length ? Math.min(...running.map((p) => p.nextTime)) : null,
  };
}

export function nextRunText(nextRun: number, nowSec: number): string {
  const wait = nextRun - nowSec;
  if (wait <= 0) return "due now";
  if (wait < 3600) return `in ${Math.max(1, Math.round(wait / 60))} min`;
  if (wait < 86_400) return `in ${Math.round(wait / 3600)} h`;
  const days = Math.round(wait / 86_400);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}
