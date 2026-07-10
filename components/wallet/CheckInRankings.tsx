"use client";

import { useState } from "react";
import {
  Calendar,
  Globe,
  RefreshCcw,
  Trophy,
  Users,
  Wifi,
} from "lucide-react";
import { computeXPBreakdown, getDaysLeft } from "@/lib/utils/season";
import { getISOWeekNumber } from "@/lib/utils/dates";
import {
  findRank,
  participationCount,
  topEntries,
  xpForEntry,
  type BoardMode,
} from "@/lib/utils/leaderboard";
import LeaderboardPodium from "@/components/wallet/LeaderboardPodium";
import type { WalletAppState } from "@/hooks/useWalletApp";

const TOP_N = 50;

function LeaderboardTable({
  entries,
  mode,
  myAddress,
  participationCount: totalParticipants,
  currentWeek,
}: {
  entries: ReturnType<typeof topEntries>;
  mode: BoardMode;
  myAddress: string;
  participationCount: number;
  currentWeek: number;
}) {
  const xpLabel = mode === "weekly" ? "Weekly XP" : "Season XP";

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
        <Users size={24} className="text-slate-600 mx-auto mb-2" />
        <p className="font-black text-slate-500 text-sm">No rankings yet</p>
        <p className="text-xs text-slate-600 mt-1">Launch tokens, swap, and complete quests to climb the board.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-white/8 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold text-slate-500">
          Top{" "}
          <span className="text-white font-black">{Math.min(TOP_N, entries.length)}</span> of{" "}
          <span className="text-white font-black">{totalParticipants.toLocaleString()}</span>{" "}
          {mode === "weekly" ? "this week" : "season"}
        </p>
      </div>
      <div className="px-3 sm:px-4 py-2 border-b border-white/8">
        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_4.25rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_4rem_5.5rem] gap-x-2 sm:gap-x-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">
          <span>Rank</span>
          <span>Wallet</span>
          <span className="hidden sm:block text-right">Badges</span>
          <span className="text-right">{xpLabel}</span>
        </div>
      </div>
      {entries.map((e, idx) => {
        const isMe = e.address.toLowerCase() === myAddress.toLowerCase();
        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
        const xp = xpForEntry(e, mode, currentWeek);

        return (
          <div
            key={`${mode}-${e.address}`}
            className={`grid grid-cols-[2.25rem_minmax(0,1fr)_4.25rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_4rem_5.5rem] gap-x-2 sm:gap-x-3 items-center px-3 sm:px-4 py-2.5 border-b border-white/6 last:border-0 ${
              isMe ? "rank-you" : "hover:bg-white/[0.03]"
            }`}
          >
            <div className="shrink-0">
              {medal ? (
                <span className="text-base">{medal}</span>
              ) : (
                <span className="text-[11px] font-black text-slate-500">#{idx + 1}</span>
              )}
            </div>
            <div className="min-w-0">
              <p
                className={`font-black text-[11px] sm:text-sm truncate ${
                  isMe ? "text-white" : "text-slate-200"
                }`}
              >
                {e.basename || `${e.address.slice(0, 8)}...${e.address.slice(-4)}`}
                {isMe && (
                  <span className="text-[8px] text-slate-400 ml-1 font-bold">you</span>
                )}
              </p>
            </div>
            <div className="hidden sm:block text-right text-xs font-black text-slate-500">
              {e.badges}
            </div>
            <div className="text-right shrink-0 tabular-nums">
              <p className={`text-xs sm:text-sm font-black ${isMe ? "text-white" : "text-slate-300"}`}>
                {xp.toLocaleString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CheckInRankings({
  app,
  embedded = false,
}: {
  app: WalletAppState;
  embedded?: boolean;
}) {
  const {
    wallet,
    weeklyXP,
    mintedCount,
    streak,
    boosts,
    questContext,
    leaderboard,
    lbLoading,
    referralBonusXp,
  } = app;
  const [mode, setMode] = useState<BoardMode>("weekly");
  const currentWeek = getISOWeekNumber();
  const xpBreakdown = questContext ? computeXPBreakdown(questContext, boosts) : null;

  const weeklyCount = participationCount(leaderboard, "weekly", currentWeek);
  const globalCount = participationCount(leaderboard, "global", currentWeek);
  const activeCount = mode === "weekly" ? weeklyCount : globalCount;

  const activeTop = topEntries(leaderboard, mode, TOP_N, currentWeek);

  const myRank = wallet ? findRank(leaderboard, wallet.address, mode, currentWeek) : -1;
  const inTop50 = myRank >= 0 && myRank < TOP_N;
  const myEntry = wallet
    ? leaderboard.find((e) => e.address.toLowerCase() === wallet.address.toLowerCase())
    : undefined;
  const mySeasonXp = (myEntry?.totalXP ?? xpBreakdown?.seasonTotal ?? 0) + referralBonusXp;
  const myDisplayXp = mode === "weekly" ? weeklyXP : mySeasonXp;

  if (!wallet) return null;

  return (
    <div className={embedded ? "space-y-4" : "glass-panel rounded-2xl overflow-hidden"}>
      {!embedded && <div className="accent-bar" />}
      <div
        className={
          embedded
            ? "flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2"
            : "p-4 sm:p-5 border-b border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        }
      >
        <div>
          {embedded ? (
            <>
              <p className="section-eyebrow flex items-center gap-1.5">
                <Trophy size={12} />
                Rankings
              </p>
              <h3 className="text-lg sm:text-xl font-black text-white mt-1">
                Weekly & season leaderboard
              </h3>
            </>
          ) : (
            <>
              <p className="section-eyebrow flex items-center gap-1.5">
                <Trophy size={12} />
                Rankings
              </p>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                Quest & activity leaderboard
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                {mode === "weekly"
                  ? "Ranked by weekly XP — launches, swaps, quests, check-in streak, and daily activity."
                  : "Season standings include all weekly XP plus badge mint rewards (+25 XP per badge)."}
              </p>
            </>
          )}
        </div>
        <div className="flex gap-1 glass-panel p-1 rounded-xl shrink-0">
          {(
            [
              ["weekly", "Weekly", Calendar],
              ["global", "Season", Globe],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors ${
                mode === id ? "tab-active" : "text-slate-400 hover:text-white hover:bg-white/8"
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={
          embedded
            ? "glass-panel rounded-2xl overflow-hidden p-4 sm:p-5 space-y-4"
            : "p-4 sm:p-5 space-y-4"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-2xl font-black text-white tabular-nums">
              {activeCount.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-500">
              {mode === "weekly"
                ? "Participants this week"
                : "Total season participants"}
            </p>
          </div>
          <span className="editorial-badge">
            <Wifi size={9} />
            Live · {getDaysLeft()}d left
          </span>
        </div>

        {myRank >= 0 && (
          <div className="glass-panel rounded-2xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 sm:w-[3.3rem] sm:h-[3.3rem] rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center font-black text-white text-base sm:text-lg shrink-0">
                  #{myRank + 1}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-white text-base sm:text-lg truncate">
                    {wallet.basename ||
                      `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`}
                  </p>
                  {!inTop50 && (
                    <p className="text-xs text-slate-500 font-semibold mt-1">
                      Outside top {TOP_N} — keep completing quests!
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-500 uppercase font-bold">
                  {mode === "weekly" ? "Your weekly XP" : "Your season XP"}
                </p>
                <p className="text-3xl sm:text-[2.2rem] font-black text-white tabular-nums leading-none mt-0.5">
                  {myDisplayXp}
                </p>
              </div>
            </div>
            {xpBreakdown && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-4">
                {[
                  { l: "Quest XP", v: xpBreakdown.questXp },
                  { l: "Activity", v: xpBreakdown.weekActivityXp },
                  { l: "Streak", v: xpBreakdown.weekStreakXp },
                  ...(mode === "global"
                    ? [{ l: "Badge XP", v: xpBreakdown.badgeMintXp }]
                    : []),
                  {
                    l: "Today",
                    v:
                      xpBreakdown.todayActivityXp +
                      xpBreakdown.todayStreakXp +
                      xpBreakdown.todayBonusXp,
                  },
                  ...(referralBonusXp > 0
                    ? [{ l: "Referral", v: referralBonusXp }]
                    : []),
                ].map((s) => (
                  <div key={s.l} className="editorial-stat text-center py-2.5">
                    <p className="text-sm sm:text-base font-black text-white tabular-nums">{s.v}</p>
                    <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-bold mt-1">{s.l}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 mt-3">
              {[
                { l: "Score", v: `${wallet.score}/100` },
                { l: "Badges", v: String(mintedCount) },
                { l: "Streak", v: `${streak}d` },
              ].map((s) => (
                <div key={s.l} className="editorial-stat text-center py-2.5">
                  <p className="text-sm sm:text-base font-black text-white">{s.v}</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-bold mt-1">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {lbLoading ? (
          <div className="py-12 text-center">
            <RefreshCcw className="animate-spin text-white/50 mx-auto mb-2" size={22} />
            <p className="text-xs text-slate-500 font-bold">Loading rankings…</p>
          </div>
        ) : (
          <>
            {activeTop.length >= 1 && (
              <LeaderboardPodium
                entries={activeTop}
                mode={mode}
                currentWeek={currentWeek}
                myAddress={wallet.address}
              />
            )}
            <LeaderboardTable
              entries={activeTop}
              mode={mode}
              myAddress={wallet.address}
              participationCount={activeCount}
              currentWeek={currentWeek}
            />
          </>
        )}
      </div>
    </div>
  );
}
