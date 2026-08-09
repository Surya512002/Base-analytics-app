import {
  fetchWalletTransfersConnectRich,
  type WalletFetchDepth,
} from "@/lib/api/fetch-wallet-transfers";
import {
  countNftActivityFromTransfers,
  countNftTxHashesFromTransfers,
  estimateNftHoldingsFromTransfers,
} from "@/lib/utils/nft-stats";
import { fetchNftSnapshot } from "@/lib/api/nft-snapshot";
import { collectWalletComplete, collectWalletQuick } from "@/lib/wallet/collect";
import { fetchWalletBalances } from "@/lib/wallet/balances";
import {
  saveWalletHistory,
  loadOrEmptyHistory,
  mergeActivityIntoState,
  emptyHistoryState,
  type StoredWalletHistory,
} from "@/lib/wallet/history-store";
import { buildDailyStatsFromTpd } from "@/lib/wallet/sync-engine";
import { getWeekKey, getMonthKey } from "@/lib/utils/dates";
import { enrichTransferLegs } from "@/lib/utils/wallet-activity";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import {
  CHECKIN_ABI,
  CHECKIN_CONTRACT,
  ENTRYPOINT_V06,
  ENTRYPOINT_V07,
} from "@/lib/constants/contracts";
import { BRIDGE_CONTRACTS, PROTOCOL_NAMES } from "@/lib/constants/protocols";
import { MONTH_NAMES } from "@/lib/constants/season";
import { resolveBasename } from "@/lib/utils/resolve-basename";
import {
  countContractInteractions,
  mergeTransfers,
  rollupWalletActivity,
  rollupAnalyticsActivity,
  countsTowardActivity,
} from "@/lib/utils/wallet-activity";
import { calcWalletHealth } from "@/lib/utils/wallet-health";
import { computeSwapVolume, computeEthFlowVolumes } from "@/lib/utils/swap-volume";
import { buildOnchainScore } from "@/lib/analytics/onchain-score";
import type {
  AnalyzeWalletResult,
  AlchemyTransfer,
  DayStats,
  WalletData,
} from "@/lib/types/wallet";

export interface AnalyzeWalletOptions {
  onProgress?: (msg: string) => void;
  transfers?: AlchemyTransfer[];
  fetchDepth?: WalletFetchDepth;
  historyComplete?: boolean;
  v2StreamStates?: Record<string, { complete: boolean; cursor: string | null }>;
}

function mergeRollupWithHistory(
  rollup: ReturnType<typeof rollupWalletActivity>,
  history: StoredWalletHistory,
  _addrLow: string
): {
  participatingHashes: Set<string>;
  uDays: Set<string>;
  uWeeks: Set<string>;
  uMonths: Set<string>;
  tpd: Map<string, number>;
  monthActivity: Map<string, number>;
  mergedState: StoredWalletHistory;
} {
  const participatingHashes = new Set(rollup.participatingHashes);
  const uDays = new Set(rollup.uDays);
  const tpd = new Map(rollup.tpd);

  for (const [day, count] of Object.entries(history.tpd)) {
    if (count <= 0) continue;
    uDays.add(day);
    tpd.set(day, Math.max(tpd.get(day) ?? 0, count));
  }
  for (const day of history.activityDays) {
    if ((history.tpd[day] ?? 0) > 0) uDays.add(day);
  }
  for (const h of history.txHashes) {
    participatingHashes.add(h);
  }

  const uWeeks = new Set(
    [...uDays].map((d) => getWeekKey(`${d}T12:00:00Z`))
  );
  const uMonths = new Set(
    [...uDays].map((d) => getMonthKey(`${d}T12:00:00Z`))
  );
  const monthActivity = new Map<string, number>();
  for (const d of uDays) {
    const mk = getMonthKey(`${d}T12:00:00Z`);
    monthActivity.set(mk, (monthActivity.get(mk) || 0) + (tpd.get(d) || 0));
  }

  const heatmapState: StoredWalletHistory = {
    ...history,
    tpd: Object.fromEntries(tpd),
    activityDays: [...uDays].sort(),
    txHashes: [...participatingHashes],
  };

  return {
    participatingHashes,
    uDays,
    uWeeks,
    uMonths,
    tpd,
    monthActivity,
    mergedState: heatmapState,
  };
}

