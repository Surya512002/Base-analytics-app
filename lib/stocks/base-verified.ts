/**
 * Base's official tokenized-stock registry.
 *
 * Source: https://www.base.org/stocks (Listings) and https://www.base.org/assets, read 2026-11-13.
 * Base states: "The full list of Coinbase Tokenized Stocks on Base. Match the contract address
 * before you buy. If a token is not on this list, Coinbase did not issue it."
 *
 * Gifting (Vouchers) and meme-pair launches (Launch) only offer these stocks. Other entries in
 * tokenized-stocks-registry.ts are NOT on Base's official list and must not be offered there.
 * When Base adds a stock, add its address here after checking it on base.org and Basescan.
 */
import type { Address } from "viem";
import {
  getTokenizedStockByAddress,
  type TokenizedStockEntry,
} from "./tokenized-stocks-registry";
import { mapEntryToBaseStock, type BaseStock } from "./base-stocks";
import {
  BASE_OFFICIAL_REGISTRY,
  BASE_OFFICIAL_REGISTRY_URL,
} from "./base-official-registry";

export const BASE_VERIFIED_SOURCE_URL = BASE_OFFICIAL_REGISTRY_URL;

/** All stocks on Base's official registry (348, read 2026-11-13). */
export const BASE_OFFICIAL_STOCKS: ReadonlyArray<{ symbol: string; name: string; address: Address }> =
  BASE_OFFICIAL_REGISTRY.map(([symbol, name, address]) => ({ symbol, name, address }));

const OFFICIAL_ADDRS = new Set(BASE_OFFICIAL_STOCKS.map((s) => s.address.toLowerCase()));

export function isBaseVerifiedStockAddress(address: string | null | undefined): boolean {
  return Boolean(address && OFFICIAL_ADDRS.has(address.toLowerCase()));
}

/**
 * Registry entries for the official stocks (keeps logos, feeds, categories). Matching is by
 * address only — never by symbol, since look-alike symbols exist.
 */
export function getVerifiedTokenizedStocks(): TokenizedStockEntry[] {
  return BASE_OFFICIAL_STOCKS.map((s) => getTokenizedStockByAddress(s.address)).filter(
    (e): e is TokenizedStockEntry => e !== null && e.status === "active"
  );
}

/** Every official stock in the app's BaseStock shape, in Base's listing order. */
export const BASE_VERIFIED_STOCKS: readonly BaseStock[] = BASE_OFFICIAL_STOCKS.map((o) => {
  const entry = getTokenizedStockByAddress(o.address);
  if (entry) return { ...mapEntryToBaseStock(entry), symbol: o.symbol, name: entry.name || o.name };
  return { symbol: o.symbol, name: o.name, address: o.address, feed: null, decimals: 8 } as BaseStock;
});

export function getVerifiedStockBySymbol(symbol: string): BaseStock | null {
  const s = symbol.trim().toLowerCase();
  return BASE_VERIFIED_STOCKS.find((x) => x.symbol.toLowerCase() === s) ?? null;
}

export function isBaseVerifiedStockSymbol(symbol: string | null | undefined): boolean {
  return Boolean(symbol && getVerifiedStockBySymbol(symbol));
}
