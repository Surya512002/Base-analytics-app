"use client";

import { BadgeCheck, Coins, Flame, MousePointerClick, Send, Share2, TrendingUp, Twitter } from "lucide-react";
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
      <div className="elegant-panel rounded-3xl overflow-hidden border border-violet-500/20">
        <div className="h-0.5 bg-linear-to-r from-champagne via-violet-500 to-cyan-400" />
        <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/8">
          <div>
            <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.35em]">
              Onchain Analysis
            </p>
            <h2 className="text-lg sm:text-xl font-black text-white mt-1">
              Your <span className="text-gradient-blue">Base Profile</span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
            Wallet score, heatmap & swap volume from indexed Base history.
          </p>
          <button
            type="button"
            onClick={onGoCheckIn}
            className="mt-3 text-xs font-black text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <Flame size={12} /> Open Check-In →
          </button>
        </div>

        <div className="mx-4 sm:mx-5 mb-4 glass-panel-accent rounded-2xl overflow-hidden">
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
                      stroke="rgba(0,229,255,0.1)"
                      strokeWidth="6"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      fill="none"
                      stroke="#00E5FF"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 26}`}
                      strokeDashoffset={`${2 * Math.PI * 26 * (1 - wallet.walletHealthScore / 100)}`}
                      transform="rotate(-90 32 32)"
                      style={{
                        filter: "drop-shadow(0 0 4px rgba(0,229,255,0.6))",
                        transition: "stroke-dashoffset 1s ease",
                      }}
                    />
                    <text
                      x="32"
                      y="36"
                      textAnchor="middle"
                      fill="#60a5fa"
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
                    <span className="text-xs font-black text-cyan-400/60 uppercase tracking-widest">
                      Wallet Health
                    </span>
                    <span className="text-xs font-black text-white bg-cyan-500/12 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                      {wallet.walletHealthLabel}
                    </span>
                  </div>
                  <p className="text-slate-200/70 text-xs leading-relaxed max-w-sm">
                    {wallet.recommendation}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
                {[
                  { l: "Active Days", v: wallet.uniqueDays, c: "text-cyan-400" },
                  { l: "Months", v: wallet.activeMonths, c: "text-cyan-300" },
                  { l: "Streak", v: `${wallet.currentStreak}d`, c: "text-cyan-400" },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="bg-white/[0.04] border border-white/10 rounded-xl p-2.5 text-center"
                  >
                    <p className={`font-black text-lg ${s.c}`}>{s.v}</p>
                    <p className="text-[9px] text-slate-500 uppercase font-bold mt-0.5">
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

      <div className="glass-panel rounded-3xl overflow-hidden shadow-xl shadow-black/25">
        <div className="h-0.5 bg-linear-to-r from-rose-500 via-cyan-400 to-blue-600" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-6">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-[10px] font-black text-cyan-400/60 uppercase tracking-widest">
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
                      className="bg-white/5 hover:bg-white/8 border border-white/10 text-cyan-400/60 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
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
                <span className="text-7xl sm:text-8xl font-black text-white tracking-tighter leading-none">
                  {wallet.score}
                </span>
                <span className="text-2xl text-slate-600 font-black">/100</span>
              </div>
              <p className="text-cyan-400 font-black text-base mt-2 flex items-center gap-2 flex-wrap">
                {wallet.walletRank}
                {wallet.basename && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-cyan-300 bg-cyan-500/10 border border-cyan-500/18 px-2 py-0.5 rounded-full">
                    <BadgeCheck size={10} />
                    {wallet.basename}
                  </span>
                )}
              </p>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl">
                <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
                  <p className="text-[9px] text-slate-500 uppercase font-bold">ETH Sent</p>
                  <p className="text-sm font-black text-white mt-1">{volumeSummary.ethSentLabel}</p>
                </div>
                <div className="bg-white/[0.04] border border-violet-500/25 rounded-xl p-3">
                  <p className="text-[9px] text-slate-500 uppercase font-bold flex items-center gap-1">
                    <TrendingUp size={10} /> Swap Volume
                  </p>
                  <p className="text-sm font-black text-violet-200 mt-1">
                    {volumeSummary.swapVolumeLabel}
                  </p>
                </div>
                <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
                  <p className="text-[9px] text-slate-500 uppercase font-bold flex items-center gap-1">
                    <Coins size={10} /> ETH in Swaps
                  </p>
                  <p className="text-sm font-black text-cyan-200 mt-1">
                    {volumeSummary.ethSwapLabel}
                  </p>
                </div>
                <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3">
                  <p className="text-[9px] text-slate-500 uppercase font-bold">Swap Txs</p>
                  <p className="text-sm font-black text-white mt-1">{volumeSummary.swapTxLabel}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5 sm:gap-x-6 gap-y-1 max-w-lg">
                {Object.entries(wallet.scoreComponents).map(([k, v], i) => {
                  const key = k as keyof typeof SCORE_MAX;
                  const val = Number(v);
                  const pct = Math.round((val / (SCORE_MAX[key] || 1)) * 100);
                  return (
                    <div key={i} className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-slate-400 w-16 sm:w-[4.25rem] font-bold shrink-0">
                        {SCORE_LABELS[key] || k}
                      </span>
                      <div className="flex-1 min-w-0 bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/8">
                        <div
                          className="h-full bg-linear-to-r from-rose-500 to-cyan-400 rounded-full"
                          style={{
                            width: `${pct}%`,
                            transition: "width 1.5s ease-out",
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-cyan-400/70 w-5 text-right shrink-0 font-bold tabular-nums">
                        {Math.round(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="shrink-0">
              {selDay ? (
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl px-5 py-4 text-center">
                  <p className="text-[10px] text-cyan-400/50 font-bold uppercase tracking-wide">
                    {selDay.date}
                  </p>
                  <p className="text-3xl font-black text-cyan-400 mt-1">{selDay.count}</p>
                  <p className="text-[10px] text-slate-500 font-bold">transactions</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 opacity-30">
                  <MousePointerClick size={14} className="text-cyan-400" />
                  <span className="text-[10px] text-cyan-400/50 uppercase font-bold">
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
