import type { AlchemyTransfer } from "@/lib/types/wallet";
import {
  ACHIEVEMENTS_CONTRACT,
  BOOSTER_CONTRACT,
  CHECKIN_CONTRACT,
  GM_GN_CONTRACT,
} from "@/lib/constants/contracts";
import { DEX_ROUTERS, DEFI_PROTOCOLS } from "@/lib/constants/protocols";

const WETH = "0x4200000000000000000000000000000000000006";

/** Base mainnet symbol → contract (lowercase). */
const SYMBOL_TO_ADDRESS: Record<string, string> = {
  eth: "eth",
  weth: WETH,
  usdc: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  usdbc: "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca",
  dai: "0x50c5725949a6f0c72e6c4a641f24049a917db0cb",
  usdt: "0xfde4c96c8593536e31f229ea8f37b25ada2f435a",
  usde: "0x820c137fa70c8691f0e3fc6f225d4c956d9900e2",
  cbeth: "0x2ae3f1ec7f1f2ad4a3dac6aa832b89e6e1b08893",
  wsteth: "0xc1cba3fcea764f57cd08b8e9a0aa74c1f29e2f55",
  eurc: "0x60a3e35cc302bfa44e2f138ea258988f9a7b4220",
  axlusdc: "0xedfa23602d0ec14bf2b89fa5d5077243395e085f",
};

const STABLE_OR_ETH = new Set([
  "eth",
  "weth",
  "usdc",
  "usdbc",
  "dai",
  "usdt",
  "usde",
  "eurc",
  WETH,
  ...Object.values(SYMBOL_TO_ADDRESS).filter((a) => a.startsWith("0x")),
]);

const APP_CONTRACTS = new Set(
  [
    GM_GN_CONTRACT,
    BOOSTER_CONTRACT,
    CHECKIN_CONTRACT,
    ACHIEVEMENTS_CONTRACT,
  ].map((a) => a.toLowerCase())
);

const DEX_COUNTERPARTIES = new Set([...DEX_ROUTERS, ...DEFI_PROTOCOLS]);

export interface SwapVolumeMetrics {
  dexTradeCount: number;
  dexVolumeUSD: number;
  dexVolumeETH: number;
  dexTradeCount30d: number;
  dexVolumeUSD30d: number;
  /** Native ETH/WETH legs from swap txs (USD). */
  ethSwapVolumeUSD: number;
  totalSwapVolumeUSD: number;
}

export interface EthFlowVolumes {
  /** Total ETH/WETH sent (smart-wallet aware, per-tx hash). */
  ethSent: number;
  ethReceived: number;
  /** ETH/WETH out in swap / contract txs (excludes simple peer sends). */
  ethSwapSent: number;
  swapLikeTxCount: number;
}

/**
 * ETH sent/received with smart-wallet legs. ethSwapSent = outgoing ETH in swap-like txs.
 */
export function computeEthFlowVolumes(
  allTxs: AlchemyTransfer[],
  walletAddress: string,
  activityFilter?: (tx: AlchemyTransfer, addr: string) => boolean
): EthFlowVolumes {
  const addr = walletAddress.toLowerCase();
  const byHash = new Map<string, AlchemyTransfer[]>();

  for (const tx of allTxs) {
    if (!tx.metadata?.blockTimestamp) continue;
    if (activityFilter && !activityFilter(tx, addr)) continue;
    if (!byHash.has(tx.hash)) byHash.set(tx.hash, []);
    byHash.get(tx.hash)!.push(tx);
  }

  let ethSent = 0;
  let ethReceived = 0;
  let ethSwapSent = 0;
  let swapLikeTxCount = 0;

  for (const transfers of byHash.values()) {
    const walletInTx = transfers.some(
      (t) => walletInvolved(t, addr) || t.metadata?.walletParticipated
    );
    if (!walletInTx) continue;

    let bestOut = 0;
    let bestIn = 0;
    for (const t of fungibleLegs(transfers)) {
      if (!isEthLike(normAsset(t.asset), t)) continue;
      const v = t.value ?? 0;
      if (v <= 0) continue;
      if (isWalletOutgoing(t, addr)) bestOut = Math.max(bestOut, v);
      if (isWalletIncoming(t, addr)) bestIn = Math.max(bestIn, v);
    }

    ethSent += bestOut;
    ethReceived += bestIn;

    if (bestOut > 0 && !isSimpleEthSend(transfers, addr)) {
      ethSwapSent += bestOut;
      swapLikeTxCount++;
    }
  }

  return {
    ethSent: parseFloat(ethSent.toFixed(6)),
    ethReceived: parseFloat(ethReceived.toFixed(6)),
    ethSwapSent: parseFloat(ethSwapSent.toFixed(6)),
    swapLikeTxCount,
  };
}

