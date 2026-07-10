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
    <div className="glass-panel rounded-2xl p-4 sm:p-6 mb-4 overflow-hidden">
      <p className="section-eyebrow text-center mb-4">Top champions</p>

      <div className="flex items-end justify-center gap-2 sm:gap-4">
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
                <Crown size={18} className="text-[#e8c872] mb-1" />
              ) : (
                <Medal size={16} className="text-slate-500 mb-1" />
              )}
              <span className="text-xl sm:text-2xl mb-1">{slot.medal}</span>
              <p
                className={`text-[10px] sm:text-xs font-black text-center truncate w-full px-1 ${
                  isMe ? "text-white" : "text-slate-300"
                }`}
              >
                {shortName(slot.e)}
              </p>
              <p className="text-[9px] text-slate-500 font-bold tabular-nums mt-0.5">
                {xp.toLocaleString()} XP
              </p>
              <div
                className={`w-full ${slot.h} mt-2 rounded-t-2xl border border-white/10 relative overflow-hidden`}
                style={{
                  background:
                    slot.rank === 1
                      ? "linear-gradient(180deg, rgba(232,200,114,0.14) 0%, rgba(255,255,255,0.04) 100%)"
                      : slot.rank === 2
                        ? "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)"
                        : "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                }}
              >
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-black text-white/80">
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
