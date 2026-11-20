"use client";

import { useState, useEffect } from "react";
import { formatUnits } from "viem";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  PauseCircle,
} from "lucide-react";
import type { OnChainPlan } from "@/src/lib/limitOrders/types";
import { PRICE_DECIMALS } from "@/src/lib/limitOrders/orderMath";
import type { MarketState } from "@/src/lib/limitOrders/useLimitOrders";

interface MyPlansPanelProps {
  plans: OnChainPlan[];
  markets: Record<string, MarketState>;
  quoteSymbol: string;
  quoteDecimals: number;
  onCancelPlan: (id: bigint) => Promise<boolean>;
  isSubmitting: boolean;
}

export default function MyPlansPanel({
  plans,
  markets,
  quoteSymbol,
  quoteDecimals,
  onCancelPlan,
  isSubmitting,
}: MyPlansPanelProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeSec(Math.floor(Date.now() / 1000));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const getMarket = (stockToken: string): MarketState | undefined => {
    return markets[stockToken.toLowerCase()];
  };

  const formatInterval = (sec: number) => {
    if (sec === 3600) return "1 hour";
    if (sec === 86400) return "1 day";
    if (sec === 604800) return "1 week";
    if (sec % 86400 === 0) return `${sec / 86400} days`;
    if (sec % 3600 === 0) return `${sec / 3600} hours`;
    return `${sec}s`;
  };

  const formatNextTime = (timestamp: number) => {
    if (timestamp === 0) return "Due now";
    const now = currentTimeSec;
    if (timestamp <= now) return "Due now (awaiting keeper)";
    const diff = timestamp - now;
    if (diff < 60) return "in < 1 min";
    if (diff < 3600) return `in ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `in ${(diff / 3600).toFixed(1)} hrs`;
    return `in ${(diff / 86400).toFixed(1)} days`;
  };

  const handleCancel = async (id: bigint) => {
    setCancellingId(id.toString());
    try {
      await onCancelPlan(id);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-3 pt-4">
      <div className="flex items-center justify-between px-1">
        <h4 className="text-sm font-bold text-[var(--ink)]">My Recurring Plans</h4>
        <span className="text-xs text-[var(--ink-muted)]">
          {plans.length} {plans.length === 1 ? "plan" : "plans"}
        </span>
      </div>

      <div className="space-y-2.5">
        {plans.length === 0 ? (
          <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] text-center space-y-1">
            <p className="text-xs text-[var(--ink-muted)] font-medium">
              No recurring plans yet. Set up a schedule above to buy or sell automatically.
            </p>
          </div>
        ) : (
          plans.map((p) => {
            const market = getMarket(p.stockToken);
            const symbol = market?.symbol || "Stock";
            const currentPrice = market?.currentPrice || null;

            // Buy plans escrow quote token; sell plans escrow the stock token.
            const unitDecimals = p.isSell ? (market?.decimals ?? 8) : quoteDecimals;
            const unitSymbol = p.isSell ? symbol : quoteSymbol;
            const amountPerBuyStr = formatUnits(p.amountPerBuy, unitDecimals);
            const remainingRefund = p.amountPerBuy * BigInt(p.remaining);
            const refundStr = formatUnits(remainingRefund, unitDecimals);
            const hasCeiling = p.maxPrice > 0n;
            const ceilingStr = hasCeiling ? formatUnits(p.maxPrice, PRICE_DECIMALS) : "None";

            const isOpen = p.status === 1;
            const isExecuted = p.status === 2;
            const isCancelled = p.status === 3;

            const isPausedByCeiling =
              isOpen &&
              hasCeiling &&
              currentPrice !== null &&
              (p.isSell ? currentPrice < p.maxPrice : currentPrice > p.maxPrice);

            const isBusy = cancellingId === p.id.toString() || isSubmitting;

            return (
              <div
                key={`plan-${p.id.toString()}`}
                className="p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xs space-y-2.5 transition hover:border-[var(--brand)]/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                      <Calendar size={12} /> {p.isSell ? "Recurring sell" : "Recurring buy"}
                    </span>
                    <span className="text-xs font-semibold text-[var(--ink)]">{symbol}</span>
                    <span className="text-[11px] text-[var(--ink-muted)] font-mono">
                      #{p.id.toString()}
                    </span>
                  </div>

                  <div>
                    {isExecuted && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={12} /> Completed
                      </span>
                    )}
                    {isCancelled && (
                      <span className="flex items-center gap-1 text-[11px] text-zinc-400 font-semibold bg-zinc-500/10 px-2 py-0.5 rounded-full">
                        <XCircle size={12} /> Cancelled
                      </span>
                    )}
                    {isOpen && isPausedByCeiling && (
                      <span className="flex items-center gap-1 text-[11px] text-amber-500 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full">
                        <PauseCircle size={12} /> {p.isSell ? "Waiting for price floor" : "Paused by price ceiling"}
                      </span>
                    )}
                    {isOpen && !isPausedByCeiling && (
                      <span className="text-[11px] text-blue-500 font-semibold bg-blue-500/10 px-2 py-0.5 rounded-full">
                        Active ({p.remaining} left)
                      </span>
                    )}
                  </div>
                </div>

                {/* Plan details */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                    <span className="block text-[11px] text-[var(--ink-muted)] uppercase tracking-wider">
                      {p.isSell ? "Per sale" : "Per buy"}
                    </span>
                    <span className="font-semibold text-[var(--ink)] tabular-nums">
                      {amountPerBuyStr} {unitSymbol}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                    <span className="block text-[11px] text-[var(--ink-muted)] uppercase tracking-wider">
                      Frequency
                    </span>
                    <span className="font-semibold text-[var(--ink)] tabular-nums">
                      {formatInterval(p.interval)}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-[var(--surface-2)]">
                    <span className="block text-[11px] text-[var(--ink-muted)] uppercase tracking-wider">
                      {p.isSell ? "Price floor" : "Price ceiling"}
                    </span>
                    <span className="font-semibold text-[var(--ink)] tabular-nums">
                      {hasCeiling ? `$${ceilingStr}` : "None"}
                    </span>
                  </div>
                </div>

                {/* Schedule & Timing status */}
                {isOpen && (
                  <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-xl bg-[var(--surface-2)] text-[var(--ink-muted)]">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> Next {p.isSell ? "sale" : "buy"}: {formatNextTime(p.nextTime)}
                    </span>
                    <span>Runs left: {p.remaining}</span>
                  </div>
                )}

                {/* Action: Cancel plan */}
                {isOpen && (
                  <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)]">
                    <span className="text-[11px] text-[var(--ink-muted)]">
                      Refund if cancelled:{" "}
                      <span className="font-semibold text-[var(--ink)]">
                        {refundStr} {unitSymbol}
                      </span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleCancel(p.id)}
                      disabled={isBusy}
                      className="flex items-center gap-1 text-[11px] font-semibold text-rose-500 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 transition disabled:opacity-50"
                    >
                      <Trash2 size={12} /> Cancel Plan
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
