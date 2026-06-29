"use client";

import { Sparkles, Trophy } from "lucide-react";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { SEASON_NAME } from "@/lib/constants/season";
import {
  mintedCollectionPct,
  sumMintedBadges,
  totalAchievementTiers,
} from "@/lib/utils/achievements";
import { getDaysLeft, getSeasonPct } from "@/lib/utils/season";

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
  const totalMinted = sumMintedBadges(mintedLevels);
  const totalTiers = totalAchievementTiers();
  const pct = mintedCollectionPct(mintedLevels);

  return (
    <div className="achievements-hero rounded-3xl border border-amber-500/25 overflow-hidden mb-5 relative">
      <div className="h-0.5 bg-linear-to-r from-amber-400 via-violet-500 to-cyan-400" />
      <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative p-5 sm:p-6 grid sm:grid-cols-[1fr_auto] gap-4 items-center">
        <div>
          <p className="section-eyebrow text-amber-300 flex items-center gap-2">
            <Trophy size={12} /> Onchain Identity
          </p>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Mint your <span className="text-gradient-prism">Base Badges</span>
          </h2>
          <p className="text-xs text-slate-400 mt-2 max-w-md leading-relaxed">
            {SEASON_NAME} · {getDaysLeft()} days left · {getSeasonPct()}% through season
          </p>
        </div>

        <div className="badge-orbit shrink-0 mx-auto sm:mx-0" aria-hidden>
          <div className="badge-orbit-ring" />
          <div className="badge-orbit-core flex flex-col items-center justify-center">
            <Sparkles size={16} className="text-amber-400 mb-1" />
            <p className="text-2xl font-black text-white leading-none">{totalMinted}</p>
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
              of {totalTiers} minted
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-white/5 border-t border-white/8">
        {[
          { l: "Score", v: `${wallet.score}`, c: "text-cyan-300" },
          { l: "Weekly XP", v: weeklyXP.toLocaleString(), c: "text-violet-300" },
          { l: "Collection", v: `${pct}%`, c: "text-amber-300" },
        ].map((s) => (
          <div key={s.l} className="bg-[#040a14]/80 px-3 py-3 text-center">
            <p className={`font-black text-base sm:text-lg ${s.c}`}>{s.v}</p>
            <p className="text-[9px] text-slate-500 uppercase font-bold mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
