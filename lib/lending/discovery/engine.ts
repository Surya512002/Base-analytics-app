import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  DiscoveryProtocol,
  DiscoveryResult,
  NormalizedMarket,
  ProtocolHealthStatus,
} from "./types";
import { DISCOVERY_SAFETY_CONFIG } from "./types";
import { morphoAdapter } from "./adapters/morpho";
import { aaveAdapter } from "./adapters/aave";
import { moonwellAdapter } from "./adapters/moonwell";
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
 * Record an unapproved candidate to pending-review.json
 */
function recordPendingCandidate(token: {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  protocol: string;
}) {
  try {
    const pendingPath = resolve(process.cwd(), "lib/stocks/pending-review.json");
    let currentData = { lastUpdated: new Date().toISOString(), candidates: [] as any[] };
    try {
      const raw = readFileSync(pendingPath, "utf-8");
      currentData = JSON.parse(raw);
    } catch {
      // fresh
    }

    const exists = currentData.candidates.some(
      (c: any) => c.address.toLowerCase() === token.address.toLowerCase()
    );

    if (!exists) {
      currentData.candidates.push({
        symbol: token.symbol,
        name: token.name,
        underlyingTicker: token.symbol.replace(/c$|^d/, ""),
        address: token.address,
        decimals: token.decimals,
        status: "pending",
        discoveredAt: new Date().toISOString(),
        notes: `Automatically discovered in ${token.protocol} lending market. Awaiting review before approval.`,
      });
      currentData.lastUpdated = new Date().toISOString();
      writeFileSync(pendingPath, JSON.stringify(currentData, null, 2), "utf-8");
      console.log(`[Discovery Engine] Recorded candidate for review: ${token.symbol} (${token.address})`);
    }
  } catch (err) {
    console.warn("[Discovery Engine] Could not update pending review file:", err);
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
    aaveAdapter,
    moonwellAdapter,
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
    aave: { protocol: "aave", status: "ok", lastSuccessfulUpdate: new Date().toISOString(), marketCount: 0 },
    moonwell: { protocol: "moonwell", status: "ok", lastSuccessfulUpdate: new Date().toISOString(), marketCount: 0 },
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
