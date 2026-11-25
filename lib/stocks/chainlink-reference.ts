import { parseAbi } from "viem";
import { TOKENIZED_STOCKS_REGISTRY } from "@/lib/stocks/tokenized-stocks-registry";
import { createBasePublicClient } from "@/lib/utils/base-rpc";

const FEED_ABI = parseAbi(["function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)"]);

export function chainlinkFeedFor(stockAddress: string) {
  const stock = TOKENIZED_STOCKS_REGISTRY.find((s) => s.address.toLowerCase() === stockAddress.toLowerCase());
  return stock?.priceFeed.type === "chainlink" ? (stock.priceFeed.address ?? null) : null;
}

/** The stock's latest Chainlink price (8 decimals) and when it was written; null when there is none. */
export async function readChainlinkReference(stockAddress: string): Promise<{ price: number; updatedAt: number } | null> {
  const feed = chainlinkFeedFor(stockAddress);
  if (!feed) return null;
  try {
    const [, answer, , updatedAt] = await createBasePublicClient().readContract({ address: feed, abi: FEED_ABI, functionName: "latestRoundData" });
    return answer > 0n ? { price: Number(answer) / 1e8, updatedAt: Number(updatedAt) } : null;
  } catch {
    return null;
  }
}

export function ageText(updatedAtSec: number, nowSec = Math.floor(Date.now() / 1000)): string {
  const age = Math.max(0, nowSec - updatedAtSec);
  if (age < 90) return "just now";
  if (age < 3600) return `${Math.round(age / 60)} min ago`;
  if (age < 172_800) return `${Math.round(age / 3600)} h ago`;
  return `${Math.round(age / 86_400)} days ago`;
}
