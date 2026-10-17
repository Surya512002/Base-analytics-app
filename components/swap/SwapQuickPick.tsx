"use client";

import { useState } from "react";
import { COMMON_BASE_TOKENS, COMMON_STOCK_TOKENS } from "@/lib/launchpad/common-tokens";
import { commonTokenToCounter } from "@/lib/launchpad/token-logo";
import { CounterAvatar, type SwapCounter } from "@/components/launchpad/TokenPickerDialog";

export default function SwapQuickPick({
  onPick,
}: {
  onPick: (counter: SwapCounter) => void;
}) {
  const [tab, setTab] = useState<"crypto" | "stocks">("crypto");
  const cryptoPicks = COMMON_BASE_TOKENS.filter((t) => (t.category ?? "crypto") === "crypto").slice(0, 7);
  const stockPicks = COMMON_STOCK_TOKENS.slice(0, 7);
  const activePicks = tab === "crypto" ? cryptoPicks : stockPicks;

  return (
    <div className="dex-swap-quick">
      <div className="flex items-center justify-between pb-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("crypto")}
            className={`text-[11px] font-semibold uppercase tracking-wider transition-colors ${
              tab === "crypto"
                ? "text-[var(--ink)] font-bold border-b border-[var(--ink)] pb-0.5"
                : "text-[var(--ink-dim)] hover:text-[var(--ink)]"
            }`}
          >
            Popular Crypto
          </button>
          <span className="text-[var(--ink-dim)] text-[10px]">·</span>
          <button
            type="button"
            onClick={() => setTab("stocks")}
            className={`text-[11px] font-semibold uppercase tracking-wider transition-colors flex items-center gap-1 ${
              tab === "stocks"
                ? "text-blue-500 font-bold border-b border-blue-500 pb-0.5"
                : "text-[var(--ink-dim)] hover:text-blue-500"
            }`}
          >
            <span>📈</span> Tokenized Stocks (RWAs)
          </button>
        </div>
      </div>
      <div className="dex-swap-quick-row">
        {activePicks.map((t) => {
          const counter = commonTokenToCounter(t);
          return (
            <button
              key={t.address}
              type="button"
              onClick={() => onPick(counter)}
              className="dex-swap-quick-chip"
            >
              <CounterAvatar counter={counter} size={16} />
              {t.symbol}
            </button>
          );
        })}
      </div>
    </div>
  );
}
