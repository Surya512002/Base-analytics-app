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

export const BASE_VERIFIED_SOURCE_URL = "https://www.base.org/stocks";

/** Exact contract addresses as published by Base (EIP-55 casing from basescan links). */
export const BASE_OFFICIAL_STOCKS: ReadonlyArray<{ symbol: string; name: string; address: Address }> = [
  { symbol: "NVDAc", name: "NVIDIA", address: "0xb20000000000000000000078ee7ce2fE4908108C" },
  { symbol: "METAc", name: "Meta", address: "0xb2000000000000000000008bC8786B856E61707C" },
  { symbol: "AAPLc", name: "Apple", address: "0xb200000000000000000000C2e324d24d7eEcd1fb" },
  { symbol: "GOOGLc", name: "Alphabet", address: "0xb2000000000000000000002D0BA3164cc74f58B7" },
  { symbol: "AMZNc", name: "Amazon", address: "0xb200000000000000000000d9192b6B456483C2E8" },
  { symbol: "MSFTc", name: "Microsoft", address: "0xB200000000000000000000Ab99cFa739E253872B" },
  { symbol: "MSTRc", name: "Strategy", address: "0xb2000000000000000000004884b426556b92883d" },
  { symbol: "SNDKc", name: "SanDisk", address: "0xb200000000000000000000397293Cb8cda9a10c5" },
  { symbol: "SPCXc", name: "SpaceX", address: "0xb2000000000000000000007b9fcbd005511aCBd5" },
  { symbol: "TSLAc", name: "Tesla", address: "0xb2000000000000000000001e800a7f5189430cD0" },
];

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

/** Verified stocks in the app's BaseStock shape, in Base's listing order. */
export const BASE_VERIFIED_STOCKS: readonly BaseStock[] = getVerifiedTokenizedStocks().map(mapEntryToBaseStock);

export function getVerifiedStockBySymbol(symbol: string): BaseStock | null {
  const s = symbol.trim().toLowerCase();
  return BASE_VERIFIED_STOCKS.find((x) => x.symbol.toLowerCase() === s) ?? null;
}

export function isBaseVerifiedStockSymbol(symbol: string | null | undefined): boolean {
  return Boolean(symbol && getVerifiedStockBySymbol(symbol));
}