/** Floor swap USD with measured ETH swap legs so 6 Ξ sent ≠ $250 swap vol. */
export function reconcileSwapMetrics(
  detected: SwapVolumeMetrics,
  flow: EthFlowVolumes,
  ethUsd: number
): SwapVolumeMetrics {
  const safeEthUsd = ethUsd > 0 ? ethUsd : 3200;
  const ethSentUsd = flow.ethSent * safeEthUsd;
  const measuredSwapUsd = flow.ethSwapSent * safeEthUsd;
  const activeTrader =
    flow.swapLikeTxCount >= 2 || detected.dexTradeCount >= 2;

  // Indexed history often misses token legs on smart-wallet swaps — floor with ETH sent.
  const ethSwapVolumeUSD = Math.max(
    detected.ethSwapVolumeUSD,
    measuredSwapUsd,
    activeTrader && flow.ethSent > 0.01 ? ethSentUsd * 0.92 : 0
  );
  const totalSwapVolumeUSD = parseFloat(
    Math.max(detected.totalSwapVolumeUSD, ethSwapVolumeUSD).toFixed(2)
  );
  const dexTradeCount = Math.max(
    detected.dexTradeCount,
    flow.swapLikeTxCount
  );

  return {
    ...detected,
    dexTradeCount,
    dexVolumeUSD: totalSwapVolumeUSD,
    dexVolumeETH: parseFloat((totalSwapVolumeUSD / safeEthUsd).toFixed(4)),
    ethSwapVolumeUSD: parseFloat(ethSwapVolumeUSD.toFixed(2)),
    totalSwapVolumeUSD,
  };
}

function normAsset(asset: string | null | undefined): string {
  if (!asset) return "eth";
  const a = asset.toLowerCase();
  if (a.startsWith("0x")) return a;
  return SYMBOL_TO_ADDRESS[a] || a;
}

function isFungible(tx: AlchemyTransfer): boolean {
  return (
    tx.category === "erc20" ||
    tx.category === "erc1155" ||
    tx.category === "external" ||
    tx.category === "internal"
  );
}

function isEthLike(key: string, tx: AlchemyTransfer): boolean {
  return (
    key === "eth" ||
    key === "weth" ||
    key === WETH ||
    (!tx.asset && (tx.category === "external" || tx.category === "internal"))
  );
}

function isStableKey(key: string): boolean {
  return STABLE_OR_ETH.has(key);
}

function legUsd(
  tx: AlchemyTransfer,
  ethUsd: number,
  tokenPrices: Record<string, number>
): number {
  if (tx.value == null || tx.value <= 0) return 0;
  const key = normAsset(tx.asset);

  if (isEthLike(key, tx)) return tx.value * ethUsd;
  if (isStableKey(key)) return tx.value;
  if (key.startsWith("0x") && tokenPrices[key]) return tx.value * tokenPrices[key];

  return 0;
}

function walletInvolved(tx: AlchemyTransfer, addr: string): boolean {
  const from = (tx.from || "").toLowerCase();
  const to = (tx.to || "").toLowerCase();
  return (
    from === addr ||
    to === addr ||
    tx.metadata?.walletParticipated === true
  );
}

