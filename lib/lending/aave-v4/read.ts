import type { PublicClient } from "viem";
import {
  AAVE_V4_HUB,
  AAVE_V4_HUB_ABI,
  AAVE_V4_ORACLE,
  AAVE_V4_ORACLE_ABI,
  AAVE_V4_RESERVES,
  AAVE_V4_SPOKE,
  AAVE_V4_SPOKE_ABI,
} from "./constants";

type Addr = `0x${string}`;
const RAY = 1e27;
const WAD = 1e18;

export type AaveV4StockMarket = {
  symbol: string;
  reserveId: bigint;
  address: Addr;
  decimals: number;
  /** Share of the stock's value you can borrow against, percent. */
  collateralFactor: number;
  /** Extra borrow cost for this collateral, percent (0 for most). */
  riskPremium: number;
  priceUsd: number;
  supplied: number;
  supplyCap: number;
  capUsedPct: number;
  suppliedUsd: number;
  paused: boolean;
  frozen: boolean;
};

export type AaveV4Usdc = {
  borrowApr: number; // percent, base rate before any collateral risk premium
  supplyApy: number; // percent, what a USDC supplier earns
  utilization: number; // percent
  totalSuppliedUsd: number;
  totalBorrowedUsd: number;
  availableUsd: number;
  borrowCapUsd: number;
  supplyCapUsd: number;
  borrowable: boolean;
};

export type AaveV4Overview = { stocks: AaveV4StockMarket[]; usdc: AaveV4Usdc };

const STOCKS = Object.entries(AAVE_V4_RESERVES).filter(([k]) => k !== "USDC") as Array<
  [string, (typeof AAVE_V4_RESERVES)[keyof typeof AAVE_V4_RESERVES]]
>;

export async function readAaveV4Overview(client: PublicClient): Promise<AaveV4Overview> {
  const ids = [...STOCKS.map(([, r]) => r.id), AAVE_V4_RESERVES.USDC.id];

  const [prices, reserves, configs, hubSupplied, spokeCfgs] = await Promise.all([
    Promise.all(ids.map((id) => client.readContract({ address: AAVE_V4_ORACLE, abi: AAVE_V4_ORACLE_ABI, functionName: "getReservePrice", args: [id] }))),
    Promise.all(ids.map((id) => client.readContract({ address: AAVE_V4_SPOKE, abi: AAVE_V4_SPOKE_ABI, functionName: "getReserveConfig", args: [id] }))),
    Promise.all(ids.map((id) => client.readContract({ address: AAVE_V4_SPOKE, abi: AAVE_V4_SPOKE_ABI, functionName: "getDynamicReserveConfig", args: [id, 0] }))),
    Promise.all(ids.map((id) => client.readContract({ address: AAVE_V4_HUB, abi: AAVE_V4_HUB_ABI, functionName: "getAddedAssets", args: [id] }))),
    Promise.all(ids.map((id) => client.readContract({ address: AAVE_V4_HUB, abi: AAVE_V4_HUB_ABI, functionName: "getSpokeConfig", args: [id, AAVE_V4_SPOKE] }))),
  ]);

  const stocks: AaveV4StockMarket[] = STOCKS.map(([symbol, r], i) => {
    const decimals = 8;
    const priceUsd = Number(prices[i]) / 1e8;
    const supplied = Number(hubSupplied[i]) / 10 ** decimals;
    const supplyCap = Number(spokeCfgs[i].addCap); // whole tokens
    return {
      symbol,
      reserveId: r.id,
      address: r.address as Addr,
      decimals,
      collateralFactor: Number(configs[i].collateralFactor) / 100,
      riskPremium: Number(reserves[i].collateralRisk) / 100,
      priceUsd,
      supplied,
      supplyCap,
      capUsedPct: supplyCap > 0 ? Math.min(100, (supplied / supplyCap) * 100) : 0,
      suppliedUsd: supplied * priceUsd,
      paused: reserves[i].paused,
      frozen: reserves[i].frozen,
    };
  });

  // USDC (last entry)
  const u = ids.length - 1;
  const usdcId = AAVE_V4_RESERVES.USDC.id;
  const [rate, owed, liquidity, assetCfg] = await Promise.all([
    client.readContract({ address: AAVE_V4_HUB, abi: AAVE_V4_HUB_ABI, functionName: "getAssetDrawnRate", args: [usdcId] }),
    client.readContract({ address: AAVE_V4_HUB, abi: AAVE_V4_HUB_ABI, functionName: "getAssetTotalOwed", args: [usdcId] }),
    client.readContract({ address: AAVE_V4_HUB, abi: AAVE_V4_HUB_ABI, functionName: "getAssetLiquidity", args: [usdcId] }),
    client.readContract({ address: AAVE_V4_HUB, abi: AAVE_V4_HUB_ABI, functionName: "getAssetConfig", args: [usdcId] }),
  ]);
  const price = Number(prices[u]) / 1e8;
  const added = Number(hubSupplied[u]) / 1e6;
  const borrowed = Number(owed) / 1e6;
  const util = added > 0 ? borrowed / added : 0;
  const borrowApr = (Number(rate) / RAY) * 100;
  const feeShare = 1 - Number(assetCfg.liquidityFee) / 10_000;
  return {
    stocks,
    usdc: {
      borrowApr,
      supplyApy: borrowApr * util * feeShare,
      utilization: util * 100,
      totalSuppliedUsd: added * price,
      totalBorrowedUsd: borrowed * price,
      availableUsd: (Number(liquidity) / 1e6) * price,
      borrowCapUsd: Number(spokeCfgs[u].drawCap) * price,
      supplyCapUsd: Number(spokeCfgs[u].addCap) * price,
      borrowable: reserves[u].borrowable && !reserves[u].paused && !reserves[u].frozen,
    },
  };
}

