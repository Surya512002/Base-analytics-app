import { formatUnits, parseAbi, type PublicClient } from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { getStockPricesUsd } from "@/lib/stocks/stock-prices";
import { getBaseStockBySymbol } from "@/lib/stocks/base-stocks";
import { readAaveV4PositionRows } from "./aave-v4/positions";
import { readMorphoPositionRows } from "./morpho-positions";
import type { NormalizedMarket } from "./discovery/types";
import {
  AAVE_V3_POOL_BASE,
  USDC_BASE_ADDRESS,
  IPOR_FUSION_FACTORY_BASE,
  ERC4626_VAULT_ABI,
} from "./constants";
import {
  VERIFIED_BEEFY_STOCK_DETAILS,
  VERIFIED_BEEFY_STOCK_VAULTS,
  getLiveBeefyAndAeroRates,
} from "./unified-comparison";

const ZERO_BI = BigInt(0);

export const HEALTH_THRESHOLDS = {
  SAFE: 1.5,
  WATCH: 1.15,
} as const;

export interface UserProtocolPosition {
  id: string;
  protocol: "beefy" | "aerodrome" | "aave" | "aave_v4" | "morpho" | "ipor";
  protocolName: string;
  protocolBadge: string;
  marketId: string;
  marketName: string;
  assetSymbol: string;
  assetName: string;
  assetAddress: `0x${string}`;
  type: "supplied" | "borrowed" | "staked";
  suppliedAmount: number;
  borrowedAmount: number;
  suppliedFormatted: string;
  borrowedFormatted: string;
  /** Null when the position's price can't be read — show "—", never a guess. */
  suppliedUsd: number | null;
  borrowedUsd: number;
  apy: number;
  apr: number;
  healthFactor: number | null; // null if no debt
  ltv: number | null; // null if no debt or collateral
  liquidationPrice: number | null; // null if no debt
  explorerUrl: string;
  contractAddress: `0x${string}`;
  pendingRewards?: number;
  pendingRewardsFormatted?: string;
  rewardToken?: string;
  canAdd?: boolean;
  canWithdraw?: boolean;
  canBorrow?: boolean;
  canRepay?: boolean;
}

export interface PositionsFetchResult {
  positions: UserProtocolPosition[];
  errors: Record<string, string>;
  timestamp: number;
  isMockData: boolean;
}

// ABI for Aave V3 Pool user data
const AAVE_POOL_ACCOUNT_ABI = parseAbi([
  "function getUserAccountData(address user) external view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
]);

// Live stock prices (USD) from each stock's Base DEX pool. A stock without a price counts as 0,
// so its USD value reads as unknown rather than a made-up number.
const PRICED_STOCKS = ["GOOGLc", "NVDAc", "AAPLc", "METAc"] as const;
async function liveStockPrices(): Promise<Record<string, number>> {
  const addrs = PRICED_STOCKS.map((sym) => getBaseStockBySymbol(sym)?.address).filter((a): a is `0x${string}` => Boolean(a));
  const px = await getStockPricesUsd(addrs).catch(() => new Map<string, number>());
  const out: Record<string, number> = {};
  for (const sym of PRICED_STOCKS) {
    const a = getBaseStockBySymbol(sym)?.address.toLowerCase();
    out[sym] = (a && px.get(a)) || 0;
  }
  return out;
}

/** Result of one multicall entry when `allowFailure: true`. */
type MulticallEntry = { status: "success"; result: unknown } | { status: "failure"; error?: unknown };

function bigintResult(entry: MulticallEntry | undefined): bigint | null {
  return entry?.status === "success" && typeof entry.result === "bigint" ? entry.result : null;
}

/**
 * USD value of Beefy vault (mooToken) shares:
 *   shares × pricePerFullShare (LP per share) × LP token price.
 * All three are 18-decimal. Returns null when the share price or LP price is unknown.
 */
