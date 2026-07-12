import { LAUNCHPAD_PLATFORM_FEE_BPS } from "@/lib/constants/launchpad";
import { USDC_BASE, type SwapAsset } from "@/lib/launchpad/tokens-base";
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

/** Map a token amount to USD using stablecoin / WETH / DexScreener price rules. */
export function tokenAmountToUsd(
  amount: number,
  opts: {
    tokenAddress?: string;
    ethUsd: number;
    priceUsd?: number | null;
    assetKind?: SwapAsset;
  }
): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const addr = opts.tokenAddress?.toLowerCase() ?? "";
  const kind = opts.assetKind;

  if (kind === "usdc" || isUsdcAddress(addr)) return amount;
  if (kind === "eth" || isWethAddress(addr)) return amount * opts.ethUsd;
  if (opts.priceUsd != null && opts.priceUsd > 0) return amount * opts.priceUsd;
  return null;
}

export function swapPayUsd(opts: {
  direction: "buy" | "sell";
  amount: number;
  tokenAddress: string;
  tokenPriceUsd: number | null;
  ethUsd: number;
  payAsset?: SwapAsset;
}): number | null {
  const { direction, amount, tokenAddress, tokenPriceUsd, ethUsd, payAsset } = opts;
  if (direction === "buy") {
    return tokenAmountToUsd(amount, {
      tokenAddress,
      ethUsd,
      assetKind: payAsset ?? "eth",
    });
  }
  return tokenAmountToUsd(amount, {
    tokenAddress,
    ethUsd,
    priceUsd: tokenPriceUsd,
    assetKind: "token",
  });
}

export function swapReceiveUsd(opts: {
  direction: "buy" | "sell";
  quoteOut: number;
  tokenAddress: string;
  tokenPriceUsd: number | null;
  ethUsd: number;
  receiveAsset?: SwapAsset;
}): number | null {
  const { direction, quoteOut, tokenAddress, tokenPriceUsd, ethUsd, receiveAsset } = opts;
  if (direction === "buy") {
    return tokenAmountToUsd(quoteOut, {
      tokenAddress,
      ethUsd,
      priceUsd: tokenPriceUsd,
      assetKind: "token",
    });
  }
  return tokenAmountToUsd(quoteOut, {
    tokenAddress,
    ethUsd,
    assetKind: receiveAsset ?? "eth",
  });
}

/** Expected receive amount (human units) before slippage, after platform fee. */
export function expectedReceiveAmount(opts: {
  direction: "buy" | "sell";
  payAmount: number;
  tokenAddress: string;
  tokenPriceUsd: number | null;
  ethUsd: number;
  payAsset?: SwapAsset;
  receiveAsset?: SwapAsset;
}): number | null {
  const payUsd = swapPayUsd({
    direction: opts.direction,
    amount: opts.payAmount,
    tokenAddress: opts.tokenAddress,
    tokenPriceUsd: opts.tokenPriceUsd,
    ethUsd: opts.ethUsd,
    payAsset: opts.payAsset,
  });
  if (payUsd == null) return null;

  const netUsd = netAfterPlatformFee(payUsd);
  if (opts.direction === "buy") {
    if (isUsdcAddress(opts.tokenAddress)) return netUsd;
    if (isWethAddress(opts.tokenAddress)) return netUsd / opts.ethUsd;
    if (opts.tokenPriceUsd != null && opts.tokenPriceUsd > 0) {
      return netUsd / opts.tokenPriceUsd;
    }
    return null;
  }

  if ((opts.receiveAsset ?? "eth") === "usdc") return netUsd;
  return netUsd / opts.ethUsd;
}
