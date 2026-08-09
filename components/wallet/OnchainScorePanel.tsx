"use client";

import {
  BadgeCheck,
  Coins,
  Flame,
  MousePointerClick,
  Send,
  Share2,
  TrendingUp,
  Twitter,
} from "lucide-react";
import { ActivityHeatmap } from "@/components/wallet/ActivityHeatmap";
import PaymasterInsightTile from "@/components/wallet/PaymasterInsightTile";
import QuestProgressBanner from "@/components/wallet/QuestProgressBanner";
import {
  buildVolumeSummary,
  formatVolumeSummary,
} from "@/lib/analytics/onchain-score";
import { SCORE_LABELS, SCORE_MAX, type ScoreComponents } from "@/lib/utils/score";
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

const SCORE_BAR_COLORS: Record<keyof ScoreComponents, string> = {
  txActivity: "#2563eb",
  consistency: "#0d9488",
  longevity: "#7c3aed",
  streak: "#ea580c",
  volume: "#059669",
  diversity: "#db2777",
  defiUsage: "#0891b2",
  contracts: "#4f46e5",
  nftHolder: "#c026d3",
  dexTrading: "#0284c7",
  bridge: "#64748b",
  identity: "#d97706",
  engagement: "#e11d48",
  activeWeeks: "#65a30d",
};

