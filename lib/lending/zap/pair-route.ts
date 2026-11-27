/**
 * Which in-app route a lending/staking market needs before a user can deposit.
 *
 * Pair markets (e.g. NVDAc-USDC) take an LP position, not a single token: nobody holds
 * "NVDAc-USDC" in their wallet. Those go through the Smart Deposit zap (clm-zap.ts), which
 * starts from USDC, the stock or ETH, swaps only the missing half, adds liquidity and stakes
 * in one batch. The zap needs a Beefy CLM vault:
 *   - a Beefy pair vault is used directly;
 *   - any other pair venue for the same stock (Beefy CLM "CoW" pools, Aerodrome gauges)
 *     hands off to that stock's Beefy auto-compounder, which wraps the same kind of
 *     Aerodrome stock/USDC liquidity. The drawer says so.
 *
 * Pure functions: no network, so they are cheap to call on every click and easy to test.
 */
import type { Address } from "viem";
import type { LendingMarket } from "@/lib/lending/types";
import type { NormalizedMarket } from "@/lib/lending/discovery/types";
import { classifyStockMarket, marketDepthUsd } from "@/lib/lending/stock-market-groups";

/** Quote-side tokens of a pair; the other side is the stock. */
const QUOTE_SYMBOLS = new Set(["USDC", "USDBC", "WETH", "ETH", "CBBTC", "DAI", "USDT", "EURC"]);
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** "NVDAc-USDC" / "USDC/NVDAc" / "vAMM-NVDAc/USDC" → "NVDAc"; single tokens → null. */
export function pairStockSymbol(symbol: string): string | null {
  const parts = symbol
    .replace(/^(v|s)AMM-|^CL\d*-/i, "")
    .split(/[-/\s]+/)
    .filter(Boolean);
  if (parts.length < 2) return null;
  const nonQuote = parts.filter((p) => !QUOTE_SYMBOLS.has(p.toUpperCase()));
  return nonQuote.length === 1 ? nonQuote[0] : null;
}

/** True when depositing means providing liquidity for two tokens. */
export function isPairMarket(market: Pick<LendingMarket, "asset">): boolean {
  return pairStockSymbol(market.asset.symbol) !== null;
}

export type PairVaultRoute = {
  vault: Address;
  stockSymbol: string;
  apy: number;
  sourceLink: string;
  /** The market the user clicked isn't the vault itself; the deposit goes through the stock's Beefy vault. */
  viaStockVault: boolean;
};

const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** The Smart Deposit vault for a pair market, or null when the market isn't a pair / has none. */
export function resolvePairVault(
  market: LendingMarket,
  discovered: readonly NormalizedMarket[],
  catalog: readonly LendingMarket[] = []
): PairVaultRoute | null {
  const pairStock = pairStockSymbol(market.asset.symbol);
  if (!pairStock) return null;
  const stockSymbol = market.collateralAsset?.symbol ?? pairStock;

  if (market.protocol === "beefy" && market.contractType === "beefy_vault" && ADDRESS_RE.test(market.contractAddress)) {
    return {
      vault: market.contractAddress as Address,
      stockSymbol,
      apy: market.supplyApy ?? 0,
      sourceLink: market.protocolUrl,
      viaStockVault: false,
    };
  }

  // Same stock elsewhere (Beefy CLM "CoW" pools, gauges): the catalog maps each to the Beefy
  // vault that wraps that exact CLM (checked on-chain), so prefer it.
  const fallback = catalog.find(
    (m) =>
      m.protocol === "beefy" &&
      m.contractType === "beefy_vault" &&
      ADDRESS_RE.test(m.contractAddress) &&
      isPairMarket(m) &&
      same(m.collateralAsset?.symbol ?? pairStockSymbol(m.asset.symbol) ?? undefined, stockSymbol)
  );
  if (fallback) {
    return {
      vault: fallback.contractAddress as Address,
      stockSymbol,
      apy: discovered.find((m) => same(m.contractAddress, fallback.contractAddress))?.supplyApy ?? 0,
      sourceLink: fallback.protocolUrl,
      viaStockVault: true,
    };
  }
  // Otherwise the deepest live Beefy pair vault for the stock.
  let best: NormalizedMarket | undefined;
  for (const m of discovered) {
    if (m.protocol !== "beefy" || m.canSupply === false || !m.contractAddress) continue;
    if (classifyStockMarket(m) !== "lp") continue;
    if (!same((m.collateralAsset ?? m.supplyAsset).symbol, stockSymbol)) continue;
    if (!best || marketDepthUsd(m) > marketDepthUsd(best)) best = m;
  }
  if (best?.contractAddress) {
    return { vault: best.contractAddress, stockSymbol, apy: best.supplyApy, sourceLink: best.sourceLink, viaStockVault: true };
  }

  return null;
}

/** Deposit-side actions (what "Get it first" and the zap apply to). */
export const isDepositAction = (a: string) => a === "supply" || a === "stake";
