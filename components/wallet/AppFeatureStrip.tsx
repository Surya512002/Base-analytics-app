"use client";

import { BarChart3, Gift, Rocket, Zap } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { AppTab } from "@/hooks/useWalletApp";
import { SECTION_THEME } from "@/lib/motion/presets";

const STRIP: {
  icon: React.ReactNode;
  label: string;
  tab?: AppTab;
  core?: boolean;
  accent: keyof typeof SECTION_THEME;
}[] = [
  {
    icon: <Rocket size={13} />,
    label: "Launchpad",
    tab: "launchpad",
    core: true,
    accent: "explore",
  },
  {
    icon: <Zap size={13} />,
    label: "Quests & XP",
    tab: "checkin",
    accent: "rewards",
  },
  {
    icon: <Gift size={13} />,
    label: "Base Voucher",
    tab: "basehub",
    accent: "vouchers",
  },
  {
    icon: <BarChart3 size={13} />,
    label: "Wallet Analytics",
    tab: "dashboard",
    accent: "analytics",
  },
];

interface AppFeatureStripProps {
  onNavigate?: (tab: AppTab) => void;
}

export default function AppFeatureStrip({ onNavigate }: AppFeatureStripProps) {
  const reduce = useReducedMotion();

  return (
    <div className="mb-4 flex flex-wrap gap-2 items-center">
      <motion.div
        className="inline-flex items-center gap-2 badge-live rounded-full px-3 py-1.5 border border-emerald-200 bg-emerald-50/80"
        animate={reduce ? undefined : { scale: [1, 1.02, 1] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      >
        <motion.div
          className="w-1.5 h-1.5 rounded-full bg-emerald-500"
          animate={reduce ? undefined : { opacity: [0.4, 1, 0.4], scale: [1, 1.3, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-800">
          B20 launchpad live
        </span>
      </motion.div>
      {STRIP.map((s, i) => {
        const theme = SECTION_THEME[s.accent];
        return (
          <motion.button
            key={s.label}
            type="button"
            onClick={() => s.tab && onNavigate?.(s.tab)}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.35 }}
            whileHover={reduce ? undefined : { y: -2, scale: 1.03 }}
            whileTap={reduce ? undefined : { scale: 0.97 }}
            className="rounded-full px-3 py-1.5 flex items-center gap-1.5 border transition shadow-sm"
            style={{
              borderColor: theme.border,
              background: theme.soft,
              color: theme.accent,
            }}
          >
            {s.icon}
            <span className="text-[9px] font-black uppercase tracking-wide opacity-90">
              {s.label}
            </span>
            {s.core && (
              <span className="text-[8px] font-black uppercase tracking-wider opacity-75">
                Core
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
