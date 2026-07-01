"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Globe,
  RefreshCcw,
  Trophy,
  Users,
  Wifi,
} from "lucide-react";
import { computeXPBreakdown, getDaysLeft } from "@/lib/utils/season";
import { getISOWeekNumber } from "@/lib/utils/dates";
import {
  effectiveWeeklyXP,
  findRank,
  participationCount,
  topEntries,
  xpForEntry,
  type BoardMode,
} from "@/lib/utils/leaderboard";
import LeaderboardPodium from "@/components/wallet/LeaderboardPodium";
import StaggerIn from "@/components/ui/StaggerIn";
import type { WalletAppState } from "@/hooks/useWalletApp";

const TOP_N = 50;

interface LeaderboardTableProps {
  entries: ReturnType<typeof topEntries>;
  mode: BoardMode;
  myAddress: string;
  participationCount: number;
  currentWeek: number;
}

function LeaderboardTable({
  entries,
  mode,
  myAddress,
  participationCount: totalParticipants,
  currentWeek,
}: LeaderboardTableProps) {
  const xpLabel = mode === "weekly" ? "Weekly XP" : "Season XP";

  if (entries.length === 0) {
    return (
      <div className="bg-white/[0.04] border-2 border-dashed border-white/10 rounded-3xl p-12 text-center">
        <Users size={28} className="text-slate-700 mx-auto mb-3" />
        <p className="font-black text-slate-600 mb-1">No entries yet</p>
        <p className="text-xs text-slate-700">Be the first! Connect your wallet and earn XP.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel-accent rounded-3xl overflow-hidden shadow-lg shadow-black/25">
      <div className="px-4 py-3 border-b border-white/8 bg-white/[0.03] flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold text-slate-500">
          Showing top <span className="text-cyan-400 font-black">{Math.min(TOP_N, entries.length)}</span> of{" "}
          <span className="text-white font-black">{totalParticipants.toLocaleString()}</span>{" "}
          {mode === "weekly" ? "active this week" : "season participants"}
        </p>
      </div>
      <div className="px-3 sm:px-4 py-3 border-b border-white/8 bg-white/[0.03]">
        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_4.25rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_4rem_5.5rem_2rem] gap-x-2 sm:gap-x-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">
          <span>Rank</span>
          <span>Wallet</span>
          <span className="hidden sm:block text-right">Badges</span>
          <span className="text-right">{xpLabel}</span>
          <span className="hidden sm:block" />
        </div>
      </div>
      {entries.map((e, idx) => {
        const isMe = e.address.toLowerCase() === myAddress.toLowerCase();
        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
        const xp = xpForEntry(e, mode, currentWeek);

        return (
          <div
            key={`${mode}-${e.address}`}
            className={`grid grid-cols-[2.25rem_minmax(0,1fr)_4.25rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_4rem_5.5rem_2rem] gap-x-2 sm:gap-x-3 items-center px-3 sm:px-4 py-3 border-b border-white/6 last:border-0 transition-all ${
              isMe
                ? "bg-cyan-500/8 border-l-2 border-l-rose-500"
                : "hover:bg-white/[0.03]"
            }`}
          >
            <div className="shrink-0">
              {medal ? (
                <span className="text-base sm:text-lg">{medal}</span>
              ) : (
                <span
                  className={`text-[11px] sm:text-xs font-black ${
                    idx < 10 ? "text-cyan-300/60" : "text-slate-600"
                  }`}
                >
                  #{idx + 1}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p
                className={`font-black text-[11px] sm:text-sm leading-snug break-all sm:truncate ${
                  isMe ? "text-cyan-400" : "text-white"
                }`}
              >
                {e.basename || `${e.address.slice(0, 8)}...${e.address.slice(-4)}`}
                {isMe && (
                  <span className="text-[8px] sm:text-[9px] text-rose-400/60 ml-1.5 font-bold bg-cyan-500/10 px-1 py-0.5 rounded align-middle">
                    you
                  </span>
                )}
              </p>
              <p className="text-[8px] sm:text-[9px] text-slate-500 font-bold mt-0.5 truncate">
                {e.rank}
              </p>
            </div>
            <div className="hidden sm:block text-right">
              <p className="text-xs font-black text-cyan-300/60">{e.badges}</p>
              <p className="text-[8px] text-slate-600 font-bold">badges</p>
            </div>
            <div className="text-right shrink-0 tabular-nums">
              <p
                className={`text-xs sm:text-base font-black leading-none ${
                  isMe ? "text-cyan-400" : "text-white"
                }`}
              >
                {xp.toLocaleString()}
              </p>
              {mode === "global" && (
                <p className="text-[8px] sm:text-[9px] text-cyan-400/50 font-bold mt-0.5">
                  +{effectiveWeeklyXP(e, currentWeek)} wk
                </p>
              )}
            </div>
            <div className="hidden sm:flex justify-center">
              {idx === 0 ? (
                <ChevronUp size={12} className="text-cyan-400" />
              ) : (
                <ChevronDown size={12} className="text-slate-700" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LeaderboardTab({ app }: { app: WalletAppState }) {
  const {
    wallet,
    weeklyXP,
    mintedCount,
    streak,
    boosts,
    questContext,
    leaderboard,
    lbLoading,
  } = app;
  const [mode, setMode] = useState<BoardMode>("weekly");
  const currentWeek = getISOWeekNumber();
  const xpBreakdown = questContext ? computeXPBreakdown(questContext, boosts) : null;

  const weeklyCount = participationCount(leaderboard, "weekly", currentWeek);
  const globalCount = participationCount(leaderboard, "global", currentWeek);
  const activeParticipationCount = mode === "weekly" ? weeklyCount : globalCount;

  const weeklyTop = useMemo(
    () => topEntries(leaderboard, "weekly", TOP_N, currentWeek),
    [leaderboard, currentWeek]
  );
  const globalTop = useMemo(
    () => topEntries(leaderboard, "global", TOP_N, currentWeek),
    [leaderboard, currentWeek]
  );

  const activeTop = mode === "weekly" ? weeklyTop : globalTop;
  const myRank = wallet ? findRank(leaderboard, wallet.address, mode, currentWeek) : -1;
  const myEntry =
    myRank >= 0
      ? topEntries(leaderboard, mode, leaderboard.length, currentWeek)[myRank]
      : null;
  const inTop50 = myRank >= 0 && myRank < TOP_N;

  if (!wallet) return null;

  return (
    <div className="space-y-4 tab-content-enter">
      <div className="glass-panel rounded-3xl overflow-hidden border border-violet-500/20 card-shimmer">
        <div className="h-0.5 bg-linear-to-r from-amber-400 via-violet-500 to-cyan-400" />
        <div className="p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="section-eyebrow">Season rankings</p>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
              Climb the <span className="text-gradient-prism">leaderboard</span>
            </h2>
            <p className="text-xs text-slate-400 mt-2 max-w-sm">
              Rankings combine quest XP, check-in streak, XP boosts, and GM/GN. Top {TOP_N} shown live.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Trophy size={28} className="text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]" />
          </div>
        </div>
      </div>

      <div className="flex gap-1 glass-panel p-1 rounded-2xl">
        {(
          [
            ["weekly", "Weekly", Calendar],
            ["global", "Global", Globe],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition ${
              mode === id ? "tab-active" : "text-slate-400 hover:text-white hover:bg-white/8"
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <div className="glass-panel rounded-3xl overflow-hidden shadow-xl shadow-black/25">
        <div className="h-0.5 bg-linear-to-r from-rose-500 via-cyan-400 to-blue-600" />
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black text-cyan-400/50 uppercase tracking-widest flex items-center gap-2 mb-1">
                {mode === "weekly" ? <Calendar size={11} /> : <Globe size={11} />}
                {mode === "weekly" ? "Weekly Leaderboard" : "Global Leaderboard"}
              </p>
              <p className="text-2xl font-black text-white">
                {activeParticipationCount.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {mode === "weekly"
                  ? `Active this week · top ${TOP_N} shown`
                  : `Total season participants · top ${TOP_N} shown`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/18 px-2.5 sm:px-3 py-1.5 rounded-xl whitespace-nowrap">
                <Wifi size={9} />
                Live · Redis
              </span>
              <span className="text-[10px] text-slate-500 bg-white/[0.04] border border-white/8 px-3 py-1.5 rounded-xl flex items-center gap-1">
                <Trophy size={10} className="text-cyan-400" />
                {getDaysLeft()}d left
              </span>
            </div>
          </div>
        </div>
      </div>

      {myRank >= 0 && myEntry && (
        <div className="glass-panel-accent border border-cyan-500/20 rounded-3xl overflow-hidden shadow-xl shadow-black/25">
          <div className="h-0.5 bg-linear-to-r from-rose-500 to-cyan-400" />
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 sm:w-12 sm:h-12 bg-cyan-500/15 border border-cyan-500/30 rounded-2xl flex items-center justify-center font-black text-cyan-400 text-base sm:text-lg shrink-0">
                  #{myRank + 1}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-white text-sm sm:text-base break-all sm:truncate">
                    {wallet.basename ||
                      `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`}
                  </p>
                  <span className="inline-block text-[10px] font-black text-cyan-300 bg-cyan-500/10 border border-cyan-500/15 px-2 py-0.5 rounded-lg mt-1">
                    {wallet.walletRank}
                  </span>
                  {!inTop50 && (
                    <p className="text-[10px] text-amber-400/90 font-bold mt-1.5">
                      Outside top {TOP_N} — keep earning XP to climb!
                    </p>
                  )}
                </div>
              </div>
              <div className="sm:text-right shrink-0">
                <p className="text-[10px] font-black text-cyan-400/50 uppercase tracking-widest mb-1">
                  {mode === "weekly" ? "Your Weekly XP" : "Your Season XP"}
                </p>
                <p className="text-2xl sm:text-4xl font-black text-white tabular-nums leading-none">
                  {mode === "weekly"
                    ? weeklyXP.toLocaleString()
                    : xpForEntry(myEntry, mode, currentWeek).toLocaleString()}
                </p>
                {mode === "global" && (
                  <p className="text-[11px] text-cyan-400 font-bold mt-1.5 whitespace-nowrap">
                    +{weeklyXP} XP this week
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
              {[
                { l: "XP", v: xpBreakdown?.questXp ?? 0, c: "text-cyan-400" },
                { l: "Activity", v: xpBreakdown?.weekActivityXp ?? 0, c: "text-violet-300" },
                { l: "Streak", v: xpBreakdown?.weekStreakXp ?? 0, c: "text-amber-300" },
                {
                  l: "Today",
                  v:
                    (xpBreakdown?.todayActivityXp ?? 0) +
                    (xpBreakdown?.todayStreakXp ?? 0) +
                    (xpBreakdown?.todayBonusXp ?? 0),
                  c: "text-emerald-400",
                },
              ].map((s, i) => (
                <div
                  key={i}
                  className="bg-white/[0.04] border border-white/8 rounded-xl p-2.5 text-center"
                >
                  <p className={`font-black text-base tabular-nums ${s.c}`}>{s.v}</p>
                  <p className="text-[9px] text-slate-500 uppercase font-bold mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[
                { l: "Score", v: `${wallet.score}/100`, c: "text-cyan-400" },
                { l: "Badges", v: String(mintedCount), c: "text-cyan-300" },
                { l: "Streak", v: `${streak}d`, c: "text-cyan-400" },
              ].map((s, i) => (
                <div
                  key={i}
                  className="bg-white/[0.04] border border-white/8 rounded-xl p-2.5 text-center"
                >
                  <p className={`font-black text-base ${s.c}`}>{s.v}</p>
                  <p className="text-[9px] text-slate-500 uppercase font-bold mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {lbLoading ? (
        <div className="glass-panel-accent rounded-3xl p-12 text-center">
          <RefreshCcw className="animate-spin text-rose-400 mx-auto mb-3" size={24} />
          <p className="text-cyan-400/50 font-bold text-sm">Loading rankings...</p>
        </div>
      ) : (
        <StaggerIn>
          {!lbLoading && activeTop.length >= 1 && (
            <div className="stagger-child">
              <LeaderboardPodium
                entries={activeTop}
                mode={mode}
                currentWeek={currentWeek}
                myAddress={wallet.address}
              />
            </div>
          )}
          <div className="stagger-child">
            <LeaderboardTable
              entries={activeTop}
              mode={mode}
              myAddress={wallet.address}
              participationCount={activeParticipationCount}
              currentWeek={currentWeek}
            />
          </div>
        </StaggerIn>
      )}
    </div>
  );
}
