"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { SEASON_NAME } from "@/lib/constants/season";
import {
  mintedCollectionPct,
  sumMintedBadges,
  totalAchievementTiers,
} from "@/lib/utils/achievements";
import {
  appBadgeCollectionPct,
  readAppBadgeLevels,
  sumAppBadges,
  totalAppBadgeTiers,
} from "@/lib/utils/app-badge-levels";

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

  useEffect(() => {
    setAppLevels(readAppBadgeLevels(wallet.address));
  }, [wallet.address]);

  const onchainMinted = sumMintedBadges(mintedLevels);
  const onchainTotal = totalAchievementTiers();
  const onchainPct = mintedCollectionPct(mintedLevels);

  const appClaimed = sumAppBadges(appLevels);
  const appTotal = totalAppBadgeTiers();
  const appPct = appBadgeCollectionPct(appLevels);

  return (
    <div className="page-hero mb-5 relative">
      <div className="accent-bar" />

      <div className="relative p-5 sm:p-6 grid sm:grid-cols-[1fr_auto] gap-4 items-center">
        <div>
          <p className="section-eyebrow flex items-center gap-2">
            <Sparkles size={12} /> Badge collection
          </p>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            App badges first
            <span className="text-slate-500 font-bold text-lg"> · then onchain</span>
          </h2>
          <p className="text-xs text-slate-500 mt-2 max-w-md leading-relaxed">
            {SEASON_NAME} · trade, stake, check in, and explore to unlock — no gas for app badges
          </p>
        </div>

        <div className="badge-orbit shrink-0 mx-auto sm:mx-0" aria-hidden>
          <div className="badge-orbit-ring" />
          <div className="badge-orbit-core flex flex-col items-center justify-center">
            <Sparkles size={16} className="text-white/60 mb-1" />
            <p className="text-2xl font-black text-white leading-none">{appClaimed}</p>
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
              of {appTotal} app
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/5 border-t border-white/8">
        {[
          { l: "App badges", v: `${appPct}%` },
          { l: "Onchain", v: `${onchainMinted}/${onchainTotal}` },
          { l: "Weekly XP", v: weeklyXP.toLocaleString() },
          { l: "Score", v: `${wallet.score}` },
        ].map((s) => (
          <div key={s.l} className="bg-[#080808] px-3 py-3 text-center">
            <p className="font-black text-base sm:text-lg text-white">{s.v}</p>
            <p className="text-[9px] text-slate-500 uppercase font-bold mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
