"use client";

import { Target } from "lucide-react";
import { WEEKLY_QUESTS } from "@/lib/constants/season";
import type { AppTab } from "@/hooks/useWalletApp";

interface QuestProgressBannerProps {
  doneQuests: number;
  onGoQuests: () => void;
}

export default function QuestProgressBanner({ doneQuests, onGoQuests }: QuestProgressBannerProps) {
  if (doneQuests >= WEEKLY_QUESTS.length) return null;

  const pct = Math.round((doneQuests / WEEKLY_QUESTS.length) * 100);

  return (
    <button
      type="button"
      onClick={onGoQuests}
      className="w-full elegant-panel rounded-2xl border border-violet-500/25 p-4 flex items-center gap-4 text-left hover:border-violet-400/40 transition mb-4"
    >
      <div className="w-11 h-11 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
        <Target size={20} className="text-violet-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black text-white text-sm">Weekly quests · {doneQuests}/{WEEKLY_QUESTS.length}</p>
        <div className="w-full bg-white/5 rounded-full h-1.5 mt-2 overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-violet-500 to-champagne rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="text-xs font-black text-violet-300 shrink-0">{pct}%</span>
    </button>
  );
}
