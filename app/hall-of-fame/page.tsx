"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Crown, Trophy } from "lucide-react";
import AppLogo from "@/components/ui/AppLogo";
import { APP_URL_WEB } from "@/lib/constants/env";
import { SEASON_NAME } from "@/lib/constants/season";
import type { LeaderboardEntry } from "@/lib/types/leaderboard";

export default function HallOfFamePage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => setEntries((d.leaderboard ?? []).slice(0, 10)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#03080f] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-aurora pointer-events-none" />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        <Link href={APP_URL_WEB} className="flex items-center gap-2 mb-10">
          <AppLogo size="md" />
          <span className="font-black tracking-widest uppercase text-sm">Base Analytics</span>
        </Link>

        <div className="elegant-panel rounded-3xl border border-champagne/30 overflow-hidden">
          <div className="h-0.5 bg-linear-to-r from-champagne via-amber-400 to-violet-500" />
          <div className="p-6 sm:p-8">
            <p className="section-eyebrow text-champagne flex items-center gap-2">
              <Trophy size={12} /> {SEASON_NAME}
            </p>
            <h1 className="text-3xl font-black text-white mt-2">Hall of Fame</h1>
            <p className="text-sm text-slate-400 mt-2">Top 10 season champions by total XP.</p>

            {loading ? (
              <p className="text-slate-500 mt-8 animate-pulse">Loading rankings…</p>
            ) : entries.length === 0 ? (
              <p className="text-slate-500 mt-8">No entries yet — be the first legend.</p>
            ) : (
              <ol className="mt-8 space-y-3">
                {entries.map((e, i) => (
                  <li
                    key={e.address}
                    className="flex items-center gap-4 rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3 podium-slot"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    <span className="text-2xl w-8 text-center">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-white truncate">
                        {e.basename || `${e.address.slice(0, 8)}…${e.address.slice(-4)}`}
                      </p>
                      <p className="text-[10px] text-slate-500">{e.rank}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-champagne">{(e.totalXP ?? e.weeklyXP ?? 0).toLocaleString()}</p>
                      <p className="text-[9px] text-slate-500 uppercase">XP</p>
                    </div>
                    {i === 0 && <Crown size={18} className="text-champagne shrink-0" />}
                  </li>
                ))}
              </ol>
            )}

            <p className="text-xs text-slate-500 mt-8 text-center">
              Genesis badge rewards for top 10 — announced at season end.
            </p>
            <Link
              href={`${APP_URL_WEB}/?tab=rankings`}
              className="block text-center mt-4 text-sm font-black text-violet-400 hover:underline"
            >
              View Rankings →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
