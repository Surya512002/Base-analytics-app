"use client";

import { useEffect, useState } from "react";
import RecurringView from "./RecurringView";
import InvestPlanComposer from "./InvestPlanComposer";
import type { useLimitOrders } from "@/src/lib/limitOrders/useLimitOrders";

type Props = {
  limitOrders: ReturnType<typeof useLimitOrders>;
  onConnectWallet?: () => void;
  onSwitchChain?: () => void;
  onSwitchSepolia?: () => void;
  /** Menu links open straight on the basket plan. */
  initialPlan?: "basket";
};

/** Recurring tab: one stock (the original form) or a basket of up to 10 stocks started together. */
export default function RecurringHub(props: Props) {
  const [mode, setMode] = useState<"single" | "basket">(props.initialPlan ?? "single");
  useEffect(() => {
    if (props.initialPlan) setMode(props.initialPlan);
  }, [props.initialPlan]);
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Plan type" className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1">
        {(
          [
            ["single", "One stock"],
            ["basket", "Basket plan"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={`min-h-[40px] rounded-lg text-sm font-semibold ${mode === id ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs" : "text-[var(--ink-muted)]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "single" ? <RecurringView {...props} /> : <InvestPlanComposer limitOrders={props.limitOrders} onConnectWallet={props.onConnectWallet} />}
    </div>
  );
}
