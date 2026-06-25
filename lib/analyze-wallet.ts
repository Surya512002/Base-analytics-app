import { JsonRpcProvider, formatEther } from "ethers";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import {
  fetchAlchemyTxsFast,
  fetchAlchemyTxsIncoming,
  fetchNftCount,
} from "@/lib/api/alchemy";
import {
  fetchBlockscoutInternalTxs,
  fetchBlockscoutTxs,
} from "@/lib/api/blockscout";
import { BASE_RPC } from "@/lib/constants/env";
import {
  ACHIEVEMENTS_ABI,
  ACHIEVEMENTS_CONTRACT,
  BOOSTER_CONTRACT,
  BASE_BRIDGE,
  CHECKIN_ABI,
  CHECKIN_CONTRACT,
  ENTRYPOINT_V06,
  ENTRYPOINT_V07,
  GM_GN_CONTRACT,
} from "@/lib/constants/contracts";
import { DEFI_PROTOCOLS, DEX_ROUTERS, PROTOCOL_NAMES } from "@/lib/constants/protocols";
import { ACHIEVEMENTS, MONTH_NAMES } from "@/lib/constants/season";
import { getTargetTokenId } from "@/lib/utils/achievements";
import { getDayKey, getMonthKey, getWeekKey } from "@/lib/utils/dates";
import { calcWalletHealth } from "@/lib/utils/wallet-health";
import type {
  AlchemyTransfer,
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

function getDedupKey(tx: AlchemyTransfer): string {
  const valKey = tx.value ? tx.value.toFixed(6) : "0";
  return `${tx.hash}-${tx.category}-${tx.asset || "ETH"}-${(tx.from || "").toLowerCase()}-${(tx.to || "").toLowerCase()}-${valKey}`;
}

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

  onProgress?.("Awaiting all sources...");

  const [
    bn,
    balWei,
    nftCount,
    mcRes,
    alchemyOut,
    alchemyIn,
    blockscoutTxs,
    internalTxs,
    dbStreak,
    dbLastCI,
    ethPriceData,
  ] = await Promise.all([
    bnP,
    balP,
    nftP,
    mcP,
    fetchAlchemyTxsFast(address).catch(() => []),
    fetchAlchemyTxsIncoming(address).catch(() => []),
    fetchBlockscoutTxs(address).catch(() => []),
    fetchBlockscoutInternalTxs(address).catch(() => []),
    strkP,
    lastP,
    ethPriceP,
  ]);

  onProgress?.("Computing stats...");

  const txTransferMap = new Map<string, AlchemyTransfer>();
  internalTxs.forEach((tx) => txTransferMap.set(getDedupKey(tx), tx));
  blockscoutTxs.forEach((tx) => txTransferMap.set(getDedupKey(tx), tx));
  alchemyIn.forEach((tx) => txTransferMap.set(getDedupKey(tx), tx));
  alchemyOut.forEach((tx) => txTransferMap.set(getDedupKey(tx), tx));
  const allTxs = Array.from(txTransferMap.values());

  const uniqueHashes = new Set(allTxs.map((t) => t.hash));
  const actualTxCount = uniqueHashes.size;

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

  const dexTxHashes = new Set<string>();
  const bridgeTxHashes = new Set<string>();
  const outgoingHashes = new Set<string>();
  const paymasterTxHashes = new Set<string>();
  const ep06 = ENTRYPOINT_V06.toLowerCase();
  const ep07 = ENTRYPOINT_V07.toLowerCase();

  for (const tx of allTxs) {
    const toAddr = (tx.to || "").toLowerCase();
    const fromAddr = (tx.from || "").toLowerCase();
    if (fromAddr === addrLow) outgoingHashes.add(tx.hash);
    if (DEX_ROUTERS.has(toAddr) || DEX_ROUTERS.has(fromAddr))
      dexTxHashes.add(tx.hash);
    if (toAddr === BASE_BRIDGE.toLowerCase()) bridgeTxHashes.add(tx.hash);
    if (tx.category === "internal" && toAddr === addrLow)
      paymasterTxHashes.add(tx.hash);
    if (fromAddr === ep06 || fromAddr === ep07) paymasterTxHashes.add(tx.hash);
  }

  const dexTradeCount = [...dexTxHashes].filter(
    (h) => outgoingHashes.has(h) || paymasterTxHashes.has(h)
  ).length;
  const bridgeTxCount = [...bridgeTxHashes].filter((h) =>
    outgoingHashes.has(h)
  ).length;
  const paymasterTxCount = paymasterTxHashes.size;

  const STABLECOINS = new Set([
    "USDC",
    "USDBC",
    "DAI",
    "USDT",
    "0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913",
    "0XD9AAEC86B65D86F6A7B5B1B0C42FFA531710B6CA",
  ]);
  const ethUSD = ethPriceData?.ethereum?.usd || 3200;
  let dexVolumeUSD = 0;
  const txFlows = new Map<string, { outUSD: number; inUSD: number }>();

  for (const tx of allTxs) {
    if (!dexTxHashes.has(tx.hash)) continue;
    if (!outgoingHashes.has(tx.hash) && !paymasterTxHashes.has(tx.hash))
      continue;
    if (!tx.value || tx.value <= 0) continue;

    const fromAddr = (tx.from || "").toLowerCase();
    const toAddr = (tx.to || "").toLowerCase();
    let valUSD = 0;
    const assetUpper = (tx.asset || "").toUpperCase();

    if (
      assetUpper === "ETH" ||
      assetUpper === "WETH" ||
      (!tx.asset &&
        (tx.category === "external" || tx.category === "internal"))
    ) {
      valUSD = tx.value * ethUSD;
    } else if (STABLECOINS.has(assetUpper)) {
      valUSD = tx.value;
    } else {
      continue;
    }

    if (!txFlows.has(tx.hash)) txFlows.set(tx.hash, { outUSD: 0, inUSD: 0 });
    const flow = txFlows.get(tx.hash)!;
    if (fromAddr === addrLow) flow.outUSD += valUSD;
    if (toAddr === addrLow) flow.inUSD += valUSD;
  }

  for (const flow of txFlows.values()) {
    dexVolumeUSD += Math.max(flow.inUSD, flow.outUSD);
  }
  const dexVolumeETH = dexVolumeUSD / ethUSD;

  const hashDateMap = new Map<string, string>();
  for (const tx of allTxs) {
    if (!tx.metadata?.blockTimestamp) continue;
    if (!hashDateMap.has(tx.hash))
      hashDateMap.set(tx.hash, getDayKey(tx.metadata.blockTimestamp));
  }

  const uDays = new Set<string>(),
    uWeeks = new Set<string>(),
    uMonths = new Set<string>();
  const tpd = new Map<string, number>(),
    monthActivity = new Map<string, number>();

  for (const tx of allTxs) {
    if (!tx.metadata?.blockTimestamp) continue;
    const dk = getDayKey(tx.metadata.blockTimestamp);
    if (!uDays.has(dk)) {
      uDays.add(dk);
      tpd.set(dk, 0);
    }
    if (hashDateMap.get(tx.hash) === dk) {
      const prevVal = tpd.get(dk) || 0;
      const countKey = `${tx.hash}-${dk}`;
      if (!tpd.has(countKey)) {
        tpd.set(countKey, 1);
        tpd.set(dk, prevVal + 1);
      }
    }
    uWeeks.add(getWeekKey(tx.metadata.blockTimestamp));
    const mk = getMonthKey(tx.metadata.blockTimestamp);
    uMonths.add(mk);
  }

  tpd.clear();
  const hashSeenOnDay = new Set<string>();
  for (const tx of allTxs) {
    if (!tx.metadata?.blockTimestamp) continue;
    const dk = getDayKey(tx.metadata.blockTimestamp);
    const seen = `${tx.hash}-${dk}`;
    if (!hashSeenOnDay.has(seen)) {
      hashSeenOnDay.add(seen);
      tpd.set(dk, (tpd.get(dk) || 0) + 1);
    }
    const mk = getMonthKey(tx.metadata.blockTimestamp);
    monthActivity.set(mk, (monthActivity.get(mk) || 0) + 1);
  }

  const uTokens = new Set<string>(),
    uContracts = new Set<string>(),
    uProtocols = new Set<string>();
  const tokFreq = new Map<string, number>(),
    protocolFreq = new Map<string, number>();

  let ethVol = 0,
    ethReceived = 0,
    swapCount = 0,
    cxInteract = 0,
    hBoosts = 0,
    defi = 0,
    hasGm = false;
  let erc20Txs = 0,
    erc721Txs = 0,
    gmCount = 0,
    checkInCount = 0;
  const processedHashes = new Set<string>();

  for (const tx of allTxs) {
    if (!tx.metadata?.blockTimestamp) continue;
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

    const isDirectCall = tx.category === "external" && isOutgoing;
    const isSponsoredCall = paymasterTxHashes.has(tx.hash) && isIncoming;
    if ((isDirectCall || isSponsoredCall) && isNewHash) {
      cxInteract++;
      if (tx.to) uContracts.add(toAddr);
      if (DEFI_PROTOCOLS.has(toAddr)) {
        defi++;
        uProtocols.add(toAddr);
        protocolFreq.set(toAddr, (protocolFreq.get(toAddr) || 0) + 1);
      }
      if (toAddr === BOOSTER_CONTRACT.toLowerCase()) hBoosts++;
      if (toAddr === GM_GN_CONTRACT.toLowerCase()) {
        hasGm = true;
        gmCount++;
      }
      if (toAddr === CHECKIN_CONTRACT.toLowerCase()) checkInCount++;
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

  const scoreComponents: Record<string, number> = {
    txActivity: Math.min(25, actualTxCount / 20),
    consistency: Math.min(20, uDays.size / 4),
    longevity: Math.min(15, uMonths.size * 1.25),
    streak: Math.min(15, curStreak * 2),
    volume: Math.min(10, ethVol * 10),
    diversity: Math.min(10, uTokens.size),
    defiUsage: Math.min(5, defi),
  };
  const score = Math.min(
    100,
    Math.floor(Object.values(scoreComponents).reduce((a, b) => a + b, 0))
  );
  let walletRank = "Base Shrimp 🦐";
  if (score >= 30) walletRank = "Base Dolphin 🐬";
  if (score >= 50) walletRank = "Base Shark 🦈";
  if (score >= 70) walletRank = "Base Whale 🐋";
  if (score >= 85) walletRank = "Base God 👑";

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
    .slice(0, 20);

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
    dexVolumeETH: parseFloat(dexVolumeETH.toFixed(4)),
    dexVolumeUSD: parseFloat(dexVolumeUSD.toFixed(2)),
    dexTradeCount,
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
