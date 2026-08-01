"use client";

import { useEffect, useState } from "react";
import { fetchAlchemyNftTotalCount } from "@/lib/utils/nft-stats";
import AchievementsHero from "@/components/wallet/AchievementsHero";
import BadgeMarketplace from "@/components/wallet/BadgeMarketplace";
import BadgeCatalogTabs, { type BadgeCatalogTab } from "@/components/wallet/BadgeCatalogTabs";
import OnchainBadgesSection from "@/components/wallet/OnchainBadgesSection";
import AppBadgesSection from "@/components/wallet/AppBadgesSection";
import type { WalletAppState } from "@/hooks/useWalletApp";

export default function AchievementsTab({ app }: { app: WalletAppState }) {
  const { wallet, mintedLevels, weeklyXP, boosts } = app;
  const [catalogTab, setCatalogTab] = useState<BadgeCatalogTab>("app");
  const [heldNftCount, setHeldNftCount] = useState<number | null>(null);

  useEffect(() => {
    if (!wallet || !app.analyticsUnlocked) return;
    void fetchAlchemyNftTotalCount(wallet.address)
      .then((n) => setHeldNftCount(n > 0 ? n : null))
      .catch(() => setHeldNftCount(null));
  }, [wallet?.address, app.analyticsUnlocked]);

  const getCatValue = (id: string) => {
    if (!wallet) return 0;
    const m: Record<string, number> = {
      score: wallet.score,
      age: wallet.daysOnBase,
      name: wallet.basename ? 1 : 0,
      days: wallet.uniqueDays,
      contract: wallet.contractInteractions,
      volume: parseFloat(wallet.ethVolume),
      txs: wallet.txCount,
      swaps: wallet.swapCount,
      nfts: Math.max(wallet.nftCount, heldNftCount ?? 0),
      streak: wallet.longestStreak,
      boosts,
    };
    return m[id] ?? 0;
  };

  if (!wallet) return null;

  return (
    <div className="tab-content-enter">
      <AchievementsHero wallet={wallet} mintedLevels={mintedLevels} weeklyXP={weeklyXP} />

      <BadgeCatalogTabs active={catalogTab} onChange={setCatalogTab} />

      {catalogTab === "app" ? (
        <AppBadgesSection app={app} />
      ) : (
        <OnchainBadgesSection app={app} getCatValue={getCatValue} />
      )}

      <div className="mt-10">
        <BadgeMarketplace app={app} />
      </div>
    </div>
  );
}
