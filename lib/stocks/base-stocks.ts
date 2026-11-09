/**
 * Base Network Tokenized Stocks
 *
 * Sourced directly from single source of truth: `lib/stocks/tokenized-stocks-registry.ts`
 * Backed 1:1 by real stock shares held in custody (Coinbase/Alpaca, Regulation S).
 * Addresses are native Base B20 precompiles (0xb200000000000000000000...).
 * Prices sourced directly from on-chain Chainlink 24/5 equity feeds on Base.
 */

import { getAddress, type Address } from "viem";
import {
  TOKENIZED_STOCKS_REGISTRY,
  type TokenizedStockEntry,
  type StockCategory,
  getActiveTokenizedStocks,
  getTokenizedStockByAddress,
  getTokenizedStockBySymbol,
  isActiveStockAddress,
  isRegisteredStockAddress,
  getStockCategoryCounts,
  getStocksByCategory,
  isNewStock,
} from "./tokenized-stocks-registry";

export {
  TOKENIZED_STOCKS_REGISTRY,
  type TokenizedStockEntry,
  type StockCategory,
  getActiveTokenizedStocks,
  getTokenizedStockByAddress,
  getTokenizedStockBySymbol,
  isActiveStockAddress,
  isRegisteredStockAddress,
  getStockCategoryCounts,
  getStocksByCategory,
  isNewStock,
};

export type BaseStock = {
  symbol: string;
  name: string;
  address: Address;
  feed: Address | null;
  decimals: number;
  category?: string;
  underlyingTicker?: string;
  issuer?: string;
  logo?: string;
  status?: string;
  addedAt?: string;
};

export const BASE_STOCK_DECIMALS = 8;
export const B20_PREFIX = "0xb200000000000000000000";

/** Central stock symbol alias mapping (e.g. IPOR/Aerodrome GOOGc <-> Canonical GOOGLc) */
export const STOCK_SYMBOL_ALIASES: Record<string, string> = {
  GOOGc: "GOOGLc",
  googc: "GOOGLc",
  GOOG: "GOOGLc",
  goog: "GOOGLc",
};

/** Normalize any external or protocol symbol to its canonical registry symbol */
export function normalizeStockSymbol(symbol: string): string {
  if (!symbol) return "";
  const clean = symbol.trim();
  return STOCK_SYMBOL_ALIASES[clean] || STOCK_SYMBOL_ALIASES[clean.toLowerCase()] || clean;
}

/** Check if two stock symbols or variants refer to the same underlying stock */
export function areStockSymbolsEquivalent(symA: string, symB: string): boolean {
  if (!symA || !symB) return false;
  const normA = normalizeStockSymbol(symA).toLowerCase();
  const normB = normalizeStockSymbol(symB).toLowerCase();
  if (normA === normB) return true;
  // Also match ticker without 'c' suffix if applicable
  const baseA = normA.endsWith("c") ? normA.slice(0, -1) : normA;
  const baseB = normB.endsWith("c") ? normB.slice(0, -1) : normB;
  return baseA === baseB;
}

/** Verified OpenLaunch deployments on Base mainnet */
export const OPENLAUNCH_FACTORY_BASE = getAddress("0x815542E8b392389A1389E22E588E4B62A67Ade72");
export const OPENLAUNCH_LOCKER_BASE = getAddress("0xcd1680D26922fcd9CabFbb8a56bA40C333fD842a");

/** Map active registry entries into BaseStock format */
export function mapEntryToBaseStock(entry: TokenizedStockEntry): BaseStock {
  return {
    symbol: entry.symbol,
    name: entry.name,
    address: entry.address,
    feed: entry.priceFeed.address ?? null,
    decimals: entry.decimals,
    category: entry.category.toLowerCase(),
    underlyingTicker: entry.underlyingTicker,
    issuer: entry.issuer,
    logo: entry.logo,
    status: entry.status,
    addedAt: entry.addedAt,
  };
}

/**
 * Derived list of active verified tokenized stocks on Base mainnet.
 * Generated dynamically from single source of truth registry.
 */
export const BASE_STOCKS: readonly BaseStock[] = getActiveTokenizedStocks().map(mapEntryToBaseStock);

/** Full catalog of all 260+ tokenized stocks in registry */
export const ALL_BASE_STOCKS: readonly BaseStock[] = TOKENIZED_STOCKS_REGISTRY.map(mapEntryToBaseStock);

export function getBaseStockByAddress(address: string): BaseStock | null {
  const found = getTokenizedStockByAddress(address);
  return found ? mapEntryToBaseStock(found) : null;
}

export function getBaseStockBySymbol(symbol: string): BaseStock | null {
  if (!symbol) return null;
  const canonical = normalizeStockSymbol(symbol);
  const found = getTokenizedStockBySymbol(canonical) || getTokenizedStockBySymbol(symbol);
  return found ? mapEntryToBaseStock(found) : null;
}

export function isBaseStockAddress(address: string): boolean {
  return isActiveStockAddress(address);
}

export function getPricedStocks(): BaseStock[] {
  return BASE_STOCKS.filter((s) => s.feed !== null);
}

export function searchBaseStocks(query: string, limit = 10): BaseStock[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return BASE_STOCKS.slice(0, limit);

  return BASE_STOCKS.filter(
    (s) =>
      s.symbol.toLowerCase().includes(clean) ||
      s.name.toLowerCase().includes(clean) ||
      s.address.toLowerCase() === clean
  ).slice(0, limit);
}
