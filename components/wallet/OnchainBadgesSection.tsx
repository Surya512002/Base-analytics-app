"use client";

import { RefreshCcw, Trophy } from "lucide-react";
import { ACHIEVEMENTS } from "@/lib/constants/season";
import { XP_PER_BADGE_MINT } from "@/lib/utils/badge-mint-xp";
import { getLevelStyle, getTargetTokenId } from "@/lib/utils/achievements";
import StaggerIn from "@/components/ui/StaggerIn";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { Lock } from "lucide-react";

export default function OnchainBadgesSection({
  app,
  getCatValue,
}: {
  app: WalletAppState;
  getCatValue: (id: string) => number;
}) {
  const { wallet, minting, mintedLevels, doNativeMint } = app;
  if (!wallet) return null;

  return (
    <div className="space-y-4">
      <div>
        <p className="section-eyebrow flex items-center gap-2 mb-1">
          <Trophy size={12} /> Onchain score badges
        </p>
        <p className="text-xs text-[var(--ink-muted)] max-w-2xl">
          Mint soulbound badges from your Base wallet score and onchain history. One-tap mint when a
          tier is unlocked.
        </p>
      </div>

      <StaggerIn className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {ACHIEVEMENTS.map((cat) => {
          const value = getCatValue(cat.id);
          let unlocked = 0;
          for (let i = 0; i < cat.thresholds.length; i++) {
            if (value >= cat.thresholds[i]) unlocked = i + 1;
          }
          const mintedTier = mintedLevels[cat.id] || 0;
          const canMint = unlocked > mintedTier;
          const nextThr =
            unlocked < cat.thresholds.length
              ? cat.thresholds[unlocked]
              : cat.thresholds[cat.thresholds.length - 1];
          const prog =
            unlocked === cat.thresholds.length
              ? 100
              : Math.min(100, (value / nextThr) * 100);
          const toMint: number[] = [];
          const toLevels: number[] = [];
          for (let i = mintedTier + 1; i <= unlocked; i++) {
            toLevels.push(i);
            toMint.push(getTargetTokenId(cat.baseId, cat.thresholds.length, i));
          }
          const isBatch = toMint.length > 1;
          let btnText = `${cat.tierNames[mintedTier] || "..."} Locked`;
          if (mintedTier === cat.thresholds.length) btnText = "Fully minted";
          else if (canMint)
            btnText = isBatch
              ? `Mint ${toMint.length} badges`
              : `Mint ${cat.tierNames[mintedTier]}`;

          return (
            <div
              key={cat.id}
              className="stagger-child quest-card p-4 sm:p-5 flex flex-col"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-xl flex items-center justify-center text-xl shrink-0">
                    {cat.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[var(--ink)] text-sm truncate">{cat.name}</p>
                    <p className="text-[10px] text-[var(--ink-muted)] uppercase font-bold mt-0.5">
                      L{unlocked}/{cat.thresholds.length}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-lg font-black text-[var(--ink)]">
                    {typeof value === "number" && value < 1
                      ? value.toFixed(3)
                      : value.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-[var(--ink-muted)] uppercase">{cat.unit}</p>
                </div>
              </div>

              <div className="w-full bg-[var(--surface-2)] rounded-full h-1.5 mb-4 overflow-hidden">
                <div
                  className="h-full bg-[var(--brand)] rounded-full transition-all duration-700"
                  style={{ width: `${prog}%` }}
                />
              </div>

              <div
                className={`flex ${cat.thresholds.length === 1 ? "justify-center" : "justify-between"} items-end mb-4`}
              >
                {cat.thresholds.map((_, idx) => {
                  const tier = idx + 1;
                  const isEarned = unlocked >= tier;
                  const isMinted = mintedTier >= tier;
                  const style = getLevelStyle(
                    cat.thresholds.length === 1 ? 5 : tier,
                    isMinted,
                    isEarned
                  );
                  return (
                    <div
                      key={tier}
                      className="flex flex-col items-center gap-1 relative"
                      style={{ width: `${Math.floor(100 / cat.thresholds.length)}%` }}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all ${style}`}
                      >
                        {isEarned ? (
                          cat.tierIcons[idx]
                        ) : (
                          <Lock size={11} className="text-white/20" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => doNativeMint(cat.id, toLevels, toMint, cat.name)}
                disabled={!canMint || minting === `mint-${cat.id}`}
                className={`mt-auto w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                  canMint && minting !== `mint-${cat.id}`
                    ? "btn-primary text-white"
                    : "bg-[var(--surface-2)] text-[var(--ink-dim)] cursor-not-allowed border border-[var(--border-subtle)]"
                }`}
              >
                {minting === `mint-${cat.id}` ? (
                  <RefreshCcw className="animate-spin mx-auto" size={16} />
                ) : (
                  btnText
                )}
              </button>
              {canMint && (
                <p className="text-[9px] text-[var(--ink-dim)] mt-2 text-center">
                  +{XP_PER_BADGE_MINT} season XP per mint
                </p>
              )}
            </div>
          );
        })}
      </StaggerIn>
    </div>
  );
}
