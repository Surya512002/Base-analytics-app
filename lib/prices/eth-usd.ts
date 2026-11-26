import { parseAbi } from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";

/** Chainlink ETH/USD on Base mainnet, 8 decimals, updates at least every 20 minutes. */
const CHAINLINK_ETH_USD_BASE = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70" as const;
const ABI = parseAbi([
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);
const MAX_AGE_SEC = 3600;

/** Live ETH price in USD, or 0 when no live source answers. Never an assumed value. */
export async function fetchEthUsd(): Promise<number> {
  try {
    const [, answer, , updatedAt] = await createBasePublicClient().readContract({
      address: CHAINLINK_ETH_USD_BASE,
      abi: ABI,
      functionName: "latestRoundData",
    });
    if (answer > BigInt(0) && Date.now() / 1000 - Number(updatedAt) < MAX_AGE_SEC) {
      return Number(answer) / 1e8;
    }
  } catch {
    // Try the second source.
  }
  try {
    const r = await fetch("https://coins.llama.fi/prices/current/coingecko:ethereum", {
      signal: AbortSignal.timeout(3_000),
      cache: "no-store",
    });
    if (r.ok) {
      const d = (await r.json()) as { coins?: Record<string, { price?: number }> };
      const p = d.coins?.["coingecko:ethereum"]?.price;
      if (p && p > 0) return p;
    }
  } catch {
    // Unknown price.
  }
  return 0;
}