export function valueBeefyVaultShares(
  sharesRaw: bigint,
  pricePerFullShareRaw: bigint | null,
  lpPriceUsd: number | null | undefined
): number | null {
  if (pricePerFullShareRaw === null || pricePerFullShareRaw <= ZERO_BI) return null;
  const lpAmount = Number(formatUnits(sharesRaw, 18)) * Number(formatUnits(pricePerFullShareRaw, 18));
  return valueLpTokens(lpAmount, lpPriceUsd);
}

/** USD value of a whole-unit LP token amount. Null when the LP price is unknown. */
export function valueLpTokens(lpAmount: number, lpPriceUsd: number | null | undefined): number | null {
  if (typeof lpPriceUsd !== "number" || !Number.isFinite(lpPriceUsd) || lpPriceUsd <= 0) return null;
  if (!Number.isFinite(lpAmount)) return null;
  return lpAmount * lpPriceUsd;
}

/**
 * LP and vault-share balances are often tiny (Beefy CLM tokens are worth ~$1e12 each), so a
 * fixed 4 decimals would read "0.0000". Keep 4 significant digits for small amounts.
 */
export function formatLpAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return "0";
  if (Math.abs(amount) >= 0.0001) return amount.toFixed(4);
  return amount.toPrecision(4);
}

const BEEFY_VAULT_VIEW_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function getPricePerFullShare() view returns (uint256)",
]);

const BEEFY_POSITION_STOCKS = ["NVDAc", "AAPLc", "MSFTc", "TSLAc", "AMZNc", "METAc"] as const;

/**
 * 1. Read real Beefy Finance auto-compounding stock vault positions on Base.
 *
 * Each vault holds a Beefy CLM token (an Aerodrome Slipstream stock/USDC LP). A user's mooToken
 * balance is vault shares, not stock units: value = shares × getPricePerFullShare() × CLM price
 * (Beefy `/lps`). Balance and share price are read in one multicall.
 */
export async function readBeefyPositions(
  userAddress: `0x${string}`
): Promise<UserProtocolPosition[]> {
  const client = createBasePublicClient();
  const liveRates = await getLiveBeefyAndAeroRates().catch(() => null);
  const vaultEntries = BEEFY_POSITION_STOCKS.flatMap((symbol) => {
    const vaultAddress = VERIFIED_BEEFY_STOCK_VAULTS[symbol];
    if (!vaultAddress) return [];
    return [
      {
        symbol,
        name: `Moo Beefy Aerodrome ${symbol}-USDC`,
        vaultAddress,
        apy: liveRates?.beefy?.[symbol]?.apy ?? 0,
        lpPriceUsd: liveRates?.lpPrices?.[symbol] ?? null,
      },
    ];
  });

  const calls = vaultEntries.flatMap((v) => [
    { address: v.vaultAddress, abi: BEEFY_VAULT_VIEW_ABI, functionName: "balanceOf" as const, args: [userAddress] as const },
    { address: v.vaultAddress, abi: BEEFY_VAULT_VIEW_ABI, functionName: "getPricePerFullShare" as const },
  ]);

  try {
    const results = (await client.multicall({
      contracts: calls,
      allowFailure: true,
    })) as MulticallEntry[];

    const positions: UserProtocolPosition[] = [];

    for (let i = 0; i < vaultEntries.length; i++) {
      const v = vaultEntries[i]!;
      const sharesBal = bigintResult(results[i * 2]) ?? ZERO_BI;
      if (sharesBal === ZERO_BI) continue;
      const ppfs = bigintResult(results[i * 2 + 1]);

      const suppliedNum = Number(formatUnits(sharesBal, 18)) || 0;
      const suppliedUsd = valueBeefyVaultShares(sharesBal, ppfs, v.lpPriceUsd);

      positions.push({
        id: `beefy-${v.symbol.toLowerCase()}`,
        protocol: "beefy",
        protocolName: "Beefy Finance",
        protocolBadge: "Auto-Compounding Vault",
        marketId: `beefy-${v.symbol.toLowerCase()}-vault`,
        marketName: v.name,
        assetSymbol: v.symbol,
        assetName: `${v.symbol} Aerodrome LP Vault`,
        assetAddress: v.vaultAddress as `0x${string}`,
        type: "supplied",
        suppliedAmount: suppliedNum,
        borrowedAmount: 0,
        suppliedFormatted: `${formatLpAmount(suppliedNum)} vault shares`,
        borrowedFormatted: "—",
        suppliedUsd,
        borrowedUsd: 0,
        apy: v.apy,
        apr: 0,
        healthFactor: null,
        ltv: null,
        liquidationPrice: null,
        explorerUrl: `https://basescan.org/address/${v.vaultAddress}`,
        contractAddress: v.vaultAddress as `0x${string}`,
        canAdd: true,
        canWithdraw: true,
      });
    }

    return positions;
  } catch {
    return [];
  }
}

