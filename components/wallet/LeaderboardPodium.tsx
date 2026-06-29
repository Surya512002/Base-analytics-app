"use client";

import { Crown, Medal } from "lucide-react";
import { xpForEntry, type BoardMode } from "@/lib/utils/leaderboard";
import type { LeaderboardEntry } from "@/lib/types/leaderboard";

interface LeaderboardPodiumProps {
  entries: LeaderboardEntry[];
  mode: BoardMode;
  currentWeek: number;
  myAddress: string;
}

function shortName(e: LeaderboardEntry) {
  return e.basename || `${e.address.slice(0, 6)}…${e.address.slice(-4)}`;
}

export default function LeaderboardPodium({
  entries,
  mode,
  currentWeek,
  myAddress,
}: LeaderboardPodiumProps) {
  const [first, second, third] = entries;
  if (!first) return null;

  const slots = [
    { e: second, rank: 2, h: "h-24 sm:h-28", delay: "0.15s", medal: "🥈" },
    { e: first, rank: 1, h: "h-32 sm:h-36", delay: "0s", medal: "🥇", crown: true },
    { e: third, rank: 3, h: "h-20 sm:h-24", delay: "0.3s", medal: "🥉" },
  ];

  return (
    <div className="podium-3d rounded-3xl border border-violet-500/20 bg-white/[0.03] p-4 sm:p-6 mb-4 overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(139,92,246,0.12),transparent_60%)] pointer-events-none" />
      <p className="section-eyebrow text-center mb-4 relative">Top champions</p>

      <div className="flex items-end justify-center gap-2 sm:gap-4 relative">
        {slots.map((slot) => {
          if (!slot.e) {
            return (
              <div key={slot.rank} className="flex-1 max-w-[120px] opacity-30">
                <div className={`${slot.h} rounded-t-2xl border border-dashed border-white/10`} />
              </div>
            );
          }
          const isMe = slot.e.address.toLowerCase() === myAddress.toLowerCase();
          const xp = xpForEntry(slot.e, mode, currentWeek);

          return (
            <div
              key={slot.rank}
              className="flex-1 max-w-[130px] flex flex-col items-center podium-slot"
              style={{ animationDelay: slot.delay }}
            >
              {slot.crown ? (
                <Crown size={18} className="text-amber-400 mb-1 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              ) : (
                <Medal size={16} className="text-slate-500 mb-1" />
              )}
              <span className="text-xl sm:text-2xl mb-1">{slot.medal}</span>
              <p
                className={`text-[10px] sm:text-xs font-black text-center truncate w-full px-1 ${
                  isMe ? "text-cyan-300" : "text-white"
                }`}
              >
                {shortName(slot.e)}
              </p>
              <p className="text-[9px] text-violet-300/80 font-bold tabular-nums mt-0.5">
                {xp.toLocaleString()} XP
              </p>
              <div
                className={`w-full ${slot.h} mt-2 rounded-t-2xl border border-white/15 podium-block relative overflow-hidden`}
                style={{
                  background:
                    slot.rank === 1
                      ? "linear-gradient(180deg, rgba(251,191,36,0.25) 0%, rgba(139,92,246,0.15) 100%)"
                      : slot.rank === 2
                        ? "linear-gradient(180deg, rgba(148,163,184,0.2) 0%, rgba(59,130,246,0.1) 100%)"
                        : "linear-gradient(180deg, rgba(180,83,9,0.2) 0%, rgba(16,185,129,0.08) 100%)",
                }}
              >
                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/30 to-transparent" />
                <span className="absolute bottom-2 inset-x-0 text-center text-2xl sm:text-3xl font-black text-white/20">
                  #{slot.rank}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
