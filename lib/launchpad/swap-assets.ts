import type { Address } from "viem";
import { USDC_BASE, USDC_DECIMALS, type SwapAsset, isValidTokenAddress } from "@/lib/launchpad/tokens-base";
import { ZEROX_NATIVE_ETH } from "@/lib/launchpad/zerox";

export type ResolvedSwapLegs = {
  sellToken: string;
  buyToken: string;
  amountDecimals: number;
  outDecimals: number;
  /** Direct Uniswap/Aerodrome/Slipstream WETH routes apply. */
  canUseDirectDex: boolean;
  payAsset: SwapAsset;
  receiveAsset: SwapAsset;
};

export function parseSwapAsset(raw: string | null, fallback: SwapAsset = "eth"): SwapAsset {
  if (raw === "usdc" || raw === "token") return raw;
  return fallback;
}

export function resolveSwapLegs(params: {
  pageToken: Address;
  direction: "buy" | "sell";
  payAsset?: SwapAsset;
  receiveAsset?: SwapAsset;
  payToken?: string | null;
  receiveToken?: string | null;
  pageDecimals?: number;
  counterDecimals?: number;
}): ResolvedSwapLegs | null {
  const payAsset = params.payAsset ?? "eth";
  const receiveAsset = params.receiveAsset ?? "eth";
  const pageDec = params.pageDecimals ?? 18;
  const counterDec = params.counterDecimals ?? 18;

  if (params.direction === "buy") {
    let sellToken: string;
    let amountDecimals: number;
    if (payAsset === "eth") {
      sellToken = ZEROX_NATIVE_ETH;
      amountDecimals = 18;
    } else if (payAsset === "usdc") {
      sellToken = USDC_BASE;
      amountDecimals = USDC_DECIMALS;
    } else if (isValidTokenAddress(params.payToken)) {
      sellToken = params.payToken;
      amountDecimals = counterDec;
    } else {
      return null;
    }
    return {
      sellToken,
      buyToken: params.pageToken,
      amountDecimals,
      outDecimals: pageDec,
      canUseDirectDex: payAsset === "eth",
      payAsset,
      receiveAsset: "eth",
    };
  }

  let buyToken: string;
  let outDecimals: number;
  if (receiveAsset === "eth") {
    buyToken = ZEROX_NATIVE_ETH;
    outDecimals = 18;
  } else if (receiveAsset === "usdc") {
    buyToken = USDC_BASE;
    outDecimals = USDC_DECIMALS;
  } else if (isValidTokenAddress(params.receiveToken)) {
    buyToken = params.receiveToken;
    outDecimals = counterDec;
  } else {
    return null;
  }

  return {
    sellToken: params.pageToken,
    buyToken,
    amountDecimals: pageDec,
    outDecimals,
    canUseDirectDex: receiveAsset === "eth",
    payAsset: "eth",
    receiveAsset,
  };
}