function isDexCounterparty(addr: string | null | undefined): boolean {
  if (!addr) return false;
  return DEX_COUNTERPARTIES.has(addr.toLowerCase());
}

function fungibleLegs(transfers: AlchemyTransfer[]): AlchemyTransfer[] {
  return transfers.filter((t) => isFungible(t) && t.value != null && t.value > 0);
}

function walletOutIn(
  transfers: AlchemyTransfer[],
  addr: string
): { out: AlchemyTransfer[]; inn: AlchemyTransfer[] } {
  const fungible = fungibleLegs(transfers);
  return {
    out: fungible.filter((t) => isWalletOutgoing(t, addr)),
    inn: fungible.filter((t) => isWalletIncoming(t, addr)),
  };
}

function isWalletOutgoing(tx: AlchemyTransfer, addr: string): boolean {
  const from = (tx.from || "").toLowerCase();
  if (from === addr) return true;
  if (
    Boolean(tx.metadata?.walletParticipated) &&
    isEthLike(normAsset(tx.asset), tx)
  ) {
    return true;
  }
  return (
    Boolean(tx.metadata?.walletParticipated) && isDexCounterparty(tx.to)
  );
}

function isWalletIncoming(tx: AlchemyTransfer, addr: string): boolean {
  const to = (tx.to || "").toLowerCase();
  if (to === addr) return true;
  return (
    Boolean(tx.metadata?.walletParticipated) && isDexCounterparty(tx.from)
  );
}

function isWalletFungibleLeg(tx: AlchemyTransfer, addr: string): boolean {
  if (!isFungible(tx) || tx.value == null || tx.value <= 0) return false;
  if (isWalletOutgoing(tx, addr) || isWalletIncoming(tx, addr)) return true;
  return Boolean(tx.metadata?.walletParticipated);
}

/** Best USD notional for wallet ETH/WETH out (smart-wallet internal legs included). */
function bestWalletEthOutUsd(
  transfers: AlchemyTransfer[],
  addr: string,
  ethUsd: number,
  tokenPrices: Record<string, number>
): number {
  let best = 0;
  for (const t of fungibleLegs(transfers)) {
    if (!isEthLike(normAsset(t.asset), t)) continue;
    if (!isWalletOutgoing(t, addr) && !isWalletFungibleLeg(t, addr)) continue;
    best = Math.max(best, legUsd(t, ethUsd, tokenPrices));
  }
  return best;
}

function isSimpleEthSend(transfers: AlchemyTransfer[], addr: string): boolean {
  const fungible = fungibleLegs(transfers);
  if (fungible.length !== 1) return false;
  if (transfers.length > 1) return false;
  const t = fungible[0];
  return (
    t.category === "external" &&
    isEthLike(normAsset(t.asset), t) &&
    (t.from || "").toLowerCase() === addr &&
    !isDexCounterparty(t.to)
  );
}

function hasNftLeg(transfers: AlchemyTransfer[]): boolean {
  return transfers.some(
    (t) => t.category === "erc721" || t.category === "erc1155"
  );
}

function isEthAsset(asset: string | null | undefined): boolean {
  const key = normAsset(asset);
  return key === "eth" || key === "weth" || key === WETH;
}

function hasEthFungibleLeg(transfers: AlchemyTransfer[]): boolean {
  return fungibleLegs(transfers).some((t) => isEthLike(normAsset(t.asset), t));
}

/** Sum USD for wallet ETH/WETH legs in a swap hash. */
function ethSwapLegUsd(
  transfers: AlchemyTransfer[],
  addr: string,
  ethUsd: number,
  tokenPrices: Record<string, number>
): number {
  let best = 0;
  for (const tx of fungibleLegs(transfers)) {
    if (!isEthAsset(tx.asset) && !isEthLike(normAsset(tx.asset), tx)) continue;
    if (!isWalletFungibleLeg(tx, addr)) continue;
    best = Math.max(best, legUsd(tx, ethUsd, tokenPrices));
  }
  return best;
}

