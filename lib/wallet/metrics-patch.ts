import type { AlchemyTransfer, DayStats, WalletData } from "@/lib/types/wallet";
import {
  type StoredWalletHistory,
  uniqueDaysFromState,
} from "@/lib/wallet/history-store";
import { countsTowardActivity, rollupWalletActivity } from "@/lib/utils/wallet-activity";
import { computeScoreComponents, computeTotalScore, type ScoreComponents } from "@/lib/utils/score";
import { computeSwapVolume } from "@/lib/utils/swap-volume";
import { fetchNftSnapshot } from "@/lib/api/nft-snapshot";
import { countNftTxHashesFromTransfers } from "@/lib/utils/nft-stats";
import { buildDailyStatsFromState } from "@/lib/wallet/sync-engine";
import { maxScoreComponents } from "@/lib/wallet/merge-metrics";
import { getWeekKey, getMonthKey } from "@/lib/utils/dates";

export interface WalletMetricsPatch {
  uniqueDays: number;
  txCount: number;
  activeWeeks: number;
  activeMonths: number;
  dailyStats: DayStats[];
  tokensSwapped: number;
  erc20Txs: number;
  swapCount: number;
  dexTradeCount: number;
  dexVolumeUSD: number;
  dexVolumeETH: number;
  dexTradeCount30d: number;
  dexVolumeUSD30d: number;
  ethVolume: string;
  nftCount: number;
  erc721Txs: number;
  scoreComponents: Record<string, number>;
  score: number;
  activityScore: number;
}

function activeDaysFromState(stored: StoredWalletHistory): string[] {
  return Object.entries(stored.tpd)
    .filter(([, c]) => c > 0)
    .map(([d]) => d);
}

function weeksMonthsFromDays(days: string[]): {
  activeWeeks: number;
  activeMonths: number;
} {
  const weeks = new Set<string>();
  const months = new Set<string>();
  for (const d of days) {
    weeks.add(getWeekKey(`${d}T12:00:00Z`));
    months.add(getMonthKey(`${d}T12:00:00Z`));
  }
  return { activeWeeks: weeks.size, activeMonths: months.size };
}

function activityScoreFromDays(
  days: string[],
  activeMonths: number
): number {
  const last30Key = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const recentDays = days.filter((d) => d >= last30Key).length;
  return Math.min(
    100,
    Math.round(recentDays * 3 + Math.min(10, activeMonths))
  );
}

function countTokenStats(
  transfers: AlchemyTransfer[],
  address: string
): { tokensSwapped: number; erc20Txs: number; swapCount: number; ethVol: number } {
  const addr = address.toLowerCase();
  const uTokens = new Set<string>();
  let erc20Txs = 0;
  let swapCount = 0;
  let ethVol = 0;
  const seenHash = new Set<string>();

  for (const tx of transfers) {
    if (!countsTowardActivity(tx, addr)) continue;
    const from = (tx.from || "").toLowerCase();
    const isOutgoing = from === addr;
    const isNewHash = !seenHash.has(tx.hash);
    seenHash.add(tx.hash);

    if (tx.category === "erc20") {
      erc20Txs++;
      if (isNewHash && isOutgoing) swapCount++;
      if (tx.asset) uTokens.add(tx.asset);
    }

    if (
      tx.value &&
      tx.value > 0 &&
      (tx.asset?.toLowerCase() === "eth" ||
        tx.asset?.toLowerCase() === "weth" ||
        tx.asset?.toLowerCase() ===
          "0x4200000000000000000000000000000000000006") &&
      isOutgoing &&
      isNewHash
    ) {
      ethVol += tx.value;
    }
  }

  return {
    tokensSwapped: uTokens.size,
    erc20Txs,
    swapCount,
    ethVol,
  };
}

