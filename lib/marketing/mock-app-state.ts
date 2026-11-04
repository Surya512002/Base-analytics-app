import type { RefObject } from "react";
import type { AppTab } from "@/hooks/useWalletApp";
import type { WalletAppState } from "@/hooks/useWalletApp";
import type { WalletData } from "@/lib/types/wallet";
import {
  BOOSTER_ABI,
  BOOSTER_CONTRACT,
  CHECKIN_ABI,
  CHECKIN_CONTRACT,
  GM_GN_ABI,
  GM_GN_CONTRACT,
} from "@/lib/constants/contracts";
import { encodeContractCall } from "@/lib/utils/tx";
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
  return {
    address: "0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F",
    basename: "surya.base.eth",
    usdcBalance: "1240.50",
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
    nftCount: 8,
    walletRank: "Base User",
    score: 0,
    historyDays: 90,
    weekLabels: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12"],
    dailyStats: buildDailyStats(),
    topTokens: ["ETH", "USDC", "AERO", "BRETT"],
    recommendation: "Active Base Mainnet Trader",
    recentTxs: [
      {
        hash: "0x3a4f...9c12",
        category: "external",
        value: 0.25,
        asset: "ETH",
        to: "0x1234...5678",
        from: "0xB4BD...d42F",
        metadata: { blockTimestamp: new Date().toISOString() },
      },
    ],
    daysOnBase: 312,
    defiInteractions: 54,
    hasGm: true,
    uniqueContracts: 38,
    avgTxPerDay: 4.1,
    mostActiveMonth: "Jan 2025",
    ethReceived: 8.4,
    totalGasSpent: 0.042,
    erc20Txs: 612,
    erc721Txs: 24,
    gmCount: 18,
    checkInCount: 42,
    walletHealthScore: 88,
    walletHealthLabel: "Strong",
    scoreComponents: {},
    portfolioValueUSD: 3840.25,
    dexVolumeETH: 8.6,
    dexVolumeUSD: 24500,
    dexTradeCount: 86,
    dexVolumeUSD30d: 8200,
    dexTradeCount30d: 28,
    ethSwapVolumeUSD: 16300,
    paymasterTxCount: 31,
    bridgeTxCount: 4,
    netETHFlow: 2.1,
    avgTxValueETH: 0.08,
    uniqueProtocols: 12,
    longestInactiveDays: 5,
    weeklyTxAvg: 28.5,
    onchainAgePercentile: 82,
    mostUsedProtocol: "Aerodrome",
    activityScore: 78,
    peakDayTxCount: 19,
    peakDayDate: "2025-01-14",
  };
}

export function createMockAppState(tab: AppTab = "launchpad"): WalletAppState {
  const wallet = createMockWallet();
  const scrollRef = { current: null } as RefObject<HTMLDivElement | null>;
  const txCaps = getCapabilities();

  return {
    wallet,
    walletCore: {
      address: wallet.address,
      balance: wallet.balance,
      portfolioValueUSD: wallet.portfolioValueUSD,
      basename: wallet.basename,
    },
    connType: "coinbase",
    loading: false,
    tab,
    setTab: noop,
    minting: null,
    ready: true,
    sessionBootstrapped: true,
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
    refCopied: false,
    setRefCopied: noop,
    scanProgress: "",
    walletRefreshing: false,
    analyticsSyncing: false,
    walletScanComplete: true,
    miniAppIdentity: null,
    walletDisplayLabel: "surya.base.eth",
    launchLoading: false,
    swapLoading: false,
    b20Activated: true,
    handleLaunchB20: async () => ({ ok: true }),
    handleTokenSwap: async () => true,
    handleSeedLiquidity: async () => true,
    handleUnwrapWeth: async () => true,
    referralInvites: 4,
    boostCall: [encodeContractCall(BOOSTER_CONTRACT as `0x${string}`, BOOSTER_ABI, "boost")],
    gmCall: [encodeContractCall(GM_GN_CONTRACT as `0x${string}`, GM_GN_ABI, "gm")],
    gnCall: [encodeContractCall(GM_GN_CONTRACT as `0x${string}`, GM_GN_ABI, "gn")],
    ciCall: [encodeContractCall(CHECKIN_CONTRACT as `0x${string}`, CHECKIN_ABI, "checkIn")],
    txCaps,
    ref: "B4BD7D41",
    showToast: noop,
    handleConnect: noopAsync,
    handleDisconnect: noop,
    handleCheckInSuccess: noopAsync,
    handleBoostSuccess: noop,
    syncCheckInStatus: async () => ({ checkedToday: true, streak: 3 }),
    doNativeTx: noopAsync,
    pointsRevision: 0,
    setPointsRevision: () => {},
    siweAuthenticated: true,
    siweSessionChecked: true,
    siweSigningIn: false,
    siweSignIn: async () => ({ ok: true }),
    siweSignOut: async () => {},
  };
}
