"use client";

import { BadgeCheck, Coins, Flame, MousePointerClick, RefreshCcw, Send, Share2, TrendingUp, Twitter } from "lucide-react";
import { ActivityHeatmap } from "@/components/wallet/ActivityHeatmap";
import PaymasterInsightTile from "@/components/wallet/PaymasterInsightTile";
import QuestProgressBanner from "@/components/wallet/QuestProgressBanner";
import {
  buildVolumeSummary,
  formatVolumeSummary,
} from "@/lib/analytics/onchain-score";
import { SCORE_LABELS, SCORE_MAX } from "@/lib/utils/score";
import type { WalletData } from "@/lib/types/wallet";
import type { DayStats } from "@/lib/types/wallet";
import type { RefObject } from "react";

interface OnchainScorePanelProps {
  wallet: WalletData;
  streak: number;
  doneQuests: number;
  selDay: DayStats | null;
  setSelDay: (d: DayStats | null) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  onGoCheckIn: () => void;
  onGoQuests: () => void;
  shareScore: (platform: "w" | "t" | "n") => void;
  syncing?: boolean;
  scanProgress?: string;
}

export default function OnchainScorePanel({
  wallet,
  streak,
  doneQuests,
  selDay,
  setSelDay,
  scrollRef,
  onGoCheckIn,
  onGoQuests,
  shareScore,
  syncing = false,
  scanProgress = "",
}: OnchainScorePanelProps) {
  const ethPrice =
    wallet.dexVolumeETH > 0
      ? wallet.dexVolumeUSD / wallet.dexVolumeETH
      : 3200;
  const volumeSummary = formatVolumeSummary(
    buildVolumeSummary(
      {
        ethSent: parseFloat(wallet.ethVolume || "0"),
        ethReceived: wallet.ethReceived,
        ethSwapSent: (wallet.ethSwapVolumeUSD ?? 0) / Math.max(ethPrice, 1),
        swapLikeTxCount: wallet.dexTradeCount,
      },
      {
        dexTradeCount: wallet.dexTradeCount,
        dexVolumeUSD: wallet.dexVolumeUSD,
        dexVolumeETH: wallet.dexVolumeETH,
        dexTradeCount30d: wallet.dexTradeCount30d,
        dexVolumeUSD30d: wallet.dexVolumeUSD30d,
        ethSwapVolumeUSD: wallet.ethSwapVolumeUSD ?? 0,
        totalSwapVolumeUSD: wallet.dexVolumeUSD,
      },
      ethPrice
    )
  );

  return (
    <div className="space-y-4">
      {syncing && (
        <div className="glass-panel rounded-2xl px-4 py-3 flex items-center gap-3">
          <RefreshCcw size={16} className="text-[var(--ink-muted)] animate-spin shrink-0" />
          <p className="text-xs text-[var(--ink-muted)] font-semibold">
            {scanProgress || "Syncing onchain score & heatmap…"}
          </p>
        </div>
      )}
      <div className="elegant-panel rounded-3xl overflow-hidden">
        <div className="accent-bar" />
        <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)]">
          <div>
            <p className="section-eyebrow">Onchain Analysis</p>
            <h2 className="text-lg sm:text-xl font-black text-[var(--ink)] mt-1">
              Your Base Profile
            </h2>
          </div>
          <p className="text-xs text-[var(--ink-muted)] max-w-xs leading-relaxed">
            Wallet score, heatmap & swap volume from indexed Base history.
          </p>
          <button
            type="button"
            onClick={onGoCheckIn}
            className="mt-3 text-xs font-black text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center gap-1"
          >
            <Flame size={12} /> Open Check-In →
          </button>
        </div>

        <div className="mx-4 sm:mx-5 mb-4 glass-panel rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 shrink-0">
                  <svg width="64" height="64" viewBox="0 0 64 64">
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      fill="none"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="6"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      fill="none"
                      stroke="#f5f5f4"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 26}`}
                      strokeDashoffset={`${2 * Math.PI * 26 * (1 - wallet.walletHealthScore / 100)}`}
                      transform="rotate(-90 32 32)"
                      style={{
                        filter: "none",
                        transition: "stroke-dashoffset 1s ease",
                      }}
                    />
                    <text
                      x="32"
                      y="36"
                      textAnchor="middle"
                      fill="#f8fafc"
                      fontSize="12"
                      fontWeight="800"
                      fontFamily="monospace"
                    >
                      {wallet.walletHealthScore}
                    </text>
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-black text-[var(--ink-muted)] uppercase tracking-widest">
                      Wallet Health
                    </span>
                    <span className="text-xs font-black text-[var(--ink)] bg-[var(--surface-2)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-full">
                      {wallet.walletHealthLabel}
                    </span>
                  </div>
                  <p className="text-[var(--ink-soft)]/70 text-xs leading-relaxed max-w-sm">
                    {wallet.recommendation}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
                {[
                  { l: "Active Days", v: wallet.uniqueDays, c: "text-[var(--ink)]" },
                  { l: "Months", v: wallet.activeMonths, c: "text-[var(--ink)]" },
                  { l: "Streak", v: `${wallet.currentStreak}d`, c: "text-[var(--ink)]" },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-center"
                  >
                    <p className={`font-black text-lg ${s.c}`}>{s.v}</p>
                    <p className="text-[9px] text-[var(--ink-muted)] uppercase font-bold mt-0.5">
                      {s.l}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <QuestProgressBanner doneQuests={doneQuests} onGoQuests={onGoQuests} />
      <PaymasterInsightTile wallet={wallet} />

      <div className="glass-panel rounded-3xl overflow-hidden">
        <div className="accent-bar" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-6">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="section-eyebrow">
                  Onchain Score
                </span>
                <div className="flex gap-1">
                  {(
                    [
                      ["w", "Cast"],
                      ["t", "Post"],
                      ["n", "Share"],
                    ] as const
                  ).map(([pl, lbl]) => (
                    <button
                      key={pl}
                      type="button"
                      onClick={() => shareScore(pl)}
                      className="bg-[var(--surface-2)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--ink-muted)] px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                    >
                      {pl === "w" ? (
                        <Send size={9} />
                      ) : pl === "t" ? (
                        <Twitter size={9} />
                      ) : (
                        <Share2 size={9} />
                      )}
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-7xl sm:text-8xl font-black text-[var(--ink)] tracking-tighter leading-none">
                  {wallet.score}
                </span>
                <span className="text-2xl text-[var(--ink-dim)] font-black">/100</span>
              </div>
              <p className="text-[var(--ink)] font-black text-base mt-2 flex items-center gap-2 flex-wrap">
                {wallet.walletRank}
                {wallet.basename && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-[var(--ink-muted)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-full">
                    <BadgeCheck size={10} />
                    {wallet.basename}
                  </span>
                )}
              </p>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl">
                <div className="bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-xl p-3">
                  <p className="text-[9px] text-[var(--ink-muted)] uppercase font-bold">ETH Sent</p>
                  <p className="text-sm font-black text-[var(--ink)] mt-1">{volumeSummary.ethSentLabel}</p>
                </div>
                <div className="bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-xl p-3">
                  <p className="text-[9px] text-[var(--ink-muted)] uppercase font-bold flex items-center gap-1">
                    <TrendingUp size={10} /> Swap Volume
                  </p>
                  <p className="text-sm font-black text-[var(--ink)] mt-1">
                    {volumeSummary.swapVolumeLabel}
                  </p>
                </div>
                <div className="bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-xl p-3">
                  <p className="text-[9px] text-[var(--ink-muted)] uppercase font-bold flex items-center gap-1">
                    <Coins size={10} /> ETH in Swaps
                  </p>
                  <p className="text-sm font-black text-[var(--ink)] mt-1">
                    {volumeSummary.ethSwapLabel}
                  </p>
                </div>
                <div className="bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-xl p-3">
                  <p className="text-[9px] text-[var(--ink-muted)] uppercase font-bold">Swap Txs</p>
                  <p className="text-sm font-black text-[var(--ink)] mt-1">{volumeSummary.swapTxLabel}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5 sm:gap-x-6 gap-y-1 max-w-lg">
                {Object.entries(wallet.scoreComponents).map(([k, v], i) => {
                  const key = k as keyof typeof SCORE_MAX;
                  const val = Number(v);
                  const pct = Math.round((val / (SCORE_MAX[key] || 1)) * 100);
                  return (
                    <div key={i} className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-[var(--ink-muted)] w-16 sm:w-[4.25rem] font-bold shrink-0">
                        {SCORE_LABELS[key] || k}
                      </span>
                      <div className="flex-1 min-w-0 bg-[var(--surface-2)] rounded-full h-1.5 overflow-hidden border border-[var(--border-subtle)]">
                        <div
                          className="h-full bg-[var(--accent)] rounded-full"
                          style={{
                            width: `${pct}%`,
                            transition: "width 1.5s ease-out",
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-[var(--ink-muted)] w-5 text-right shrink-0 font-bold tabular-nums">
                        {Math.round(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="shrink-0">
              {selDay ? (
                <div className="bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-2xl px-5 py-4 text-center">
                  <p className="text-[10px] text-[var(--ink-dim)] font-bold uppercase tracking-wide">
                    {selDay.date}
                  </p>
                  <p className="text-3xl font-black text-[var(--ink)] mt-1">{selDay.count}</p>
                  <p className="text-[10px] text-[var(--ink-muted)] font-bold">transactions</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 opacity-70">
                  <MousePointerClick size={14} className="text-[var(--ink-muted)]" />
                  <span className="text-[10px] text-[var(--ink-muted)] uppercase font-bold">
                    Click a cell
                  </span>
                </div>
              )}
            </div>
          </div>
          <ActivityHeatmap
            dailyStats={wallet.dailyStats}
            selectedDay={selDay}
            onSelectDay={setSelDay}
            scrollRef={scrollRef}
          />
        </div>
      </div>
    </div>
  );
}
