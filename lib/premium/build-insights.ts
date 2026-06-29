import type { WalletData } from "@/lib/types/wallet";

export interface PremiumInsights {
  generatedAt: string;
  address: string;
  tier: string;
  headline: string;
  benchmarks: Array<{ label: string; value: string; vsMedian: string }>;
  portfolio: Array<{ label: string; value: string }>;
  highlights: string[];
  exportSummary: string;
}

const MEDIAN = {
  score: 42,
  txCount: 85,
  uniqueDays: 28,
  paymasterTxCount: 12,
  dexVolumeUSD: 450,
};

export function buildPremiumInsights(
  wallet: WalletData,
  tier = "scan"
): PremiumInsights {
  const vs = (v: number, m: number) => {
    const pct = m > 0 ? Math.round(((v - m) / m) * 100) : 0;
    if (pct > 5) return `+${pct}% vs median`;
    if (pct < -5) return `${pct}% vs median`;
    return "near median";
  };

  const benchmarks = [
    { label: "Onchain score", value: `${wallet.score}/100`, vsMedian: vs(wallet.score, MEDIAN.score) },
    { label: "Transactions", value: wallet.txCount.toLocaleString(), vsMedian: vs(wallet.txCount, MEDIAN.txCount) },
    { label: "Active days", value: String(wallet.uniqueDays), vsMedian: vs(wallet.uniqueDays, MEDIAN.uniqueDays) },
    { label: "Paymaster txs", value: String(wallet.paymasterTxCount), vsMedian: vs(wallet.paymasterTxCount, MEDIAN.paymasterTxCount) },
    { label: "DEX volume (30d)", value: `$${wallet.dexVolumeUSD30d.toFixed(0)}`, vsMedian: vs(wallet.dexVolumeUSD30d, MEDIAN.dexVolumeUSD) },
  ];

  const portfolio = [
    { label: "Portfolio est.", value: wallet.portfolioValueUSD > 0 ? `$${wallet.portfolioValueUSD.toFixed(2)}` : "—" },
    { label: "ETH volume", value: `${parseFloat(wallet.ethVolume).toFixed(4)} ETH` },
    { label: "Top tokens", value: wallet.topTokens.slice(0, 3).join(", ") || "—" },
    { label: "NFTs held", value: String(wallet.nftCount) },
    { label: "Protocols", value: String(wallet.uniqueProtocols) },
    { label: "Health", value: wallet.walletHealthLabel },
  ];

  const highlights: string[] = [];
  if (wallet.paymasterTxCount > 0) {
    highlights.push(`${wallet.paymasterTxCount} smart-wallet / paymaster transactions detected (Base App activity).`);
  }
  if (wallet.dexTradeCount30d > 0) {
    highlights.push(`${wallet.dexTradeCount30d} DEX trades in the last 30 days — ${wallet.mostUsedProtocol || "multiple protocols"}.`);
  }
  if (wallet.longestStreak >= 7) {
    highlights.push(`Longest activity streak: ${wallet.longestStreak} days — strong retention signal.`);
  }
  if (wallet.basename) {
    highlights.push(`Basename verified: ${wallet.basename}`);
  }
  if (highlights.length === 0) {
    highlights.push(wallet.recommendation || "Keep building on Base — more activity unlocks deeper insights.");
  }

  const exportSummary = [
    `Base Analytics Premium Report`,
    `Address: ${wallet.address}`,
    `Score: ${wallet.score}/100 (${wallet.walletRank})`,
    `Txs: ${wallet.txCount} | Active days: ${wallet.uniqueDays}`,
    `Paymaster: ${wallet.paymasterTxCount} | DEX 30d: $${wallet.dexVolumeUSD30d.toFixed(2)}`,
    `Generated: ${new Date().toISOString()}`,
  ].join("\n");

  return {
    generatedAt: new Date().toISOString(),
    address: wallet.address,
    tier,
    headline: `${wallet.walletRank} · score ${wallet.score} — ${tier === "compare" ? "full benchmark report" : tier === "export" ? "export-ready analysis" : "premium deep scan"}`,
    benchmarks: tier === "compare" ? benchmarks : benchmarks.slice(0, 3),
    portfolio: tier === "scan" ? portfolio.slice(0, 4) : portfolio,
    highlights: tier === "export" ? highlights : highlights.slice(0, 3),
    exportSummary: tier === "export" || tier === "compare" ? exportSummary : "",
  };
}
