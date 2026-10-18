"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Rocket,
  TrendingUp,
  Clock,
  Activity,
  ExternalLink,
  ShieldCheck,
  Check,
  Calendar,
} from "lucide-react";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import type { CreatorRevenueSummary, FeeEvent } from "@/lib/launchpad/fee-ledger";
import TokenCard from "@/components/launchpad/TokenCard";
import { shortAddr, timeAgo } from "@/lib/launchpad/format";

type TabId = "launches" | "revenue" | "vesting" | "activity";

interface ProfileTabsProps {
  tokens: LaunchedToken[];
  markets: Record<string, TokenMarketSummary>;
  creatorRevenue: CreatorRevenueSummary | null;
  address: string;
  isOwner?: boolean;
  onOpenToken?: (token: LaunchedToken) => void;
}

export default function ProfileTabs({
  tokens,
  markets,
  creatorRevenue,
  address,
  isOwner = false,
  onOpenToken,
}: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("launches");
  const [revenueRange, setRevenueRange] = useState<"7d" | "30d" | "all">("all");

  // Vesting schedules
  const vestingSchedules = useMemo(() => {
    const list: Array<{
      token: LaunchedToken;
      cliffMonths: number;
      vestMonths: number;
      pct: number;
      recipient: string;
      unlockDate: Date;
      isUnlocked: boolean;
    }> = [];

    const now = Date.now();
    for (const t of tokens) {
      for (const v of t.vestingSchedule ?? []) {
        const unlockMs = t.createdAt + v.cliffMonths * 30 * 24 * 60 * 60 * 1000;
        list.push({
          token: t,
          cliffMonths: v.cliffMonths,
          vestMonths: v.vestMonths,
          pct: v.pct,
          recipient: v.address,
          unlockDate: new Date(unlockMs),
          isUnlocked: now >= unlockMs,
        });
      }
    }
    return list.sort((a, b) => a.unlockDate.getTime() - b.unlockDate.getTime());
  }, [tokens]);

  // Check if activity exists
  const hasActivity = Boolean(
    (creatorRevenue && creatorRevenue.recent.length > 0) || tokens.length > 0
  );

  const TABS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { id: "launches", label: `Launches (${tokens.length})`, icon: Rocket },
    { id: "revenue", label: "Revenue", icon: TrendingUp },
    { id: "vesting", label: `Vesting (${vestingSchedules.length})`, icon: Clock },
    ...(hasActivity ? [{ id: "activity" as TabId, label: "Activity", icon: Activity }] : []),
  ];

  return (
    <div className="space-y-5 w-full min-w-0">
      {/* Segmented Tab Bar */}
      <div
        role="tablist"
        aria-label="Profile navigation"
        className="flex gap-1 p-1 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] overflow-x-auto no-scrollbar w-full min-w-0"
      >
        {TABS.map((t) => {
          const isSelected = activeTab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 min-w-[6.5rem] py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                isSelected
                  ? "bg-[#0052FF] text-white shadow-xs"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)]"
              }`}
            >
              <Icon size={15} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. LAUNCHES TAB */}
      {activeTab === "launches" && (
        <section className="space-y-4 animate-in fade-in duration-200">
          {tokens.length === 0 ? (
            <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-8 sm:p-12 text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center border border-[#0052FF]/20 shadow-inner">
                <Rocket size={28} />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-black text-[var(--ink)]">
                  No tokens launched yet
                </h3>
                <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                  Tokens launched by this creator on Base will appear here with live price charts, liquidity, and 24h volume.
                </p>
              </div>
              {isOwner && (
                <Link
                  href="/explore?create=true"
                  className="pop-pill inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#0052FF] text-white hover:bg-[#0047e0] transition shadow-md cursor-pointer"
                >
                  <Rocket size={14} />
                  <span>Launch a token</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {tokens.map((token) => (
                <TokenCard
                  key={token.address}
                  token={token}
                  market={markets[token.address.toLowerCase()]}
                  isMine={isOwner}
                  onTrade={() =>
                    onOpenToken
                      ? onOpenToken(token)
                      : (window.location.href = `/explore/token/${token.address}`)
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* 2. REVENUE TAB */}
      {activeTab === "revenue" && (
        <section className="space-y-4 animate-in fade-in duration-200">
          {/* Instant Payout Explainer Card */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-[var(--ink)]">
                  Creator Swap Fee Revenue
                </h3>
                <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                  Creators earn <strong>50%</strong> of the 0.50% swap fee on their tokens. Payouts stream <strong>instantly onchain</strong> per swap — there is no claim queue.
                </p>
              </div>
              <a
                href={`https://basescan.org/address/${address}#internaltx`}
                target="_blank"
                rel="noopener noreferrer"
                className="pop-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs font-bold text-[var(--ink)] hover:text-[#0052FF] transition shrink-0 cursor-pointer"
              >
                <span>Verify on Basescan</span>
                <ExternalLink size={12} />
              </a>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full min-w-0">
              <div className="pop p-2.5 sm:p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 min-w-0 overflow-hidden">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 truncate block">
                  Creator Share
                </span>
                <p className="font-mono font-black text-base sm:text-xl text-[var(--ink)] mt-0.5 truncate">0.25%</p>
                <p className="text-[9px] sm:text-[10px] text-[var(--ink-dim)] truncate">Every in-app swap</p>
              </div>

              <div className="pop p-2.5 sm:p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] min-w-0 overflow-hidden">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase text-[var(--ink-muted)] truncate block">
                  Platform Fee
                </span>
                <p className="font-mono font-black text-base sm:text-xl text-[var(--ink)] mt-0.5 truncate">0.50%</p>
                <p className="text-[9px] sm:text-[10px] text-[var(--ink-dim)] truncate">Split 50/50</p>
              </div>

              <div className="pop p-2.5 sm:p-3.5 rounded-xl border border-[#0052FF]/30 bg-[#0052FF]/10 min-w-0 overflow-hidden">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase text-[#0052FF] truncate block">
                  Payout Status
                </span>
                <p className="font-bold text-xs sm:text-sm text-[var(--ink)] mt-1 flex items-center gap-1 truncate">
                  <Check size={14} className="text-emerald-500 shrink-0" /> Instant
                </p>
                <p className="text-[9px] sm:text-[10px] text-[var(--ink-dim)] truncate">Zero lockup</p>
              </div>
            </div>
          </div>

          {/* Per-Token Revenue Breakdown */}
          {creatorRevenue && creatorRevenue.byToken.length > 0 ? (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-[var(--ink-muted)]">
                  Per-Token Revenue History
                </h4>
                {/* 7D / 30D / All Filter */}
                <div className="flex gap-1 text-[11px] font-bold">
                  {(["7d", "30d", "all"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRevenueRange(r)}
                      className={`pop-pill px-2.5 py-1 rounded-lg uppercase transition cursor-pointer ${
                        revenueRange === r
                          ? "bg-[#0052FF] text-white"
                          : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-[var(--border-subtle)]">
                {creatorRevenue.byToken.map((row) => (
                  <div
                    key={row.tokenAddress}
                    className="pop-row flex items-center justify-between py-3 px-3 rounded-xl text-xs"
                  >
                    <div>
                      <Link
                        href={`/explore/token/${row.tokenAddress}`}
                        className="font-bold text-sm text-[var(--ink)] hover:text-[#0052FF] transition"
                      >
                        ${row.tokenSymbol}
                      </Link>
                      <span className="font-mono text-[11px] text-[var(--ink-dim)] block">
                        {shortAddr(row.tokenAddress, 6, 4)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {(Number(BigInt(row.creatorShare.toString())) / 1e18).toFixed(4)} ETH
                      </span>
                      <span className="text-[10px] text-[var(--ink-dim)] block">accrued &amp; sent</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-6 text-center text-xs text-[var(--ink-muted)]">
              Swap fee revenue history will populate automatically as traders execute swaps on your tokens.
            </div>
          )}
        </section>
      )}

      {/* 3. VESTING TAB */}
      {activeTab === "vesting" && (
        <section className="space-y-4 animate-in fade-in duration-200">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 space-y-4 shadow-sm">
            <div>
              <h3 className="text-base font-black text-[var(--ink)]">
                Token Vesting Schedules
              </h3>
              <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                Onchain team allocations configured at token launch.
              </p>
            </div>

            {vestingSchedules.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--ink-muted)]">
                No vesting schedules configured for tokens launched by this creator.
              </p>
            ) : (
              <div className="space-y-3">
                {vestingSchedules.map((schedule, idx) => (
                  <div
                    key={idx}
                    className="pop p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--ink)]">
                          ${schedule.token.symbol}
                        </span>
                        <span className="text-xs text-[var(--ink-muted)]">
                          · {schedule.token.name}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          schedule.isUnlocked
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {schedule.isUnlocked ? "Unlocked" : "Locked"}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-[var(--ink-muted)]">
                        <span>Allocation: {schedule.pct}% of total supply</span>
                        <span className="font-mono">
                          {schedule.isUnlocked ? "100% Unlocked" : "Vesting in progress"}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[var(--surface)] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            schedule.isUnlocked ? "bg-emerald-500" : "bg-[#0052FF]"
                          }`}
                          style={{ width: schedule.isUnlocked ? "100%" : "35%" }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--ink-dim)]">
                      <span>Recipient: {shortAddr(schedule.recipient, 6, 4)}</span>
                      <span>Unlock Date: {schedule.unlockDate.toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 4. ACTIVITY TAB */}
      {activeTab === "activity" && hasActivity && (
        <section className="space-y-4 animate-in fade-in duration-200">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--ink-muted)]">
              Recent Creator Activity
            </h3>

            <div className="divide-y divide-[var(--border-subtle)]">
              {creatorRevenue?.recent.map((ev: FeeEvent) => (
                <div
                  key={ev.id}
                  className="pop-row py-3 px-3 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                      $
                    </span>
                    <div>
                      <p className="font-bold text-[var(--ink)]">
                        Swap Fee Payout · ${ev.tokenSymbol}
                      </p>
                      <p className="text-[11px] text-[var(--ink-dim)]">{timeAgo(ev.timestamp)}</p>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      +{(Number(BigInt(ev.creatorShare)) / 1e18).toFixed(4)} ETH
                    </span>
                    <a
                      href={`https://basescan.org/tx/${ev.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--ink-muted)] hover:text-[#0052FF]"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