/** Detect swaps: in+out exchange, DEX router flow, or stable↔token pattern. */
function isSwapHash(transfers: AlchemyTransfer[], addr: string): boolean {
  const walletInTx = transfers.some(
    (t) => walletInvolved(t, addr) || t.metadata?.walletParticipated
  );
  if (!walletInTx) return false;

  const hasDex = transfers.some(
    (t) => isDexCounterparty(t.from) || isDexCounterparty(t.to)
  );
  const fungible = fungibleLegs(transfers);
  const nftLeg = hasNftLeg(transfers);

  if (hasDex && fungible.length >= 1 && !nftLeg) return true;

  const { out, inn } = walletOutIn(transfers, addr);

  if (out.length && inn.length) {
    const outOnlyApp =
      out.length > 0 &&
      out.every((t) => APP_CONTRACTS.has((t.to || "").toLowerCase()));
    if (!outOnlyApp) {
      const outAssets = new Set(out.map((t) => normAsset(t.asset)));
      const inAssets = new Set(inn.map((t) => normAsset(t.asset)));
      for (const a of outAssets) {
        if (!inAssets.has(a)) return true;
      }
      for (const a of inAssets) {
        if (!outAssets.has(a)) return true;
      }
    }
  }

  if (out.some((t) => isDexCounterparty(t.to))) return true;
  if (inn.some((t) => isDexCounterparty(t.from))) return true;

  const ethLegs = fungible.filter((t) => isEthLike(normAsset(t.asset), t));
  const tokenLegs = fungible.filter(
    (t) =>
      t.category === "erc20" &&
      !isEthLike(normAsset(t.asset), t) &&
      !isStableKey(normAsset(t.asset))
  );
  const stableLegs = fungible.filter(
    (t) =>
      t.category === "erc20" &&
      isStableKey(normAsset(t.asset)) &&
      !isEthLike(normAsset(t.asset), t)
  );

  if (nftLeg && !hasDex) return false;

  if (ethLegs.length && tokenLegs.length && walletInTx) return true;
  if (ethLegs.length && stableLegs.length && walletInTx) return true;
  if (hasEthFungibleLeg(transfers) && hasDex && walletInTx) return true;

  // Aerodrome / pool swaps: wallet sends ETH/WETH in a tx that also moves ERC-20s
  const walletEthOut = ethLegs.some((t) => isWalletOutgoing(t, addr));
  const hasErc20 = fungible.some((t) => t.category === "erc20");
  if (walletEthOut && hasErc20 && walletInTx && !nftLeg) return true;

  const walletErc20In = fungible.some(
    (t) =>
      t.category === "erc20" &&
      (isWalletIncoming(t, addr) || isWalletOutgoing(t, addr))
  );
  if (walletEthOut && walletErc20In && walletInTx && !nftLeg) return true;

  // Wallet sends native ETH/WETH to a contract in a multi-leg tx (common on Base App)
  if (
    ethLegs.some((t) => isWalletFungibleLeg(t, addr)) &&
    fungible.length >= 2 &&
    walletInTx
  ) {
    return true;
  }

  // Smart-wallet: wallet has ETH + token legs in same tx
  if (walletInTx && !nftLeg) {
    const wLegs = fungible.filter((t) => isWalletFungibleLeg(t, addr));
    const hasEth = wLegs.some((t) => isEthLike(normAsset(t.asset), t));
    const hasToken = wLegs.some((t) => t.category === "erc20");
    if (hasEth && hasToken) return true;
  }

  return false;
}

