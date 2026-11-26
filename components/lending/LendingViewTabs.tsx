"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeftRight, Compass } from "lucide-react";
import PlaceTabs, { AccountTabs } from "@/components/shell/PlaceTabs";

export type LendingViewTab = "markets" | "stocks" | "portfolio" | "orders" | "vaults" | "finder" | "compare";

const COMPARE_VIEWS = [
  { id: "compare", label: "Protocols side by side", icon: ArrowLeftRight },
  { id: "finder", label: "Yield scanner", icon: Compass },
] as const;

interface LendingViewTabsProps {
  value: LendingViewTab;
  onChange: (tab: LendingViewTab) => void;
  vaultsCount?: number;
}

export default function LendingViewTabs({ value, onChange, vaultsCount }: LendingViewTabsProps) {
  if (value === "portfolio" || value === "orders") return <AccountTabs current={value === "orders" ? "orders" : "holdings"} />;
  const comparing = value === "compare" || value === "finder";

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div className="flex w-full items-center gap-2 sm:max-w-[600px]">
        <div className="min-w-0 flex-1">
          <PlaceTabs
            label="Earn"
            current={comparing ? "compare" : value === "vaults" ? "vaults" : "lend"}
            onSelect={(id) => onChange(id === "vaults" ? "vaults" : "markets")}
            items={[
              { id: "lend", label: "Lend and borrow", href: "/lend" },
              { id: "vaults", label: vaultsCount ? `Vaults and staking (${vaultsCount})` : "Vaults and staking", href: "/lend?view=vaults" },
            ]}
          />
        </div>
        <Link
          href="/lend?view=compare"
          scroll={false}
          aria-current={comparing ? "page" : undefined}
          onClick={() => onChange("compare")}
          className="place-tabs-extra"
        >
          <ArrowLeftRight size={18} aria-hidden /> <span className="max-sm:sr-only">Compare rates</span>
        </Link>
      </div>

      {comparing && (
        <div className="flex w-full gap-1.5 overflow-x-auto no-scrollbar" role="tablist" aria-label="Ways to compare">
          {COMPARE_VIEWS.map((tab) => (
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
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
