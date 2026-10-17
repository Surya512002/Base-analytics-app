/**
 * Swap Provider Abstraction for Base Mainnet
 *
 * Provides a unified interface for swap quoting, allowance checks, and transaction building.
 * Implementations can include the default Base DEX aggregator (Uniswap V3, Aerodrome, Slipstream),
 * limit orders, cross-chain intents, or direct B20 precompile stock trades.
 */

import { fetchSwapQuote, type LaunchDex, type SwapQuoteResponse } from "@/lib/api/launchpad-client";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { ERC20_ABI } from "@/lib/constants/contracts";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import type { SwapAsset } from "@/lib/launchpad/tokens-base";
import { parseUnits } from "viem";

export interface SwapQuoteParams {
  token: string;
  symbol?: string;
  direction: "buy" | "sell";
  amount: string;
  decimals: number;
  slippageBps: number;
  dex?: LaunchDex;
  referrer?: string | null;
  taker?: string | null;
  payAsset?: SwapAsset;
  receiveAsset?: SwapAsset;
  payToken?: string | null;
  receiveToken?: string | null;
  counterDecimals?: number;
}

export interface SwapQuoteResult {
  hasLiquidity: boolean;
  amountIn: string;
  amountOut: string;
  amountOutMinimum?: string;
  outDecimals?: number;
  dex?: string;
  priceImpactBps?: number | null;
  platformFeeBps?: number;
  isLaunchedToken?: boolean;
  creator?: string;
  error?: string;
  raw: SwapQuoteResponse;
}

export interface SwapProvider {
  readonly id: string;
  readonly name: string;
  getQuote(params: SwapQuoteParams): Promise<SwapQuoteResult>;
  getAllowance(owner: `0x${string}`, token: `0x${string}`, spender: `0x${string}`): Promise<bigint>;
}

export class BaseDexAggregatorProvider implements SwapProvider {
  readonly id = "base-dex-aggregator";
  readonly name = "Base Smart Order Router";

  async getQuote(params: SwapQuoteParams): Promise<SwapQuoteResult> {
    const raw = await fetchSwapQuote({
      token: params.token,
      direction: params.direction,
      amount: params.amount,
      decimals: params.decimals,
      slippageBps: params.slippageBps,
      dex: params.dex ?? "auto",
      referrer: params.referrer,
      taker: params.taker,
      payAsset: params.payAsset,
      receiveAsset: params.receiveAsset,
      payToken: params.payToken,
      receiveToken: params.receiveToken,
      counterDecimals: params.counterDecimals,
      includeAggregator: true,
    });

    return {
      hasLiquidity: Boolean(raw.hasLiquidity && raw.amountOut && raw.amountOut !== "0"),
      amountIn: raw.amountIn,
      amountOut: raw.amountOut,
      amountOutMinimum: raw.amountOutMinimum,
      outDecimals: raw.outDecimals,
      dex: raw.dex ?? undefined,
      priceImpactBps: raw.priceImpactBps,
      platformFeeBps: raw.platformFeeBps ?? 50,
      isLaunchedToken: raw.isLaunchedToken,
      creator: raw.creator,
      error: raw.error,
      raw,
    };
  }

  async getAllowance(
    owner: `0x${string}`,
    token: `0x${string}`,
    spender: `0x${string}`
  ): Promise<bigint> {
    try {
      const pub = createBasePublicClient();
      const allowance = await pub.readContract({
        address: token,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [owner, spender],
      });
      return allowance;
    } catch {
      return BigInt(0);
    }
  }
}

export const defaultSwapProvider = new BaseDexAggregatorProvider();