async function fetchConnectHistory(
  address: string,
  opts: {
    isQuick: boolean;
    isComplete: boolean;
    onProgress?: (msg: string) => void;
  }
): Promise<{
  transfers: AlchemyTransfer[];
  mergedHistory: StoredWalletHistory;
  historyComplete: boolean;
  v2StreamStates: Record<string, { complete: boolean; cursor: string | null }> | undefined;
}> {
  const stored = await loadOrEmptyHistory(address);

  // Connect analyze — rich single-shot fetch (d731448) for accurate heatmap / active days.
  if (!opts.isQuick && !opts.isComplete) {
    opts.onProgress?.("Fetching onchain history (Alchemy + Blockscout + paymaster)...");
    const rich = await fetchWalletTransfersConnectRich(address);
    const transfers = enrichTransferLegs(rich.transfers, address.toLowerCase());
    const merged = mergeActivityIntoState(stored, transfers, address);
    const next = {
      ...merged,
      v2StreamStates: rich.v2StreamStates,
      historyComplete: stored.historyComplete || rich.historyComplete,
    };
    void saveWalletHistory(address, next).catch(() => {});
    return {
      transfers,
      mergedHistory: next,
      historyComplete: next.historyComplete,
      v2StreamStates: rich.v2StreamStates,
    };
  }

  if (opts.isQuick && !opts.isComplete) {
    opts.onProgress?.("Fetching onchain data…");
    const [stored, collected] = await Promise.all([
      loadOrEmptyHistory(address),
      collectWalletQuick(address),
    ]);
    const merged = mergeActivityIntoState(stored, collected.transfers, address);
    const next = {
      ...merged,
      v2StreamStates: collected.v2StreamStates,
      historyComplete: stored.historyComplete || collected.historyComplete,
    };
    void saveWalletHistory(address, next).catch(() => {});
    return {
      transfers: collected.transfers,
      mergedHistory: next,
      historyComplete: next.historyComplete,
      v2StreamStates: collected.v2StreamStates,
    };
  }

  const r = opts.isComplete
    ? await collectWalletComplete(address)
    : await collectWalletQuick(address);

  const merged = mergeActivityIntoState(stored, r.transfers, address);
  const next = {
    ...merged,
    v2StreamStates: r.v2StreamStates,
    historyComplete: r.historyComplete,
  };
  await saveWalletHistory(address, next).catch(() => {});
  return {
    transfers: r.transfers,
    mergedHistory: next,
    historyComplete: r.historyComplete,
    v2StreamStates: r.v2StreamStates,
  };
}

