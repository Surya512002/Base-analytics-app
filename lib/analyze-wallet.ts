import { JsonRpcProvider, formatEther } from "ethers";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import {
  fetchNftCount,
} from "@/lib/api/alchemy";
import { fetchWalletTransfersMerged } from "@/lib/api/fetch-wallet-transfers";
import { BASE_RPC } from "@/lib/constants/env";
import {
  ACHIEVEMENTS_ABI,
  ACHIEVEMENTS_CONTRACT,
  CHECKIN_ABI,
  CHECKIN_CONTRACT,
  ENTRYPOINT_V06,
  ENTRYPOINT_V07,
} from "@/lib/constants/contracts";
import { BRIDGE_CONTRACTS, PROTOCOL_NAMES } from "@/lib/constants/protocols";
import { ACHIEVEMENTS, MONTH_NAMES } from "@/lib/constants/season";
import { getTargetTokenId } from "@/lib/utils/achievements";
import {
  countContractInteractions,
  rollupWalletActivity,
  walletInvolved,
} from "@/lib/utils/wallet-activity";
import { calcWalletHealth } from "@/lib/utils/wallet-health";
import { computeSwapVolume } from "@/lib/utils/swap-volume";
import {
  computeScoreComponents,
  computeTotalScore,
  computeWalletRank,
} from "@/lib/utils/score";
import type {
  AnalyzeWalletResult,
  DayStats,
  WalletData,
} from "@/lib/types/wallet";

const BASE_REVERSE_REGISTRAR =
  "0x79EA96012eEa67A83431F1701B3dFf7e37F9E282" as `0x${string}`;
const BASE_L2_RESOLVER =
  "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD" as `0x${string}`;

