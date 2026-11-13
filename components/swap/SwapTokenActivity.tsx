"use client";

import { Activity, ExternalLink, Share2 } from "lucide-react";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import LiveTradesList from "@/components/markets/LiveTradesList";
import { useLiveTrades, useNow } from "@/hooks/useLiveTrades";
import { buildSwapLink } from "@/lib/swap/swap-link";

/**
 * Under the swap card: the latest buys and sells of the token you're about to buy (straight
 * from its most active pool), plus one-tap Share on X and a link to the pool chart.
 */
export default function SwapTokenActivity({ token }: { token: SwapCounter | null }) {
  const address = token?.kind === "token" ? token.address.toLowerCase() : null;
  const symbol = token?.kind === "token" ? token.symbol : "";
  const { trades, loading } = useLiveTrades({ token: address });
  const now = useNow();

  if (!address) return null;

  const shareOnX = () => {
    const link = `${window.location.origin}${buildSwapLink({ buy: address })}`;
    const text = `Swapping $${symbol} on Base with Base Analytics`;
    window.open(
      `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-xs">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-black text-[var(--ink)]">
          <Activity size={15} className="shrink-0 text-[var(--brand-text)]" />
          <span className="truncate">Recent {symbol} trades</span>
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={shareOnX}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
          >
            <Share2 size={12} /> Share
          </button>
          <a
            href={`https://dexscreener.com/base/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
          >
            Chart <ExternalLink size={11} />
          </a>
        </div>
      </div>
      <LiveTradesList
        trades={trades}
        now={now}
        max={8}
        emptyText={loading ? "Loading recent trades…" : "No recent trades to show right now."}
      />
    </section>
  );
}
