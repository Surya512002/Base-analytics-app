import type {
  DiscoveryProtocol,
  DiscoveryResult,
  NormalizedMarket,
  ProtocolHealthStatus,
} from "./types";
import { DISCOVERY_SAFETY_CONFIG } from "./types";
import { morphoAdapter } from "./adapters/morpho";
import { beefyAdapter } from "./adapters/beefy";
import { pendleAdapter } from "./adapters/pendle";
import { zkfiAdapter } from "./adapters/zkfi";
import { aaveAdapter } from "./adapters/aave";
import { iporAdapter } from "./adapters/ipor";
import { aerodromeAdapter } from "./adapters/aerodrome";
import { eulerAdapter } from "./adapters/euler";
import { superformAdapter } from "./adapters/superform";
import {
  getTokenizedStockByAddress,
  isActiveStockAddress,
} from "@/lib/stocks/tokenized-stocks-registry";

// In-memory server-side discovery cache
interface CacheStore {
  result: DiscoveryResult | null;
  lastUpdatedMs: number;
  perProtocolLastGood: Partial<Record<DiscoveryProtocol, NormalizedMarket[]>>;
}

const GLOBAL_DISCOVERY_CACHE: CacheStore = {
  result: null,
  lastUpdatedMs: 0,
  perProtocolLastGood: {},
};

/**
 * Checks if a token symbol or name looks like a tokenized stock
 */
function looksLikeStockToken(symbol: string, name: string): boolean {
  const cleanSym = symbol.trim();
  if (cleanSym.endsWith("c") && cleanSym.length >= 3 && cleanSym.length <= 6) return true;
  if (cleanSym.startsWith("d") && cleanSym.length >= 3 && cleanSym.length <= 6) return true;
  if (/equity|stock|shares|nasdaq|nyse/i.test(name)) return true;
  return false;
}

/**
 * Record an unapproved candidate to pending review log
 */
function recordPendingCandidate(token: {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  protocol: string;
}) {
  try {
    // Isomorphic safety: avoid filesystem operations in client bundles
    if (typeof window !== "undefined") {
      return;
    }
    console.log(`[Discovery Engine] Candidate for review: ${token.symbol} (${token.address}) on ${token.protocol}`);
  } catch (err) {
    console.warn("[Discovery Engine] Could not process candidate:", err);
  }
}

/**
 * Executes multi-protocol market discovery on Base mainnet.
 * Never falls back to mock data.
 */
