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
      className="w-full elegant-panel rounded-2xl p-4 flex items-center gap-4 text-left hover:bg-white/[0.02] transition mb-4"
    >
      <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
        <TrendingUp size={20} className="text-white/60" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black text-white text-sm flex items-center gap-2">
          Weekly quests · {doneQuests}/{WEEKLY_QUESTS.length}
          <Target size={12} className="text-white/40 shrink-0" />
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">
          Launches and swaps earn the most XP — up to {launchSwapXp} from trading quests
        </p>
        <div className="w-full bg-white/5 rounded-full h-1.5 mt-2 overflow-hidden">
          <div className="progress-ink" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-xs font-black text-white shrink-0">{pct}%</span>
    </button>
  );
}
