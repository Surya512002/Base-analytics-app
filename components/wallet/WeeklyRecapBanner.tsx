"use client";

import { Trophy, Flame } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { SECTION_THEME } from "@/lib/motion/presets";

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
  const reduce = useReducedMotion();
  const rewards = SECTION_THEME.rewards;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border px-4 py-3 flex flex-wrap items-center gap-4 justify-between shadow-[var(--shadow-card)] overflow-hidden relative"
      style={{
        borderColor: rewards.border,
        background: `linear-gradient(135deg, ${rewards.soft}, var(--surface) 55%)`,
      }}
    >
      <div
        className={`absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r ${rewards.bar}`}
        aria-hidden
      />
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-800/70">
          This week
        </p>
        <p className="text-sm font-bold text-[var(--ink)] mt-0.5">
          <span className="text-orange-700 tabular-nums">{weeklyXP} XP</span>
          {rankLabel ? ` · ${rankLabel}` : ""}
        </p>
      </div>
      <div className="flex gap-4 text-center">
        <motion.div whileHover={reduce ? undefined : { scale: 1.05 }}>
          <p className="text-lg font-black text-amber-800 flex items-center justify-center gap-1">
            <Trophy size={14} className="text-amber-500" />
            {doneQuests}/{totalQuests}
          </p>
          <p className="text-[9px] uppercase text-amber-900/60 font-bold">Quests</p>
        </motion.div>
        <motion.div
          whileHover={reduce ? undefined : { scale: 1.05 }}
          animate={
            streak > 0 && !reduce
              ? { scale: [1, 1.04, 1] }
              : undefined
          }
          transition={{ duration: 2.2, repeat: Infinity }}
        >
          <p className="text-lg font-black text-orange-800 flex items-center justify-center gap-1">
            <Flame size={14} className="text-orange-500" />
            {streak}
          </p>
          <p className="text-[9px] uppercase text-orange-900/60 font-bold">Streak</p>
        </motion.div>
      </div>
    </motion.div>
  );
}
