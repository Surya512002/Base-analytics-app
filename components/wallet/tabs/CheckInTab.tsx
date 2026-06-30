"use client";

import { ChevronRight, Droplets, Flame, RefreshCcw, Rocket, Target, Zap } from "lucide-react";
import { WEEKLY_QUESTS } from "@/lib/constants/season";
import {
  CHECK_IN_TRACK_DAYS,
  dailyRewardPP,
  getTrackDayStatuses,
  rewardDayForToday,
  streakBoostPercent,
  trackProgressLabel,
} from "@/lib/utils/check-in-rewards";
import {
  DAILY_POINTS_CAP,
  POINTS_PER_BOOST,
  POINTS_PER_GM,
  POINTS_PER_GN,
  SEVEN_DAY_ALL_TASKS_BONUS,
} from "@/lib/utils/daily-points";
import { computeXPBreakdown } from "@/lib/utils/season";
import type { WalletAppState } from "@/hooks/useWalletApp";

const TAB_LABELS: Record<string, string> = {
  checkin: "Check-In",
  achievements: "Badges",
  basehub: "Vouchers",
  dashboard: "Analytics",
};

export default function CheckInTab({ app }: { app: WalletAppState }) {
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
    referralBonusXp,
  } = app;

  if (!wallet || !questContext) return null;

  const rewardDay = rewardDayForToday(streak, checkedToday);
  const boostPct = checkedToday
    ? streakBoostPercent(Math.min(streak, CHECK_IN_TRACK_DAYS) || 1)
    : streakBoostPercent(rewardDay);
  const dailyPP = dailyRewardPP(rewardDay);
  const trackDays = getTrackDayStatuses(streak, checkedToday);
  const xp = computeXPBreakdown(questContext, boosts);
  void pointsRevision;
  const dailyPct = Math.min(
    100,
    Math.round((xp.todayActivityXp / xp.dailyCap) * 100)
  );
  const questPct = Math.round((doneQuests / WEEKLY_QUESTS.length) * 100);

  return (
    <div className="w-full space-y-4 tab-content-enter">
      {/* Daily actions — top */}
      <div className="glass-panel rounded-2xl border border-white/8 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-white/8">
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
            Daily actions
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
                      ? `${streak}d streak · ${checkedToday ? "done today" : "gas sponsored"}`
                      : "Start Day 1 — 50 PP"}
                  </p>
                </div>
                <span className="text-[11px] font-black text-emerald-400 shrink-0 tabular-nums">
                  +{checkedToday ? dailyRewardPP(Math.min(streak, CHECK_IN_TRACK_DAYS) || 1) : dailyPP} PP
                </span>
              </div>
              <button
                type="button"
                onClick={() => doNativeTx("checkin")}
                disabled={checkedToday || minting === "checkin"}
                className={`w-full py-3 rounded-xl font-black text-sm transition-colors active:scale-[0.99] mt-auto ${
                  checkedToday
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 cursor-default"
                    : "bg-linear-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 hover:opacity-95"
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
                className="flex flex-col items-center justify-center gap-1.5 min-h-[6.75rem] rounded-xl font-black text-sm btn-primary text-white active:scale-95 disabled:opacity-50"
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
                  className="flex flex-col items-center justify-center gap-1.5 min-h-[6.75rem] rounded-xl font-black text-sm btn-primary text-white active:scale-95 disabled:opacity-50"
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
              {xp.dailyRemaining} PP left · {boosts} boosts
            </span>
          </div>
        </div>
      </div>

      {/* Daily cap + 7-day track — compact */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="glass-panel rounded-xl p-3.5 border border-white/8">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              Daily cap
            </p>
            {xp.todayBonusXp > 0 && (
              <span className="text-[9px] font-black text-amber-300">+{xp.todayBonusXp} bonus</span>
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

        <div className="glass-panel rounded-xl border border-white/8 overflow-hidden">
          <div className="px-3.5 py-2 border-b border-white/8 flex items-center justify-between">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              {CHECK_IN_TRACK_DAYS} day track
            </p>
            <span className="text-[10px] font-black text-cyan-400 tabular-nums">
              {trackProgressLabel(streak, checkedToday)}
            </span>
          </div>
          <div className="p-2.5 grid grid-cols-7 gap-1.5">
            {trackDays.map((status, i) => {
              const day = i + 1;
              const isToday = status === "today";
              const isDone = status === "done";
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
                >
                  <span
                    className={`text-[8px] font-black uppercase ${
                      isToday ? "text-cyan-300" : isDone ? "text-emerald-400/80" : "text-slate-600"
                    }`}
                  >
                    D{day}
                  </span>
                  {isDone && <span className="text-[10px] leading-none">✓</span>}
                  {isToday && <Flame size={11} className="text-cyan-400" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Weekly quests */}
      <div className="glass-panel rounded-2xl border border-violet-500/20 overflow-hidden flex flex-col">
          <div className="px-5 sm:px-6 py-3.5 border-b border-white/8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-cyan-400" />
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                Weekly quests
              </p>
            </div>
            <div className="flex items-center gap-3 min-w-[150px]">
              <div className="flex-1 h-2 bg-white/8 rounded-full overflow-hidden min-w-[88px]">
                <div
                  className="h-full bg-linear-to-r from-violet-500 to-cyan-400 rounded-full transition-[width] duration-500"
                  style={{ width: `${questPct}%` }}
                />
              </div>
              <span className="text-sm font-black text-cyan-400 tabular-nums shrink-0">
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
                    className={`rounded-xl p-3.5 border flex flex-col gap-2.5 min-h-[6.5rem] ${
                      done
                        ? "bg-cyan-500/10 border-cyan-500/25"
                        : "bg-white/[0.04] border-white/10 hover:border-cyan-500/25"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="text-xl shrink-0 leading-none">
                        {done ? "✅" : q.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-black leading-snug ${
                            done ? "text-slate-400 line-through" : "text-white"
                          }`}
                        >
                          {q.title}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{q.desc}</p>
                      </div>
                      <span
                        className={`text-xs font-black shrink-0 tabular-nums ${
                          done ? "text-cyan-400" : "text-slate-500"
                        }`}
                      >
                        +{q.xp}
                      </span>
                    </div>
                    {!done && q.tab && q.tab !== "checkin" && (
                      <button
                        type="button"
                        onClick={() => setTab(q.tab!)}
                        className="flex items-center justify-between w-full text-[11px] font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-500/8 border border-cyan-500/15 rounded-lg px-3 py-2 transition-colors"
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
                <p className="text-[11px] font-bold text-amber-300 mt-3 text-center">
                  7-day streak + all quests — +{SEVEN_DAY_ALL_TASKS_BONUS} bonus PP
                </p>
              )}
          </div>
        </div>

      <div className="glass-panel-accent rounded-2xl p-4 sm:p-5 border border-white/8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Zap size={18} className="text-amber-400 shrink-0" />
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Your weekly score
            </p>
            <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none mt-0.5">
              {weeklyXP} XP
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 flex-1 min-w-[200px] max-w-2xl">
          {[
            { l: "Quest XP", v: xp.questXp },
            { l: "Activity", v: xp.weekActivityXp },
            { l: "Today", v: xp.todayActivityXp + xp.todayBonusXp },
            ...(referralBonusXp > 0
              ? [{ l: "Referral", v: referralBonusXp }]
              : []),
          ].map((row) => (
            <div
              key={row.l}
              className="bg-white/[0.04] border border-white/8 rounded-xl py-2 px-1 text-center"
            >
              <p className="text-sm font-black text-cyan-300 tabular-nums">{row.v}</p>
              <p className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">{row.l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
