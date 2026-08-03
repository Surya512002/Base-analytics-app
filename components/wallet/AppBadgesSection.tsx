"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, RefreshCcw, Sparkles } from "lucide-react";
import {
  APP_BADGE_SECTIONS,
  XP_PER_APP_BADGE_CLAIM,
  type AppBadgeCategory,
} from "@/lib/constants/app-badges";
import { getLevelStyle, getTargetTokenId } from "@/lib/utils/achievements";
import {
  buildAppBadgeMetrics,
  getAppBadgeMetricValue,
  readAppBadgeLevels,
  sumAppBadges,
  totalAppBadgeTiers,
  writeAppBadgeLevels,
  type AppBadgeMetrics,
} from "@/lib/utils/app-badge-levels";
import {
  buildLifetimeBadgeMetrics,
  ensureLifetimeFloors,
} from "@/lib/utils/app-badge-lifetime";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { fetchAppMintedLevelsFromChain } from "@/lib/wallet/app-minted-badges";
import StaggerIn from "@/components/ui/StaggerIn";
import type { WalletAppState } from "@/hooks/useWalletApp";

function BadgeGroup({
  title,
  subtitle,
  categories,
  metrics,
  claimedLevels,
  minting,
  onMint,
}: {
  title: string;
  subtitle: string;
  categories: AppBadgeCategory[];
  metrics: AppBadgeMetrics;
  claimedLevels: Record<string, number>;
  minting: string | null;
  onMint: (cat: AppBadgeCategory, toLevels: number[]) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-lg font-bold text-[var(--ink)]">{title}</h3>
        <p className="text-xs text-[var(--ink-muted)] mt-1">{subtitle}</p>
      </div>
      <StaggerIn className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {categories.map((cat) => {
          const value = getAppBadgeMetricValue(cat.metric, metrics);
          let unlocked = 0;
          for (let i = 0; i < cat.thresholds.length; i++) {
            if (value >= cat.thresholds[i]) unlocked = i + 1;
          }
          const claimedTier = claimedLevels[cat.id] || 0;
          const canMint = unlocked > claimedTier;
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

          const pendingKey = `app-mint-${cat.id}`;
          let btnText = "Locked";
          if (claimedTier === cat.thresholds.length) btnText = "Minted";
          else if (canMint)
            btnText =
              toLevels.length > 1
                ? `Mint ${toLevels.length} badges`
                : `Mint ${cat.tierNames[claimedTier]}`;

          return (
            <div
              key={cat.id}
              className="stagger-child quest-card p-4 sm:p-5 flex flex-col"
            >
              <div className="flex justify-between items-start mb-3 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-center text-xl shrink-0">
                    {cat.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[var(--ink)] text-sm truncate">{cat.name}</p>
                    <p className="text-[10px] text-[var(--ink-muted)] uppercase font-bold mt-0.5">
                      L{unlocked}/{cat.thresholds.length}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-[var(--ink)] font-mono">{value}</p>
                  <p className="text-[10px] text-[var(--ink-muted)] uppercase">{cat.unit}</p>
                </div>
              </div>

              <div className="w-full bg-[var(--surface-2)] rounded-full h-1.5 mb-4">
                <div
                  className="h-full bg-[var(--brand)] rounded-full transition-all"
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
                disabled={!canMint || minting === pendingKey}
                onClick={() => onMint(cat, toLevels)}
                className={`mt-auto w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                  canMint && minting !== pendingKey
                    ? "bg-[var(--base-blue)] text-white hover:bg-[#1a63ff]"
                    : "bg-[var(--surface-2)] text-[var(--ink-dim)] cursor-not-allowed border border-[var(--border-subtle)]"
                }`}
              >
                {minting === pendingKey ? (
                  <RefreshCcw className="animate-spin mx-auto" size={16} />
                ) : (
                  btnText
                )}
              </button>
              {canMint && (
                <p className="text-[9px] text-[var(--ink-dim)] mt-2 text-center">
                  +{XP_PER_APP_BADGE_CLAIM} season XP · on-chain mint
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
    minting,
    doAppBadgeMint,
    boosts,
  } = app;
  const [claimedLevels, setClaimedLevels] = useState<Record<string, number>>({});

  const syncClaimedLevels = useCallback(async () => {
    if (!wallet) return;
    const local = readAppBadgeLevels(wallet.address);
    try {
      const pub = createBasePublicClient();
      const chain = await fetchAppMintedLevelsFromChain(pub, wallet.address);
      const merged = { ...local };
      for (const [k, v] of Object.entries(chain)) {
        merged[k] = Math.max(merged[k] ?? 0, v);
      }
      writeAppBadgeLevels(wallet.address, merged);
      setClaimedLevels(merged);
    } catch {
      setClaimedLevels(local);
    }
  }, [wallet]);

  useEffect(() => {
    void syncClaimedLevels();
  }, [syncClaimedLevels]);

  // Seed lifetime floors from on-chain counters so reconnects unlock tiers.
  useEffect(() => {
    if (!wallet) return;
    ensureLifetimeFloors(wallet.address, {
      checkin: wallet.checkInCount,
      boost: boosts,
      gm: wallet.gmCount,
    });
  }, [wallet?.address, wallet?.checkInCount, wallet?.gmCount, boosts]);

  const metrics = useMemo(
    () =>
      wallet
        ? buildLifetimeBadgeMetrics({
            address: wallet.address,
            streak,
            referralInvites,
            checkedToday,
            weeklyTxKeys: txKeys,
            floors: {
              checkin: wallet.checkInCount,
              boost: boosts,
              gm: wallet.gmCount,
            },
          })
        : buildAppBadgeMetrics({
            txKeys,
            streak,
            referralInvites,
            checkedToday,
          }),
    [wallet, txKeys, streak, referralInvites, checkedToday, boosts]
  );

  const claimedCount = sumAppBadges(claimedLevels);
  const totalTiers = totalAppBadgeTiers();

  const handleMint = async (cat: AppBadgeCategory, toLevels: number[]) => {
    if (!wallet || toLevels.length === 0) return;
    const claimedTier = claimedLevels[cat.id] || 0;
    const toMint: number[] = [];
    for (let i = claimedTier + 1; i <= Math.max(...toLevels); i++) {
      toMint.push(getTargetTokenId(cat.baseId, cat.thresholds.length, i));
    }
    const ok = await doAppBadgeMint(cat.id, toLevels, toMint, cat.name);
    if (ok) {
      await syncClaimedLevels();
    }
  };

  if (!wallet) return null;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-[var(--base-blue)]/25 bg-[var(--base-blue)]/[0.06] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="section-eyebrow text-[#7aa2ff] flex items-center gap-2 mb-1">
            <Sparkles size={12} /> In-app achievements · on-chain
          </p>
          <p className="text-sm text-[var(--ink-soft)] max-w-xl">
            Mint soulbound badges for trading, check-ins, vouchers, and more — earned only
            by using Base Analytics. Progress is lifetime (not reset each week).
          </p>
        </div>
        <div className="text-center sm:text-right shrink-0">
          <p className="text-3xl font-black text-[#7aa2ff] font-mono">
            {claimedCount}
            <span className="text-[var(--ink-dim)] text-lg">/{totalTiers}</span>
          </p>
          <p className="text-[10px] text-[var(--ink-muted)] uppercase font-bold tracking-wider">
            app badges minted
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
          minting={minting}
          onMint={handleMint}
        />
      ))}
    </div>
  );
}
