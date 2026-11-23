import { parseAbi, type PublicClient } from "viem";
import type { UserProtocolPosition } from "@/lib/lending/user-positions";
import type { NormalizedMarket } from "@/lib/lending/discovery/types";
import { MORPHO_BLUE_ABI, MORPHO_BLUE_BASE } from "@/lib/lending/constants";
import { getMorphoMarketId, morphoDebtAssets } from "@/lib/lending/morpho-blue";

export { morphoDebtAssets };

const ORACLE_ABI = parseAbi(["function price() view returns (uint256)"]);
const ORACLE_SCALE = BigInt(10) ** BigInt(36);
const WAD = BigInt(10) ** BigInt(18);

export type MorphoHealth = {
  /** Collateral value in loan-token units (what the oracle says it is worth). */
  collateralValue: bigint;
  /** null when there is no debt. */
  healthFactor: number | null;
  ltvPct: number | null;
  /** Stock price (in loan-token units per whole token) at which health reaches 1.0, as a fraction of today's price. */
  liquidationPriceRatio: number | null;
};

export function morphoHealth(p: { collateral: bigint; oraclePrice: bigint; lltv: bigint; debt: bigint }): MorphoHealth {
  const collateralValue = (p.collateral * p.oraclePrice) / ORACLE_SCALE;
  if (p.debt <= BigInt(0) || collateralValue <= BigInt(0)) {
    return { collateralValue, healthFactor: null, ltvPct: null, liquidationPriceRatio: null };
  }
  const maxBorrow = (collateralValue * p.lltv) / WAD;
  const healthFactor = Number(maxBorrow) / Number(p.debt);
  return {
    collateralValue,
    healthFactor,
    ltvPct: (Number(p.debt) / Number(collateralValue)) * 100,
    liquidationPriceRatio: Number(p.debt) / Number(maxBorrow),
  };
}

const fmt = (n: number, d = 2) => n.toLocaleString(undefined, { maximumFractionDigits: d });

/**
 * The wallet's Morpho Blue stock-collateral loans as rows for the positions panel. Uses the markets
 * the discovery engine found (their parameters identify each market) and reads only the user's
 * position in each, then the market totals and oracle for the ones that are in use.
 */
export async function readMorphoPositionRows(
  client: PublicClient,
  user: `0x${string}`,
  markets: readonly NormalizedMarket[]
): Promise<UserProtocolPosition[]> {
  const candidates = markets.filter((m) => m.protocol === "morpho" && m.morphoParams && m.collateralAsset);
  if (candidates.length === 0) return [];

  const ids = candidates.map((m) => getMorphoMarketId(m.morphoParams!));
  const positions = await Promise.all(
    ids.map((id) => client.readContract({ address: MORPHO_BLUE_BASE, abi: MORPHO_BLUE_ABI, functionName: "position", args: [id, user] }).catch(() => null))
  );

  const rows: UserProtocolPosition[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const pos = positions[i] as readonly [bigint, bigint, bigint] | null;
    if (!pos) continue;
    const [, borrowShares, collateral] = pos;
    if (collateral <= BigInt(0) && borrowShares <= BigInt(0)) continue;

    const m = candidates[i];
    const params = m.morphoParams!;
    const [mkt, oraclePrice] = await Promise.all([
      client.readContract({ address: MORPHO_BLUE_BASE, abi: MORPHO_BLUE_ABI, functionName: "market", args: [ids[i]] }),
      client.readContract({ address: params.oracle, abi: ORACLE_ABI, functionName: "price" }),
    ]);
    const [, , totalBorrowAssets, totalBorrowShares] = mkt as readonly [bigint, bigint, bigint, bigint, bigint, bigint];
    const debt = morphoDebtAssets(borrowShares, totalBorrowAssets, totalBorrowShares);
    const health = morphoHealth({ collateral, oraclePrice, lltv: params.lltv, debt });

    const stock = m.collateralAsset!;
    const loan = m.borrowAsset ?? m.supplyAsset;
    const tokens = Number(collateral) / 10 ** stock.decimals;
    const collateralUsd = Number(health.collateralValue) / 10 ** loan.decimals; // the loan token is USDC
    const debtUsd = Number(debt) / 10 ** loan.decimals;
    const stockPriceUsd = tokens > 0 ? collateralUsd / tokens : 0;

    rows.push({
      id: `morpho-${ids[i].slice(0, 10)}`,
      protocol: "morpho",
      protocolName: "Morpho Blue",
      protocolBadge: "Stock loan",
      marketId: `${m.protocol}-${m.marketId}`,
      marketName: `${stock.symbol} → ${loan.symbol}`,
      assetSymbol: stock.symbol,
      assetName: stock.name,
      assetAddress: stock.address,
      type: debt > BigInt(0) ? "borrowed" : "supplied",
      suppliedAmount: tokens,
      borrowedAmount: debtUsd,
      suppliedFormatted: `${fmt(tokens, 4)} ${stock.symbol}`,
      borrowedFormatted: debt > BigInt(0) ? `${fmt(debtUsd)} ${loan.symbol}` : "—",
      suppliedUsd: collateralUsd,
      borrowedUsd: debtUsd,
      apy: 0,
      apr: m.borrowApr ?? 0,
      healthFactor: health.healthFactor,
      ltv: health.ltvPct,
      liquidationPrice: health.liquidationPriceRatio != null && stockPriceUsd > 0 ? stockPriceUsd * health.liquidationPriceRatio : null,
      explorerUrl: `https://app.morpho.org/base/market/${m.marketId}`,
      contractAddress: MORPHO_BLUE_BASE,
      canAdd: true,
      canWithdraw: collateral > BigInt(0),
      canBorrow: true,
      canRepay: debt > BigInt(0),
    });
  }
  return rows;
}