function scoreTone(score: number): {
  ring: string;
  chip: string;
  glow: string;
  label: string;
} {
  if (score >= 80)
    return {
      ring: "#059669",
      chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
      glow: "from-emerald-100/80 to-teal-50/40",
      label: "Elite activity",
    };
  if (score >= 55)
    return {
      ring: "#2563eb",
      chip: "bg-sky-50 text-sky-900 border-sky-200",
      glow: "from-sky-100/80 to-indigo-50/40",
      label: "Strong onchain",
    };
  if (score >= 30)
    return {
      ring: "#d97706",
      chip: "bg-amber-50 text-amber-900 border-amber-200",
      glow: "from-amber-50/90 to-orange-50/40",
      label: "Building up",
    };
  return {
    ring: "#64748b",
    chip: "bg-slate-100 text-slate-700 border-slate-200",
    glow: "from-slate-100/90 to-slate-50/40",
    label: "Early stage",
  };
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

  const tone = scoreTone(wallet.score);
  const healthPct = Math.min(100, Math.max(0, wallet.walletHealthScore));

  return (
    <div className="space-y-4">
      {/* Profile + health — teal/emerald track */}
      <div className="rounded-3xl overflow-hidden border border-teal-200/70 bg-gradient-to-br from-teal-50/90 via-[var(--surface)] to-cyan-50/50 shadow-[0_12px_40px_rgba(13,148,136,0.08)]">
        <div className="h-1 w-full bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-400" />
        <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-teal-100">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-700">
              Onchain Analysis
            </p>
            <h2 className="text-lg sm:text-xl font-black text-[var(--ink)] mt-1">
              Your Base Profile
            </h2>
          </div>
          <p className="text-xs text-teal-900/60 max-w-xs leading-relaxed">
            Wallet score, heatmap & swap volume from indexed Base history.
          </p>
          <button
            type="button"
            onClick={onGoCheckIn}
            className="text-xs font-black text-teal-800 hover:text-teal-950 flex items-center gap-1 bg-teal-100/70 border border-teal-200 px-3 py-1.5 rounded-full"
          >
            <Flame size={12} /> Open Check-In →
          </button>
        </div>

        <div className="mx-4 sm:mx-5 mb-4 mt-4 rounded-2xl overflow-hidden border border-teal-100 bg-white/70">
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
                      stroke="rgba(13,148,136,0.15)"
                      strokeWidth="6"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      fill="none"
                      stroke="#0d9488"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 26}`}
                      strokeDashoffset={`${2 * Math.PI * 26 * (1 - healthPct / 100)}`}
                      transform="rotate(-90 32 32)"
                      style={{ transition: "stroke-dashoffset 1s ease" }}
                    />
                    <text
                      x="32"
                      y="36"
                      textAnchor="middle"
                      fill="#0f766e"
                      fontSize="12"
                      fontWeight="800"
                      fontFamily="monospace"
                    >
                      {wallet.walletHealthScore}
                    </text>
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-black text-teal-800 uppercase tracking-widest">
                      Wallet Health
                    </span>
                    <span className="text-xs font-black text-teal-900 bg-teal-100 border border-teal-200 px-2 py-0.5 rounded-full">
                      {wallet.walletHealthLabel}
                    </span>
                  </div>
                  <p className="text-slate-600 text-xs leading-relaxed max-w-sm">
                    {wallet.recommendation}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
                {[
                  { l: "Active Days", v: wallet.uniqueDays, c: "text-teal-800", bg: "bg-teal-50 border-teal-100" },
                  { l: "Months", v: wallet.activeMonths, c: "text-cyan-800", bg: "bg-cyan-50 border-cyan-100" },
                  {
                    l: "Streak",
                    v: `${wallet.currentStreak}d`,
                    c: "text-orange-800",
                    bg: "bg-orange-50 border-orange-100",
                  },
                ].map((s) => (
                  <div
                    key={s.l}
                    className={`${s.bg} border rounded-xl p-2.5 text-center`}
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

      {/* Score + heatmap — blue/value track, separate from health teal */}
      <div
        className={`rounded-3xl overflow-hidden border border-sky-200/80 bg-gradient-to-br ${tone.glow} via-[var(--surface)] to-white shadow-[0_14px_44px_rgba(37,99,235,0.1)]`}
      >
        <div
          className="h-1.5 w-full"
          style={{
            background: `linear-gradient(90deg, ${tone.ring}, #0d9488 55%, #2563eb)`,
          }}
        />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-6">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-800">
                  Onchain Score
                </span>
                <span
                  className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border ${tone.chip}`}
                >
                  {tone.label}
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
                      className="bg-white/80 hover:bg-sky-50 border border-sky-100 text-sky-800 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
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
                <span
                  className="text-7xl sm:text-8xl font-black tracking-tighter leading-none"
                  style={{
                    background: `linear-gradient(135deg, ${tone.ring} 0%, #0f172a 70%)`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {wallet.score}
                </span>
                <span className="text-2xl text-slate-400 font-black">/100</span>
              </div>
              <p className="text-[var(--ink)] font-black text-base mt-2 flex items-center gap-2 flex-wrap">
                {wallet.walletRank}
                {wallet.basename && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                    <BadgeCheck size={10} />
                    {wallet.basename}
                  </span>
                )}
              </p>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl">
                {[
                  {
                    l: "ETH Sent",
                    v: volumeSummary.ethSentLabel,
                    border: "border-slate-200",
                    bg: "bg-slate-50",
                    accent: "text-slate-800",
                  },
                  {
                    l: "Swap Volume",
                    v: volumeSummary.swapVolumeLabel,
                    border: "border-blue-200",
                    bg: "bg-blue-50",
                    accent: "text-blue-900",
                    icon: <TrendingUp size={10} />,
                  },
                  {
                    l: "ETH in Swaps",
                    v: volumeSummary.ethSwapLabel,
                    border: "border-emerald-200",
                    bg: "bg-emerald-50",
                    accent: "text-emerald-900",
                    icon: <Coins size={10} />,
                  },
                  {
                    l: "Swap Txs",
                    v: volumeSummary.swapTxLabel,
                    border: "border-violet-200",
                    bg: "bg-violet-50",
                    accent: "text-violet-900",
                  },
                ].map((card) => (
                  <div
                    key={card.l}
                    className={`${card.bg} border ${card.border} rounded-xl p-3`}
                  >
                    <p
                      className={`text-[9px] uppercase font-bold flex items-center gap-1 ${card.accent} opacity-80`}
                    >
                      {card.icon}
                      {card.l}
                    </p>
                    <p className={`text-sm font-black mt-1 ${card.accent}`}>{card.v}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-5 sm:gap-x-6 gap-y-1.5 max-w-lg">
                {Object.entries(wallet.scoreComponents).map(([k, v]) => {
                  const key = k as keyof typeof SCORE_MAX;
                  const val = Number(v);
                  const pct = Math.round((val / (SCORE_MAX[key] || 1)) * 100);
                  const bar = SCORE_BAR_COLORS[key] || "#2563eb";
                  return (
                    <div key={k} className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-slate-600 w-16 sm:w-[4.25rem] font-bold shrink-0">
                        {SCORE_LABELS[key] || k}
                      </span>
                      <div className="flex-1 min-w-0 bg-white/80 rounded-full h-2 overflow-hidden border border-slate-200/80">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: bar,
                            transition: "width 1.5s ease-out",
                          }}
                        />
                      </div>
                      <span className="text-[10px] w-5 text-right shrink-0 font-bold tabular-nums text-slate-700">
                        {Math.round(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="shrink-0">
              {selDay ? (
                <div className="bg-white border border-sky-200 rounded-2xl px-5 py-4 text-center shadow-sm">
                  <p className="text-[10px] text-sky-700/70 font-bold uppercase tracking-wide">
                    {selDay.date}
                  </p>
                  <p className="text-3xl font-black text-sky-900 mt-1">{selDay.count}</p>
                  <p className="text-[10px] text-sky-800/70 font-bold">transactions</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 opacity-70">
                  <MousePointerClick size={14} className="text-sky-700" />
                  <span className="text-[10px] text-sky-800 uppercase font-bold">
                    Click a cell
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-white/70 p-3 sm:p-4">
            <ActivityHeatmap
              dailyStats={wallet.dailyStats}
              selectedDay={selDay}
              onSelectDay={setSelDay}
              scrollRef={scrollRef}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
