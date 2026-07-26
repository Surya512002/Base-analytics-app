import { LAUNCHPAD_PLATFORM_FEE_BPS } from "@/lib/constants/launchpad";
import { USDC_BASE } from "@/lib/launchpad/tokens-base";
import { WETH_BASE } from "@/lib/launchpad/uniswap";

export function isUsdcAddress(address: string): boolean {
  return address.toLowerCase() === USDC_BASE.toLowerCase();
}

export function isWethAddress(address: string): boolean {
  return address.toLowerCase() === WETH_BASE.toLowerCase();
}

export function netAfterPlatformFee(gross: number): number {
  if (!Number.isFinite(gross) || gross <= 0) return 0;
  return gross * (1 - LAUNCHPAD_PLATFORM_FEE_BPS / 10000);
}

export function grossFromNet(net: number): number {
  const factor = 1 - LAUNCHPAD_PLATFORM_FEE_BPS / 10000;
  if (!Number.isFinite(net) || net <= 0 || factor <= 0) return 0;
  return net / factor;
}

/**
 * USD values for a swap, anchored on the counter asset (the ETH or USDC side).
 *
 * Every in-app swap pairs the page token against a counter asset we have a
 * reliable USD price for, so both sides are derived from that leg + the live
 * quote. This works for ANY page token instead of trusting a possibly-stale
 * DexScreener price for the token side.
 *
 * `counterUsd` is USD per unit of the counter asset: the live ETH price for
 * ETH/WETH routes, or 1 for USDC routes.
 *
 * - Buy  (counter in → token out): pay = gross value, receive = net value
 *   (post platform fee). The token you receive is worth ~the net you spent.
 * - Sell (token in → counter out): receive = counter out value, pay = grossed-up
 *   value (what the tokens were worth before the platform fee).
 *
 * Price impact/slippage beyond the fee is surfaced separately via priceImpact.
 */
export function computeSwapUsd(opts: {
  direction: "buy" | "sell";
  payAmount: number;
  quoteOut: number | null;
  counterUsd: number;
}): { payUsd: number | null; receiveUsd: number | null } {
  const { direction, payAmount, quoteOut, counterUsd } = opts;
  const validCounter = Number.isFinite(counterUsd) && counterUsd > 0;

  if (direction === "buy") {
    if (!Number.isFinite(payAmount) || payAmount <= 0 || !validCounter) {
      return { payUsd: null, receiveUsd: null };
    }
    const payUsd = payAmount * counterUsd;
    return { payUsd, receiveUsd: netAfterPlatformFee(payUsd) };
  }

  if (
    quoteOut == null ||
    !Number.isFinite(quoteOut) ||
    quoteOut <= 0 ||
    !validCounter
  ) {
    return { payUsd: null, receiveUsd: null };
  }
  const receiveUsd = quoteOut * counterUsd;
  return { payUsd: grossFromNet(receiveUsd), receiveUsd };
}

/**
 * Token unit price implied by the live quote (USD per 1 token), anchored on the
 * counter asset. Reliable for every token since it comes straight from the
 * executable route.
 */
export function impliedTokenPriceUsd(opts: {
  direction: "buy" | "sell";
  payAmount: number;
  quoteOut: number;
  counterUsd: number;
}): number | null {
  const { direction, payAmount, quoteOut, counterUsd } = opts;
  if (
    !Number.isFinite(payAmount) ||
    payAmount <= 0 ||
    !Number.isFinite(quoteOut) ||
    quoteOut <= 0 ||
    !Number.isFinite(counterUsd) ||
    counterUsd <= 0
  ) {
    return null;
  }
  if (direction === "buy") {
    const netSpentUsd = netAfterPlatformFee(payAmount) * counterUsd;
    return netSpentUsd / quoteOut;
  }
  const netTokens = netAfterPlatformFee(payAmount);
  if (netTokens <= 0) return null;
  return (quoteOut * counterUsd) / netTokens;
}
