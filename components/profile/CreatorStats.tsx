"use client";

import React from "react";
import Link from "next/link";
import { Rocket, Info, ArrowRight } from "lucide-react";
import { formatUsd } from "@/lib/launchpad/format";

interface CreatorStatsProps {
  loading?: boolean;
  launches: number;
  earningsDisplay: string;
  isEstimatedEarnings?: boolean;
  volume24h: number;
  totalMcap: number;
  isOwner?: boolean;
}

export default function CreatorStats({
  loading = false,
  launches,
  earningsDisplay,
  isEstimatedEarnings = false,
  volume24h,
  totalMcap,
  isOwner = false,
}: CreatorStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  const isAllEmpty = launches === 0 && volume24h === 0 && totalMcap === 0;

  const statItems = [
    {
      label: "Launches",
      value: String(launches),
      subtext: launches === 1 ? "1 Token" : `${launches} Tokens`,
    },
    {
      label: "Creator Earnings",
      value: earningsDisplay || "0 ETH",
      isEst: isEstimatedEarnings,
      subtext: "50% of platform fees",
    },
    {
      label: "24H Volume",
      value: volume24h > 0 ? formatUsd(volume24h) : "$0.00",
      subtext: volume24h > 0 ? "Past 24 hours" : "No volume yet",
    },
    {
      label: "Total Mcap",
      value: totalMcap > 0 ? formatUsd(totalMcap) : "$0.00",
      subtext: totalMcap > 0 ? "Cumulative tokens" : "No tokens yet",
    },
  ];

  return (
    <div className="space-y-3">
      {/* 4 Stat Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statItems.map((item) => (
          <div
            key={item.label}
            className="pop flex flex-col justify-between p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xs transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                {item.label}
              </span>
              {item.isEst && (
                <span
                  title="Estimated based on 24H volume fee share"
                  className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)] cursor-help"
                >
                  est.
                </span>
              )}
            </div>

            <div className="my-2">
              <span className="text-xl sm:text-2xl font-black text-[var(--ink)] font-mono tabular-nums tracking-tight">
                {item.value}
              </span>
            </div>

            <span className="text-[11px] text-[var(--ink-dim)] truncate">
              {item.subtext}
            </span>
          </div>
        ))}
      </div>

      {/* Guidance Line when empty */}
      {isAllEmpty && isOwner && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs text-[var(--ink-muted)] animate-in fade-in">
          <span>Launch your first token to start earning instant swap fee shares on Base.</span>
          <Link
            href="/explore?create=true"
            className="pop-pill inline-flex items-center gap-1.5 font-bold text-xs bg-[#0052FF] text-white px-3 py-1.5 rounded-lg hover:bg-[#0047e0] transition shrink-0 cursor-pointer"
          >
            <Rocket size={13} />
            <span>Launch a token</span>
          </Link>
        </div>
      )}
    </div>
  );
}
