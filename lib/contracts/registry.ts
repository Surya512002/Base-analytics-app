import { getAddress, type Address } from "viem";

export type ContractRegistryEntry = {
  id: string;
  name: string;
  address: Address;
  category: "core" | "protocol" | "token" | "stock" | "oracle" | "infrastructure";
  officialDocsUrl: string;
  verifiedOnBasescan: boolean;
  matchesDocs: boolean;
  notes?: string;
};

/**
 * MASTER CONTRACT REGISTRY FOR BASE MAINNET (CHAIN ID 8453)
 * Single source of truth for all on-chain addresses across Base Analytics App.
 * Every address is strictly checksummed via viem `getAddress`.
 */
export const BASE_MAINNET_REGISTRY: Record<string, ContractRegistryEntry> = {
  // ── INFRASTRUCTURE & CORE APP ──
  ENTRYPOINT_V06: {
    id: "entrypoint-v06",
    name: "ERC-4337 EntryPoint v0.6",
    address: getAddress("0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"),
    category: "infrastructure",
    officialDocsUrl: "https://docs.erc4337.io",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  ENTRYPOINT_V07: {
    id: "entrypoint-v07",
    name: "ERC-4337 EntryPoint v0.7",
    address: getAddress("0x0000000071727De22E5E9d8BAf0edAc6f37da032"),
    category: "infrastructure",
    officialDocsUrl: "https://docs.erc4337.io",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  BASE_BRIDGE: {
    id: "base-bridge",
    name: "Base Standard Bridge (L2)",
    address: getAddress("0x4200000000000000000000000000000000000010"),
    category: "infrastructure",
    officialDocsUrl: "https://docs.base.org/base-contracts/#base-mainnet",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  PLATFORM_TREASURY: {
    id: "platform-treasury",
    name: "Base Analytics App Platform Treasury",
    address: getAddress("0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F"),
    category: "core",
    officialDocsUrl: "https://basescan.org/address/0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F",
    verifiedOnBasescan: true,
    matchesDocs: true,
    notes: "Platform fee recipient for swaps and B20 launchpad fees (0.25% creator / 0.25% platform)",
  },
  CHECKIN_CONTRACT: {
    id: "checkin-contract",
    name: "Daily Check-in Streak Contract",
    address: getAddress("0xABc7099C631E18640ea60b25116407aa17354FBb"),
    category: "core",
    officialDocsUrl: "https://basescan.org/address/0xABc7099C631E18640ea60b25116407aa17354FBb",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  ACHIEVEMENTS_CONTRACT: {
    id: "achievements-contract",
    name: "Base Analytics ERC-1155 Badges",
    address: getAddress("0xadb8120B4B18b892cFAD171243074487122Dea03"),
    category: "core",
    officialDocsUrl: "https://basescan.org/address/0xadb8120B4B18b892cFAD171243074487122Dea03",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  BOOSTER_CONTRACT: {
    id: "booster-contract",
    name: "Daily Score Booster Contract",
    address: getAddress("0x0d1BE33F8B6a33BeEe7b3bb834DF6f8c168B2e46"),
    category: "core",
    officialDocsUrl: "https://basescan.org/address/0x0d1BE33F8B6a33BeEe7b3bb834DF6f8c168B2e46",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  GM_GN_CONTRACT: {
    id: "gm-gn-contract",
    name: "GM/GN On-chain Daily Action",
    address: getAddress("0xdb4f873B33F448aeA8Bb2b3B7e3ab9561329608A"),
    category: "core",
    officialDocsUrl: "https://basescan.org/address/0xdb4f873B33F448aeA8Bb2b3B7e3ab9561329608A",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },

  // ── DEFI PROTOCOLS ──
  MORPHO_BLUE: {
    id: "morpho-blue",
    name: "Morpho Blue Base Singleton",
    address: getAddress("0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb"),
    category: "protocol",
    officialDocsUrl: "https://docs.morpho.org/morpho-blue/addresses",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  MORPHO_MIDNIGHT: {
    id: "morpho-midnight",
    name: "Morpho Blue Midnight Market / Bundler",
    address: getAddress("0xbBBBbbbC7a483B6F67D4fC4b24894e0341773099"),
    category: "protocol",
    officialDocsUrl: "https://docs.morpho.org",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  AAVE_V3_POOL: {
    id: "aave-v3-pool",
    name: "Aave V3 Pool Base",
    address: getAddress("0xA238Dd80C259a72e81d7e4664a9801593F98d1c5"),
    category: "protocol",
    officialDocsUrl: "https://docs.aave.com/developers/deployed-contracts/v3-mainnet/base",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  MOONWELL_COMPTROLLER: {
    id: "moonwell-comptroller",
    name: "Moonwell Comptroller Base",
    address: getAddress("0xfBb21d0380beE3312B33c4353c8936a0F13EF26C"),
    category: "protocol",
    officialDocsUrl: "https://docs.moonwell.fi/moonwell/protocol-information/contracts-addresses",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  MOONWELL_MUSDC: {
    id: "moonwell-musdc",
    name: "Moonwell mUSDC",
    address: getAddress("0xeDc817A28E8B93Ca689afb215a5552c41326118B"),
    category: "protocol",
    officialDocsUrl: "https://docs.moonwell.fi/moonwell/protocol-information/contracts-addresses",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  MOONWELL_MWETH: {
    id: "moonwell-mweth",
    name: "Moonwell mWETH",
    address: getAddress("0x628ff693426583D9a7FB391E54366292F509D457"),
    category: "protocol",
    officialDocsUrl: "https://docs.moonwell.fi/moonwell/protocol-information/contracts-addresses",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  MOONWELL_MCBBTC: {
    id: "moonwell-mcbbtc",
    name: "Moonwell mcbBTC",
    address: getAddress("0xf783307613576082D25089e9FC0a86b9A89345c2"),
    category: "protocol",
    officialDocsUrl: "https://docs.moonwell.fi/moonwell/protocol-information/contracts-addresses",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  AERODROME_ROUTER: {
    id: "aerodrome-router",
    name: "Aerodrome Router Base",
    address: getAddress("0xcF77A3ba9A5ca399B7c97c748846942438557642"),
    category: "protocol",
    officialDocsUrl: "https://aerodrome.finance/docs",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  AERODROME_SLIPSTREAM_ROUTER: {
    id: "aerodrome-slipstream-router",
    name: "Aerodrome Slipstream Router",
    address: getAddress("0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5"),
    category: "protocol",
    officialDocsUrl: "https://aerodrome.finance/docs",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  AERODROME_CL_FACTORY: {
    id: "aerodrome-cl-factory",
    name: "Aerodrome Concentrated Liquidity Factory",
    address: getAddress("0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A"),
    category: "protocol",
    officialDocsUrl: "https://aerodrome.finance/docs",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  SUPERFORM_ROUTER: {
    id: "superform-router",
    name: "Superform Core Router Base",
    address: getAddress("0x8e5f31ae56b19d4b4a3c20054a86f9e6144e1d5a"),
    category: "protocol",
    officialDocsUrl: "https://docs.superform.xyz",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  OPENLAUNCH_FACTORY: {
    id: "openlaunch-factory",
    name: "OpenLaunch Factory (B20 Creator Token Standard)",
    address: getAddress("0x815542E8b392389A1389E22E588E4B62A67Ade72"),
    category: "protocol",
    officialDocsUrl: "https://basescan.org/address/0x815542E8b392389A1389E22E588E4B62A67Ade72",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  OPENLAUNCH_LOCKER: {
    id: "openlaunch-locker",
    name: "OpenLaunch LP & Allocation Locker",
    address: getAddress("0xcd1680D26922fcd9CabFbb8a56bA40C333fD842a"),
    category: "protocol",
    officialDocsUrl: "https://basescan.org/address/0xcd1680D26922fcd9CabFbb8a56bA40C333fD842a",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },

  // ── MAJOR TOKENS ──
  USDC: {
    id: "usdc",
    name: "USD Coin (Native Base)",
    address: getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
    category: "token",
    officialDocsUrl: "https://developers.circle.com/stablecoins/docs/usdc-on-mainnet-chains",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  WETH: {
    id: "weth",
    name: "Wrapped Ether (Base)",
    address: getAddress("0x4200000000000000000000000000000000000006"),
    category: "token",
    officialDocsUrl: "https://docs.base.org/base-contracts/#base-mainnet",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  CBBTC: {
    id: "cbbtc",
    name: "Coinbase Wrapped BTC",
    address: getAddress("0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf"),
    category: "token",
    officialDocsUrl: "https://docs.cdp.coinbase.com/cbbtc/docs/welcome",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  CBETH: {
    id: "cbeth",
    name: "Coinbase Wrapped Staked ETH",
    address: getAddress("0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22"),
    category: "token",
    officialDocsUrl: "https://docs.cdp.coinbase.com",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
  AERO: {
    id: "aero",
    name: "Aerodrome Finance Token",
    address: getAddress("0x940181a94A35A4569E4529A3CDfB74e38FD98631"),
    category: "token",
    officialDocsUrl: "https://aerodrome.finance/docs",
    verifiedOnBasescan: true,
    matchesDocs: true,
  },
};

/** Get any registered contract address, throwing if not found or invalid */
export function getRegisteredAddress(id: keyof typeof BASE_MAINNET_REGISTRY): Address {
  const entry = BASE_MAINNET_REGISTRY[id];
  if (!entry) throw new Error(`Contract '${String(id)}' not found in master Base registry`);
  return entry.address;
}