/**
 * 2. Read real IPOR Fusion stock carry trade vault positions on Base (app.ipor.io/stocks)
 * Strictly the 4 verified stocks: GOOGLc, NVDAc, AAPLc, METAc
 */
export async function readIporPositions(
  userAddress: `0x${string}`
): Promise<UserProtocolPosition[]> {
  const STOCK_PRICES = await liveStockPrices();
  const client = createBasePublicClient();
  const markets = [
    {
      vault: IPOR_FUSION_FACTORY_BASE,
      symbol: "GOOGLc",
      name: "IPOR Google Carry Trade",
      decimals: 8,
      priceUsd: STOCK_PRICES.GOOGLc,
      supplyApy: 0,
    },
    {
      vault: IPOR_FUSION_FACTORY_BASE,
      symbol: "NVDAc",
      name: "IPOR Nvidia Carry Trade",
      decimals: 8,
      priceUsd: STOCK_PRICES.NVDAc,
      supplyApy: 0,
    },
    {
      vault: IPOR_FUSION_FACTORY_BASE,
      symbol: "AAPLc",
      name: "IPOR Apple Carry Trade",
      decimals: 8,
      priceUsd: STOCK_PRICES.AAPLc,
      supplyApy: 0,
    },
    {
      vault: IPOR_FUSION_FACTORY_BASE,
      symbol: "METAc",
      name: "IPOR Meta Carry Trade",
      decimals: 8,
      priceUsd: STOCK_PRICES.METAc,
      supplyApy: 0,
    },
  ];

  const calls = markets.map((m) => ({
    address: m.vault,
    abi: ERC4626_VAULT_ABI,
    functionName: "balanceOf" as const,
    args: [userAddress],
  }));

  try {
    const results = await client.multicall({
      contracts: calls,
      allowFailure: true,
    });

    const positions: UserProtocolPosition[] = [];

    for (let i = 0; i < markets.length; i++) {
      const m = markets[i]!;
      const balRes = results[i] as any;
      const sharesBal = (balRes?.status === "success" && balRes.result ? balRes.result : ZERO_BI) as bigint;
      if (sharesBal === ZERO_BI) continue;

      const suppliedNum = parseFloat(formatUnits(sharesBal, m.decimals)) || 0;
      const suppliedUsd = suppliedNum * m.priceUsd;

      positions.push({
        id: `ipor-${m.symbol.toLowerCase()}`,
        protocol: "ipor",
        protocolName: "IPOR Fusion",
        protocolBadge: "Stocks Plasma Vault",
        marketId: `ipor-${m.symbol.toLowerCase()}-vault`,
        marketName: m.name,
        assetSymbol: m.symbol,
        assetName: m.name,
        assetAddress: m.vault,
        type: "supplied",
        suppliedAmount: suppliedNum,
        borrowedAmount: 0,
        suppliedFormatted: `${suppliedNum.toFixed(4)} ${m.symbol}`,
        borrowedFormatted: "—",
        suppliedUsd,
        borrowedUsd: 0,
        apy: m.supplyApy,
        apr: 0,
        healthFactor: null,
        ltv: null,
        liquidationPrice: null,
        explorerUrl: `https://basescan.org/address/${m.vault}`,
        contractAddress: m.vault,
        canAdd: true,
        canWithdraw: true,
      });
    }

    return positions;
  } catch {
    return [];
  }
}

