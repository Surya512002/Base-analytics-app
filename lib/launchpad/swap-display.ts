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
 * USD values for a swap, anchored on ETH.
 *
 * Every in-app swap routes token↔ETH, and ETH/USD is our one reliable price
 * feed, so we derive both the pay and receive USD from the ETH leg + the live
 * quote. This works consistently for ANY asset (memecoins, USDC, WETH) instead
 * of trusting a possibly-stale DexScreener token price for the counter side.
 *
 * - Buy  (ETH in → token out): pay = gross ETH value, receive = net ETH value
 *   (post platform fee). The token you receive is worth ~the net ETH you spent.
 * - Sell (token in → ETH out): receive = ETH out value, pay = grossed-up value
 *   (what the tokens were worth before the platform fee).
 *
 * Price impact/slippage beyond the fee is surfaced separately via priceImpact.
 */
export function computeSwapUsd(opts: {
  direction: "buy" | "sell";
  payAmount: number;
  quoteOut: number | null;
  ethUsd: number;
}): { payUsd: number | null; receiveUsd: number | null } {
  const { direction, payAmount, quoteOut, ethUsd } = opts;
  const validEth = Number.isFinite(ethUsd) && ethUsd > 0;

  if (direction === "buy") {
    if (!Number.isFinite(payAmount) || payAmount <= 0 || !validEth) {
      return { payUsd: null, receiveUsd: null };
    }
    const payUsd = payAmount * ethUsd;
    return { payUsd, receiveUsd: netAfterPlatformFee(payUsd) };
  }

  // Sell: ETH out is the reliable side.
  if (quoteOut == null || !Number.isFinite(quoteOut) || quoteOut <= 0 || !validEth) {
    return { payUsd: null, receiveUsd: null };
  }
  const receiveUsd = quoteOut * ethUsd;
  return { payUsd: grossFromNet(receiveUsd), receiveUsd };
}

/**
 * Token unit price implied by the live quote (USD per 1 token), anchored on ETH.
 * Reliable for every asset since it comes straight from the executable route.
 */
export function impliedTokenPriceUsd(opts: {
  direction: "buy" | "sell";
  payAmount: number;
  quoteOut: number;
  ethUsd: number;
}): number | null {
  const { direction, payAmount, quoteOut, ethUsd } = opts;
  if (
    !Number.isFinite(payAmount) ||
    payAmount <= 0 ||
    !Number.isFinite(quoteOut) ||
    quoteOut <= 0 ||
    !Number.isFinite(ethUsd) ||
    ethUsd <= 0
  ) {
    return null;
  }
  if (direction === "buy") {
    // netEth spent buys quoteOut tokens.
    const netEthUsd = netAfterPlatformFee(payAmount) * ethUsd;
    return netEthUsd / quoteOut;
  }
  // payAmount tokens (net of fee) yield quoteOut ETH.
  const netTokens = netAfterPlatformFee(payAmount);
  if (netTokens <= 0) return null;
  return (quoteOut * ethUsd) / netTokens;
}

/**
 * Price impact %: how far the quote's execution price sits from the reference
 * market price (DexScreener). Returns null when we lack a sane reference.
 */
export function computePriceImpactPct(opts: {
  direction: "buy" | "sell";
  payAmount: number;
  quoteOut: number;
  ethUsd: number;
  referencePriceUsd: number | null;
}): number | null {
  const { referencePriceUsd } = opts;
  if (referencePriceUsd == null || referencePriceUsd <= 0) return null;
  const implied = impliedTokenPriceUsd(opts);
  if (implied == null || implied <= 0) return null;
  return Math.abs(1 - implied / referencePriceUsd) * 100;
}
