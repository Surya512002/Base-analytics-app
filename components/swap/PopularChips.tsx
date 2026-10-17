"use client";

import { useMemo } from "react";
import { COMMON_BASE_TOKENS } from "@/lib/launchpad/common-tokens";
import { commonTokenToCounter } from "@/lib/launchpad/token-logo";
import { CounterAvatar, type SwapCounter, sameCounter } from "@/components/launchpad/TokenPickerDialog";

const POPULAR_SYMBOLS = ["USDC", "WETH", "cbBTC", "cbETH", "wstETH", "AERO", "USDT"];

interface PopularChipsProps {
  currentBuyToken: SwapCounter | null;
  onSelectBuyToken: (counter: SwapCounter) => void;
}

export default function PopularChips({
  currentBuyToken,
  onSelectBuyToken,
}: PopularChipsProps) {
  const chips = useMemo(() => {
    return POPULAR_SYMBOLS.map((sym) => {
      const found = COMMON_BASE_TOKENS.find(
        (t) => t.symbol.toUpperCase() === sym.toUpperCase()
      );
      if (!found) return null;
      return {
        ...found,
        counter: commonTokenToCounter(found),
      };
    }).filter(Boolean) as Array<typeof COMMON_BASE_TOKENS[0] & { counter: SwapCounter }>;
  }, []);

  return (
    <div className="flex flex-col items-center gap-2 pt-1 pb-4">
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-dim)] mr-1">
          Popular:
        </span>
        {chips.map((chip) => {
          const isSelected = currentBuyToken && sameCounter(chip.counter, currentBuyToken);
          return (
            <button
              key={chip.address}
              type="button"
              aria-pressed={!!isSelected}
              onClick={() => onSelectBuyToken(chip.counter)}
              className={`pop-pill h-7 px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 select-none cursor-pointer ${
                isSelected
                  ? "bg-[var(--brand)] text-white shadow-xs"
                  : "border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
              title={`Buy ${chip.symbol} (${chip.name})`}
            >
              <CounterAvatar counter={chip.counter} size={15} />
              <span className="font-mono">{chip.symbol}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