/** Recompute score bars + swap/token stats from transfer legs. */
export async function buildWalletMetricsPatch(
  transfers: AlchemyTransfer[],
  address: string,
  stored: StoredWalletHistory | null,
  options: {
    ethUsd?: number;
    basename?: string | null;
    nftCount?: number;
    gmCount?: number;
    checkInCount?: number;
    currentStreak?: number;
    longestStreak?: number;
    bridgeTxCount?: number;
    defiInteractions?: number;
    uniqueContracts?: number;
    /** Partial sync burst — keep swap/token metrics from prior wallet. */
    partialSync?: boolean;
    priorWallet?: WalletData | null;
  } = {}
): Promise<WalletMetricsPatch> {
  const addr = address.toLowerCase();
  const ethUsd = options.ethUsd ?? 3200;
  const partial = options.partialSync === true && options.priorWallet != null;
  const prior = options.priorWallet;

  const storedDays = stored ? activeDaysFromState(stored) : [];
  const uniqueDays = stored
    ? uniqueDaysFromState(stored)
    : rollupWalletActivity(transfers, addr).uDays.size;
  const txCount = stored?.txHashes.length
    ? stored.txHashes.length
    : rollupWalletActivity(transfers, addr).participatingHashes.size;

  const { activeWeeks, activeMonths } = storedDays.length
    ? weeksMonthsFromDays(storedDays)
    : (() => {
        const a = rollupWalletActivity(transfers, addr);
        return { activeWeeks: a.uWeeks.size, activeMonths: a.uMonths.size };
      })();

  const dailyStats = stored && storedDays.length
    ? buildDailyStatsFromState(stored)
    : (() => {
        const a = rollupWalletActivity(transfers, addr);
        const now = new Date();
        const histDays = 400;
        const dStats: DayStats[] = [];
        const hPtr = new Date(now);
        for (let i = 0; i < histDays; i++) {
          const ds = hPtr.toISOString().slice(0, 10);
          const c = a.tpd.get(ds) || 0;
          let intensity = 0;
          if (c > 0) intensity = 1;
          if (c > 2) intensity = 2;
          if (c > 5) intensity = 3;
          if (c > 10) intensity = 4;
          dStats.unshift({ date: ds, count: c, intensity });
          hPtr.setUTCDate(hPtr.getUTCDate() - 1);
        }
        return dStats;
      })();

  const activityScore = activityScoreFromDays(
    storedDays.length
      ? storedDays
      : Array.from(rollupWalletActivity(transfers, addr).uDays),
    activeMonths
  );

  const tokenStats = countTokenStats(transfers, addr);
  const mergedAssets = new Set<string>([...(stored?.tokenAssets ?? [])]);
  for (const tx of transfers) {
    if (tx.category === "erc20" && tx.asset) mergedAssets.add(tx.asset);
  }
  const tokensFromTransfers = Math.max(
    tokenStats.tokensSwapped,
    mergedAssets.size
  );

  let tokensSwapped: number;
  let erc20Txs: number;
  let swapCount: number;
  let ethVolume: string;
  let dexTradeCount: number;
  let dexVolumeUSD: number;
  let dexVolumeETH: number;
  let dexTradeCount30d: number;
  let dexVolumeUSD30d: number;
  let ethSwapVolumeUSD = 0;

  const nftSnapshot =
    partial && prior
      ? {
          nftCount: prior.nftCount,
          nftTxCount: prior.erc721Txs,
          mintCount: 0,
          transfers: [] as AlchemyTransfer[],
        }
      : await fetchNftSnapshot(address, transfers, { quick: partial });
  const nftTxMetrics = countNftTxHashesFromTransfers(
    [...transfers, ...nftSnapshot.transfers],
    addr
  );
  const nftCountComputed = Math.max(
    options.nftCount ?? 0,
    prior?.nftCount ?? 0,
    nftSnapshot.nftCount,
    nftSnapshot.nftTxCount
  );
  const erc721TxsComputed = Math.max(
    prior?.erc721Txs ?? 0,
    nftTxMetrics.uniqueHashes,
    nftSnapshot.nftTxCount
  );

  if (partial && prior) {
    const swapMetrics = await computeSwapVolume(transfers, addr, ethUsd);
    ethSwapVolumeUSD = swapMetrics.ethSwapVolumeUSD;
    tokensSwapped = Math.max(prior.tokensSwapped, tokensFromTransfers);
    erc20Txs = Math.max(prior.erc20Txs, stored?.erc20LegCount ?? 0);
    swapCount = Math.max(prior.swapCount, tokenStats.swapCount);
    ethVolume =
      parseFloat(prior.ethVolume) > tokenStats.ethVol
        ? prior.ethVolume
        : tokenStats.ethVol.toFixed(4);
    dexTradeCount = Math.max(prior.dexTradeCount, swapMetrics.dexTradeCount);
    dexVolumeUSD = Math.max(prior.dexVolumeUSD, swapMetrics.dexVolumeUSD);
    dexVolumeETH = Math.max(prior.dexVolumeETH, swapMetrics.dexVolumeETH);
    dexTradeCount30d = Math.max(
      prior.dexTradeCount30d,
      swapMetrics.dexTradeCount30d
    );
    dexVolumeUSD30d = Math.max(
      prior.dexVolumeUSD30d,
      swapMetrics.dexVolumeUSD30d
    );
  } else if (partial) {
    tokensSwapped = tokensFromTransfers;
    erc20Txs = Math.max(tokenStats.erc20Txs, stored?.erc20LegCount ?? 0);
    swapCount = tokenStats.swapCount;
    const swapMetrics = await computeSwapVolume(transfers, addr, ethUsd);
    ethSwapVolumeUSD = swapMetrics.ethSwapVolumeUSD;
    ethVolume = tokenStats.ethVol.toFixed(4);
    dexTradeCount = swapMetrics.dexTradeCount;
    dexVolumeUSD = swapMetrics.dexVolumeUSD;
    dexVolumeETH = swapMetrics.dexVolumeETH;
    dexTradeCount30d = swapMetrics.dexTradeCount30d;
    dexVolumeUSD30d = swapMetrics.dexVolumeUSD30d;
  } else {
    const swapMetrics = await computeSwapVolume(transfers, addr, ethUsd);
    ethSwapVolumeUSD = swapMetrics.ethSwapVolumeUSD;
    tokensSwapped = tokensFromTransfers;
    erc20Txs = Math.max(tokenStats.erc20Txs, stored?.erc20LegCount ?? 0);
    swapCount = tokenStats.swapCount;
    ethVolume = tokenStats.ethVol.toFixed(4);
    dexTradeCount = swapMetrics.dexTradeCount;
    dexVolumeUSD = swapMetrics.dexVolumeUSD;
    dexVolumeETH = swapMetrics.dexVolumeETH;
    dexTradeCount30d = swapMetrics.dexTradeCount30d;
    dexVolumeUSD30d = swapMetrics.dexVolumeUSD30d;
  }

  const ethVolNum =
    partial && prior
      ? Math.max(parseFloat(prior.ethVolume) || 0, tokenStats.ethVol)
      : tokenStats.ethVol;

  const freshScore = computeScoreComponents({
    txCount,
    uniqueDays,
    activeMonths,
    activeWeeks,
    currentStreak: options.currentStreak ?? prior?.currentStreak ?? 0,
    longestStreak: options.longestStreak ?? prior?.longestStreak ?? 0,
    ethVol: ethVolNum,
    uniqueTokens: tokensSwapped,
    defiInteractions: options.defiInteractions ?? prior?.defiInteractions ?? 0,
    uniqueContracts: options.uniqueContracts ?? prior?.uniqueContracts ?? 0,
    nftCount: nftCountComputed,
    nftTxCount: erc721TxsComputed,
    dexTradeCount,
    dexVolumeUSD,
    ethSwapVolumeUSD,
    bridgeTxCount: options.bridgeTxCount ?? prior?.bridgeTxCount ?? 0,
    hasBasename: Boolean(options.basename ?? prior?.basename),
    gmCount: options.gmCount ?? prior?.gmCount ?? 0,
    checkInCount: options.checkInCount ?? prior?.checkInCount ?? 0,
  });

  const scoreComponents: ScoreComponents =
    partial && prior
      ? (maxScoreComponents(freshScore, prior.scoreComponents) as ScoreComponents)
      : freshScore;

  return {
    uniqueDays,
    txCount,
    activeWeeks,
    activeMonths,
    dailyStats,
    tokensSwapped,
    erc20Txs,
    swapCount,
    dexTradeCount,
    dexVolumeUSD,
    dexVolumeETH,
    dexTradeCount30d,
    dexVolumeUSD30d,
    ethVolume,
    nftCount: nftCountComputed,
    erc721Txs: erc721TxsComputed,
    scoreComponents,
    score: computeTotalScore(scoreComponents),
    activityScore: partial && prior
      ? Math.max(prior.activityScore, activityScore)
      : activityScore,
  };
}
