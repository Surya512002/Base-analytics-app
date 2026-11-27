/** One purchase of several tokenized stocks with USDC: the calls that go into a single batch. Pure. */
import { parseUnits, type Address, type Hex } from "viem";
import type { SwapQuoteResponse } from "@/lib/api/launchpad-client";
import { splitGrossAmount, LAUNCHPAD_TRADING_FEE_BPS } from "@/lib/launchpad/fees";
import { isTrustedSwapTarget } from "@/lib/launchpad/router-guard";
import { encodeAerodromeTokensForTokens } from "@/lib/launchpad/aerodrome";
import { encodeSlipstreamExactInput, encodeSlipstreamPathSwap } from "@/lib/launchpad/slipstream";
import { encodeExactInputMultiHop, encodeExactInputSingle } from "@/lib/launchpad/uniswap";
import { USDC_BASE, USDC_DECIMALS } from "@/lib/launchpad/tokens-base";
import { encodeB20ApproveCalldata, encodeErc20TransferCalldata } from "@/lib/b20/encode";
import { LAUNCHPAD_TREASURY } from "@/lib/constants/launchpad";
import { buildContractCall, type ContractCall } from "@/lib/utils/tx";

/** Swap calldata for buying a token with another token on the venue the quote chose. */
export function encodeTokenBuy(
  quote: SwapQuoteResponse,
  p: { tokenIn: Address; tokenOut: Address; recipient: Address; amountIn: bigint }
): Hex {
  const common = { recipient: p.recipient, amountIn: p.amountIn, amountOutMinimum: BigInt(quote.amountOutMinimum) };
  if (quote.dex === "aerodrome") {
    return encodeAerodromeTokensForTokens({
      ...common,
      tokenIn: p.tokenIn,
      tokenOut: p.tokenOut,
      stable: quote.aerodromeStable ?? false,
      hops: quote.aerodromeHops?.map((h) => ({ from: h.from as Address, to: h.to as Address, stable: h.stable })),
    });
  }
  if (quote.dex === "slipstream") {
    return quote.slipstreamPath
      ? encodeSlipstreamPathSwap({ ...common, path: quote.slipstreamPath as Hex })
      : encodeSlipstreamExactInput({ ...common, tokenIn: p.tokenIn, tokenOut: p.tokenOut, tickSpacing: quote.slipstreamTickSpacing ?? 200 });
  }
  return quote.uniswapPath
    ? encodeExactInputMultiHop({ ...common, path: quote.uniswapPath as Hex })
    : encodeExactInputSingle({ ...common, tokenIn: p.tokenIn, tokenOut: p.tokenOut, fee: quote.uniswapFeeTier ?? 3000 });
}

export type BasketLeg = { symbol: string; token: Address; usdc: string; quote: SwapQuoteResponse };

export type BasketPlan =
  | { ok: true; calls: ContractCall[]; total: bigint; fee: bigint }
  | { ok: false; error: string };

/**
 * [approval per router, one swap per stock, one fee transfer]. Only direct exchange routes are
 * accepted: every approval and call must go to a known router, and every swap pays the buyer.
 * `allowances` (router address in lower case → USDC already approved) skips needless approvals.
 */
export function buildBasketCalls(buyer: Address, legs: BasketLeg[], allowances: Map<string, bigint> = new Map()): BasketPlan {
  if (legs.length < 1) return { ok: false, error: "Pick at least one stock." };
  const usdc = USDC_BASE as Address;
  const approvals = new Map<string, { router: Address; amount: bigint }>();
  const swaps: ContractCall[] = [];
  let total = BigInt(0);
  let fee = BigInt(0);

  for (const leg of legs) {
    const { quote } = leg;
    const router = quote.router as Address | undefined;
    if (!quote.hasLiquidity || !router) return { ok: false, error: `No route for ${leg.symbol} right now.` };
    if (quote.dex === "aggregator" || quote.isLaunchedToken) return { ok: false, error: `${leg.symbol} can't be bought in a basket right now.` };
    if (!isTrustedSwapTarget(router)) return { ok: false, error: `Unrecognised swap contract for ${leg.symbol}. Nothing was sent.` };

    const gross = parseUnits(leg.usdc, USDC_DECIMALS);
    const split = splitGrossAmount(gross, LAUNCHPAD_TRADING_FEE_BPS);
    // The quote must be for exactly this amount, and must protect the buyer with a minimum.
    if (gross <= BigInt(0) || quote.amountIn !== split.net.toString() || !(BigInt(quote.amountOutMinimum || "0") > BigInt(0))) {
      return { ok: false, error: `The quote for ${leg.symbol} is out of date. Try again.` };
    }
    const key = router.toLowerCase();
    approvals.set(key, { router, amount: (approvals.get(key)?.amount ?? BigInt(0)) + split.net });
    swaps.push(buildContractCall(router, encodeTokenBuy(quote, { tokenIn: usdc, tokenOut: leg.token, recipient: buyer, amountIn: split.net })));
    total += gross;
    fee += split.fee;
  }

  const approveCalls = [...approvals.entries()]
    .filter(([key, a]) => (allowances.get(key) ?? BigInt(0)) < a.amount)
    .map(([, a]) => buildContractCall(usdc, encodeB20ApproveCalldata(a.router, a.amount)));
  const calls = [...approveCalls, ...swaps];
  if (fee > BigInt(0) && buyer.toLowerCase() !== LAUNCHPAD_TREASURY.toLowerCase()) {
    calls.push(buildContractCall(usdc, encodeErc20TransferCalldata(LAUNCHPAD_TREASURY, fee)));
  }
  return { ok: true, calls, total, fee };
}
