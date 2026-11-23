import type { PublicClient } from "viem";
import type { UserProtocolPosition } from "@/lib/lending/user-positions";
import { AAVE_V4_HUB, AAVE_V4_RESERVES, AAVE_V4_SPOKE } from "./constants";
import { borrowPower, liquidationPrice } from "./math";
import { readAaveV4Overview, readAaveV4Position } from "./read";

const fmt = (n: number, d = 2) => n.toLocaleString(undefined, { maximumFractionDigits: d });

/**
 * The connected wallet's Aave V4 Equities Hub position as rows for the positions panel: one row per
 * stock used as collateral, plus one USDC debt row. The market id of every row is the id of the
 * matching market in the lending comparison, so the panel's buttons open the right drawer.
 */
export async function readAaveV4PositionRows(client: PublicClient, user: `0x${string}`): Promise<UserProtocolPosition[]> {
  const overview = await readAaveV4Overview(client);
  const pos = await readAaveV4Position(client, user, overview);
  if (pos.collateral.length === 0 && pos.debtUsdc <= 0) return [];

  const lines = pos.collateral.map((c) => ({ usd: c.usd, collateralFactor: c.collateralFactor, on: c.collateralOn }));
  const power = borrowPower(lines);
  const totalCollateralUsd = pos.collateral.reduce((a, c) => a + c.usd, 0);
  const ltv = totalCollateralUsd > 0 && pos.debtUsdc > 0 ? (pos.debtUsdc / totalCollateralUsd) * 100 : null;
  const optionId = (symbol: string) => `aave_v4-equities-${symbol.toLowerCase()}`;
  const base = { protocol: "aave_v4" as const, protocolName: "Aave V4", protocolBadge: "Equities Hub", contractAddress: AAVE_V4_SPOKE };

  const rows: UserProtocolPosition[] = pos.collateral.map((c) => {
    const stock = overview.stocks.find((s) => s.symbol === c.symbol)!;
    return {
      ...base,
      id: `aave-v4-${c.symbol.toLowerCase()}`,
      marketId: optionId(c.symbol),
      marketName: `${c.symbol} as collateral`,
      assetSymbol: c.symbol,
      assetName: c.symbol,
      assetAddress: stock.address,
      type: "supplied",
      suppliedAmount: c.tokens,
      borrowedAmount: 0,
      suppliedFormatted: `${fmt(c.tokens, 4)} ${c.symbol}${c.collateralOn ? "" : " (collateral off)"}`,
      borrowedFormatted: "—",
      suppliedUsd: c.usd,
      borrowedUsd: 0,
      apy: 0, // collateral only: stocks earn nothing in this market
      apr: 0,
      healthFactor: pos.healthFactor,
      ltv,
      liquidationPrice: c.collateralOn ? liquidationPrice(stock.priceUsd, power, pos.debtUsdc, (c.usd * c.collateralFactor) / 100) : null,
      explorerUrl: `https://basescan.org/address/${AAVE_V4_HUB}`,
      canAdd: true,
      canWithdraw: true,
      canBorrow: true,
      canRepay: false,
    };
  });

  if (pos.debtUsdc > 0) {
    const anchor = [...pos.collateral].sort((a, b) => b.usd - a.usd)[0]?.symbol ?? "NVDAc"; // repay is account-wide; open it from the biggest collateral
    rows.push({
      ...base,
      id: "aave-v4-usdc-debt",
      marketId: optionId(anchor),
      marketName: "USDC borrowed",
      assetSymbol: anchor,
      assetName: "USDC loan",
      assetAddress: AAVE_V4_RESERVES.USDC.address,
      type: "borrowed",
      suppliedAmount: 0,
      borrowedAmount: pos.debtUsdc,
      suppliedFormatted: "—",
      borrowedFormatted: `${fmt(pos.debtUsdc)} USDC`,
      suppliedUsd: 0,
      borrowedUsd: pos.debtUsdc,
      apy: 0,
      apr: overview.usdc.borrowApr,
      healthFactor: pos.healthFactor,
      ltv,
      liquidationPrice: null,
      explorerUrl: `https://basescan.org/address/${AAVE_V4_SPOKE}`,
      canAdd: false,
      canWithdraw: false,
      canBorrow: true,
      canRepay: true,
    });
  }
  return rows;
}
