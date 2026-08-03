"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
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

  const appClaimed = sumAppBadges(appLevels);
  const appTotal = totalAppBadgeTiers();
  const appPct = appBadgeCollectionPct(appLevels);

  return (
    <div className="page-hero mb-5 relative overflow-hidden !p-0">
      <div className="accent-bar" />

      <div className="relative z-10 p-5 sm:p-6 grid sm:grid-cols-[1fr_auto] gap-5 items-center">
        <div className="min-w-0">
          <p className="section-eyebrow flex items-center gap-2">
            <Sparkles size={12} className="shrink-0" /> Badge collection
          </p>
          <h2 className="page-hero-title mt-2">
            App badges first
            <span className="text-[var(--ink-muted)] font-bold text-lg"> · then onchain</span>
          </h2>
          <p className="text-xs text-[var(--ink-muted)] mt-2 max-w-md leading-relaxed">
            {SEASON_NAME} · trade, stake, check in, and explore to unlock — no gas for app badges
          </p>
        </div>

        <div
          className="badge-orbit shrink-0 mx-auto sm:mx-0"
          title={`${appClaimed} of ${appTotal} app badges claimed`}
        >
          <div className="badge-orbit-ring" aria-hidden />
          <div className="badge-orbit-core flex flex-col items-center justify-center text-center">
            <p className="text-2xl font-black text-[var(--ink)] leading-none tabular-nums">
              {appClaimed}
            </p>
            <p className="text-[9px] font-bold text-[var(--ink-muted)] uppercase tracking-wide mt-1.5 leading-none">
              of {appTotal} app
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
        {[
          { l: "App badges", v: `${appPct}%` },
          { l: "Onchain", v: `${onchainMinted}/${onchainTotal}` },
          { l: "Weekly XP", v: weeklyXP.toLocaleString() },
          { l: "Score", v: `${wallet.score}` },
        ].map((s) => (
          <div key={s.l} className="bg-[var(--surface-2)] px-3 py-3 text-center">
            <p className="font-black text-base sm:text-lg text-[var(--ink)]">{s.v}</p>
            <p className="text-[9px] text-[var(--ink-muted)] uppercase font-bold mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
