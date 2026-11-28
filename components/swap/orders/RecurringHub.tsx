"use client";

import { useEffect, useState } from "react";
import RecurringView from "./RecurringView";
import InvestPlanComposer from "./InvestPlanComposer";
import BasketBuyNow from "./BasketBuyNow";
import IndexBuilder from "@/components/stocks/IndexBuilder";
import type { WalletAppState } from "@/hooks/useWalletApp";
import type { useLimitOrders } from "@/src/lib/limitOrders/useLimitOrders";

type Props = {
  app: WalletAppState;
  limitOrders: ReturnType<typeof useLimitOrders>;
  onConnectWallet?: () => void;
  onSwitchChain?: () => void;
  onSwitchSepolia?: () => void;
  /** Menu links open straight on the basket; "index" opens the index builder. */
  initialPlan?: "basket" | "index";
  /** A link for one stock opens its plan form. */
  initialStock?: string;
};

/** Auto-invest: buy a basket now, build an index, repeat a basket on a schedule, or repeat one stock. */
export default function RecurringHub(props: Props) {
  // "Buy now" works for everyone; "One stock" opens only from a link naming that stock.
  const [mode, setMode] = useState<"now" | "index" | "single" | "basket">(props.initialPlan === "index" ? "index" : props.initialStock && !props.initialPlan ? "single" : "now");
  useEffect(() => {
    if (props.initialPlan) setMode(props.initialPlan === "index" ? "index" : "now");
    else if (props.initialStock) setMode("single");
  }, [props.initialPlan, props.initialStock]);
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Plan type" className="mx-auto grid w-full max-w-[560px] grid-cols-4 gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1">
        {(
          [
            ["now", "Buy now"],
            ["index", "My index"],
            ["basket", "Repeat basket"],
            ["single", "One stock"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={`min-h-11 rounded-lg px-1 text-sm font-semibold ${mode === id ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs" : "text-[var(--ink-muted)]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "now" ? (
        <BasketBuyNow app={props.app} onConnectWallet={props.onConnectWallet} onRepeat={() => setMode("basket")} />
      ) : mode === "index" ? (
        <IndexBuilder app={props.app} onConnectWallet={props.onConnectWallet} />
      ) : mode === "single" ? (
        <div className="mx-auto w-full max-w-[560px]">
          <RecurringView {...props} />
        </div>
      ) : (
        <InvestPlanComposer limitOrders={props.limitOrders} onConnectWallet={props.onConnectWallet} />
      )}
    </div>
  );
}