const LP_TOKEN_VIEW_ABI = parseAbi(["function balanceOf(address account) external view returns (uint256)"]);

const CLM_POSITION_STOCKS = [
  { id: "aero-nvda-usdc", symbol: "NVDAc" },
  { id: "aero-msft-usdc", symbol: "MSFTc" },
  { id: "aero-aapl-usdc", symbol: "AAPLc" },
  { id: "aero-tsla-usdc", symbol: "TSLAc" },
] as const;

/**
 * 3. Read Aerodrome Slipstream stock/USDC LP held directly on Base.
 *
 * These stock pools are concentrated-liquidity (Slipstream) pools, which have no fungible LP
 * token of their own. The fungible LP is the Beefy CLM token that manages the range — the same
 * token the Beefy vaults hold (`wantTokenAddress`). Value = LP balance × CLM price (Beefy `/lps`,
 * which prices it from the CLM's pool balances and token prices). One balanceOf per pool,
 * batched in a single multicall.
 */
export async function readAerodromeGaugePositions(
  userAddress: `0x${string}`
): Promise<UserProtocolPosition[]> {
  const client = createBasePublicClient();
  const liveRates = await getLiveBeefyAndAeroRates().catch(() => null);
  const lpMarkets = CLM_POSITION_STOCKS.flatMap(({ id, symbol }) => {
    const lpAddress = VERIFIED_BEEFY_STOCK_DETAILS[symbol]?.wantTokenAddress;
    if (!lpAddress) return [];
    return [
      {
        id,
        pairName: `${symbol} / USDC`,
        lpAddress,
        apr: liveRates?.aerodrome?.[symbol]?.apy ?? 0,
        lpPriceUsd: liveRates?.lpPrices?.[symbol] ?? null,
      },
    ];
  });

  const calls = lpMarkets.map((g) => ({
    address: g.lpAddress,
    abi: LP_TOKEN_VIEW_ABI,
    functionName: "balanceOf" as const,
    args: [userAddress] as const,
  }));

  try {
    const results = (await client.multicall({
      contracts: calls,
      allowFailure: true,
    })) as MulticallEntry[];

    const positions: UserProtocolPosition[] = [];

    for (let i = 0; i < lpMarkets.length; i++) {
      const g = lpMarkets[i]!;
      const lpRaw = bigintResult(results[i]) ?? ZERO_BI;
      if (lpRaw === ZERO_BI) continue;

      const lpNum = Number(formatUnits(lpRaw, 18)) || 0;
      const lpUsd = valueLpTokens(lpNum, g.lpPriceUsd);

      positions.push({
        id: g.id,
        protocol: "aerodrome",
        protocolName: "Aerodrome Slipstream",
        protocolBadge: "Beefy CLM LP",
        marketId: g.id,
        marketName: `${g.pairName} LP`,
        assetSymbol: g.pairName,
        assetName: `${g.pairName} Slipstream LP (Beefy CLM)`,
        assetAddress: g.lpAddress,
        type: "supplied",
        suppliedAmount: lpNum,
        borrowedAmount: 0,
        suppliedFormatted: `${formatLpAmount(lpNum)} LP`,
        borrowedFormatted: "—",
        suppliedUsd: lpUsd,
        borrowedUsd: 0,
        apy: g.apr,
        apr: 0,
        healthFactor: null,
        ltv: null,
        liquidationPrice: null,
        explorerUrl: `https://basescan.org/address/${g.lpAddress}`,
        contractAddress: g.lpAddress,
        canAdd: true,
        canWithdraw: true,
      });
    }

    return positions;
  } catch {
    return [];
  }
}

/**
 * 4. Aave V4 Equities Hub position (stocks as collateral, USDC borrowed).
 * Replaces the old Aave V3 read, which never held stocks and so always came back empty.
 */