/** ETH/WETH out + ERC-20 leg in same tx (Aerodrome pools, smart-wallet swaps). */
function findEthErc20Swaps(
  hashTransfers: Map<string, AlchemyTransfer[]>,
  addr: string,
  known: Set<string>,
  ethUsd: number,
  tokenPrices: Record<string, number>
): { hashes: Set<string>; volumeUsd: number; ethVolumeUsd: number } {
  const hashes = new Set<string>();
  let volumeUsd = 0;
  let ethVolumeUsd = 0;

  for (const [hash, transfers] of hashTransfers) {
    if (known.has(hash)) continue;
    const walletInTx = transfers.some(
      (t) => walletInvolved(t, addr) || t.metadata?.walletParticipated
    );
    if (!walletInTx || hasNftLeg(transfers)) continue;

    const fungible = fungibleLegs(transfers);
    const ethOut = fungible.filter(
      (t) =>
        isEthLike(normAsset(t.asset), t) && isWalletOutgoing(t, addr)
    );
    const hasErc20 = fungible.some((t) => t.category === "erc20");
    if (!ethOut.length || !hasErc20) continue;

    let bestEth = 0;
    for (const t of ethOut) {
      bestEth = Math.max(bestEth, legUsd(t, ethUsd, tokenPrices));
    }
    let bestToken = 0;
    for (const tx of fungible) {
      if (tx.category !== "erc20") continue;
      if (!isWalletIncoming(tx, addr) && !isWalletOutgoing(tx, addr)) continue;
      bestToken = Math.max(bestToken, legUsd(tx, ethUsd, tokenPrices));
    }

    const vol = Math.max(bestEth, bestToken);
    if (vol <= 0) continue;

    hashes.add(hash);
    volumeUsd += vol;
    ethVolumeUsd += bestEth;
  }

  return { hashes, volumeUsd, ethVolumeUsd };
}

/** ETH out in non-simple-send txs when token legs are missing from the index. */
function findEthOutMultiLegSwaps(
  hashTransfers: Map<string, AlchemyTransfer[]>,
  addr: string,
  userHashes: Set<string>,
  known: Set<string>,
  ethUsd: number
): { hashes: Set<string>; volumeUsd: number } {
  const hashes = new Set<string>();
  let volumeUsd = 0;

  for (const [hash, transfers] of hashTransfers) {
    if (!userHashes.has(hash) || known.has(hash)) continue;
    if (hasNftLeg(transfers)) continue;

    const fungible = fungibleLegs(transfers);
    const bestEth = bestWalletEthOutUsd(transfers, addr, ethUsd, {});
    if (bestEth <= 0) continue;

    const hasErc20 = fungible.some((t) => t.category === "erc20");
    const hasUserOp = transfers.some(
      (t) =>
        t.category === "useroperation" || t.metadata?.isUserOperation === true
    );
    const internalCount = transfers.filter((t) => t.category === "internal").length;

    const onlySimpleSend = isSimpleEthSend(transfers, addr);

    const likelySwap =
      !onlySimpleSend &&
      (hasErc20 ||
        hasUserOp ||
        internalCount > 0 ||
        fungible.length >= 2 ||
        transfers.length >= 2);

    if (!likelySwap) continue;

    hashes.add(hash);
    volumeUsd += bestEth;
  }

  return { hashes, volumeUsd };
}

/** ETH/WETH swaps missed by strict router detection (wallet ETH out + token/stable leg). */
function findSupplementalEthSwaps(
  hashTransfers: Map<string, AlchemyTransfer[]>,
  addr: string,
  known: Set<string>,
  ethUsd: number
): { hashes: Set<string>; volumeUsd: number } {
  const hashes = new Set<string>();
  let volumeUsd = 0;

  for (const [hash, transfers] of hashTransfers) {
    if (known.has(hash)) continue;
    const walletInTx = transfers.some(
      (t) => walletInvolved(t, addr) || t.metadata?.walletParticipated
    );
    if (!walletInTx) continue;
    if (hasNftLeg(transfers)) continue;

    const fungible = fungibleLegs(transfers);
    const ethOut = fungible.filter(
      (t) =>
        isEthLike(normAsset(t.asset), t) &&
        (isWalletOutgoing(t, addr) || isWalletFungibleLeg(t, addr))
    );
    if (!ethOut.length) continue;

    const otherLegs = fungible.filter(
      (t) => !isEthLike(normAsset(t.asset), t)
    );

    if (!otherLegs.length) continue;

    let bestEth = 0;
    for (const t of ethOut) {
      bestEth = Math.max(bestEth, legUsd(t, ethUsd, {}));
    }
    if (bestEth <= 0) continue;

    hashes.add(hash);
    volumeUsd += bestEth;
  }

  return { hashes, volumeUsd };
}

