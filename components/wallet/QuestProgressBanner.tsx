"use client";

import { Target, TrendingUp } from "lucide-react";
import { WEEKLY_QUESTS } from "@/lib/constants/season";

interface QuestProgressBannerProps {
  doneQuests: number;
  onGoQuests: () => void;
}

export default function QuestProgressBanner({ doneQuests, onGoQuests }: QuestProgressBannerProps) {
  if (doneQuests >= WEEKLY_QUESTS.length) return null;

  const pct = Math.round((doneQuests / WEEKLY_QUESTS.length) * 100);
  const launchSwapXp = WEEKLY_QUESTS.filter(
    (q) => q.id.startsWith("q_launch_") || q.id.startsWith("q_swap_")
  ).reduce((s, q) => s + q.xp, 0);

  return (
    <button
      type="button"
      onClick={onGoQuests}
      className="card w-full p-4 flex items-center gap-4 text-left hover:border-[var(--brand)] transition mb-4"
    >
      <div className="w-11 h-11 rounded-xl bg-[var(--brand-soft)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
        <TrendingUp size={20} className="text-[var(--brand-dark)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[var(--ink)] text-sm flex items-center gap-2">
          Weekly quests · {doneQuests}/{WEEKLY_QUESTS.length}
          <Target size={12} className="text-[var(--brand)] shrink-0" />
        </p>
        <p className="text-[10px] text-[var(--ink-muted)] mt-0.5">
          Launches and swaps earn the most XP — up to {launchSwapXp} from trading quests
        </p>
        <div className="w-full bg-[var(--surface-2)] rounded-full h-1.5 mt-2 overflow-hidden border border-[var(--border-subtle)]">
          <div className="progress-ink" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-xs font-black text-[var(--brand-dark)] shrink-0">{pct}%</span>
    </button>
  );
}
