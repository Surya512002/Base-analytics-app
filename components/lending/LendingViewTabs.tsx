"use client";

import React from "react";
import { Sparkles, Coins, Compass, ArrowLeftRight, BadgeCheck, PieChart } from "lucide-react";
import ActivePill from "@/components/ui/motion/ActivePill";

type Tab = { id: LendingViewTab; label: string; icon: React.ElementType; countBadge?: string };

export type LendingViewTab = "markets" | "stocks" | "portfolio" | "vaults" | "finder" | "compare";

interface LendingViewTabsProps {
  value: LendingViewTab;
  onChange: (tab: LendingViewTab) => void;
  stocksCount?: number;
  vaultsCount?: number;
  marketsCount?: number;
}

export default function LendingViewTabs({
  value,
  onChange,
  stocksCount = 12,
  vaultsCount,
  marketsCount,
}: LendingViewTabsProps) {
  // Three everyday places. The other ways of looking at markets sit in a second row under "Markets".
  const main: Tab[] = [
    { id: "markets", label: "Markets", icon: BadgeCheck, countBadge: marketsCount && marketsCount > 0 ? `${marketsCount} verified` : undefined },
    { id: "portfolio", label: "My Stocks", icon: PieChart },
    { id: "vaults", label: "Staking & Vaults", icon: Coins, countBadge: vaultsCount && vaultsCount > 0 ? vaultsCount.toString() : undefined },
  ];
  const marketViews: Tab[] = [
    { id: "markets", label: "By stock", icon: BadgeCheck },
    { id: "stocks", label: "All Stocks", icon: Sparkles, countBadge: stocksCount > 0 ? stocksCount.toString() : undefined },
    { id: "finder", label: "Yield Scanner", icon: Compass },
    { id: "compare", label: "Compare Protocols", icon: ArrowLeftRight },
  ];
  const inMarkets = marketViews.some((t) => t.id === value);

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div
        className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] w-full sm:w-fit overflow-x-auto no-scrollbar"
        role="tablist"
        aria-label="Lending and Yield Views"
      >
        {main.map((tab) => {
          const isSelected = tab.id === "markets" ? inMarkets : value === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onChange(tab.id)}
              className={`relative isolate min-h-[44px] flex-1 justify-center px-3 sm:flex-none sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 select-none ${
                isSelected
                  ? "text-white"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)]"
              }`}
            >
              {isSelected && <ActivePill layoutId="lending-view-pill" className="bg-[var(--brand)] shadow-xs" />}
              <Icon size={15} className={`hidden sm:block ${isSelected ? "text-white" : "text-[var(--ink-dim)]"}`} />
              <span>{tab.label}</span>
              {tab.countBadge && (
                <span
                  className={`hidden sm:inline text-[11px] px-1.5 py-0.5 rounded-md font-mono ${
                    isSelected
                      ? "bg-white/20 text-white font-semibold"
                      : "bg-[var(--surface)] text-[var(--ink-dim)] border border-[var(--border-subtle)]"
                  }`}
                >
                  {tab.countBadge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {inMarkets && (
        <div className="flex w-full gap-1.5 overflow-x-auto no-scrollbar" role="tablist" aria-label="Market views">
          {marketViews.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={value === tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex min-h-[40px] shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-xs font-bold transition ${
                value === tab.id
                  ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-text)]"
                  : "border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              <tab.icon size={13} aria-hidden />
              {tab.label}
              {tab.countBadge && <span className="font-mono text-[11px] opacity-70">{tab.countBadge}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
