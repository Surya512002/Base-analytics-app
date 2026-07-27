"use client";

import { COMMON_BASE_TOKENS } from "@/lib/launchpad/common-tokens";
import { commonTokenToCounter } from "@/lib/launchpad/token-logo";
import { CounterAvatar, type SwapCounter } from "@/components/launchpad/TokenPickerDialog";

export default function SwapQuickPick({
  onPick,
}: {
  onPick: (counter: SwapCounter) => void;
}) {
  const picks = COMMON_BASE_TOKENS.slice(0, 8);
  return (
    <div className="dex-swap-quick">
      <p className="dex-swap-quick-label">Popular</p>
      <div className="dex-swap-quick-row">
        {picks.map((t) => {
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
