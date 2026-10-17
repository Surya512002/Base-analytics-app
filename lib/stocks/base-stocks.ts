/**
 * Base Network Tokenized Stocks (Coinbase B20 Standard & RWAs)
 *
 * Full on-chain registry of tokenized US equities on Base mainnet.
 * Backed 1:1 by real stock shares held in custody (Coinbase/Alpaca, Regulation S).
 * Addresses are native Base B20 precompiles (0xb200000000000000000000...).
 * Prices sourced directly from on-chain Chainlink 24/5 equity feeds on Base.
 */

import { getAddress, type Address } from "viem";

export type BaseStock = {
  symbol: string;
  name: string;
  address: Address;
  feed: Address | null;
  decimals: number;
  category?: "tech" | "finance" | "crypto" | "aerospace" | "consumer" | "health" | "index";
};

export const BASE_STOCK_DECIMALS = 8;
export const B20_PREFIX = "0xb200000000000000000000";

/** Verified OpenLaunch deployments on Base mainnet */
export const OPENLAUNCH_FACTORY_BASE = getAddress("0x815542E8b392389A1389E22E588E4B62A67Ade72");
export const OPENLAUNCH_LOCKER_BASE = getAddress("0xcd1680D26922fcd9CabFbb8a56bA40C333fD842a");