function collectUnpricedAddresses(
  transfers: AlchemyTransfer[],
  addr: string,
  ethUsd: number,
  tokenPrices: Record<string, number>
): string[] {
  const addrs: string[] = [];
  for (const tx of transfers) {
    if (!walletInvolved(tx, addr)) continue;
    if (tx.category !== "erc20" && tx.category !== "erc1155") continue;
    const key = normAsset(tx.asset);
    if (!key.startsWith("0x")) continue;
    if (isStableKey(key)) continue;
    if (legUsd(tx, ethUsd, tokenPrices) > 0) continue;
    addrs.push(key);
  }
  return addrs;
}

async function fetchDefiLlamaPrices(
  addresses: string[]
): Promise<Record<string, number>> {
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
  if (!unique.length) return {};

  const prices: Record<string, number> = {};
  for (let i = 0; i < unique.length; i += 80) {
    const batch = unique.slice(i, i + 80);
    const coins = batch.map((a) => `base:${a}`).join(",");
    try {
      const res = await fetch(
        `https://coins.llama.fi/prices/current/${coins}`,
        { next: { revalidate: 300 }, signal: AbortSignal.timeout(1800) }
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        coins?: Record<string, { price?: number }>;
      };
      for (const [coinKey, obj] of Object.entries(data.coins || {})) {
        const a = coinKey.split(":")[1]?.toLowerCase();
        if (a && obj.price && obj.price > 0) prices[a] = obj.price;
      }
    } catch {
      /* optional pricing */
    }
  }
  return prices;
}

async function fetchCoinGeckoPrices(
  addresses: string[]
): Promise<Record<string, number>> {
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
  if (!unique.length) return {};

  const prices: Record<string, number> = {};
  for (let i = 0; i < unique.length; i += 25) {
    const batch = unique.slice(i, i + 25);
    try {
      const url = `https://api.coingecko.com/api/v3/simple/token_price/base?contract_addresses=${batch.join(",")}&vs_currencies=usd`;
      const res = await fetch(url, {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(1800),
      });
      if (res.ok) {
        const data = (await res.json()) as Record<string, { usd?: number }>;
        for (const [a, obj] of Object.entries(data)) {
          if (obj.usd && obj.usd > 0) prices[a.toLowerCase()] = obj.usd;
        }
      }
    } catch {
      /* optional pricing */
    }
  }
  return prices;
}

async function fetchBaseTokenPrices(
  addresses: string[],
  options: { quick?: boolean } = {}
): Promise<Record<string, number>> {
  if (options.quick) {
    // Quick path: pricing is best-effort only; never block score on slow price APIs.
    // ETH/stables are priced without tokenPrices anyway, so this mainly affects long-tail ERC-20 legs.
    return await fetchDefiLlamaPrices(addresses);
  }
  const llama = await fetchDefiLlamaPrices(addresses);
  const missing = addresses.filter((a) => !llama[a.toLowerCase()]);
  if (!missing.length) return llama;
  const cg = await fetchCoinGeckoPrices(missing);
  return { ...llama, ...cg };
}

