/**
 * Constant-product AMM for binary YES/NO shares (Uniswap V2 style).
 * Virtual reserves yesReserve * noReserve = k
 * Implied P(YES) = noReserve / (yesReserve + noReserve)
 */

export interface PoolState {
  yesReserve: number;
  noReserve: number;
}

export const DEFAULT_LIQUIDITY = 10_000;

export function impliedYesProbability(pool: PoolState): number {
  const total = pool.yesReserve + pool.noReserve;
  if (total <= 0) return 0.5;
  return pool.noReserve / total;
}

export function impliedNoProbability(pool: PoolState): number {
  return 1 - impliedYesProbability(pool);
}

/** USDC in → YES shares out (6-decimal float for UI). */
export function buyYesShares(pool: PoolState, usdcIn: number): {
  sharesOut: number;
  nextPool: PoolState;
  priceImpact: number;
  avgPrice: number;
} {
  if (usdcIn <= 0) {
    return { sharesOut: 0, nextPool: pool, priceImpact: 0, avgPrice: 0 };
  }
  const k = pool.yesReserve * pool.noReserve;
  const priceBefore = impliedYesProbability(pool);
  const newNo = pool.noReserve + usdcIn;
  const newYes = k / newNo;
  const sharesOut = pool.yesReserve - newYes;
  const nextPool = { yesReserve: newYes, noReserve: newNo };
  const priceAfter = impliedYesProbability(nextPool);
  const avgPrice = sharesOut > 0 ? usdcIn / sharesOut : 0;
  return {
    sharesOut,
    nextPool,
    priceImpact: priceAfter - priceBefore,
    avgPrice,
  };
}

export function buyNoShares(pool: PoolState, usdcIn: number): {
  sharesOut: number;
  nextPool: PoolState;
  priceImpact: number;
  avgPrice: number;
} {
  if (usdcIn <= 0) {
    return { sharesOut: 0, nextPool: pool, priceImpact: 0, avgPrice: 0 };
  }
  const k = pool.yesReserve * pool.noReserve;
  const priceBefore = impliedNoProbability(pool);
  const newYes = pool.yesReserve + usdcIn;
  const newNo = k / newYes;
  const sharesOut = pool.noReserve - newNo;
  const nextPool = { yesReserve: newYes, noReserve: newNo };
  const priceAfter = impliedNoProbability(nextPool);
  const avgPrice = sharesOut > 0 ? usdcIn / sharesOut : 0;
  return {
    sharesOut,
    nextPool,
    priceImpact: priceAfter - priceBefore,
    avgPrice,
  };
}

/** Depth buckets for order-book style visual (cumulative USDC to move price ±%). */
export function depthCurve(
  pool: PoolState,
  side: "yes" | "no",
  steps = 8
): { usdc: number; prob: number }[] {
  const points: { usdc: number; prob: number }[] = [];
  let p = { ...pool };
  const stepUsdc = Math.max(1, (p.yesReserve + p.noReserve) / steps / 4);
  for (let i = 0; i <= steps; i++) {
    const usdc = i * stepUsdc;
    if (i === 0) {
      points.push({
        usdc: 0,
        prob: side === "yes" ? impliedYesProbability(p) : impliedNoProbability(p),
      });
      continue;
    }
    const r = side === "yes" ? buyYesShares(p, stepUsdc) : buyNoShares(p, stepUsdc);
    p = r.nextPool;
    points.push({
      usdc,
      prob: side === "yes" ? impliedYesProbability(p) : impliedNoProbability(p),
    });
  }
  return points;
}

export function settlementPreview(
  pool: PoolState,
  protocolFeeBps: number
): { poolUsdc: number; feeUsdc: number; payoutUsdc: number } {
  const poolUsdc = pool.yesReserve + pool.noReserve - 2 * DEFAULT_LIQUIDITY;
  const gross = Math.max(0, poolUsdc);
  const feeUsdc = (gross * protocolFeeBps) / 10_000;
  return { poolUsdc: gross, feeUsdc, payoutUsdc: gross - feeUsdc };
}