/** Master registry of Coinbase tokenized stocks on Base mainnet (strictly EIP-55 checksummed) */
export const BASE_STOCKS: readonly BaseStock[] = [
  { symbol: "AAPLc", name: "Apple", address: getAddress("0xb200000000000000000000c2e324d24d7eecd1fb"), feed: getAddress("0x787f13dEa48Db0897CbCDD985de77809D837F988"), decimals: 8, category: "tech" },
  { symbol: "NVDAc", name: "NVIDIA", address: getAddress("0xb20000000000000000000078ee7ce2fe4908108c"), feed: getAddress("0x04689a41629776563E6822F76f2e57D148d28513"), decimals: 8, category: "tech" },
  { symbol: "TSLAc", name: "Tesla", address: getAddress("0xb2000000000000000000001e800a7f5189430cd0"), feed: getAddress("0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4"), decimals: 8, category: "tech" },
  { symbol: "COINc", name: "Coinbase", address: getAddress("0xb200000000000000000000c85a31389d71f3ecfb"), feed: getAddress("0x408e44f504A7371a345F03a73dDC96A4b48e8aa7"), decimals: 8, category: "crypto" },
  { symbol: "GOOGLc", name: "Alphabet (Google)", address: getAddress("0xb2000000000000000000002d0ba3164cc74f58b7"), feed: getAddress("0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2"), decimals: 8, category: "tech" },
  { symbol: "MSFTc", name: "Microsoft", address: getAddress("0xb200000000000000000000ab99cfa739e253872b"), feed: getAddress("0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c"), decimals: 8, category: "tech" },
  { symbol: "AMZNc", name: "Amazon", address: getAddress("0xb200000000000000000000d9192b6b456483c2e8"), feed: getAddress("0x06A8E4b3aBB3B7543d8396FB2B763d22820cB295"), decimals: 8, category: "tech" },
  { symbol: "METAc", name: "Meta Platforms", address: getAddress("0xb2000000000000000000008bc8786b856e61707c"), feed: getAddress("0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D"), decimals: 8, category: "tech" },
  { symbol: "MSTRc", name: "MicroStrategy", address: getAddress("0xb2000000000000000000004884b426556b92883d"), feed: getAddress("0xB3cE282CD188b35DA0E38D8Bc7d58e33173D202a"), decimals: 8, category: "crypto" },
  { symbol: "CRCLc", name: "Circle", address: getAddress("0xb20000000000000000000019f6e7c675b73c2e4d"), feed: getAddress("0x0231cF2635D1E17bB5c2462cc7504Ba1fBd61f33"), decimals: 8, category: "crypto" },
  { symbol: "INTCc", name: "Intel", address: getAddress("0xb2000000000000000000004aff16039ba04bdfbc"), feed: getAddress("0xAB657C39bac0D5886250D70849e2E3E008F2EECB"), decimals: 8, category: "tech" },
  { symbol: "SPCXc", name: "SpaceX", address: getAddress("0xb2000000000000000000007b9fcbd005511acbd5"), feed: getAddress("0x6A634B235903C4ad6376892180d6fF8612e3Fa68"), decimals: 8, category: "aerospace" },
  { symbol: "SNDKc", name: "Sandisk", address: getAddress("0xb200000000000000000000397293cb8cda9a10c5"), feed: getAddress("0x388b0dC46C0Fb05A74BeE0994fa5b02c6Fcca2eA"), decimals: 8, category: "tech" },
  { symbol: "PLTRc", name: "Palantir Technologies", address: getAddress("0xb2000000000000000000007d16372840df4dabbe"), feed: null, decimals: 8, category: "tech" },
  { symbol: "AMDc", name: "Advanced Micro Devices", address: getAddress("0xb2000000000000000000000d8ce462e99ee7a47b"), feed: null, decimals: 8, category: "tech" },
  { symbol: "ARMc", name: "Arm Holdings", address: getAddress("0xb20000000000000000000026215d755356e5043f"), feed: null, decimals: 8, category: "tech" },
  { symbol: "NFLXc", name: "Netflix", address: getAddress("0xb20000000000000000000058b8c947e44011dfe6"), feed: null, decimals: 8, category: "consumer" },
  { symbol: "RKLBc", name: "Rocket Lab", address: getAddress("0xb200000000000000000000e8e50cbbb9a3861a3c"), feed: null, decimals: 8, category: "aerospace" },
  { symbol: "RDDTc", name: "Reddit", address: getAddress("0xb20000000000000000000066242d4067724cb7a1"), feed: null, decimals: 8, category: "tech" },
  { symbol: "RIVNc", name: "Rivian Automotive", address: getAddress("0xb2000000000000000000003e4249c65bd6c037d9"), feed: null, decimals: 8, category: "consumer" },
  { symbol: "SOFIc", name: "SoFi Technologies", address: getAddress("0xb2000000000000000000003ef37a7c863dc1482a"), feed: null, decimals: 8, category: "finance" },
  { symbol: "PYPLc", name: "PayPal Holdings", address: getAddress("0xb200000000000000000000450ad3abe5d4846c6e"), feed: null, decimals: 8, category: "finance" },
  { symbol: "UBERc", name: "Uber Technologies", address: getAddress("0xb200000000000000000000cae20cb1446462e24c"), feed: null, decimals: 8, category: "tech" },
  { symbol: "WMTc", name: "Walmart", address: getAddress("0xb2000000000000000000008a7508619c717a7106"), feed: null, decimals: 8, category: "consumer" },
  { symbol: "BRK.Bc", name: "Berkshire Hathaway B", address: getAddress("0xb20000000000000000000024170488e788cbbcb4"), feed: null, decimals: 8, category: "finance" },
  { symbol: "PFEc", name: "Pfizer", address: getAddress("0xb20000000000000000000018fe7ec7d6dfeeb528"), feed: null, decimals: 8, category: "health" },
  { symbol: "LLYc", name: "Eli Lilly", address: getAddress("0xb200000000000000000000f1a0f91e34892e4718"), feed: null, decimals: 8, category: "health" },
  { symbol: "AVGOc", name: "Broadcom", address: getAddress("0xb200000000000000000000fc737aea6196ab5a4c"), feed: null, decimals: 8, category: "tech" },
  { symbol: "MARAc", name: "MARA Holdings", address: getAddress("0xb200000000000000000000a310e034e09186fb2d"), feed: null, decimals: 8, category: "crypto" },
  { symbol: "RIOTc", name: "Riot Platforms", address: getAddress("0xb200000000000000000000bd0c7627b663c581a6"), feed: null, decimals: 8, category: "crypto" },
  { symbol: "GMEc", name: "GameStop", address: getAddress("0xb2000000000000000000007790ed6e48e06ed935"), feed: null, decimals: 8, category: "consumer" },
  { symbol: "AMCc", name: "AMC Entertainment", address: getAddress("0xb200000000000000000000cd7e6b8042cb7c2bb5"), feed: null, decimals: 8, category: "consumer" },
];

const BY_ADDRESS = new Map<string, BaseStock>(
  BASE_STOCKS.map((s) => [s.address.toLowerCase(), s])
);

const BY_SYMBOL = new Map<string, BaseStock>(
  BASE_STOCKS.map((s) => [s.symbol.toLowerCase(), s])
);

export function getBaseStockByAddress(address: string): BaseStock | null {
  return BY_ADDRESS.get(address.toLowerCase()) ?? null;
}

export function getBaseStockBySymbol(symbol: string): BaseStock | null {
  return BY_SYMBOL.get(symbol.toLowerCase()) ?? null;
}

export function isBaseStockAddress(address: string): boolean {
  return BY_ADDRESS.has(address.toLowerCase());
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