/** USD notional for one swap tx — wallet legs first, then best leg in the tx. */
function volumeForSwapHash(
  transfers: AlchemyTransfer[],
  addr: string,
  ethUsd: number,
  tokenPrices: Record<string, number>
): number {
  let walletOutUsd = 0;
  let walletInUsd = 0;
  let walletEthUsd = 0;

  for (const tx of fungibleLegs(transfers)) {
    const usd = legUsd(tx, ethUsd, tokenPrices);
    if (usd <= 0) continue;
    if (isWalletOutgoing(tx, addr)) walletOutUsd = Math.max(walletOutUsd, usd);
    if (isWalletIncoming(tx, addr)) walletInUsd = Math.max(walletInUsd, usd);
    if (isWalletFungibleLeg(tx, addr) && isEthLike(normAsset(tx.asset), tx)) {
      walletEthUsd = Math.max(walletEthUsd, usd);
    }
  }

  let vol = Math.max(walletOutUsd, walletInUsd, walletEthUsd);
  if (vol >= 1) return vol;

  let bestWalletLeg = 0;
  for (const tx of fungibleLegs(transfers)) {
    if (!isWalletFungibleLeg(tx, addr)) continue;
    const usd = legUsd(tx, ethUsd, tokenPrices);
    if (usd > bestWalletLeg) bestWalletLeg = usd;
  }
  vol = Math.max(vol, bestWalletLeg);

  let bestInTx = 0;
  for (const tx of fungibleLegs(transfers)) {
    const usd = legUsd(tx, ethUsd, tokenPrices);
    if (usd > bestInTx) bestInTx = usd;
  }

  return Math.max(vol, bestInTx);
}