export async function analyzeWalletAddress(
  address: string,
  options: AnalyzeWalletOptions = {}
): Promise<(AnalyzeWalletResult & { historyComplete?: boolean }) | null> {
  const onProgress = options.onProgress;
  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return null;
  }

  onProgress?.("Firing all data sources in parallel...");

  const pub = createBasePublicClient();
  const addrLow = address.toLowerCase();
  const isQuick = options.fetchDepth === "quick";

  const bnP = resolveBasename(address, { quick: isQuick });

  const ethPriceP = fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    { signal: AbortSignal.timeout(1200) }
  )
    .then((r) => r.json())
    .catch(() => ({ ethereum: { usd: 3200 } }));

  const balancesP = ethPriceP.then((d) =>
    fetchWalletBalances(address, d?.ethereum?.usd || 3200)
  );

  const nftSnapshotP = fetchNftSnapshot(address, [], { quick: isQuick });
  const strkP = pub
    .readContract({
      address: CHECKIN_CONTRACT as `0x${string}`,
      abi: CHECKIN_ABI,
      functionName: "streaks",
      args: [address as `0x${string}`],
    })
    .catch(() => BigInt(0));
  const lastP = pub
    .readContract({
      address: CHECKIN_CONTRACT as `0x${string}`,
      abi: CHECKIN_ABI,
      functionName: "lastCheckIn",
      args: [address as `0x${string}`],
    })
    .catch(() => BigInt(0));

  onProgress?.(
    isQuick
      ? "Calculating wallet score…"
      : "Fetching onchain history (Blockscout + Alchemy + paymaster)..."
  );

  const historyFetchP =
    options.transfers != null
      ? loadOrEmptyHistory(address).then(async (base) => {
          const merged = mergeActivityIntoState(
            base,
            options.transfers!,
            address
          );
          await saveWalletHistory(address, merged).catch(() => {});
          return {
            transfers: options.transfers!,
            mergedHistory: merged,
            historyComplete: options.historyComplete ?? false,
            v2StreamStates: options.v2StreamStates,
          };
        })
      : fetchConnectHistory(address, {
          isQuick,
          isComplete: options.fetchDepth === "complete",
          onProgress,
        }).catch(() => ({
            transfers: [] as AlchemyTransfer[],
            mergedHistory: emptyHistoryState(),
            historyComplete: false,
            v2StreamStates: undefined,
          }));

  const [
    bn,
    balances,
    historyBundle,
    dbStreak,
    dbLastCI,
    ethPriceData,
    nftSnapshot,
  ] = await Promise.all([
    bnP,
    balancesP,
    historyFetchP,
    strkP,
    lastP,
    ethPriceP,
    nftSnapshotP,
  ]);

  const allTxs = enrichTransferLegs(
    mergeTransfers([historyBundle.transfers, nftSnapshot.transfers]),
    addrLow
  );
  const nftCount = Math.max(
    nftSnapshot.nftCount,
    countNftActivityFromTransfers(allTxs, addrLow),
    estimateNftHoldingsFromTransfers(allTxs, addrLow)
  );
  const historyComplete = historyBundle.historyComplete;
  const v2StreamStates = historyBundle.v2StreamStates;

  onProgress?.(`Computing stats from ${allTxs.length} transfer legs...`);

  const fullHeatmapState = mergeActivityIntoState(
    historyBundle.mergedHistory ?? emptyHistoryState(),
    nftSnapshot.transfers,
    addrLow
  );

  const activity = isQuick
    ? rollupWalletActivity(allTxs, addrLow)
    : rollupAnalyticsActivity(allTxs, addrLow);
  // Connect/full analyze: live rollup only (d731448) — history merge inflated days without heatmap cells.
  const mergedActivity = isQuick
    ? mergeRollupWithHistory(activity, fullHeatmapState, addrLow)
    : {
        ...activity,
        mergedState: mergeActivityIntoState(fullHeatmapState, allTxs, addrLow),
      };
  const {
    participatingHashes,
    uDays,
    uWeeks,
    uMonths,
    tpd,
    monthActivity,
    mergedState: heatmapState,
  } = mergedActivity;

  const actualTxCount = participatingHashes.size;

  const streak = Number(dbStreak);
  let checkedToday = false;
  if (Number(dbLastCI) > 0) {
    const ld = new Date(Number(dbLastCI) * 1000).toISOString().slice(0, 10);
    checkedToday = ld === new Date().toISOString().slice(0, 10);
  }
  if (typeof window !== "undefined") {
    const localKey = `base_checkin_${addrLow}`;
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(localKey) === today) checkedToday = true;
    else if (checkedToday) localStorage.setItem(localKey, today);
  }

  const ms: Record<string, number> = {};

  const bridgeTxHashes = new Set<string>();
  const aaTxIds = new Set<string>();
  const paymasterTxHashes = new Set<string>();
  const ep06 = ENTRYPOINT_V06.toLowerCase();
  const ep07 = ENTRYPOINT_V07.toLowerCase();

  for (const tx of allTxs) {
    if (!countsTowardActivity(tx, addrLow)) continue;
    const toAddr = (tx.to || "").toLowerCase();
    const fromAddr = (tx.from || "").toLowerCase();
    if (
      (BRIDGE_CONTRACTS.has(toAddr) || BRIDGE_CONTRACTS.has(fromAddr)) &&
      (fromAddr === addrLow || toAddr === addrLow)
    ) {
      bridgeTxHashes.add(tx.hash);
    }

    const isUserOp =
      tx.category === "useroperation" ||
      tx.metadata?.isUserOperation === true ||
      toAddr === ep06 ||
      toAddr === ep07;

    if (isUserOp) {
      const aaId =
        (tx.metadata?.userOpHash || "").toLowerCase() ||
        `${tx.hash.toLowerCase()}-${fromAddr}-${toAddr}`;
      aaTxIds.add(aaId);
      paymasterTxHashes.add(tx.hash);
    }

    if (tx.metadata?.isSponsored === true) {
      paymasterTxHashes.add(tx.hash);
    }
    // Inbound internal zero-value legs often mark paymaster-funded execution.
    if (tx.category === "internal" && toAddr === addrLow) {
      paymasterTxHashes.add(tx.hash);
    }
    if (fromAddr === ep06 || fromAddr === ep07) {
      paymasterTxHashes.add(tx.hash);
    }
  }

  const bridgeTxCount = bridgeTxHashes.size;
  const aaTxCount = aaTxIds.size;
  // Prefer explicit AA count when higher (userOps only); never drop prior paid signals.
  const paymasterTxCount = Math.max(paymasterTxHashes.size, aaTxCount);

  const ethUSD = ethPriceData?.ethereum?.usd || 3200;
  const {
    dexTradeCount,
    dexVolumeUSD,
    dexVolumeETH,
    dexTradeCount30d,
    dexVolumeUSD30d,
    ethSwapVolumeUSD,
    totalSwapVolumeUSD,
  } = await computeSwapVolume(allTxs, addrLow, ethUSD, { quick: isQuick });

  const ethFlow = computeEthFlowVolumes(allTxs, addrLow, countsTowardActivity);
  const ethVol = ethFlow.ethSent;
  const ethReceived = ethFlow.ethReceived;

  const { uniqueHashes: erc721TxsFromTxs } = countNftTxHashesFromTransfers(
    allTxs,
    addrLow
  );
  const erc721Txs = Math.max(
    erc721TxsFromTxs,
    nftSnapshot.nftTxCount,
    nftSnapshot.mintCount > 0 ? nftSnapshot.mintCount : 0
  );

  const contractStats = countContractInteractions(
    allTxs,
    addrLow,
    paymasterTxHashes
  );
  const uContracts = contractStats.uniqueContracts;
  const defi = contractStats.defi;
  const uProtocols = contractStats.uProtocols;
  const protocolFreq = contractStats.protocolFreq;
  const hBoosts = contractStats.hBoosts;
  let hasGm = contractStats.hasGm;
  const gmCount = contractStats.gmCount;
  const checkInCount = contractStats.checkInCount;
  const cxInteract = contractStats.contractInteractions;

  const uTokens = new Set<string>();
  const tokFreq = new Map<string, number>();
  for (const a of fullHeatmapState.tokenAssets) {
    uTokens.add(a);
  }

  let swapCount = 0;
  let erc20Txs = 0;
  const processedHashes = new Set<string>();

  for (const tx of allTxs) {
    if (!tx.metadata?.blockTimestamp || !countsTowardActivity(tx, addrLow)) continue;
    const fromAddr = (tx.from || "").toLowerCase();
    const isOutgoing = fromAddr === addrLow;
    const isNewHash = !processedHashes.has(tx.hash);
    processedHashes.add(tx.hash);

    if (tx.category === "erc20") {
      erc20Txs++;
      if (isNewHash && isOutgoing) swapCount++;
    }

    if (["erc20", "erc721", "erc1155"].includes(tx.category) && tx.asset) {
      uTokens.add(tx.asset);
      tokFreq.set(tx.asset, (tokFreq.get(tx.asset) || 0) + 1);
    }
  }

  const fBoosts = hBoosts;
  if (typeof window !== "undefined") {
    if (localStorage.getItem(`base_gm_${addrLow}`) === "true") hasGm = true;
    else if (hasGm) localStorage.setItem(`base_gm_${addrLow}`, "true");
  }

  const sortedDays = Array.from(uDays).sort();
  let longest = sortedDays.length > 0 ? 1 : 0,
    runLen = sortedDays.length > 0 ? 1 : 0,
    longestInactiveDays = 0;
  for (let i = 1; i < sortedDays.length; i++) {
    const diff = Math.round(
      (new Date(sortedDays[i]).getTime() -
        new Date(sortedDays[i - 1]).getTime()) /
        86400000
    );
    if (diff === 1) {
      runLen++;
      longest = Math.max(longest, runLen);
    } else runLen = 1;
    if (diff > longestInactiveDays) longestInactiveDays = diff > 1 ? diff - 1 : 0;
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const yesterKey = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let curStreak = 0;
  if (uDays.has(todayKey) || uDays.has(yesterKey)) {
    let ptr = new Date(
      (uDays.has(todayKey) ? todayKey : yesterKey) + "T00:00:00Z"
    );
    while (uDays.has(ptr.toISOString().slice(0, 10))) {
      curStreak++;
      ptr = new Date(ptr.getTime() - 86400000);
    }
  }

  const now = new Date();
  let firstTs = now.getTime(),
    lastTs = 0,
    firstTx = "N/A",
    lastTx = "N/A",
    daysSinceActive = 0,
    daysOnBase = 0;
  if (actualTxCount > 0) {
    const stamps = allTxs
      .filter((tx) => countsTowardActivity(tx, addrLow))
      .map((tx) => new Date(tx.metadata.blockTimestamp).getTime())
      .filter((t) => !isNaN(t));
    firstTs = Math.min(...stamps);
    lastTs = Math.max(...stamps);
    firstTx = new Date(firstTs).toLocaleDateString();
    lastTx = new Date(lastTs).toLocaleDateString();
    daysSinceActive = Math.floor((now.getTime() - lastTs) / 86400000);
    daysOnBase = Math.floor((now.getTime() - firstTs) / 86400000);
  }

  const mak =
    Array.from(monthActivity.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "";
  let mostActiveMonth = "N/A";
  if (mak) {
    const [y, m] = mak.split("-");
    mostActiveMonth = `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
  }

  const avgTxPerDay =
    uDays.size > 0 ? Math.round((actualTxCount / uDays.size) * 10) / 10 : 0;
  const weeklyTxAvg =
    uWeeks.size > 0 ? Math.round((actualTxCount / uWeeks.size) * 10) / 10 : 0;

  let mostUsedProtocol = "None";
  if (protocolFreq.size > 0) {
    const top = Array.from(protocolFreq.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0];
    mostUsedProtocol =
      PROTOCOL_NAMES[top[0]] || `${top[0].slice(0, 8)}...`;
  }

  let peakDayTxCount = 0,
    peakDayDate = "N/A";
  tpd.forEach((count, date) => {
    if (count > peakDayTxCount) {
      peakDayTxCount = count;
      peakDayDate = date;
    }
  });

  const onchainAgePercentile = Math.min(
    99,
    Math.round((daysOnBase / 280) * 50)
  );
  const last30Key = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const recentDays = Array.from(uDays).filter((d) => d >= last30Key).length;
  const activityScore = Math.min(
    100,
    Math.round(recentDays * 3 + Math.min(10, uMonths.size))
  );

  const uniqueTokenCount = Math.max(
    uTokens.size,
    fullHeatmapState.tokenAssets.length
  );

  const displayTpd = new Map(tpd);
  for (const [day, count] of Object.entries(fullHeatmapState.tpd)) {
    if (count <= 0) continue;
    displayTpd.set(day, Math.max(displayTpd.get(day) ?? 0, count));
  }
  // 56ca030: active days = unique calendar days with any activity (not hash-deduped rollup only)
  for (const day of uDays) {
    if (!displayTpd.has(day) || (displayTpd.get(day) ?? 0) <= 0) {
      displayTpd.set(day, Math.max(displayTpd.get(day) ?? 0, 1));
    }
  }
  let histDays =
    actualTxCount > 0
      ? Math.max(364, Math.ceil((now.getTime() - firstTs) / 86400000) + 14)
      : 364;
  const oldestHeatmapDay = [...displayTpd.entries()]
    .filter(([, c]) => c > 0)
    .map(([d]) => d)
    .sort()[0];
  if (oldestHeatmapDay) {
    const oldestTs = new Date(`${oldestHeatmapDay}T12:00:00Z`).getTime();
    histDays = Math.max(
      histDays,
      Math.ceil((now.getTime() - oldestTs) / 86400000) + 14
    );
  }
  const dStats: DayStats[] = buildDailyStatsFromTpd(displayTpd, histDays);
  const heatmapActiveDays = dStats.filter((d) => d.count > 0).length;
  const displayUniqueDays = heatmapActiveDays;

  const { scoreComponents, score, walletRank } = buildOnchainScore({
    txCount: actualTxCount,
    uniqueDays: displayUniqueDays,
    activeMonths: uMonths.size,
    activeWeeks: uWeeks.size,
    currentStreak: curStreak,
    longestStreak: longest,
    ethVol,
    uniqueTokens: uniqueTokenCount,
    defiInteractions: defi,
    uniqueContracts: uContracts.size,
    nftCount,
    nftTxCount: erc721Txs,
    dexTradeCount,
    dexVolumeUSD: totalSwapVolumeUSD,
    ethSwapVolumeUSD,
    bridgeTxCount,
    hasBasename: !!bn,
    gmCount,
    checkInCount,
  });

  const ethBalNum = balances.eth;
  const usdcBalNum = balances.usdc;
  const portfolioValueUSD = balances.portfolioValueUSD;
  const health = calcWalletHealth({
    uniqueDays: displayUniqueDays,
    activeMonths: uMonths.size,
    currentStreak: curStreak,
    defiInteractions: defi,
    uniqueContracts: uContracts.size,
    txCount: actualTxCount,
    nftCount,
    basename: bn,
    daysSinceActive,
  });

  let recommendation = "You're a Base power user! Keep it up.";
  if (daysSinceActive > 30)
    recommendation = `⚠️ Inactive ${daysSinceActive} days! Wallet going dormant.`;
  else if (daysSinceActive > 7)
    recommendation = `⚠️ Inactive for ${daysSinceActive} days! Send a GM to revive your streak.`;
  else if (!bn)
    recommendation =
      "🆔 Get a Basename to boost your identity and score on Base!";
  else if (dexTradeCount === 0)
    recommendation =
      "💡 No DEX trades yet! Try Aerodrome or Uniswap on Base.";
  else if (defi === 0)
    recommendation = "🏦 No DeFi activity! Try Moonwell or Morpho.";
  else if (actualTxCount < 10)
    recommendation =
      "👋 Welcome to Base! Try minting an NFT or boosting your score.";

  const tCols = Math.ceil(histDays / 7);
  const wLabels: string[] = [];
  let lastML = "";
  const gStart = new Date();
  gStart.setUTCDate(gStart.getUTCDate() - histDays + 1);
  for (let col = 0; col < tCols; col++) {
    const ws = new Date(gStart);
    ws.setUTCDate(ws.getUTCDate() + col * 7);
    const mi = ws.getUTCMonth();
    if (MONTH_NAMES[mi] !== lastML) {
      wLabels.push(MONTH_NAMES[mi]);
      lastML = MONTH_NAMES[mi];
    } else wLabels.push("");
  }

  const topTokens = Array.from(tokFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map((e) => e[0]);

  function recentTxRank(tx: AlchemyTransfer): number {
    if (tx.category === "erc721" || tx.category === "erc1155") return 0;
    if (tx.category === "useroperation" || tx.metadata?.isUserOperation) return 1;
    if (tx.category === "external" && (tx.value ?? 0) > 0) return 2;
    if (tx.category === "erc20") return 3;
    if (tx.category === "internal") return 4;
    return 5;
  }

  const bestLegByHash = new Map<string, AlchemyTransfer>();
  for (const tx of allTxs) {
    if (!countsTowardActivity(tx, addrLow)) continue;
    const prev = bestLegByHash.get(tx.hash);
    if (!prev || recentTxRank(tx) < recentTxRank(prev)) {
      bestLegByHash.set(tx.hash, tx);
    }
  }

  const recentTxs = Array.from(bestLegByHash.values())
    .sort(
      (a, b) =>
        new Date(b.metadata.blockTimestamp).getTime() -
        new Date(a.metadata.blockTimestamp).getTime()
    )
    .slice(0, 10);

  const wallet: WalletData = {
    address,
    basename: bn,
    balance: ethBalNum.toFixed(4),
    usdcBalance: usdcBalNum.toFixed(2),
    ethVolume: ethVol.toFixed(4),
    txCount: actualTxCount,
    uniqueDays: displayUniqueDays,
    activeWeeks: uWeeks.size,
    activeMonths: uMonths.size,
    currentStreak: curStreak,
    longestStreak: longest,
    firstTx,
    lastTx,
    daysSinceActive,
    tokensSwapped: uniqueTokenCount,
    swapCount,
    contractInteractions: cxInteract,
    nftCount,
    walletRank,
    score: Math.min(100, score),
    historyDays: histDays,
    weekLabels: wLabels,
    dailyStats: dStats,
    topTokens,
    recommendation,
    recentTxs,
    daysOnBase,
    defiInteractions: defi,
    hasGm,
    uniqueContracts: uContracts.size,
    avgTxPerDay,
    mostActiveMonth,
    ethReceived: parseFloat(ethReceived.toFixed(4)),
    totalGasSpent: 0,
    erc20Txs,
    erc721Txs,
    gmCount,
    checkInCount,
    walletHealthScore: health.score,
    walletHealthLabel: health.label,
    scoreComponents,
    portfolioValueUSD,
    dexVolumeETH,
    dexVolumeUSD: totalSwapVolumeUSD,
    dexTradeCount,
    dexVolumeUSD30d,
    dexTradeCount30d,
    ethSwapVolumeUSD,
    aaTxCount,
    paymasterTxCount,
    bridgeTxCount,
    netETHFlow: parseFloat((ethReceived - ethVol).toFixed(4)),
    avgTxValueETH:
      actualTxCount > 0
        ? parseFloat((ethVol / actualTxCount).toFixed(6))
        : 0,
    uniqueProtocols: uProtocols.size,
    longestInactiveDays,
    weeklyTxAvg,
    onchainAgePercentile,
    mostUsedProtocol,
    activityScore,
    peakDayTxCount,
    peakDayDate,
  };

  const priorHistory = historyBundle.mergedHistory ?? emptyHistoryState();
  const mergedHistory = mergeActivityIntoState(heatmapState, allTxs, address);
  const finalHistoryComplete =
    historyComplete ||
    options.historyComplete === true ||
    priorHistory.historyComplete;
  await saveWalletHistory(address, {
    ...mergedHistory,
    historyComplete: finalHistoryComplete,
    v2StreamStates: v2StreamStates ?? mergedHistory.v2StreamStates,
    userOpsFetched:
      mergedHistory.userOpsFetched ||
      priorHistory.userOpsFetched ||
      finalHistoryComplete,
    v1SupplementFetched:
      mergedHistory.v1SupplementFetched ||
      priorHistory.v1SupplementFetched ||
      finalHistoryComplete,
  });

  return {
    wallet,
    mintedLevels: ms,
    boosts: fBoosts,
    streak,
    checkedToday,
    historyComplete: finalHistoryComplete,
    v2StreamStates: v2StreamStates ?? historyBundle.v2StreamStates,
  };
}
