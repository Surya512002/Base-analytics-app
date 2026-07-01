"use client";

import { ChevronRight, Zap, Star } from "lucide-react";
import { SEASON_NAME, WEEKLY_QUESTS } from "@/lib/constants/season";
import {
  DAILY_POINTS_CAP,
  POINTS_PER_CHECKIN,
  POINTS_PER_BOOST,
  SEVEN_DAY_ALL_TASKS_BONUS,
  TARGET_TXS_IDEAL,
  TARGET_TXS_MIN,
} from "@/lib/utils/daily-points";
import { CHECK_IN_TRACK_DAYS, BASE_STREAK_PP } from "@/lib/utils/check-in-rewards";
import { getDaysLeft, getSeasonPct } from "@/lib/utils/season";
import type { WalletAppState } from "@/hooks/useWalletApp";

const TAB_LABELS: Record<string, string> = {
  checkin: "Check-In",
  achievements: "Badges",
  basehub: "Vouchers",
  dashboard: "Analytics",
};

export default function QuestsTab({ app }: { app: WalletAppState }) {
  const { wallet, weeklyXP, doneQuests, questContext, setTab, streak } = app;

  if (!wallet || !questContext) return null;

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden bg-linear-to-br from-rose-600 via-cyan-500 to-[#071220] rounded-3xl p-5 sm:p-7 border border-cyan-500/30 shadow-2xl shadow-black/40">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.1) 1px,transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/5 rounded-full" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Star size={14} className="text-cyan-200" />
              <span className="text-xs font-black uppercase tracking-widest text-white/60">
                {SEASON_NAME}
              </span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white">Weekly Quests</h3>
            <p className="text-sm text-white/60 mt-0.5">
              Complete tasks inside Base Analytics · {getDaysLeft()} days left
            </p>
            <div className="mt-4 w-full sm:max-w-xs">
              <div className="flex justify-between text-[10px] text-white/50 font-bold mb-1.5">
                <span>Season progress</span>
                <span>{getSeasonPct()}%</span>
              </div>
              <div className="w-full bg-white/15 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full"
                  style={{ width: `${getSeasonPct()}%`, transition: "width 1.5s ease-out" }}
                />
              </div>
            </div>
          </div>
          <div className="sm:text-right shrink-0">
            <p className="text-5xl sm:text-6xl font-black text-white leading-none">{weeklyXP}</p>
            <p className="text-sm text-white/60 uppercase font-bold">This Week XP</p>
            <div className="mt-3 flex sm:justify-end gap-2 flex-wrap">
              <span className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 text-xs font-black text-white">
                {doneQuests}/{WEEKLY_QUESTS.length} in-app quests
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {WEEKLY_QUESTS.map((q) => {
          const done = q.check(questContext);
          return (
            <div
              key={q.id}
              className={`rounded-2xl p-4 border flex flex-col gap-3 transition-all ${
                done
                  ? "bg-cyan-500/8 border-cyan-500/20"
                  : "bg-white/[0.04] border-cyan-500/15 hover:border-cyan-500/20"
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                    done
                      ? "bg-cyan-500/12 border border-cyan-500/20"
                      : "bg-white/5 border border-white/10"
                  }`}
                >
                  {done ? "✅" : q.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-white text-sm">{q.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{q.desc}</p>
                </div>
                <span
                  className={`text-xs font-black shrink-0 ${
                    done ? "text-cyan-400" : "text-slate-500"
                  }`}
                >
                  +{q.xp} XP
                </span>
              </div>
              {!done && q.tab && (
                <button
                  type="button"
                  onClick={() => setTab(q.tab!)}
                  className="flex items-center justify-between w-full text-left text-[11px] font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-500/8 border border-cyan-500/15 rounded-xl px-3 py-2 transition-colors"
                >
                  <span>Go to {TAB_LABELS[q.tab] ?? q.tab}</span>
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {streak >= CHECK_IN_TRACK_DAYS &&
        doneQuests === WEEKLY_QUESTS.length && (
          <div className="rounded-2xl p-4 border border-amber-500/25 bg-amber-500/8 text-center">
            <p className="text-sm font-black text-amber-200">
              7-day streak + all quests complete!
            </p>
            <p className="text-xs text-amber-200/70 mt-1">
              +{SEVEN_DAY_ALL_TASKS_BONUS} weekly bonus PP
            </p>
          </div>
        )}

      <div className="glass-panel-accent rounded-2xl p-5">
        <p className="font-black text-white mb-4 flex items-center gap-2">
          <Zap size={15} className="text-cyan-400" />
          How quest XP works
        </p>
        <div className="space-y-2">
          {[
            { l: "In-app only", b: "Quests unlock when you act inside this app" },
            {
              l: "Daily activity cap",
              b: `${DAILY_POINTS_CAP} PP/day — check-in ${POINTS_PER_CHECKIN}, boost ${POINTS_PER_BOOST}, GM/GN 10 each`,
            },
            {
              l: "Weekly cap streak",
              b: `Hit daily cap ${CHECK_IN_TRACK_DAYS} days in a row → ${BASE_STREAK_PP}→100 weekly PP (resets after D7)`,
            },
            { l: "Daily txs target", b: `${TARGET_TXS_MIN}–${TARGET_TXS_IDEAL} in-app txs/day helps reach the cap` },
            { l: "7-day check-in streak", b: `+60% quest XP · +${SEVEN_DAY_ALL_TASKS_BONUS} weekly bonus when all quests done` },
            { l: "Weekly XP resets Mon", b: "Past weeks carry to Total Season XP" },
          ].map((m, i) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row sm:items-center justify-between bg-white/[0.03] rounded-xl p-3 border border-white/8 gap-2"
            >
              <span className="text-xs text-slate-200/70">{m.l}</span>
              <span className="text-xs font-black text-cyan-400 sm:text-right shrink-0">{m.b}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
