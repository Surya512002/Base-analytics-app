"use client";

import { Target, TrendingUp } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { WEEKLY_QUESTS } from "@/lib/constants/season";
import { SECTION_THEME } from "@/lib/motion/presets";

interface QuestProgressBannerProps {
  doneQuests: number;
  onGoQuests: () => void;
}

export default function QuestProgressBanner({
  doneQuests,
  onGoQuests,
}: QuestProgressBannerProps) {
  const reduce = useReducedMotion();
  if (doneQuests >= WEEKLY_QUESTS.length) return null;

  const pct = Math.round((doneQuests / WEEKLY_QUESTS.length) * 100);
  const launchSwapXp = WEEKLY_QUESTS.filter(
    (q) => q.id.startsWith("q_launch_") || q.id.startsWith("q_swap_")
  ).reduce((s, q) => s + q.xp, 0);
  const rewards = SECTION_THEME.rewards;

  return (
    <motion.button
      type="button"
      onClick={onGoQuests}
      whileHover={reduce ? undefined : { y: -2, scale: 1.01 }}
      whileTap={reduce ? undefined : { scale: 0.99 }}
      className="card w-full p-4 flex items-center gap-4 text-left transition mb-4 border"
      style={{
        borderColor: rewards.border,
        background: `linear-gradient(120deg, ${rewards.soft}, var(--surface) 70%)`,
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border"
        style={{ background: rewards.soft, borderColor: rewards.border }}
      >
        <TrendingUp size={20} style={{ color: rewards.accent }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[var(--ink)] text-sm flex items-center gap-2">
          Weekly quests · {doneQuests}/{WEEKLY_QUESTS.length}
          <Target size={12} className="text-orange-600 shrink-0" />
        </p>
        <p className="text-[10px] text-[var(--ink-muted)] mt-0.5">
          Launches and swaps earn the most XP — up to {launchSwapXp} from trading quests
        </p>
        <div className="w-full bg-white/70 rounded-full h-1.5 mt-2 overflow-hidden border border-orange-100">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
      <span className="text-xs font-black text-orange-800 shrink-0 tabular-nums">
        {pct}%
      </span>
    </motion.button>
  );
}
