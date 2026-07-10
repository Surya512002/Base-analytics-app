import type { WalletData } from "@/lib/types/wallet";

export type ScoreTip = {
  id: string;
  title: string;
  detail: string;
  impact: string;
  action: "checkin" | "swap" | "launch" | "basename" | "badge" | "voucher" | "streak";
  priority: number;
};

export function buildScoreImprovementTips(wallet: WalletData): ScoreTip[] {
  const tips: ScoreTip[] = [];

  if (!wallet.basename) {
    tips.push({
      id: "basename",
      title: "Add a Basename",
      detail: "Onchain identity boosts trust and score components.",
      impact: "+Basename bonus",
      action: "basename",
      priority: 90,
    });
  }

  if (wallet.uniqueDays < 30) {
    tips.push({
      id: "days",
      title: "Stay active on Base",
      detail: `You have ${wallet.uniqueDays} active days — more consistent weeks raise longevity score.`,
      impact: "High",
      action: "swap",
      priority: 85,
    });
  }

  if ((wallet.dexTradeCount ?? 0) < 3) {
    tips.push({
      id: "swap",
      title: "Complete in-app swaps",
      detail: "Swap any pooled token via Explore — counts toward DeFi score and weekly quests.",
      impact: "+Quest XP",
      action: "swap",
      priority: 80,
    });
  }

  if (wallet.currentStreak < 7) {
    tips.push({
      id: "streak",
      title: "Build your check-in streak",
      detail: "Daily onchain check-ins compound streak multipliers on weekly XP.",
      impact: "Medium",
      action: "checkin",
      priority: 75,
    });
  }

  if (wallet.bridgeTxCount === 0) {
    tips.push({
      id: "bridge",
      title: "Bridge activity",
      detail: "Bridging to Base from L1 adds bridge score when detected in history.",
      impact: "Medium",
      action: "swap",
      priority: 50,
    });
  }

  if (wallet.nftCount === 0 && wallet.txCount > 20) {
    tips.push({
      id: "nft",
      title: "NFT activity",
      detail: "Mint or transfer NFTs on Base to diversify your onchain profile.",
      impact: "Low",
      action: "badge",
      priority: 40,
    });
  }

  if (wallet.paymasterTxCount < 5 && wallet.txCount > 10) {
    tips.push({
      id: "paymaster",
      title: "Use gas-sponsored txs",
      detail: "Transactions via paymaster on Base improve smart-wallet signals.",
      impact: "Low",
      action: "swap",
      priority: 35,
    });
  }

  return tips.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

export function buildPremiumGapHighlights(wallet: WalletData): string[] {
  const tips = buildScoreImprovementTips(wallet);
  return tips.map((t) => `${t.title}: ${t.detail}`);
}