export async function runMarketDiscovery(
  chainId = 8453,
  forceRefresh = false
): Promise<DiscoveryResult> {
  const nowMs = Date.now();
  const ttlMs = DISCOVERY_SAFETY_CONFIG.CACHE_TTL_SECONDS * 1000;

  if (
    !forceRefresh &&
    GLOBAL_DISCOVERY_CACHE.result &&
    nowMs - GLOBAL_DISCOVERY_CACHE.lastUpdatedMs < ttlMs
  ) {
    return {
      ...GLOBAL_DISCOVERY_CACHE.result,
      cached: true,
    };
  }

  const adapters = [
    morphoAdapter,
    beefyAdapter,
    pendleAdapter,
    zkfiAdapter,
    aaveAdapter,
    iporAdapter,
    aerodromeAdapter,
    eulerAdapter,
    superformAdapter,
  ];

  const results = await Promise.allSettled(
    adapters.map((a) => a.discoverMarkets(chainId))
  );

  const discoveredRawMarkets: NormalizedMarket[] = [];
  const protocolStatus: Record<DiscoveryProtocol, ProtocolHealthStatus> = {
    morpho: { protocol: "morpho", status: "ok", lastSuccessfulUpdate: new Date().toISOString(), marketCount: 0 },
    beefy: { protocol: "beefy", status: "ok", lastSuccessfulUpdate: new Date().toISOString(), marketCount: 0 },
    pendle: { protocol: "pendle", status: "ok", lastSuccessfulUpdate: new Date().toISOString(), marketCount: 0 },
    zkfi: { protocol: "zkfi", status: "ok", lastSuccessfulUpdate: new Date().toISOString(), marketCount: 0 },
    aave: { protocol: "aave", status: "ok", lastSuccessfulUpdate: new Date().toISOString(), marketCount: 0 },
    moonwell: { protocol: "moonwell", status: "ok", lastSuccessfulUpdate: new Date().toISOString(), marketCount: 0 },
    ipor: { protocol: "ipor", status: "ok", lastSuccessfulUpdate: new Date().toISOString(), marketCount: 0 },
    aerodrome: { protocol: "aerodrome", status: "ok", lastSuccessfulUpdate: new Date().toISOString(), marketCount: 0 },
    euler: { protocol: "euler", status: "ok", lastSuccessfulUpdate: new Date().toISOString(), marketCount: 0 },
    superform: { protocol: "superform", status: "ok", lastSuccessfulUpdate: new Date().toISOString(), marketCount: 0 },
  };

  results.forEach((res, index) => {
    const adapter = adapters[index];
    const proto = adapter.protocol;

    if (res.status === "fulfilled") {
      const markets = res.value;
      protocolStatus[proto] = {
        protocol: proto,
        status: "ok",
        lastSuccessfulUpdate: new Date().toISOString(),
        marketCount: markets.length,
      };
      GLOBAL_DISCOVERY_CACHE.perProtocolLastGood[proto] = markets;
      discoveredRawMarkets.push(...markets);
    } else {
      console.warn(`[Discovery Engine] Protocol ${proto} discovery failed:`, res.reason);
      const cachedLastGood = GLOBAL_DISCOVERY_CACHE.perProtocolLastGood[proto] ?? [];
      protocolStatus[proto] = {
        protocol: proto,
        status: "error",
        error: res.reason instanceof Error ? res.reason.message : `Couldn't load ${adapter.protocolLabel}`,
        lastSuccessfulUpdate: protocolStatus[proto]?.lastSuccessfulUpdate || new Date().toISOString(),
        marketCount: cachedLastGood.length,
      };
      if (cachedLastGood.length > 0) {
        discoveredRawMarkets.push(...cachedLastGood);
      }
    }
  });

  // Apply Matching Rule and Safety Gates
  const approvedMarkets: NormalizedMarket[] = [];

  for (const mkt of discoveredRawMarkets) {
    const supplyAddr = mkt.supplyAsset.address;
    const collateralAddr = mkt.collateralAsset?.address;

    const isSupplyStock = isActiveStockAddress(supplyAddr);
    const isCollateralStock = collateralAddr ? isActiveStockAddress(collateralAddr) : false;

    // Check candidate matching rule
    if (!isSupplyStock && looksLikeStockToken(mkt.supplyAsset.symbol, mkt.supplyAsset.name)) {
      recordPendingCandidate({
        symbol: mkt.supplyAsset.symbol,
        name: mkt.supplyAsset.name,
        address: supplyAddr,
        decimals: mkt.supplyAsset.decimals,
        protocol: mkt.protocolLabel,
      });
    }

    if (
      mkt.collateralAsset &&
      !isCollateralStock &&
      looksLikeStockToken(mkt.collateralAsset.symbol, mkt.collateralAsset.name)
    ) {
      recordPendingCandidate({
        symbol: mkt.collateralAsset.symbol,
        name: mkt.collateralAsset.name,
        address: mkt.collateralAsset.address,
        decimals: mkt.collateralAsset.decimals,
        protocol: mkt.protocolLabel,
      });
    }

    // Only allow markets whose stock asset is active in the registry
    if (isSupplyStock || isCollateralStock) {
      // Enrich stock asset metadata from registry
      if (isSupplyStock) {
        const entry = getTokenizedStockByAddress(supplyAddr);
        if (entry) {
          mkt.supplyAsset.isStock = true;
          mkt.supplyAsset.logo = entry.logo;
          mkt.supplyAsset.name = entry.name;
        }
      }
      if (isCollateralStock && mkt.collateralAsset) {
        const entry = getTokenizedStockByAddress(collateralAddr!);
        if (entry) {
          mkt.collateralAsset.isStock = true;
          mkt.collateralAsset.logo = entry.logo;
          mkt.collateralAsset.name = entry.name;
        }
      }

      // Safety Gate 1: Check liquidity and flag low liquidity markets
      if (mkt.liquidityUsd < DISCOVERY_SAFETY_CONFIG.MIN_LIQUIDITY_USD && mkt.tvlUsd < DISCOVERY_SAFETY_CONFIG.MIN_LIQUIDITY_USD) {
        if (!mkt.riskFlags.includes("LOW_LIQUIDITY")) {
          mkt.riskFlags.push("LOW_LIQUIDITY");
        }
      }

      // Safety Gate 2: Known Oracle requirement for borrow markets
      if (mkt.type === "borrow") {
        if (!mkt.oracle.isVerified || !mkt.oracle.address) {
          mkt.canBorrow = false;
          if (!mkt.riskFlags.includes("UNKNOWN_ORACLE")) {
            mkt.riskFlags.push("UNKNOWN_ORACLE");
          }
        }
      }

      // Safety Gate 3: Caps nearly reached or paused
      if (mkt.utilization >= DISCOVERY_SAFETY_CONFIG.CAP_WARNING_THRESHOLD_PCT) {
        mkt.status = "cap_reached";
        if (!mkt.riskFlags.includes("CAP_NEARLY_REACHED")) {
          mkt.riskFlags.push("CAP_NEARLY_REACHED");
        }
      }

      approvedMarkets.push(mkt);
    }
  }

  const finalResult: DiscoveryResult = {
    markets: approvedMarkets,
    protocolStatus,
    lastUpdated: new Date().toISOString(),
    cached: false,
  };

  GLOBAL_DISCOVERY_CACHE.result = finalResult;
  GLOBAL_DISCOVERY_CACHE.lastUpdatedMs = nowMs;

  return finalResult;
}
