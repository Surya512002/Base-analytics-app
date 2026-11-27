import { fetchSwapQuote, type SwapQuoteResponse } from "@/lib/api/launchpad-client";

/** Price of buying one stock with USDC on a direct exchange (baskets don't use the aggregator). */
export async function fetchBasketQuote(p: {
  token: string;
  decimals: number;
  usdc: string;
  slippageBps: number;
  taker?: string | null;
}): Promise<SwapQuoteResponse> {
  const ask = (dex: "auto" | "slipstream") =>
    fetchSwapQuote({ token: p.token, direction: "buy", amount: p.usdc, decimals: p.decimals, slippageBps: p.slippageBps, dex, payAsset: "usdc", taker: p.taker });
  const best = await ask("auto");
  return best.dex === "aggregator" ? ask("slipstream") : best;
}