export type AaveV4Position = {
  collateral: Array<{ symbol: string; reserveId: bigint; tokens: number; usd: number; collateralOn: boolean; collateralFactor: number }>;
  debtUsdc: number;
  /** 1.0 is the liquidation line. null when there is no debt. */
  healthFactor: number | null;
  /** USDC still borrowable at the current collateral (before the liquidation line). */
  borrowableUsd: number;
};

export async function readAaveV4Position(client: PublicClient, user: Addr, overview: AaveV4Overview): Promise<AaveV4Position> {
  const [supplied, status, debt, account] = await Promise.all([
    Promise.all(overview.stocks.map((s) => client.readContract({ address: AAVE_V4_SPOKE, abi: AAVE_V4_SPOKE_ABI, functionName: "getUserSuppliedAssets", args: [s.reserveId, user] }))),
    Promise.all(overview.stocks.map((s) => client.readContract({ address: AAVE_V4_SPOKE, abi: AAVE_V4_SPOKE_ABI, functionName: "getUserReserveStatus", args: [s.reserveId, user] }))),
    client.readContract({ address: AAVE_V4_SPOKE, abi: AAVE_V4_SPOKE_ABI, functionName: "getUserTotalDebt", args: [AAVE_V4_RESERVES.USDC.id, user] }),
    client.readContract({ address: AAVE_V4_SPOKE, abi: AAVE_V4_SPOKE_ABI, functionName: "getUserAccountData", args: [user] }),
  ]);

  const collateral = overview.stocks
    .map((s, i) => {
      const tokens = Number(supplied[i]) / 10 ** s.decimals;
      return { symbol: s.symbol, reserveId: s.reserveId, tokens, usd: tokens * s.priceUsd, collateralOn: status[i][0], collateralFactor: s.collateralFactor };
    })
    .filter((c) => c.tokens > 0);

  const debtUsdc = Number(debt) / 1e6;
  const borrowCapacity = collateral.filter((c) => c.collateralOn).reduce((a, c) => a + (c.usd * c.collateralFactor) / 100, 0);
  const hf = Number(account.healthFactor) / WAD;
  return {
    collateral,
    debtUsdc,
    // The contract reports a huge number when there is no debt
    healthFactor: debtUsdc > 0 && Number.isFinite(hf) && hf < 1e6 ? hf : null,
    borrowableUsd: Math.max(0, borrowCapacity - debtUsdc),
  };
}
