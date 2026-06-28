import type { RefObject } from "react";
import type { AppTab } from "@/hooks/useWalletApp";
import type { WalletAppState } from "@/hooks/useWalletApp";
import type { WalletData } from "@/lib/types/wallet";
import {
  ACHIEVEMENTS_ABI,
  ACHIEVEMENTS_CONTRACT,
  BOOSTER_ABI,
  BOOSTER_CONTRACT,
  CHECKIN_ABI,
  CHECKIN_CONTRACT,
  GM_GN_ABI,
  GM_GN_CONTRACT,
} from "@/lib/constants/contracts";
import { encodeContractCall } from "@/lib/utils/tx";
import { SCORE_MAX } from "@/lib/utils/score";
import { getCapabilities } from "@/lib/utils/paymaster";

const noop = () => {};
const noopAsync = async () => {};

function buildDailyStats() {
  const stats = [];
  const now = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const count = i % 7 === 0 ? 0 : Math.max(0, Math.floor(Math.random() * 12) + (i % 3));
    stats.push({
      date: d.toISOString().slice(0, 10),
      count,
      intensity: Math.min(4, Math.floor(count / 3)),
    });
  }
  return stats;
}

export function createMockWallet(): WalletData {
  const scoreComponents = Object.fromEntries(
    Object.entries(SCORE_MAX).map(([k, max]) => [k, Math.round(max * 0.72)])
  ) as WalletData["scoreComponents"];

  return {
    address: "0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F",
    basename: "surya.base.eth",
    balance: "0.842",
    ethVolume: "12.4",
    txCount: 1248,
    uniqueDays: 147,
    activeWeeks: 42,
    activeMonths: 11,
    currentStreak: 12,
    longestStreak: 28,
    firstTx: "Mar 2024",
    lastTx: "2h ago",
    daysSinceActive: 0,
    tokensSwapped: 18,
    swapCount: 86,
    contractInteractions: 312,
    nftCount: 24,
    walletRank: "Base Shark 🦈",
    score: 72,
    historyDays: 365,
    weekLabels: ["W1", "W2", "W3", "W4"],
    dailyStats: buildDailyStats(),
    topTokens: ["USDC", "ETH", "DEGEN"],
    recommendation: "Strong Base activity — keep your streak and mint more badges.",
    recentTxs: [
      {
        hash: "0xabc123",
        category: "external",
        value: 0,
        asset: "ETH",
        to: CHECKIN_CONTRACT,
        from: "0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F",
        metadata: { blockTimestamp: new Date().toISOString() },
      },
      {
        hash: "0xdef456",
        category: "erc20",
        value: 25,
        asset: "USDC",
        to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        from: "0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F",
        metadata: { blockTimestamp: new Date(Date.now() - 3600000).toISOString() },
      },
    ],
    daysOnBase: 412,
    defiInteractions: 94,
    hasGm: true,
    uniqueContracts: 48,
    avgTxPerDay: 3.2,
    mostActiveMonth: "Oct 2025",
    ethReceived: 4.2,
    totalGasSpent: 0.08,
    erc20Txs: 420,
    erc721Txs: 38,
    gmCount: 156,
    checkInCount: 89,
    walletHealthScore: 78,
    walletHealthLabel: "Healthy",
    scoreComponents,
    portfolioValueUSD: 2840,
    dexVolumeETH: 2.4,
    dexVolumeUSD: 8420,
    dexTradeCount: 86,
    dexVolumeUSD30d: 1200,
    dexTradeCount30d: 14,
    paymasterTxCount: 42,
    bridgeTxCount: 6,
    netETHFlow: 0.34,
    avgTxValueETH: 0.012,
    uniqueProtocols: 8,
    longestInactiveDays: 9,
    weeklyTxAvg: 22,
    onchainAgePercentile: 82,
    mostUsedProtocol: "Uniswap",
    activityScore: 76,
    peakDayTxCount: 34,
    peakDayDate: "Nov 12",
  };
}

export function createMockAppState(tab: AppTab = "dashboard"): WalletAppState {
  const wallet = createMockWallet();
  const txCaps = getCapabilities();
  const scrollRef = { current: null } as RefObject<HTMLDivElement | null>;

  return {
    wallet,
    connType: "coinbase",
    loading: false,
    tab,
    setTab: noop,
    minting: null,
    mintedLevels: { score: 2, age: 1, txs: 1 },
    setMintedLevels: noop,
    ready: true,
    showModal: false,
    setShowModal: noop,
    selDay: null,
    setSelDay: noop,
    scrollRef,
    boosts: 12,
    setBoosts: noop,
    sponsored: 8,
    setSponsored: noop,
    txKeys: { boost: 1, gm: 2, gn: 1, checkin: 3 },
    setTxKeys: noop,
    toast: null,
    setToast: noop,
    streak: 12,
    checkedToday: false,
    setCheckedToday: noop,
    setStreak: noop,
    leaderboard: [
      {
        address: wallet.address,
        basename: wallet.basename,
        score: wallet.score,
        rank: wallet.walletRank,
        boosts: 12,
        badges: 4,
        weeklyXP: 120,
        totalXP: 480,
        weekNumber: 1,
      },
    ],
    lbLoading: false,
    challenge: "",
    setChallenge: noop,
    challengeResult: null,
    challengeLoading: false,
    refCopied: false,
    setRefCopied: noop,
    weeklyXP: 120,
    scanProgress: "",
    walletRefreshing: false,
    premiumUnlocked: false,
    premiumLoading: false,
    premiumData: null,
    x402PayCount: 2,
    boostCall: [encodeContractCall(BOOSTER_CONTRACT as `0x${string}`, BOOSTER_ABI, "boost")],
    gmCall: [encodeContractCall(GM_GN_CONTRACT as `0x${string}`, GM_GN_ABI, "gm")],
    gnCall: [encodeContractCall(GM_GN_CONTRACT as `0x${string}`, GM_GN_ABI, "gn")],
    ciCall: [encodeContractCall(CHECKIN_CONTRACT as `0x${string}`, CHECKIN_ABI, "checkIn")],
    txCaps,
    mintedCount: 4,
    ref: "B4BD7D41",
    showToast: noop,
    handlePremiumScan: noopAsync,
    handleChallenge: noopAsync,
    handleConnect: noopAsync,
    handleDisconnect: noop,
    doNativeTx: noopAsync,
    doNativeMint: noopAsync,
    shareScore: noop,
    shareAch: noop,
    shareAll: noop,
    getAchievementValue: () => 0,
    doneQuests: 6,
  };
}
