export interface DayStats {
  date: string;
  count: number;
  intensity: number;
}

export interface WalletData {
  address: string;
  basename: string | null;
  balance: string;
  ethVolume: string;
  txCount: number;
  uniqueDays: number;
  activeWeeks: number;
  activeMonths: number;
  currentStreak: number;
  longestStreak: number;
  firstTx: string;
  lastTx: string;
  daysSinceActive: number;
  tokensSwapped: number;
  swapCount: number;
  contractInteractions: number;
  nftCount: number;
  walletRank: string;
  score: number;
  historyDays: number;
  weekLabels: string[];
  dailyStats: DayStats[];
  topTokens: string[];
  recommendation: string;
  recentTxs: AlchemyTransfer[];
  daysOnBase: number;
  defiInteractions: number;
  hasGm: boolean;
  uniqueContracts: number;
  avgTxPerDay: number;
  mostActiveMonth: string;
  ethReceived: number;
  totalGasSpent: number;
  erc20Txs: number;
  erc721Txs: number;
  gmCount: number;
  checkInCount: number;
  walletHealthScore: number;
  walletHealthLabel: string;
  scoreComponents: Record<string, number>;
  portfolioValueUSD: number;
  dexVolumeETH: number;
  dexVolumeUSD: number;
  dexTradeCount: number;
  dexVolumeUSD30d: number;
  dexTradeCount30d: number;
  paymasterTxCount: number;
  bridgeTxCount: number;
  netETHFlow: number;
  avgTxValueETH: number;
  uniqueProtocols: number;
  longestInactiveDays: number;
  weeklyTxAvg: number;
  onchainAgePercentile: number;
  mostUsedProtocol: string;
  activityScore: number;
  peakDayTxCount: number;
  peakDayDate: string;
}

export interface AlchemyTransfer {
  hash: string;
  category: string;
  value: number | null;
  asset: string | null;
  to: string | null;
  from: string | null;
  metadata: {
    blockTimestamp: string;
    isSponsored?: boolean;
    isUserOperation?: boolean;
  };
}

export interface AlchemyResponse {
  result?: { transfers: AlchemyTransfer[]; pageKey?: string };
  error?: { message: string };
}

export type ConnectionType = "farcaster" | "coinbase" | "metamask";

export interface BlockscoutTx {
  hash: string;
  timeStamp: string;
  value: string;
  to: string;
  from: string;
}

export interface BlockscoutInternalTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  type: string;
}

export interface AnalyzeWalletResult {
  wallet: WalletData;
  mintedLevels: Record<string, number>;
  boosts: number;
  streak: number;
  checkedToday: boolean;
}
