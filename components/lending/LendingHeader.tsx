"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import PageHero, { HeroStats } from "@/components/ui/PageHero";

interface LendingHeaderProps {
  topSupplyApy: number;
  lowestBorrowApr: number;
  totalLiquidityUsd: number;
  verifiedPoolsCount: number;
  lastUpdatedSecondsAgo?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function formatCompactUsd(val: number): string {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export default function LendingHeader({
  topSupplyApy,
  lowestBorrowApr,
  totalLiquidityUsd,
  verifiedPoolsCount,
  lastUpdatedSecondsAgo = 0,
  onRefresh,
  isRefreshing = false,
}: LendingHeaderProps) {
  return (
    <PageHero
      size="md"
      as="h2"
      eyebrow="Lend, Borrow & Stake on Base"
      title={
        <>
          Put your stocks to work —{" "}
          <span className="text-[var(--brand-text)]">borrow or earn.</span>
        </>
      }
      subtitle="Borrow cash against tokenized stock collateral, or supply assets for verified onchain yield."
    >
      <div className="flex flex-col items-start gap-3 sm:items-center">
        <HeroStats
          items={[
            {
              label: "Top supply APY",
              value: (
                <span className="text-emerald-600 dark:text-emerald-400">
                  {topSupplyApy > 0 ? `${topSupplyApy.toFixed(2)}%` : "—"}
                </span>
              ),
            },
            { label: "Lowest borrow", value: lowestBorrowApr > 0 ? `${lowestBorrowApr.toFixed(2)}%` : "—" },
            { label: "Liquidity", value: formatCompactUsd(totalLiquidityUsd) },
            {
              label: "Verified",
              value: <span className="text-[var(--brand-text)]">{verifiedPoolsCount} pools</span>,
            },
          ]}
        />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-1 text-[11px] font-medium text-[var(--ink-muted)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span>Live · {lastUpdatedSecondsAgo}s ago</span>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="cursor-pointer rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1.5 text-[var(--ink-muted)] transition hover:border-[var(--brand)] hover:text-[var(--ink)] disabled:opacity-50"
              title="Refresh live rates"
              aria-label="Refresh live rates"
            >
              <RefreshCw size={13} className={isRefreshing ? "animate-spin text-[var(--brand-text)]" : ""} />
            </button>
          )}
        </div>
      </div>
    </PageHero>
  );
}
