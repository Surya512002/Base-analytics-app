import { getAddress } from "viem";
import { fetchAllCoinbaseTokenizedStocks } from "@/lib/stocks/coinbase-api";
import { runMarketDiscovery } from "@/lib/lending/discovery/engine";
import type { StockMarketItem, MarketsOverview } from "./types";

/**
 * Market overview and stock market rows, built only from real reads:
 *  - stock prices, 24h change, volume and liquidity: each stock's Base DEX pools (DexScreener)
 *  - supplied / borrowed: live lending-market discovery
 * Nothing is estimated or back-filled. History charts are left empty because we don't store
 * history; a stock without a pool is left out of the rows.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

let overviewCache: CacheEntry<MarketsOverview> | null = null;
let stocksCache: CacheEntry<StockMarketItem[]> | null = null;
const CACHE_TTL_MS = 60_000; // 60s memory TTL

/**
 * Markets overview: 24h stock DEX volume, total supplied and total borrowed.
 */
export async function fetchMarketsOverview(forceRefresh = false): Promise<MarketsOverview> {
  const now = Date.now();
  if (!forceRefresh && overviewCache && now - overviewCache.timestamp < CACHE_TTL_MS) {
    return overviewCache.data;
  }

  try {
    const [stocks, discovery] = await Promise.all([
      fetchAllCoinbaseTokenizedStocks({ forceRefresh }),
      runMarketDiscovery(8453, forceRefresh),
    ]);
    const volume24h = stocks.reduce((acc, s) => acc + (s.volume24hUsd ?? 0), 0);

    let totalSupplied = 0;
    let totalBorrowed = 0;
    for (const m of discovery.markets) {
      if (m.tvlUsd && m.tvlUsd > 0) {
        totalSupplied += m.tvlUsd;
        if (m.utilization && m.utilization > 0) {
          totalBorrowed += (m.tvlUsd * m.utilization) / 100;
        }
      }
    }

    const result: MarketsOverview = {
      volume24h: Math.round(volume24h),
      totalSupplied: Math.round(totalSupplied),
      totalBorrowed: Math.round(totalBorrowed),
      series: [],
      dataAsOf: new Date().toISOString(),
      isStale: volume24h === 0 && totalSupplied === 0,
    };

    overviewCache = { data: result, timestamp: now };
    return result;
  } catch (error) {
    console.error("[fetchMarketsOverview] Error:", error);
    if (overviewCache) {
      return { ...overviewCache.data, isStale: true };
    }
    return {
      volume24h: 0,
      totalSupplied: 0,
      totalBorrowed: 0,
      series: [],
      dataAsOf: new Date().toISOString(),
      isStale: true,
    };
  }
}

/** Friendly venue name for a DexScreener dex id. */
function venueName(dexId: string | null): string {
  if (!dexId) return "DEX";
  const map: Record<string, string> = { aerodrome: "Aerodrome", aero: "Aerodrome", uniswap: "Uniswap", pancakeswap: "PancakeSwap" };
  return map[dexId.toLowerCase()] ?? dexId.charAt(0).toUpperCase() + dexId.slice(1);
}

/**
 * Every live stock that has a Base pool: real price, 24h change, pool liquidity, and the value
 * used as collateral across lending markets.
 */
export async function fetchStockMarkets(forceRefresh = false): Promise<StockMarketItem[]> {
  const now = Date.now();
  if (!forceRefresh && stocksCache && now - stocksCache.timestamp < CACHE_TTL_MS) {
    return stocksCache.data;
  }

  try {
    const [stocks, lendingDiscovery] = await Promise.all([
      fetchAllCoinbaseTokenizedStocks({ forceRefresh }),
      runMarketDiscovery(8453, forceRefresh),
    ]);

    const collateralMap = new Map<string, number>();
    for (const m of lendingDiscovery.markets) {
      if (m.collateralAsset?.address && m.tvlUsd) {
        const addr = m.collateralAsset.address.toLowerCase();
        collateralMap.set(addr, (collateralMap.get(addr) || 0) + m.tvlUsd);
      }
      if (m.supplyAsset?.isStock && m.tvlUsd) {
        const addr = m.supplyAsset.address.toLowerCase();
        collateralMap.set(addr, (collateralMap.get(addr) || 0) + m.tvlUsd);
      }
    }

    const lastUpdated = new Date().toISOString();
    const items: StockMarketItem[] = [];
    for (const s of stocks) {
      if (s.nav == null) continue; // no pool, no price: nothing real to show
      const cleanAddr = getAddress(s.address);
      const usedCollateral = collateralMap.get(cleanAddr.toLowerCase()) ?? null;
      items.push({
        symbol: s.symbol,
        underlyingTicker: s.underlyingTicker,
        name: s.name,
        address: cleanAddr,
        decimals: s.decimals || 8,
        price: s.nav,
        change24h: s.change24h ?? 0,
        tradingLiquidity: Math.round(s.liquidityUsd ?? 0),
        priceImpact10k: null, // not measured; the swap quote shows the real impact
        usedAsCollateral: usedCollateral && usedCollateral > 0 ? Math.round(usedCollateral) : null,
        appVolumes: s.volume24hUsd ? { [venueName(s.dexId)]: Math.round(s.volume24hUsd) } : {},
        category: s.category || "other",
        priceWeek: [],
        status: "active",
        lastUpdated,
      });
    }

    items.sort((a, b) => b.tradingLiquidity - a.tradingLiquidity);
    if (items.length > 0) stocksCache = { data: items, timestamp: now };
    return items;
  } catch (error) {
    console.error("[fetchStockMarkets] Error:", error);
    if (stocksCache) return stocksCache.data;
    return [];
  }
}

/**
 * Fetch a single stock detail by symbol or address
 */
export async function fetchStockDetail(tickerOrAddress: string): Promise<StockMarketItem | null> {
  const all = await fetchStockMarkets();
  const clean = tickerOrAddress.trim().toLowerCase();
  return (
    all.find(
      (s) =>
        s.symbol.toLowerCase() === clean ||
        s.underlyingTicker.toLowerCase() === clean ||
        s.address.toLowerCase() === clean
    ) ?? null
  );
}
