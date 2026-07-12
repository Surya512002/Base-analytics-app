"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Droplets, Flame, RefreshCcw, Rocket, Target, Trophy } from "lucide-react";
import CheckInRankings from "@/components/wallet/CheckInRankings";
import { WEEKLY_QUESTS } from "@/lib/constants/season";
import { resolveQuestHighlightFromUrl } from "@/lib/utils/app-url";
import {
  CHECK_IN_TRACK_DAYS,
  capStreakProgressLabel,
  getCapStreakTrackStatuses,
  streakBoostPercent,
  weeklyStreakBonusPP,
} from "@/lib/utils/check-in-rewards";
import {
  DAILY_POINTS_CAP,
  getCapStreakUIState,
  POINTS_PER_BOOST,
  POINTS_PER_CHECKIN,
  POINTS_PER_GM,
  POINTS_PER_GN,
  POINTS_PER_LAUNCH,
  POINTS_PER_TOKEN_SWAP,
  SEVEN_DAY_ALL_TASKS_BONUS,
  TARGET_TXS_IDEAL,
  TARGET_TXS_MIN,
} from "@/lib/utils/daily-points";
import { computeXPBreakdown } from "@/lib/utils/season";
import type { WalletAppState } from "@/hooks/useWalletApp";

const TAB_LABELS: Record<string, string> = {
  launchpad: "Launchpad",
  checkin: "Check-In",
  achievements: "Badges",
  basehub: "Vouchers",
  dashboard: "Analytics",
};

