"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, RefreshCcw, Sparkles } from "lucide-react";
import {
  APP_BADGE_SECTIONS,
  XP_PER_APP_BADGE_CLAIM,
  type AppBadgeCategory,
} from "@/lib/constants/app-badges";
import { getLevelStyle } from "@/lib/utils/achievements";
import {
  buildAppBadgeMetrics,
  readAppBadgeLevels,
  recordAppBadgeClaims,
  sumAppBadges,
  totalAppBadgeTiers,
  writeAppBadgeLevels,
  type AppBadgeMetrics,
} from "@/lib/utils/app-badge-levels";
import { fetchOnchainStake } from "@/lib/wallet/onchain-stake";
import StaggerIn from "@/components/ui/StaggerIn";
import type { WalletAppState } from "@/hooks/useWalletApp";

function BadgeGroup({
  title,
  subtitle,
  categories,
  metrics,
  claimedLevels,
  claiming,
  onClaim,
}: {
  title: string;
  subtitle: string;
  categories: AppBadgeCategory[];
  metrics: AppBadgeMetrics;
  claimedLevels: Record<string, number>;
  claiming: string | null;
  onClaim: (cat: AppBadgeCategory, toLevels: number[]) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-lg font-bold text-white">{title}</h3>
        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
      </div>
      <StaggerIn className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {categories.map((cat) => {
          const value = metrics[cat.metric as keyof AppBadgeMetrics] ?? 0;
          let unlocked = 0;
          for (let i = 0; i < cat.thresholds.length; i++) {
            if (value >= cat.thresholds[i]) unlocked = i + 1;
          }
          const claimedTier = claimedLevels[cat.id] || 0;
          const canClaim = unlocked > claimedTier;
          const toLevels: number[] = [];
          for (let i = claimedTier + 1; i <= unlocked; i++) toLevels.push(i);
          const nextThr =
            unlocked < cat.thresholds.length
              ? cat.thresholds[unlocked]
              : cat.thresholds[cat.thresholds.length - 1];
          const prog =
            unlocked === cat.thresholds.length
              ? 100
              : Math.min(100, (value / nextThr) * 100);

          let btnText = "Locked";
          if (claimedTier === cat.thresholds.length) btnText = "Complete";
          else if (canClaim)
            btnText =
              toLevels.length > 1
                ? `Claim ${toLevels.length} badges`
                : `Claim ${cat.tierNames[claimedTier]}`;

          return (
            <div
              key={cat.id}
              className="stagger-child quest-card p-4 sm:p-5 flex flex-col"
            >
              <div className="flex justify-between items-start mb-3 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-xl shrink-0">
                    {cat.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm truncate">{cat.name}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold mt-0.5">
                      L{unlocked}/{cat.thresholds.length}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-white font-mono">{value}</p>
                  <p className="text-[10px] text-slate-500 uppercase">{cat.unit}</p>
                </div>
              </div>

              <div className="w-full bg-white/5 rounded-full h-1.5 mb-4">
                <div
                  className="h-full bg-white/70 rounded-full transition-all"
                  style={{ width: `${prog}%` }}
                />
              </div>

              <div
                className={`flex ${cat.thresholds.length === 1 ? "justify-center" : "justify-between"} items-end mb-4 gap-1`}
              >
                {cat.thresholds.map((_, idx) => {
                  const tier = idx + 1;
                  const isEarned = unlocked >= tier;
                  const isClaimed = claimedTier >= tier;
                  const style = getLevelStyle(
                    cat.thresholds.length === 1 ? 5 : tier,
                    isClaimed,
                    isEarned
                  );
                  return (
                    <div
                      key={tier}
                      className="flex flex-col items-center gap-1 min-w-0"
                      style={{ width: `${Math.floor(100 / cat.thresholds.length)}%` }}
                    >
                      <div
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-sm sm:text-base ${style}`}
                      >
                        {isEarned ? (
                          cat.tierIcons[idx]
                        ) : (
                          <Lock size={10} className="text-white/20" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={!canClaim || claiming === cat.id}
                onClick={() => onClaim(cat, toLevels)}
                className={`mt-auto w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                  canClaim && claiming !== cat.id
                    ? "bg-[var(--base-blue)] text-white hover:bg-[#1a63ff]"
                    : "bg-white/[0.04] text-slate-600 cursor-not-allowed border border-white/8"
                }`}
              >
                {claiming === cat.id ? (
                  <RefreshCcw className="animate-spin mx-auto" size={16} />
                ) : (
                  btnText
                )}
              </button>
              {canClaim && (
                <p className="text-[9px] text-slate-600 mt-2 text-center">
                  +{XP_PER_APP_BADGE_CLAIM} season XP · no gas
                </p>
              )}
            </div>
          );
        })}
      </StaggerIn>
    </div>
  );
}

export default function AppBadgesSection({ app }: { app: WalletAppState }) {
  const {
    wallet,
    txKeys,
    streak,
    checkedToday,
    referralInvites,
    showToast,
    setPointsRevision,
  } = app;
  const [claimedLevels, setClaimedLevels] = useState<Record<string, number>>({});
  const [ethStakeTier, setEthStakeTier] = useState(0);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet) return;
    setClaimedLevels(readAppBadgeLevels(wallet.address));
  }, [wallet?.address]);

  const refreshStakeTier = useCallback(async () => {
    if (!wallet) return;
    try {
      const onchain = await fetchOnchainStake(wallet.address);
      const active =
        onchain?.active && onchain.amount > BigInt(0) ? onchain.tier : 0;
      setEthStakeTier(active);
    } catch {
      setEthStakeTier(0);
    }
  }, [wallet]);

  useEffect(() => {
    void refreshStakeTier();
  }, [refreshStakeTier, txKeys.stake]);

  const metrics = useMemo(
    () =>
      buildAppBadgeMetrics({
        txKeys,
        streak,
        referralInvites,
        ethStakeTier,
        checkedToday,
      }),
    [txKeys, streak, referralInvites, ethStakeTier, checkedToday]
  );

  const claimedCount = sumAppBadges(claimedLevels);
  const totalTiers = totalAppBadgeTiers();

  const handleClaim = (cat: AppBadgeCategory, toLevels: number[]) => {
    if (!wallet || toLevels.length === 0) return;
    setClaiming(cat.id);
    try {
      const next = {
        ...claimedLevels,
        [cat.id]: Math.max(...toLevels),
      };
      setClaimedLevels(next);
      writeAppBadgeLevels(wallet.address, next);
      const xp = recordAppBadgeClaims(wallet.address, toLevels.length);
      if (xp > 0) setPointsRevision((n) => n + 1);
      showToast(`✅ ${cat.name} badge claimed · +${xp} season XP`, "");
    } finally {
      setClaiming(null);
    }
  };

  if (!wallet) return null;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-[var(--base-blue)]/25 bg-[var(--base-blue)]/[0.06] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="section-eyebrow text-[#7aa2ff] flex items-center gap-2 mb-1">
            <Sparkles size={12} /> Priority · in-app only
          </p>
          <p className="text-sm text-slate-300 max-w-xl">
            Claim badges for trading, staking, check-ins, vouchers, and more — earned only by using
            Base Analytics.
          </p>
        </div>
        <div className="text-center sm:text-right shrink-0">
          <p className="text-3xl font-black text-[#7aa2ff] font-mono">
            {claimedCount}
            <span className="text-slate-600 text-lg">/{totalTiers}</span>
          </p>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
            app badges claimed
          </p>
        </div>
      </div>

      {APP_BADGE_SECTIONS.map((section) => (
        <BadgeGroup
          key={section.id}
          title={section.title}
          subtitle={section.subtitle}
          categories={section.categories}
          metrics={metrics}
          claimedLevels={claimedLevels}
          claiming={claiming}
          onClaim={handleClaim}
        />
      ))}
    </div>
  );
}
