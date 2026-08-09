"use client";

import { motion, useReducedMotion } from "motion/react";
import { BarChart3, Flame, Gift, Rocket, Trophy } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";
import type { RewardsHubView } from "@/lib/utils/app-url";
import { isRewardsHubTab } from "@/lib/utils/app-url";
import { SECTION_THEME, accentForTab } from "@/lib/motion/presets";

interface TabBarProps {
  tab: AppTab;
  doneQuests: number;
  onTabChange: (tab: AppTab, opts?: { rewardsView?: RewardsHubView }) => void;
  guest?: boolean;
}

const TAB_ACCENT: Record<string, string> = {
  launchpad: SECTION_THEME.explore.accent,
  basehub: SECTION_THEME.vouchers.accent,
  dashboard: SECTION_THEME.analytics.accent,
  checkin: SECTION_THEME.rewards.accent,
  achievements: SECTION_THEME.badges.accent,
};

export default function TabBar({ tab, doneQuests, onTabChange, guest }: TabBarProps) {
  const reduce = useReducedMotion();
  const tabs = [
    {
      id: "launchpad" as const,
      icon: <Rocket size={14} />,
      label: "Explore",
      featured: true,
    },
    { id: "basehub" as const, icon: <Gift size={14} />, label: "Vouchers" },
    { id: "dashboard" as const, icon: <BarChart3 size={14} />, label: "Analytics" },
    {
      id: "checkin" as const,
      icon: <Flame size={14} />,
      label: `Quests & Rewards${doneQuests > 0 ? ` · ${doneQuests}` : ""}`,
    },
    { id: "achievements" as const, icon: <Trophy size={13} />, label: "Badges" },
  ];

  return (
    <div className="flex glass-panel p-1.5 rounded-2xl mb-4 overflow-x-auto gap-1 no-scrollbar touch-scroll-x shadow-lg shadow-black/20">
      {tabs.map((t) => {
        const active = tab === t.id || (t.id === "checkin" && isRewardsHubTab(tab));
        const accent = TAB_ACCENT[t.id] || SECTION_THEME.default.accent;
        const themeKey = accentForTab(t.id);
        const soft = SECTION_THEME[themeKey].soft;
        return (
          <motion.button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            whileHover={reduce ? undefined : { y: -1 }}
            whileTap={reduce ? undefined : { scale: 0.97 }}
            className={`relative flex items-center justify-center gap-1.5 py-2.5 px-3 sm:px-4 rounded-xl font-bold text-[11px] sm:text-xs whitespace-nowrap flex-1 transition-colors duration-200 ${
              active
                ? "text-[var(--ink)] shadow-sm"
                : guest && t.id !== "launchpad"
                  ? "text-slate-500 hover:text-slate-300 hover:bg-white/5 opacity-70"
                  : "text-slate-400 hover:text-[var(--ink)] hover:bg-[var(--bg-hover)]"
            } ${t.featured && !active ? "tab-featured" : ""}`}
            style={
              active
                ? {
                    color: accent,
                    background: soft,
                    boxShadow: `0 0 0 1px ${SECTION_THEME[themeKey].border}`,
                  }
                : undefined
            }
          >
            {active && !reduce && (
              <motion.span
                layoutId="main-tab-pill"
                className="absolute inset-0 rounded-xl -z-10"
                style={{
                  background: soft,
                  border: `1px solid ${SECTION_THEME[themeKey].border}`,
                }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {t.icon}
              <span>{t.label}</span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