export default function CheckInTab({
  app,
  embedded = false,
}: {
  app: WalletAppState;
  embedded?: boolean;
}) {
  const {
    wallet,
    streak,
    checkedToday,
    minting,
    boosts,
    questContext,
    doNativeTx,
    pointsRevision,
    doneQuests,
    setTab,
    weeklyXP,
  } = app;

  const [highlightQuest] = useState<string | null>(() => resolveQuestHighlightFromUrl());
  const questRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!highlightQuest) return;
    const t = setTimeout(() => {
      questRefs.current[highlightQuest]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
    return () => clearTimeout(t);
  }, [highlightQuest]);

  const xp = useMemo(
    () => (questContext ? computeXPBreakdown(questContext, boosts) : null),
    [questContext, boosts, pointsRevision]
  );

  if (!wallet || !questContext || !xp) return null;

  const boostPct = streakBoostPercent(
    Math.min(Math.max(streak, 1), CHECK_IN_TRACK_DAYS)
  );
  const capStreak = getCapStreakUIState(wallet.address);
  const trackDays = getCapStreakTrackStatuses(
    capStreak.nextAwardDay,
    capStreak.capBonusAwardedToday
  );
  const dailyPct = Math.min(
    100,
    Math.round((xp.todayActivityXp / xp.dailyCap) * 100)
  );
  const txPct = Math.min(
    100,
    Math.round((xp.todayTxCount / TARGET_TXS_IDEAL) * 100)
  );
  const questPct = Math.round((doneQuests / WEEKLY_QUESTS.length) * 100);

  return (
    <div className={`w-full space-y-4 ${embedded ? "" : "tab-content-enter"}`}>
      {!embedded && (
      <div className="glass-panel rounded-2xl border border-white/8 overflow-hidden">
        <div className="h-0.5 bg-linear-to-r from-emerald-500 via-amber-400 to-cyan-400" />
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Trophy size={11} className="text-amber-400" />
              Daily progress & live standings
            </p>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1 leading-tight">
              Check-In <span className="text-cyan-400">&</span> Rankings
            </h2>
            <p className="text-xs text-slate-500 mt-1.5">
              Launches and swaps earn the most XP — then check in, quest & rank.
            </p>
          </div>
          <div className="shrink-0 sm:text-right bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              Your weekly XP
            </p>
            <p className="text-3xl font-black text-cyan-300 tabular-nums leading-none mt-0.5">
              {weeklyXP}
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Daily actions — top */}
      <div className="glass-panel rounded-2xl border border-white/8 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-white/8">
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
            Daily actions
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            Launch +{POINTS_PER_LAUNCH} PP · Swap +{POINTS_PER_TOKEN_SWAP} PP each · check-in, boost, GM &amp; GN fill the daily cap
          </p>
        </div>
        <div className="p-4 sm:p-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 flex flex-col gap-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black text-white flex items-center gap-1.5">
                    <Flame size={15} className="text-emerald-400 shrink-0" />
                    Check-in
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {streak > 0
                      ? `${streak}d on-chain streak · ${checkedToday ? "done today" : "gas sponsored"}`
                      : "Onchain check-in · gas sponsored"}
                  </p>
                </div>
                <span className="text-[11px] font-black text-emerald-400 shrink-0 tabular-nums">
                  +{POINTS_PER_CHECKIN}
                </span>
              </div>
              <button
                type="button"
                onClick={() => doNativeTx("checkin")}
                disabled={checkedToday || minting === "checkin"}
                className={`w-full py-3 rounded-xl font-black text-sm transition-colors active:scale-[0.99] mt-auto ${
                  checkedToday
                    ? "bg-white/[0.04] text-slate-400 border border-white/10 cursor-default"
                    : "btn-primary"
                }`}
              >
                {minting === "checkin" ? (
                  <RefreshCcw className="animate-spin mx-auto" size={18} />
                ) : checkedToday ? (
                  "✓ Secured Today"
                ) : (
                  "Check in"
                )}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => doNativeTx("boost")}
                disabled={minting === "boost"}
                className="flex flex-col items-center justify-center gap-1.5 min-h-[6.75rem] rounded-xl font-black text-sm btn-primary active:scale-95 disabled:opacity-50"
              >
                {minting === "boost" ? (
                  <RefreshCcw className="animate-spin" size={18} />
                ) : (
                  <>
                    <Rocket size={20} />
                    <span>Boost</span>
                    <span className="text-[10px] font-bold opacity-90">+{POINTS_PER_BOOST}</span>
                  </>
                )}
              </button>
              {(["gm", "gn"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => doNativeTx(type)}
                  disabled={minting === type}
                  className="flex flex-col items-center justify-center gap-1.5 min-h-[6.75rem] rounded-xl font-black text-sm btn-primary active:scale-95 disabled:opacity-50"
                >
                  {minting === type ? (
                    <RefreshCcw className="animate-spin" size={18} />
                  ) : (
                    <>
                      <span className="text-xl">{type === "gm" ? "☀️" : "🌙"}</span>
                      <span>{type === "gm" ? "GM" : "GN"}</span>
                      <span className="text-[10px] font-bold opacity-90">
                        +{type === "gm" ? POINTS_PER_GM : POINTS_PER_GN}
                      </span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
            <span className="font-black text-cyan-400 tabular-nums">+{boostPct}% quest boost</span>
            <span className="flex items-center gap-1.5">
              <Droplets size={9} className="text-cyan-400" />
              {xp.dailyRemaining > 0 ? (
                <>
                  {xp.dailyRemaining} PP to cap
                  {!capStreak.capBonusAwardedToday && (
                    <span className="text-amber-300/90">
                      · +{capStreak.nextBonusPP} weekly at cap
                    </span>
                  )}
                </>
              ) : (
                <span className="text-amber-300/90">
                  Daily cap reached — txs still count; PP resume tomorrow UTC
                </span>
              )}
              {capStreak.capBonusAwardedToday && (
                <span className="text-emerald-400">· cap bonus earned</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Daily cap + 7-day track — compact */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="glass-panel rounded-xl p-3.5 border border-white/8 space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                Daily activity
              </p>
              {xp.todayStreakXp > 0 && (
                <span className="text-[9px] font-black text-amber-300">
                  +{xp.todayStreakXp} streak
                </span>
              )}
            </div>
            <p className="text-sm font-black text-white tabular-nums mb-2">
              {xp.todayActivityXp} / {DAILY_POINTS_CAP} PP
            </p>
            <div className="w-full bg-white/8 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-emerald-500 to-cyan-400 rounded-full transition-[width] duration-500"
                style={{ width: `${dailyPct}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                In-app txs today
              </p>
              <span
                className={`text-[9px] font-black tabular-nums ${
                  xp.todayTxCount >= TARGET_TXS_MIN ? "text-emerald-400" : "text-slate-500"
                }`}
              >
                aim {TARGET_TXS_MIN}–{TARGET_TXS_IDEAL}
              </span>
            </div>
            <p className="text-sm font-black text-white tabular-nums mb-2">
              {xp.todayTxCount} txs
            </p>
            <div className="w-full bg-white/8 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-violet-500 to-cyan-400 rounded-full transition-[width] duration-500"
                style={{ width: `${txPct}%` }}
              />
            </div>
          </div>
          {xp.todayBonusXp > 0 && (
            <p className="text-[9px] font-bold text-amber-300">
              +{xp.todayBonusXp} weekly bonus PP
            </p>
          )}
        </div>

        <div className="glass-panel rounded-xl border border-white/8 overflow-hidden">
          <div className="px-3.5 py-2 border-b border-white/8 flex items-center justify-between">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              {CHECK_IN_TRACK_DAYS}-day weekly bonus
            </p>
            <span className="text-[10px] font-black text-cyan-400 tabular-nums">
              {capStreakProgressLabel(
                capStreak.nextAwardDay,
                capStreak.capBonusAwardedToday
              )}
            </span>
          </div>
          <div className="p-2.5 grid grid-cols-7 gap-1.5">
            {trackDays.map((status, i) => {
              const day = i + 1;
              const isToday = status === "today";
              const isDone = status === "done";
              const dayPP = weeklyStreakBonusPP(day);
              return (
                <div
                  key={day}
                  className={`aspect-square max-h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 border transition-colors ${
                    isToday
                      ? "border-cyan-400/60 bg-cyan-500/10"
                      : isDone
                        ? "border-emerald-500/30 bg-emerald-500/8"
                        : "border-white/8 bg-white/[0.03]"
                  }`}
                  title={`Day ${day}: +${dayPP} weekly PP`}
                >
                  <span
                    className={`text-[8px] font-black uppercase ${
                      isToday ? "text-cyan-300" : isDone ? "text-emerald-400/80" : "text-slate-600"
                    }`}
                  >
                    D{day}
                  </span>
                  <span className="text-[7px] font-bold text-slate-500 tabular-nums">{dayPP}</span>
                  {isDone && <span className="text-[10px] leading-none">✓</span>}
                  {isToday && <Flame size={11} className="text-cyan-400" />}
                </div>
              );
            })}
          </div>
          <p className="px-3.5 pb-2.5 text-[9px] text-slate-500">
            Hit {DAILY_POINTS_CAP} PP daily · D1 = 10 → D7 = 100 weekly (resets after day 7)
          </p>
        </div>
      </div>

      {/* Weekly quests */}
      <div className="glass-panel rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 sm:px-6 py-3.5 border-b border-white/8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-white/60" />
              <p className="section-eyebrow">Weekly quests</p>
              <p className="text-[10px] text-slate-600 hidden sm:inline">· Launch & swap quests</p>
            </div>
            <div className="flex items-center gap-3 min-w-[150px]">
              <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden min-w-[88px]">
                <div
                  className="progress-ink"
                  style={{ width: `${questPct}%` }}
                />
              </div>
              <span className="text-sm font-black text-white tabular-nums shrink-0">
                {doneQuests}/{WEEKLY_QUESTS.length}
              </span>
            </div>
          </div>
          <div className="p-5 sm:p-6 flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 h-full content-start">
              {WEEKLY_QUESTS.map((q) => {
                const done = q.check(questContext);
                return (
                  <div
                    key={q.id}
                    ref={(el) => {
                      questRefs.current[q.id] = el;
                    }}
                    className={`rounded-xl p-3.5 flex flex-col gap-2.5 min-h-[6.5rem] transition-shadow ${
                      done ? "quest-card quest-card-done" : "quest-card"
                    } ${
                      highlightQuest === q.id
                        ? "ring-2 ring-cyan-400/70 shadow-lg shadow-cyan-500/20"
                        : ""
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="text-xl shrink-0 leading-none">
                        {done ? "✅" : q.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-black leading-snug ${
                            done ? "text-slate-500 line-through" : "text-white"
                          }`}
                        >
                          {q.title}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{q.desc}</p>
                      </div>
                      <span
                        className={`text-xs font-black shrink-0 tabular-nums ${
                          done ? "text-slate-500" : "text-white/70"
                        }`}
                      >
                        +{q.xp}
                      </span>
                    </div>
                    {!done && q.tab && (
                      <button
                        type="button"
                        onClick={() => setTab(q.tab!)}
                        className="flex items-center justify-between w-full text-[11px] font-bold text-[#080808] bg-[#f5f5f4] hover:bg-white rounded-lg px-3 py-2 transition-colors"
                      >
                        <span>Go to {TAB_LABELS[q.tab] ?? q.tab}</span>
                        <ChevronRight size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {streak >= CHECK_IN_TRACK_DAYS &&
              doneQuests === WEEKLY_QUESTS.length && (
                <p className="text-[11px] font-semibold text-slate-400 mt-3 text-center">
                  7-day streak + all quests — +{SEVEN_DAY_ALL_TASKS_BONUS} weekly bonus PP
                </p>
              )}
          </div>
        </div>

      <CheckInRankings app={app} embedded />
    </div>
  );
}
