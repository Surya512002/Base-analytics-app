"use client";

import { Trophy, Flame } from "lucide-react";

export default function WeeklyRecapBanner({
  weeklyXP,
  doneQuests,
  totalQuests,
  streak,
  rankLabel,
}: {
  weeklyXP: number;
  doneQuests: number;
  totalQuests: number;
  streak: number;
  rankLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 flex flex-wrap items-center gap-4 justify-between shadow-[var(--shadow-card)]">
      <div>
        <p className="section-eyebrow">This week</p>
        <p className="text-sm font-bold text-[var(--ink)] mt-0.5">
          <span className="text-[var(--brand-dark)]">{weeklyXP} XP</span>
          {rankLabel ? ` · ${rankLabel}` : ""}
        </p>
      </div>
      <div className="flex gap-4 text-center">
        <div>
          <p className="text-lg font-black text-[var(--ink)] flex items-center justify-center gap-1">
            <Trophy size={14} className="text-amber-500" />
            {doneQuests}/{totalQuests}
          </p>
          <p className="text-[9px] uppercase text-[var(--ink-muted)] font-bold">Quests</p>
        </div>
        <div>
          <p className="text-lg font-black text-[var(--ink)] flex items-center justify-center gap-1">
            <Flame size={14} className="text-orange-500" />
            {streak}
          </p>
          <p className="text-[9px] uppercase text-[var(--ink-muted)] font-bold">Streak</p>
        </div>
      </div>
    </div>
  );
}
