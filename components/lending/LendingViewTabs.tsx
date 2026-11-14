"use client";

import React from "react";
import { Sparkles, Coins, Compass, ArrowLeftRight, BadgeCheck } from "lucide-react";
import ActivePill from "@/components/ui/motion/ActivePill";

export type LendingViewTab = "markets" | "stocks" | "vaults" | "finder" | "compare";

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
  const tabs = [
    {
      id: "markets" as LendingViewTab,
      label: "Stock Markets",
      icon: BadgeCheck,
      countBadge: marketsCount && marketsCount > 0 ? `${marketsCount} verified` : undefined,
    },
    {
      id: "stocks" as LendingViewTab,
      label: "All Stocks",
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
            className={`relative isolate min-h-[44px] px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 select-none ${
              isSelected
                ? "text-white"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)]"
            }`}
          >
            {isSelected && <ActivePill layoutId="lending-view-pill" className="bg-[var(--brand)] shadow-xs" />}
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