const REVERSE_REGISTRAR_ABI = [
  {
    name: "node",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

const NAME_RESOLVER_ABI = [
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

export async function analyzeWalletAddress(
  address: string,
  onProgress?: (msg: string) => void
): Promise<AnalyzeWalletResult | null> {
  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return null;
  }

  onProgress?.("Firing all data sources in parallel...");

  const provider = new JsonRpcProvider(BASE_RPC);
  const pub = createPublicClient({ chain: base, transport: http(BASE_RPC) });
  const addrLow = address.toLowerCase();

  const bnP = pub
    .readContract({
      address: BASE_REVERSE_REGISTRAR,
      abi: REVERSE_REGISTRAR_ABI,
      functionName: "node",
      args: [address as `0x${string}`],
    })
    .then(async (rn) => {
      if (!rn) return null;
      const n = await pub
        .readContract({
          address: BASE_L2_RESOLVER,
          abi: NAME_RESOLVER_ABI,
          functionName: "name",
          args: [rn],
        })
        .catch(() => null);
      return n && typeof n === "string" && n.trim() !== "" ? n : null;
    })
    .catch(() => null);

  const balP = provider.getBalance(address).catch(() => BigInt(0));
  const nftP = fetchNftCount(address);
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
  const ethPriceP = fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
  )
    .then((r) => r.json())
    .catch(() => ({ ethereum: { usd: 3200 } }));

  const calls: {
    address: `0x${string}`;
    abi: typeof ACHIEVEMENTS_ABI;
    functionName: "hasMinted";
    args: readonly [`0x${string}`, bigint];
  }[] = [];
  const callMap: { catId: string; level: number }[] = [];
  for (const cat of ACHIEVEMENTS) {
    for (let i = cat.thresholds.length; i >= 1; i--) {
      const tid = getTargetTokenId(cat.baseId, cat.thresholds.length, i);
      calls.push({
        address: ACHIEVEMENTS_CONTRACT as `0x${string}`,
        abi: ACHIEVEMENTS_ABI,
        functionName: "hasMinted",
        args: [address as `0x${string}`, BigInt(tid)],
      });
      callMap.push({ catId: cat.id, level: i });
    }
  }
  const mcP = pub.multicall({ contracts: calls }).catch(() => []);

  onProgress?.("Fetching onchain history (Alchemy + Blockscout + paymaster)...");

  const [
    bn,
    balWei,
    nftCount,
    mcRes,
    allTxs,
    dbStreak,
    dbLastCI,
    ethPriceData,
  ] = await Promise.all([
    bnP,
    balP,
    nftP,
    mcP,
    fetchWalletTransfersMerged(address)
      .then((r) => r.transfers)
      .catch(() => []),
    strkP,
    lastP,
    ethPriceP,
  ]);

  onProgress?.(`Computing stats from ${allTxs.length} transfer legs...`);

  const activity = rollupWalletActivity(allTxs, addrLow);
  const {
    participatingHashes,
    uDays,
    uWeeks,
    uMonths,
    tpd,
    monthActivity,
  } = activity;

  const actualTxCount = participatingHashes.size;

  const streak = Number(dbStreak);
  let checkedToday = false;
  if (Number(dbLastCI) > 0) {
    const ld = new Date(Number(dbLastCI) * 1000).toISOString().slice(0, 10);
    checkedToday = ld === new Date().toISOString().slice(0, 10);
  }

  const ms: Record<string, number> = {};
  if (Array.isArray(mcRes)) {
    (mcRes as { status: string; result?: unknown }[]).forEach((r, i) => {
      const { catId, level } = callMap[i];
      if (r.status === "success" && r.result === true) {
        if (!ms[catId] || ms[catId] < level) ms[catId] = level;
      }
    });
  }

  const bridgeTxHashes = new Set<string>();
  const paymasterTxHashes = new Set<string>();
  const ep06 = ENTRYPOINT_V06.toLowerCase();
  const ep07 = ENTRYPOINT_V07.toLowerCase();

  for (const tx of allTxs) {
    const toAddr = (tx.to || "").toLowerCase();
    const fromAddr = (tx.from || "").toLowerCase();
    if (!walletInvolved(tx, addrLow)) continue;
    if (
      (BRIDGE_CONTRACTS.has(toAddr) || BRIDGE_CONTRACTS.has(fromAddr)) &&
      (fromAddr === addrLow || toAddr === addrLow)
    ) {
      bridgeTxHashes.add(tx.hash);
    }
    if (tx.metadata?.isSponsored || tx.metadata?.isUserOperation) {
      paymasterTxHashes.add(tx.hash);
    }
    if (tx.category === "internal" && toAddr === addrLow)
      paymasterTxHashes.add(tx.hash);
    if (fromAddr === ep06 || fromAddr === ep07) paymasterTxHashes.add(tx.hash);
  }

  const bridgeTxCount = bridgeTxHashes.size;
  const paymasterTxCount = paymasterTxHashes.size;

  const ethUSD = ethPriceData?.ethereum?.usd || 3200;
  const {
    dexTradeCount,
    dexVolumeUSD,
    dexVolumeETH,
    dexTradeCount30d,
    dexVolumeUSD30d,
  } = await computeSwapVolume(allTxs, addrLow, ethUSD);

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

  let ethVol = 0;
  let ethReceived = 0;
  let swapCount = 0;
  let erc20Txs = 0;
  let erc721Txs = 0;
  const processedHashes = new Set<string>();

  for (const tx of allTxs) {
    if (!tx.metadata?.blockTimestamp || !walletInvolved(tx, addrLow)) continue;
    const fromAddr = (tx.from || "").toLowerCase();
    const toAddr = (tx.to || "").toLowerCase();
    const isOutgoing = fromAddr === addrLow;
    const isIncoming = toAddr === addrLow;
    const isNewHash = !processedHashes.has(tx.hash);
    processedHashes.add(tx.hash);

    if (
      tx.value &&
      tx.value > 0 &&
      (tx.asset === "ETH" || tx.asset === "WETH")
    ) {
      if (isOutgoing && isNewHash) ethVol += tx.value;
      if (isIncoming && isNewHash) ethReceived += tx.value;
    }

    if (tx.category === "erc20") {
      erc20Txs++;
      if (isNewHash && isOutgoing) swapCount++;
    }
    if (tx.category === "erc721") erc721Txs++;

    if (["erc20", "erc721", "erc1155"].includes(tx.category) && tx.asset) {
      uTokens.add(tx.asset);
      tokFreq.set(tx.asset, (tokFreq.get(tx.asset) || 0) + 1);
    }
  }

  let fBoosts = hBoosts;
  if (typeof window !== "undefined") {
    const c = localStorage.getItem(`base_boosts_${addrLow}`);
    if (c) {
      const p = parseInt(c, 10);
      if (p > fBoosts) fBoosts = p;
    }
    localStorage.setItem(`base_boosts_${addrLow}`, fBoosts.toString());
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
    if (diff > longestInactiveDays) longestInactiveDays = diff;
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
      .filter((tx) => walletInvolved(tx, addrLow))
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

  const scoreComponents = computeScoreComponents({
    txCount: actualTxCount,
    uniqueDays: uDays.size,
    activeMonths: uMonths.size,
    activeWeeks: uWeeks.size,
    currentStreak: curStreak,
    longestStreak: longest,
    ethVol,
    uniqueTokens: uTokens.size,
    defiInteractions: defi,
    uniqueContracts: uContracts.size,
    nftCount,
    dexTradeCount,
    dexVolumeUSD,
    bridgeTxCount,
    hasBasename: !!bn,
    gmCount,
    checkInCount,
  });
  const score = computeTotalScore(scoreComponents);
  const walletRank = computeWalletRank(score);

  const ethBalNum = parseFloat(formatEther(balWei));
  const portfolioValueUSD = parseFloat((ethBalNum * ethUSD).toFixed(2));
  const health = calcWalletHealth({
    uniqueDays: uDays.size,
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

  const histDays =
    actualTxCount > 0
      ? Math.max(364, Math.ceil((now.getTime() - firstTs) / 86400000) + 14)
      : 364;
  const dStats: DayStats[] = [];
  const hPtr = new Date(now);
  for (let i = 0; i < histDays; i++) {
    const ds = hPtr.toISOString().slice(0, 10);
    const c = tpd.get(ds) || 0;
    let intensity = 0;
    if (c > 0) intensity = 1;
    if (c > 2) intensity = 2;
    if (c > 5) intensity = 3;
    if (c > 10) intensity = 4;
    dStats.unshift({ date: ds, count: c, intensity });
    hPtr.setUTCDate(hPtr.getUTCDate() - 1);
  }
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
  const seenHash = new Set<string>();
  const recentTxs = [...allTxs]
    .filter((tx) => walletInvolved(tx, addrLow))
    .sort(
      (a, b) =>
        new Date(b.metadata.blockTimestamp).getTime() -
        new Date(a.metadata.blockTimestamp).getTime()
    )
    .filter((tx) => {
      if (seenHash.has(tx.hash)) return false;
      seenHash.add(tx.hash);
      return true;
    })
    .slice(0, 10);

  const wallet: WalletData = {
    address,
    basename: bn,
    balance: ethBalNum.toFixed(4),
    ethVolume: ethVol.toFixed(4),
    txCount: actualTxCount,
    uniqueDays: uDays.size,
    activeWeeks: uWeeks.size,
    activeMonths: uMonths.size,
    currentStreak: curStreak,
    longestStreak: longest,
    firstTx,
    lastTx,
    daysSinceActive,
    tokensSwapped: uTokens.size,
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
    dexVolumeUSD,
    dexTradeCount,
    dexVolumeUSD30d,
    dexTradeCount30d,
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

  return {
    wallet,
    mintedLevels: ms,
    boosts: fBoosts,
    streak,
    checkedToday,
  };
}
