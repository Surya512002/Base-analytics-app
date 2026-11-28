"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import { Clock, Loader2, LogOut } from "lucide-react";
import { fetchSwapQuote } from "@/lib/api/launchpad-client";
import { getEquityMarketStatus } from "@/lib/stocks/nav-tracker";
import { checkExit, describeExit } from "@/lib/stocks/exit-check";
import { USDC_DECIMALS } from "@/lib/launchpad/tokens-base";

type State = { kind: "idle" } | { kind: "checking" } | { kind: "done"; text: string } | { kind: "failed" };

/**
 * Two things worth knowing before trading a stock token: whether the real market is shut, and how
 * much could be sold on-chain before the price moves hard. Mount with `key={token}`.
 */
export default function StockMarketCheck({ token, symbol, decimals }: { token: string; symbol: string; decimals: number }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const market = getEquityMarketStatus();

  const run = async () => {
    setState({ kind: "checking" });
    try {
      const result = await checkExit(async (tokens) => {
        const q = await fetchSwapQuote({
          token,
          direction: "sell",
          amount: tokens.toFixed(Math.min(decimals, 8)),
          decimals,
          slippageBps: 100,
          receiveAsset: "usdc",
          counterDecimals: USDC_DECIMALS,
        });
        if (q.failed) throw new Error("price read failed");
        return q.hasLiquidity ? Number(formatUnits(BigInt(q.amountOut), USDC_DECIMALS)) : null;
      });
      setState({ kind: "done", text: describeExit(result, symbol) });
    } catch {
      setState({ kind: "failed" });
    }
  };

  return (
    <div className="space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 text-xs">
      {!market.isOpen && (
        <p className="flex items-start gap-2 font-bold text-[var(--ink)]">
          <Clock size={14} aria-hidden className="mt-0.5 shrink-0 text-amber-500" />
          <span>
            {market.statusText}.
            <span className="font-normal text-[var(--ink-muted)]"> Trading here continues on-chain, so the price can differ from the last stock market price.</span>
          </span>
        </p>
      )}
      <div role="status" className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 flex-1 items-start gap-2 font-bold text-[var(--ink)]">
          <LogOut size={14} aria-hidden className="mt-0.5 shrink-0 text-[var(--brand-text)]" />
          <span>
            {state.kind === "done"
              ? state.text
              : state.kind === "failed"
                ? "Couldn't read prices just now."
                : state.kind === "checking"
                  ? "Asking for sell prices…"
                  : `Can you get out of ${symbol}?`}
          </span>
        </span>
        <button
          type="button"
          onClick={() => void run()}
          disabled={state.kind === "checking"}
          className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--brand)] px-3 font-bold text-[var(--brand-text)] disabled:opacity-50"
        >
          {state.kind === "checking" && <Loader2 size={12} aria-hidden className="animate-spin" />}
          {state.kind === "idle" || state.kind === "checking" ? "Check" : "Check again"}
        </button>
      </div>
      {state.kind === "done" && <p className="text-[11px] text-[var(--ink-muted)]">From live sell quotes just now. Prices and depth change, so check again before a large trade.</p>}
    </div>
  );
}
