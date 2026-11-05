"use client";

import React from "react";
import { Sparkles, Coins, Compass, ArrowLeftRight } from "lucide-react";

export type LendingViewTab = "stocks" | "vaults" | "finder" | "compare";

interface LendingViewTabsProps {
  value: LendingViewTab;
  onChange: (tab: LendingViewTab) => void;
  stocksCount?: number;
  vaultsCount?: number;
}

export default function LendingViewTabs({
  value,
  onChange,
  stocksCount = 12,
  vaultsCount,
}: LendingViewTabsProps) {
  const tabs = [
    {
      id: "stocks" as LendingViewTab,
      label: "Tokenized Stocks",
      icon: Sparkles,
      countBadge: stocksCount > 0 ? stocksCount.toString() : undefined,
    },
    {
      id: "vaults" as LendingViewTab,
      label: "Staking & Vaults",
      icon: Coins,
      countBadge: vaultsCount && vaultsCount > 0 ? vaultsCount.toString() : undefined,
    },
    {
      id: "finder" as LendingViewTab,
      label: "Yield Scanner",
      icon: Compass,
      countBadge: "Multi-Protocol",
    },
    {
      id: "compare" as LendingViewTab,
      label: "Compare Protocols",
      icon: ArrowLeftRight,
      countBadge: "8 Protocols",
    },
  ];

  return (
    <div
      className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] w-full sm:w-fit overflow-x-auto no-scrollbar"
      role="tablist"
      aria-label="Lending and Yield Views"
    >
      {tabs.map((tab) => {
        const isSelected = value === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(tab.id)}
            className={`min-h-[44px] px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 select-none ${
              isSelected
                ? "bg-[#0052FF] text-white hover:bg-[#0045D8] shadow-xs"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)]"
            }`}
          >
            <Icon size={15} className={isSelected ? "text-white" : "text-[var(--ink-dim)]"} />
            <span>{tab.label}</span>
            {tab.countBadge && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
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
  );
}
