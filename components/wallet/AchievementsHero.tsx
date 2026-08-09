"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { SEASON_NAME } from "@/lib/constants/season";
import {
  sumMintedBadges,
  totalAchievementTiers,
} from "@/lib/utils/achievements";
import {
  appBadgeCollectionPct,
  readAppBadgeLevels,
  sumAppBadges,
  totalAppBadgeTiers,
} from "@/lib/utils/app-badge-levels";
import { SECTION_THEME } from "@/lib/motion/presets";

interface AchievementsHeroProps {
  wallet: NonNullable<WalletAppState["wallet"]>;
  mintedLevels: Record<string, number>;
  weeklyXP: number;
}

export default function AchievementsHero({
  wallet,
  mintedLevels,
  weeklyXP,
}: AchievementsHeroProps) {
  const [appLevels, setAppLevels] = useState<Record<string, number>>({});
  const reduce = useReducedMotion();
  const badges = SECTION_THEME.badges;

  useEffect(() => {
    setAppLevels(readAppBadgeLevels(wallet.address));
  }, [wallet.address]);

  const onchainMinted = sumMintedBadges(mintedLevels);
  const onchainTotal = totalAchievementTiers();

  const appClaimed = sumAppBadges(appLevels);
  const appTotal = totalAppBadgeTiers();
  const appPct = appBadgeCollectionPct(appLevels);

  return (
    <motion.div
      className="page-hero mb-5 relative overflow-hidden !p-0 border"
      style={{
        borderColor: badges.border,
        background: `linear-gradient(145deg, ${badges.soft}, var(--surface) 50%)`,
      }}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className={`h-1 w-full bg-gradient-to-r ${badges.bar}`} />

      <div className="relative z-10 p-5 sm:p-6 grid sm:grid-cols-[1fr_auto] gap-5 items-center">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-800 flex items-center gap-2">
            <Sparkles size={12} className="shrink-0 text-violet-600" /> Badge collection
          </p>
          <h2 className="page-hero-title mt-2">
            App badges first
            <span className="text-[var(--ink-muted)] font-bold text-lg"> · then onchain</span>
          </h2>
          <p className="text-xs text-[var(--ink-muted)] mt-2 max-w-md leading-relaxed">
            {SEASON_NAME} · trade, check in, and explore to unlock — no gas for app badges
          </p>
        </div>

        <motion.div
          className="badge-orbit shrink-0 mx-auto sm:mx-0"
          title={`${appClaimed} of ${appTotal} app badges claimed`}
          animate={reduce ? undefined : { rotate: [0, 2, -2, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="badge-orbit-ring" aria-hidden />
          <div className="badge-orbit-core flex flex-col items-center justify-center text-center">
            <p className="text-2xl font-black text-violet-900 leading-none tabular-nums">
              {appClaimed}
            </p>
            <p className="text-[9px] font-bold text-violet-700/70 uppercase tracking-wide mt-1.5 leading-none">
              of {appTotal} app
            </p>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-violet-100/60 border-t border-violet-100">
        {[
          { l: "App badges", v: `${appPct}%`, c: "text-violet-800" },
          { l: "Onchain", v: `${onchainMinted}/${onchainTotal}`, c: "text-indigo-800" },
          { l: "Weekly XP", v: weeklyXP.toLocaleString(), c: "text-amber-800" },
          { l: "Score", v: `${wallet.score}`, c: "text-sky-800" },
        ].map((s, i) => (
          <motion.div
            key={s.l}
            className="bg-white/70 px-3 py-3 text-center"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
          >
            <p className={`font-black text-base sm:text-lg ${s.c}`}>{s.v}</p>
            <p className="text-[9px] text-[var(--ink-muted)] uppercase font-bold mt-0.5">{s.l}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
