/**
 * Price impact measured against the route actually being traded.
 *
 * The honest definition of price impact is "how much does *my size* move the
 * execution price versus the price an infinitesimal trade would get on the same
 * route". Comparing a quote to an external spot feed (DexScreener, CoinGecko)
 * does not measure that: the two numbers come from different pools, different
 * ETH prices and different refresh clocks, so they disagree by a percent or two
 * even at rest and a $5 trade appears to have several percent of "impact".
 *
 * Instead we re-quote the same pool with a tiny fraction of the order. That
 * gives the marginal rate, and everything that is not size-related — the pool's
 * own price level, the venue's fee, the USD feed — cancels out of the ratio.
 */

/** Re-quote the chosen route with `probeIn`, returning raw output units. */
export type MarginalProbe = (probeIn: bigint) => Promise<bigint>;

/**
 * Fraction of the order used as the marginal probe.
 *
 * The probe has impact of its own, which biases the result low by roughly this
 * same fraction — negligible at 1/1000, while still large enough to stay clear
 * of integer truncation in the quoters.
 */
const PROBE_DIVISOR = BigInt(1000);

const BPS = BigInt(10_000);

/** Impact above this is almost certainly a broken/asymmetric pool, not real depth. */
const MAX_REPORTABLE_BPS = 9_900;

export function probeAmountFor(amountIn: bigint): bigint {
  if (amountIn <= BigInt(0)) return BigInt(0);
  const probe = amountIn / PROBE_DIVISOR;
  return probe > BigInt(0) ? probe : BigInt(1);
}

/**
 * Price impact in basis points, or null when it cannot be measured honestly.
 *
 * Null means "don't show a number" — a missing probe is not 0% impact, and
 * quietly rendering zero would be its own lie.
 */
export function priceImpactBpsFromProbe(opts: {
  amountIn: bigint;
  amountOut: bigint;
  probeIn: bigint;
  probeOut: bigint;
}): number | null {
  const { amountIn, amountOut, probeIn, probeOut } = opts;
  if (
    amountIn <= BigInt(0) ||
    amountOut <= BigInt(0) ||
    probeIn <= BigInt(0) ||
    probeOut <= BigInt(0)
  ) {
    return null;
  }

  // impact = 1 - (amountOut/amountIn) / (probeOut/probeIn), kept in integer
  // math until the final division so no precision is lost on 18-decimal sizes.
  const execNumerator = amountOut * probeIn * BPS;
  const marginalDenominator = amountIn * probeOut;
  if (marginalDenominator <= BigInt(0)) return null;

  const ratioBps = execNumerator / marginalDenominator;

  // Better than marginal (rounding, or the probe crossed a thinner tick) is
  // reported as zero rather than a negative "bonus".
  if (ratioBps >= BPS) return 0;

  const impact = Number(BPS - ratioBps);
  if (!Number.isFinite(impact) || impact < 0) return null;
  return Math.min(impact, MAX_REPORTABLE_BPS);
}

/** Run the probe and turn it into basis points. Never throws. */
export async function estimatePriceImpactBps(opts: {
  amountIn: bigint;
  amountOut: bigint;
  probe: MarginalProbe;
}): Promise<number | null> {
  const probeIn = probeAmountFor(opts.amountIn);
  if (probeIn <= BigInt(0)) return null;

  try {
    const probeOut = await opts.probe(probeIn);
    return priceImpactBpsFromProbe({
      amountIn: opts.amountIn,
      amountOut: opts.amountOut,
      probeIn,
      probeOut,
    });
  } catch {
    return null;
  }
}
