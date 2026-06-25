import type { AlchemyTransfer } from "@/lib/types/wallet";
import {
  ACHIEVEMENTS_CONTRACT,
  BOOSTER_CONTRACT,
  CHECKIN_CONTRACT,
  GM_GN_CONTRACT,
} from "@/lib/constants/contracts";

const WETH = "0x4200000000000000000000000000000000000006";

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
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca",
  "0x50c5725949a6f0c72e6c4a641f24049a917db0cb",
  "0xfde4c96c8593536e31f229ea8f37b25ada2f435a",
  "0x820c137fa70c8691f0e3fc6f225d4c956d9900e2",
  "0x2ae3f1ec7f1f2ad4a3dac6aa832b89e6e1b08893",
  "0xc1cba3fcea764f57cd08b8e9a0aa74c1f29e2f55",
  "0x60a3e35cc302bfa44e2f138ea258988f9a7b4220",
  "0xedfa23602d0ec14bf2b89fa5d5077243395e085f",
]);

const APP_CONTRACTS = new Set(
  [
    GM_GN_CONTRACT,
    BOOSTER_CONTRACT,
    CHECKIN_CONTRACT,
    ACHIEVEMENTS_CONTRACT,
  ].map((a) => a.toLowerCase())
);

export interface SwapVolumeMetrics {
  dexTradeCount: number;
  dexVolumeUSD: number;
  dexVolumeETH: number;
  dexTradeCount30d: number;
  dexVolumeUSD30d: number;
}

function normAsset(asset: string | null | undefined): string {
  if (!asset) return "eth";
  const a = asset.toLowerCase();
  return a.startsWith("0x") ? a : a.toLowerCase();
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
    key === "0x2ae3f1ec7f1f2ad4a3dac6aa832b89e6e1b08893" ||
    key === "0xc1cba3fcea764f57cd08b8e9a0aa74c1f29e2f55" ||
    (!tx.asset && (tx.category === "external" || tx.category === "internal"))
  );
}

function legUsd(
  tx: AlchemyTransfer,
  ethUsd: number,
  tokenPrices: Record<string, number>
): number {
  if (!tx.value || tx.value <= 0) return 0;
  const key = normAsset(tx.asset);

  if (isEthLike(key, tx)) return tx.value * ethUsd;
  if (STABLE_OR_ETH.has(key)) return tx.value;
  if (key.startsWith("0x") && tokenPrices[key]) return tx.value * tokenPrices[key];

  return 0;
}

/** Any tx where the wallet sends one asset and receives another (true swap). */
function isSwapHash(transfers: AlchemyTransfer[], addr: string): boolean {
  const fungible = transfers.filter(
    (t) => isFungible(t) && t.value != null && t.value > 0
  );

  const out = fungible.filter((t) => (t.from || "").toLowerCase() === addr);
  const inn = fungible.filter((t) => (t.to || "").toLowerCase() === addr);

  if (out.length === 0 || inn.length === 0) return false;

  const outOnlyApp =
    out.length > 0 &&
    out.every((t) => APP_CONTRACTS.has((t.to || "").toLowerCase()));

  return !outOnlyApp;
}

function collectUnpricedAddresses(
  transfers: AlchemyTransfer[],
  addr: string,
  ethUsd: number,
  tokenPrices: Record<string, number>
): string[] {
  const addrs: string[] = [];
  for (const tx of transfers) {
    if (tx.category !== "erc20" && tx.category !== "erc1155") continue;
    const from = (tx.from || "").toLowerCase();
    const to = (tx.to || "").toLowerCase();
    if (from !== addr && to !== addr) continue;
    const key = normAsset(tx.asset);
    if (!key.startsWith("0x")) continue;
    if (STABLE_OR_ETH.has(key)) continue;
    if (legUsd(tx, ethUsd, tokenPrices) > 0) continue;
    addrs.push(key);
  }
  return addrs;
}

async function fetchBaseTokenPrices(
  addresses: string[]
): Promise<Record<string, number>> {
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
  if (!unique.length) return {};

  const prices: Record<string, number> = {};

  for (let i = 0; i < unique.length; i += 25) {
    const batch = unique.slice(i, i + 25);
    try {
      const url = `https://api.coingecko.com/api/v3/simple/token_price/base?contract_addresses=${batch.join(",")}&vs_currencies=usd`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as Record<string, { usd?: number }>;
        for (const [addr, obj] of Object.entries(data)) {
          if (obj.usd && obj.usd > 0) prices[addr.toLowerCase()] = obj.usd;
        }
      }
    } catch {
      /* optional pricing */
    }
    if (i + 25 < unique.length) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  return prices;
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
  ethUsd: number
): Promise<SwapVolumeMetrics> {
  const addr = walletAddress.toLowerCase();
  const safeEthUsd = ethUsd > 0 ? ethUsd : 3200;

  const userHashes = new Set<string>();
  const hashTransfers = new Map<string, AlchemyTransfer[]>();

  for (const tx of allTxs) {
    const from = (tx.from || "").toLowerCase();
    const to = (tx.to || "").toLowerCase();

    if (!hashTransfers.has(tx.hash)) hashTransfers.set(tx.hash, []);
    hashTransfers.get(tx.hash)!.push(tx);

    if (from === addr || to === addr) userHashes.add(tx.hash);
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

  const tokenPrices = await fetchBaseTokenPrices(unpricedCandidates);

  const cutoff30d = Date.now() - 30 * 86400000;
  let swapVolumeUSD = 0;
  let swapVolumeUSD30d = 0;
  let swapCount30d = 0;

  for (const hash of swapHashes) {
    const transfers = hashTransfers.get(hash) || [];
    const in30d = hashTimestamp(transfers) >= cutoff30d;
    let inUsd = 0;
    let outUsd = 0;

    for (const tx of transfers) {
      const from = (tx.from || "").toLowerCase();
      const to = (tx.to || "").toLowerCase();
      const usd = legUsd(tx, safeEthUsd, tokenPrices);
      if (usd <= 0) continue;
      if (from === addr) outUsd += usd;
      if (to === addr) inUsd += usd;
    }

    const vol = Math.max(inUsd, outUsd);
    swapVolumeUSD += vol;
    if (in30d) {
      swapVolumeUSD30d += vol;
      swapCount30d++;
    }
  }

  return {
    dexTradeCount: swapHashes.size,
    dexVolumeUSD: parseFloat(swapVolumeUSD.toFixed(2)),
    dexVolumeETH: parseFloat((swapVolumeUSD / safeEthUsd).toFixed(4)),
    dexTradeCount30d: swapCount30d,
    dexVolumeUSD30d: parseFloat(swapVolumeUSD30d.toFixed(2)),
  };
}

/** @deprecated Use computeSwapVolume */
export async function computeDexMetrics(
  allTxs: AlchemyTransfer[],
  walletAddress: string,
  ethUsd: number
): Promise<SwapVolumeMetrics> {
  return computeSwapVolume(allTxs, walletAddress, ethUsd);
}
