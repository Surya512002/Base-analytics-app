import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { PREDICTIONS_ABI } from "@/lib/constants/contracts";
import type { MarketTrack } from "@/lib/constants/predictions";
import { roundBounds } from "@/lib/predictions/market-engine";
import { encodeTrackId } from "@/lib/predictions/track-id";
import type { MarketPhase } from "@/lib/predictions/types";

const USDC_DECIMALS = 1_000_000;
const CHAINLINK_PRICE_SCALE = 1e8;

export type OnChainMarket = {
  marketId: number;
  trackId: `0x${string}`;
  openTime: number;
  closeTime: number;
  resolveTime: number;
  openPrice: number;
  resolvePrice: number | null;
  yesReserve: number;
  noReserve: number;
  phase: MarketPhase;
  yesWins: boolean | null;
  oneSided: boolean;
};

function phaseFromUint(n: number): MarketPhase {
  switch (n) {
    case 0:
      return "open";
    case 1:
      return "closed";
    case 2:
      return "resolved";
    case 3:
      return "void";
    default:
      return "open";
  }
}

export function getPredictionsPublicClient(rpcUrl: string) {
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });
}

type ChainReader = ReturnType<typeof getPredictionsPublicClient>;

export async function fetchOnChainMarkets(
  client: ChainReader,
  contract: `0x${string}`,
  scanLimit = 400
): Promise<OnChainMarket[]> {
  const nextId = Number(
    await client.readContract({
      address: contract,
      abi: PREDICTIONS_ABI,
      functionName: "nextMarketId",
    })
  );

  if (nextId <= 1) return [];

  const start = Math.max(1, nextId - scanLimit);
  const ids = Array.from({ length: nextId - start }, (_, i) => start + i);

  const rows = await Promise.all(
    ids.map(async (marketId) => {
      try {
        const m = await client.readContract({
          address: contract,
          abi: PREDICTIONS_ABI,
          functionName: "markets",
          args: [BigInt(marketId)],
        });
        const phase = phaseFromUint(Number(m[9]));
        return {
          marketId,
          trackId: m[0] as `0x${string}`,
          openTime: Number(m[2]),
          closeTime: Number(m[3]),
          resolveTime: Number(m[4]),
          openPrice: Number(m[5]) / CHAINLINK_PRICE_SCALE,
          resolvePrice:
            phase === "resolved" || phase === "void"
              ? Number(m[6]) / CHAINLINK_PRICE_SCALE
              : null,
          yesReserve: Number(m[7]) / USDC_DECIMALS,
          noReserve: Number(m[8]) / USDC_DECIMALS,
          phase,
          yesWins: phase === "resolved" ? Boolean(m[10]) : null,
          oneSided: phase === "void",
        } satisfies OnChainMarket;
      } catch {
        return null;
      }
    })
  );

  return rows.filter((r): r is OnChainMarket => r !== null);
}

/** Find the on-chain market for a track's current epoch round. */
export function matchOnChainMarket(
  markets: OnChainMarket[],
  track: MarketTrack,
  now = Date.now()
): OnChainMarket | null {
  const { open } = roundBounds(track, now);
  const openSec = Math.floor(open / 1000);
  const trackHash = encodeTrackId(track.id);

  const matches = markets.filter(
    (m) => m.trackId === trackHash && m.openTime === openSec
  );
  if (!matches.length) return null;
  return matches.reduce((best, m) => (m.marketId > best.marketId ? m : best));
}

export function roundKey(track: MarketTrack, now = Date.now()): string {
  const { roundId } = roundBounds(track, now);
  return `${track.id}:${roundId}`;
}
