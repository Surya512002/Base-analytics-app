"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import PageHero from "@/components/ui/PageHero";

interface LendingHeaderProps {
  lastUpdatedSecondsAgo?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function LendingHeader({
  lastUpdatedSecondsAgo = 0,
  onRefresh,
  isRefreshing = false,
}: LendingHeaderProps) {
  return (
    <PageHero
      size="sm"
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
        <div className="flex items-center gap-2">
          <div className="pulse-chip">
            <span className="pulse-status-dot" aria-hidden />
            <span>Live · {lastUpdatedSecondsAgo}s ago</span>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="pulse-chip cursor-pointer p-1.5 text-[var(--ink-muted)] transition hover:border-[var(--brand)] hover:text-[var(--ink)] disabled:opacity-50"
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