export async function readAavePositions(userAddress: `0x${string}`): Promise<UserProtocolPosition[]> {
  return readAaveV4PositionRows(createBasePublicClient() as unknown as PublicClient, userAddress);
}

/**
 * Master Position Reader: Queries real positions across our 4 verified protocols:
 * Beefy Finance, Aerodrome, IPOR Fusion, Aave V4 and Morpho Blue (stock loans).
 */
export async function fetchAllUserPositions(
  userAddress: `0x${string}`,
  /** The Morpho markets the discovery engine found; without them Morpho loans are not read. */
  morphoMarkets: readonly NormalizedMarket[] = []
): Promise<PositionsFetchResult> {
  const isMockEnabled =
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_USE_MOCK_POSITIONS === "true";

  if (isMockEnabled) {
    return {
      positions: [
        {
          id: "mock-beefy-nvda",
          protocol: "beefy",
          protocolName: "Beefy Finance",
          protocolBadge: "Demo Vault",
          marketId: "mock-beefy-nvda",
          marketName: "NVDAc-USDC Auto-Compounder",
          assetSymbol: "NVDAc",
          assetName: "NVIDIA Corp (Coinbase B20)",
          assetAddress: "0xb20000000000000000000078ee7ce2fe4908108c",
          type: "supplied",
          suppliedAmount: 5.0,
          borrowedAmount: 200.0,
          suppliedFormatted: "5.0000 vault shares",
          borrowedFormatted: "200.00 USDC",
          suppliedUsd: 691.25,
          borrowedUsd: 200.0,
          apy: 0,
          apr: 0,
          healthFactor: 2.66,
          ltv: 28.9,
          liquidationPrice: 51.95,
          explorerUrl: "https://basescan.org/address/0xD317fDf7e7E3BA9dc9A73CAe2E54732646866025",
          contractAddress: "0xD317fDf7e7E3BA9dc9A73CAe2E54732646866025",
          canAdd: true,
          canWithdraw: true,
          canBorrow: false,
          canRepay: false,
        },
      ],
      errors: {},
      timestamp: Date.now(),
      isMockData: true,
    };
  }

  const errors: Record<string, string> = {};
  const allPositions: UserProtocolPosition[] = [];

  const [beefyRes, aeroRes, iporRes, aaveRes, morphoRes] = await Promise.allSettled([
    readBeefyPositions(userAddress),
    readAerodromeGaugePositions(userAddress),
    readIporPositions(userAddress),
    readAavePositions(userAddress),
    readMorphoPositionRows(createBasePublicClient() as unknown as PublicClient, userAddress, morphoMarkets),
  ]);

  if (beefyRes.status === "fulfilled") {
    allPositions.push(...beefyRes.value);
  } else {
    errors["Beefy Finance"] = beefyRes.reason?.message || "Failed to query Beefy vaults";
  }

  if (aeroRes.status === "fulfilled") {
    allPositions.push(...aeroRes.value);
  } else {
    errors["Aerodrome"] = aeroRes.reason?.message || "Failed to query Aerodrome gauges";
  }

  if (iporRes.status === "fulfilled") {
    allPositions.push(...iporRes.value);
  } else {
    errors["IPOR Fusion"] = iporRes.reason?.message || "Failed to query IPOR Fusion vaults";
  }

  if (aaveRes.status === "fulfilled") {
    allPositions.push(...aaveRes.value);
  } else {
    errors["Aave V4"] = aaveRes.reason?.message || "Failed to query Aave V4";
  }

  if (morphoRes.status === "fulfilled") {
    allPositions.push(...morphoRes.value);
  } else {
    errors["Morpho Blue"] = morphoRes.reason?.message || "Failed to query Morpho Blue";
  }

  return {
    positions: allPositions,
    errors,
    timestamp: Date.now(),
    isMockData: false,
  };
}

export const readUserPositions = fetchAllUserPositions;
