"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import Marquee from "@/components/ui/motion/Marquee";
import TokenLogo from "@/components/ui/TokenLogo";
import type { StockMarketItem } from "@/lib/markets/types";

/**
 * Live ticker tape of tokenized stocks (price + 24h change) from the same market data the
 * Explore page already loads. Each chip opens that stock. Pauses on hover; static when the
 * user prefers reduced motion. Renders nothing until real data is available — no placeholders.
 */
export default function StockTickerTape({
  stocks,
  onSelect,
}: {
  stocks: StockMarketItem[];
  onSelect?: (s: StockMarketItem) => void;
}) {
  const rows = stocks
    .filter((s) => s.status === "active" && Number.isFinite(s.price) && s.price > 0)
    .sort((a, b) => b.tradingLiquidity - a.tradingLiquidity)
    .slice(0, 16);
  if (rows.length < 4) return null;

  return (
    <Marquee label="Tokenized stock prices" durationSec={Math.max(30, rows.length * 4)} className="py-1">
      {rows.map((s) => {
        const up = s.change24h >= 0;
        return (
          <button
            key={s.address}
            type="button"
            onClick={() => onSelect?.(s)}
            className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-xs transition-colors hover:border-[var(--border-strong)] cursor-pointer"
            title={`${s.name} — open details`}
          >
            <TokenLogo address={s.address} symbol={s.symbol} size={18} shape="rounded-full" />
            <span className="font-black text-[var(--ink)]">{s.symbol}</span>
            <span className="font-mono tabular-nums text-[var(--ink-soft)]">
              ${s.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span
              className={`inline-flex items-center gap-0.5 font-mono tabular-nums font-bold ${
                up ? "text-emerald-500" : "text-red-400"
              }`}
            >
              {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {up ? "+" : ""}
              {s.change24h.toFixed(2)}%
            </span>
          </button>
        );
      })}
    </Marquee>
  );
}
