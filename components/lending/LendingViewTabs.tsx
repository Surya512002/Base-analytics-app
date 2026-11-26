"use client";

import React from "react";
import { Compass, ArrowLeftRight, BadgeCheck } from "lucide-react";
import { LayoutGrid } from "lucide-react";
import PlaceTabs, { AccountTabs } from "@/components/shell/PlaceTabs";

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
  // Two switches. The ways of looking at lending markets sit in a second row under the first one.
  const marketViews: Tab[] = [
    { id: "markets", label: "By stock", icon: BadgeCheck, countBadge: marketsCount && marketsCount > 0 ? `${marketsCount} verified` : undefined },
    { id: "stocks", label: "All stocks", icon: LayoutGrid, countBadge: stocksCount > 0 ? stocksCount.toString() : undefined },
    { id: "finder", label: "Yield scanner", icon: Compass },
    { id: "compare", label: "Compare rates", icon: ArrowLeftRight },
  ];
  const inMarkets = marketViews.some((t) => t.id === value);

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      {value === "portfolio" ? (
        <AccountTabs current="holdings" />
      ) : (
        <div className="w-full sm:max-w-[420px]">
          <PlaceTabs
            label="Earn"
            current={inMarkets ? "lend" : "vaults"}
            onSelect={(id) => onChange(id === "vaults" ? "vaults" : "markets")}
            items={[
              { id: "lend", label: "Lend and borrow", href: "/lend" },
              { id: "vaults", label: vaultsCount ? `Vaults and staking (${vaultsCount})` : "Vaults and staking", href: "/lend?view=vaults" },
            ]}
          />
        </div>
      )}

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
