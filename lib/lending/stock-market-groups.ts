import type { NormalizedMarket } from "@/lib/lending/discovery/types";

/**
 * What a verified market lets you do with a stock:
 * - borrow: post the stock as collateral and borrow USDC (Morpho)
 * - lend:   deposit the stock itself to earn (single-stock vaults, e.g. Aave v4 via Beefy)
 * - lp:     provide stock/USDC liquidity and earn fees + rewards (Aerodrome, Beefy LP vaults)
 */
export type StockMarketKind = "borrow" | "lend" | "lp";

export function classifyStockMarket(m: NormalizedMarket): StockMarketKind {
  if (m.type === "borrow" || m.protocol === "morpho") return "borrow";
  const stock = m.collateralAsset ?? m.supplyAsset;
  // A vault whose deposit token IS the stock lends the stock; anything else is an LP position.
  if (m.supplyAsset.symbol === stock.symbol) return "lend";
  return "lp";
}

/** Friendly venue name ("Aave v4 via Beefy" reads better than "Beefy Finance" for those). */
export function venueLabel(m: NormalizedMarket): string {
  if (m.protocol === "beefy" && /aave/i.test(m.badgeText ?? "")) return "Aave v4 · Beefy";
  if (m.protocol === "beefy") return "Beefy";
  if (m.protocol === "morpho") return "Morpho";
  if (m.protocol === "aerodrome") return "Aerodrome";
  return m.protocolLabel;
}

/** Depth used for "small market" checks and sorting. */
export const marketDepthUsd = (m: NormalizedMarket) => Math.max(m.liquidityUsd || 0, m.tvlUsd || 0);

/** Very high APYs on tiny pools are mostly noise from a few dollars of rewards. */
export function isApyUnreliable(m: NormalizedMarket): boolean {
  return m.supplyApy > 100 && marketDepthUsd(m) < 10_000;
}

export type StockMarketGroup = {
  symbol: string;
  name: string;
  address: string;
  logo?: string;
  markets: Array<NormalizedMarket & { kind: StockMarketKind; venue: string }>;
  /** Best yield from lend + LP markets that aren't flagged unreliable. */
  bestEarn: (NormalizedMarket & { kind: StockMarketKind; venue: string }) | null;
  /** Cheapest borrow (Morpho) with real liquidity, else cheapest overall. */
  bestBorrow: (NormalizedMarket & { kind: StockMarketKind; venue: string }) | null;
  maxLtv: number;
  totalDepthUsd: number;
  venues: string[];
  kinds: StockMarketKind[];
};

/**
 * Roll verified markets up by stock. `minDepthUsd` hides dust markets (default: show all).
 */
export function groupMarketsByStock(markets: NormalizedMarket[], minDepthUsd = 0): StockMarketGroup[] {
  const byStock = new Map<string, StockMarketGroup>();
  for (const m of markets) {
    if (marketDepthUsd(m) < minDepthUsd) continue;
    const stock = m.collateralAsset ?? m.supplyAsset;
    if (!stock?.isStock) continue;
    const key = stock.address.toLowerCase();
    let g = byStock.get(key);
    if (!g) {
      g = {
        symbol: stock.symbol,
        name: stock.name,
        address: stock.address,
        logo: stock.logo,
        markets: [],
        bestEarn: null,
        bestBorrow: null,
        maxLtv: 0,
        totalDepthUsd: 0,
        venues: [],
        kinds: [],
      };
      byStock.set(key, g);
    }
    if (!g.logo && stock.logo) g.logo = stock.logo;
    g.markets.push({ ...m, kind: classifyStockMarket(m), venue: venueLabel(m) });
  }

  for (const g of byStock.values()) {
    const earn = g.markets.filter((m) => m.kind !== "borrow" && m.supplyApy > 0 && !isApyUnreliable(m));
    g.bestEarn = earn.sort((a, b) => b.supplyApy - a.supplyApy)[0] ?? null;
    const borrow = g.markets.filter((m) => m.kind === "borrow" && (m.borrowApr ?? 0) > 0);
    const liquid = borrow.filter((m) => (m.liquidityUsd || 0) > 0);
    g.bestBorrow = (liquid.length ? liquid : borrow).sort((a, b) => (a.borrowApr ?? 99) - (b.borrowApr ?? 99))[0] ?? null;
    g.maxLtv = Math.max(0, ...borrow.map((m) => m.maxLtv || 0));
    g.totalDepthUsd = g.markets.reduce((s, m) => s + marketDepthUsd(m), 0);
    g.venues = [...new Set(g.markets.map((m) => m.venue))];
    g.kinds = [...new Set(g.markets.map((m) => m.kind))];
    g.markets.sort((a, b) => marketDepthUsd(b) - marketDepthUsd(a));
  }
  return [...byStock.values()];
}

/** Earnings / borrowing helpers for the in-row calculator. */
export function yearlyEarnings(amountUsd: number, apyPct: number): number {
  return amountUsd > 0 && apyPct > 0 ? amountUsd * (apyPct / 100) : 0;
}

export function borrowCapacity(collateralUsd: number, ltvPct: number, aprPct: number) {
  const max = collateralUsd > 0 && ltvPct > 0 ? collateralUsd * (ltvPct / 100) : 0;
  // A comfortable borrow keeps a wide buffer before liquidation: half of the max.
  const safe = max * 0.5;
  return { max, safe, yearlyInterestOnSafe: safe * (Math.max(0, aprPct) / 100) };
}