export function formatDexVolumeUsd(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 10_000) return `$${(usd / 1_000).toFixed(1)}k`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(2)}k`;
  return `$${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** 30-day activity bar: $1k swap volume = full bar */
export const DEX_VOL_30D_BAR_MAX_USD = 1_000;

export function dexVolumeBarPct(usd: number): number {
  if (usd <= 0) return 0;
  return Math.min(100, Math.round((usd / DEX_VOL_30D_BAR_MAX_USD) * 100));
}

function hashTimestamp(transfers: AlchemyTransfer[]): number {
  for (const tx of transfers) {
    if (tx.metadata?.blockTimestamp) {
      return new Date(tx.metadata.blockTimestamp).getTime();
    }
  }
  return 0;
}

export async function computeSwapVolume(
  allTxs: AlchemyTransfer[],
  walletAddress: string,
  ethUsd: number,
  options: { quick?: boolean } = {}
): Promise<SwapVolumeMetrics> {
  const addr = walletAddress.toLowerCase();
  const safeEthUsd = ethUsd > 0 ? ethUsd : 3200;

  const userHashes = new Set<string>();
  const hashTransfers = new Map<string, AlchemyTransfer[]>();

  for (const tx of allTxs) {
    if (!hashTransfers.has(tx.hash)) hashTransfers.set(tx.hash, []);
    hashTransfers.get(tx.hash)!.push(tx);

    if (
      walletInvolved(tx, addr) ||
      tx.metadata?.walletParticipated === true
    ) {
      userHashes.add(tx.hash);
    }
  }

  const swapHashes = new Set<string>();
  const unpricedCandidates: string[] = [];

  for (const [hash, transfers] of hashTransfers) {
    if (!userHashes.has(hash)) continue;
    if (!isSwapHash(transfers, addr)) continue;
    swapHashes.add(hash);
    unpricedCandidates.push(
      ...collectUnpricedAddresses(transfers, addr, safeEthUsd, {})
    );
  }

  const tokenPrices = await fetchBaseTokenPrices(unpricedCandidates, {
    quick: options.quick,
  });

  const cutoff30d = Date.now() - 30 * 86400000;
  let swapVolumeUSD = 0;
  let swapVolumeUSD30d = 0;
  let swapCount30d = 0;
  let ethSwapVolumeUSD = 0;

  for (const hash of swapHashes) {
    const transfers = hashTransfers.get(hash) || [];
    const in30d = hashTimestamp(transfers) >= cutoff30d;
    const ethLegUsd = ethSwapLegUsd(transfers, addr, safeEthUsd, tokenPrices);
    const vol = Math.max(
      volumeForSwapHash(transfers, addr, safeEthUsd, tokenPrices),
      ethLegUsd
    );

    let finalVol = vol;
    if (finalVol < 1) {
      const walletEthOut = bestWalletEthOutUsd(
        transfers,
        addr,
        safeEthUsd,
        tokenPrices
      );
      if (walletEthOut > finalVol) finalVol = walletEthOut;
    }

    ethSwapVolumeUSD += ethLegUsd;
    swapVolumeUSD += finalVol;
    if (in30d) {
      swapVolumeUSD30d += finalVol;
      swapCount30d++;
    }
  }

  const ethMultiLeg = findEthOutMultiLegSwaps(
    hashTransfers,
    addr,
    userHashes,
    swapHashes,
    safeEthUsd
  );
  for (const hash of ethMultiLeg.hashes) {
    swapHashes.add(hash);
    const transfers = hashTransfers.get(hash) || [];
    const in30d = hashTimestamp(transfers) >= cutoff30d;
    const bestEth = bestWalletEthOutUsd(
      transfers,
      addr,
      safeEthUsd,
      tokenPrices
    );
    ethSwapVolumeUSD += bestEth;
    swapVolumeUSD += bestEth;
    if (in30d) {
      swapVolumeUSD30d += bestEth;
      swapCount30d++;
    }
  }

  const supplemental = findSupplementalEthSwaps(
    hashTransfers,
    addr,
    swapHashes,
    safeEthUsd
  );
  const ethErc20 = findEthErc20Swaps(
    hashTransfers,
    addr,
    swapHashes,
    safeEthUsd,
    tokenPrices
  );

  for (const hash of supplemental.hashes) {
    swapHashes.add(hash);
    const transfers = hashTransfers.get(hash) || [];
    const in30d = hashTimestamp(transfers) >= cutoff30d;
    const ethLegUsd = ethSwapLegUsd(transfers, addr, safeEthUsd, tokenPrices);
    ethSwapVolumeUSD += ethLegUsd;
    swapVolumeUSD += ethLegUsd;
    if (in30d) {
      swapVolumeUSD30d += ethLegUsd;
      swapCount30d++;
    }
  }

  for (const hash of ethErc20.hashes) {
    swapHashes.add(hash);
    const transfers = hashTransfers.get(hash) || [];
    const in30d = hashTimestamp(transfers) >= cutoff30d;
    const ethLegUsd = ethSwapLegUsd(transfers, addr, safeEthUsd, tokenPrices);
    const vol = Math.max(
      volumeForSwapHash(transfers, addr, safeEthUsd, tokenPrices),
      ethLegUsd
    );
    ethSwapVolumeUSD += ethLegUsd;
    swapVolumeUSD += vol;
    if (in30d) {
      swapVolumeUSD30d += vol;
      swapCount30d++;
    }
  }

  const totalSwapVolumeUSD = parseFloat(
    Math.max(swapVolumeUSD, ethSwapVolumeUSD).toFixed(2)
  );

  const detected: SwapVolumeMetrics = {
    dexTradeCount: swapHashes.size,
    dexVolumeUSD: totalSwapVolumeUSD,
    dexVolumeETH: parseFloat((totalSwapVolumeUSD / safeEthUsd).toFixed(4)),
    dexTradeCount30d: swapCount30d,
    dexVolumeUSD30d: parseFloat(swapVolumeUSD30d.toFixed(2)),
    ethSwapVolumeUSD: parseFloat(ethSwapVolumeUSD.toFixed(2)),
    totalSwapVolumeUSD,
  };

  const flow = computeEthFlowVolumes(allTxs, addr);
  return reconcileSwapMetrics(detected, flow, safeEthUsd);
}

/** @deprecated Use computeSwapVolume */
export async function computeDexMetrics(
  allTxs: AlchemyTransfer[],
  walletAddress: string,
  ethUsd: number
): Promise<SwapVolumeMetrics> {
  return computeSwapVolume(allTxs, walletAddress, ethUsd);
}
