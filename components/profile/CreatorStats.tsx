"use client";

import React from "react";
import Link from "next/link";
import { Rocket, Users } from "lucide-react";
import { useUniqueUsers } from "@/hooks/useUniqueUsers";
import { formatUsd } from "@/lib/launchpad/format";

interface CreatorStatsProps {
  address?: string;
  loading?: boolean;
  launches: number;
  earningsDisplay: string;
  isEstimatedEarnings?: boolean;
  volume24h: number;
  totalMcap: number;
  isOwner?: boolean;
}

export default function CreatorStats({
  address,
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

  const { formatted: uniqueUsersFormatted } = useUniqueUsers(address);
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 w-full min-w-0">
        {statItems.map((item) => (
          <div
            key={item.label}
            className="pop flex flex-col justify-between min-w-0 p-3 sm:p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xs transition overflow-hidden"
          >
            <div className="flex items-center justify-between gap-1 min-w-0">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)] truncate">
                {item.label}
              </span>
              {item.isEst && (
                <span
                  title="Estimated based on 24H volume fee share"
                  className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)] cursor-help shrink-0"
                >
                  est.
                </span>
              )}
            </div>

            <div className="my-1.5 sm:my-2 min-w-0">
              <span className="text-base sm:text-xl lg:text-2xl font-black text-[var(--ink)] font-mono tabular-nums tracking-tight truncate block">
                {item.value}
              </span>
            </div>

            <span className="text-[10px] sm:text-[11px] text-[var(--ink-dim)] truncate block">
              {item.subtext}
            </span>
          </div>
        ))}
      </div>

      {/* Community Unique Users Banner */}
      <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Users size={17} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)] truncate">
              Base Community &amp; Active App Users
            </div>
            <div className="text-[11px] text-[var(--ink-dim)] truncate">
              Unique wallet addresses connected and tracked via Redis backend
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-base sm:text-xl font-black text-[var(--ink)] font-mono tabular-nums flex items-center gap-1.5 justify-end">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {uniqueUsersFormatted}
          </div>
          <span className="text-[10px] font-semibold text-[var(--ink-muted)]">Total Connected</span>
        </div>
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
