import {
  createWalletClient,
  http,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import {
  DEFAULT_OPEN_LIQUIDITY_USDC,
  MARKET_TRACKS,
  type MarketTrack,
} from "@/lib/constants/predictions";
import { PREDICTIONS_ABI } from "@/lib/constants/contracts";
import { roundBounds } from "@/lib/predictions/market-engine";
import {
  fetchOnChainMarkets,
  getPredictionsPublicClient,
  matchOnChainMarket,
  type OnChainMarket,
} from "@/lib/predictions/onchain";
import { encodeTrackId } from "@/lib/predictions/track-id";
import { getBuilderDataSuffix } from "@/lib/utils/tx";

export type KeeperResult = {
  opened: number[];
  closed: number[];
  resolved: number[];
  errors: string[];
};

function liquidityRaw(usdc: number): bigint {
  return parseUnits(String(usdc), 6);
}

export async function runPredictionKeeper(args: {
  rpcUrl: string;
  contract: `0x${string}`;
  privateKey: `0x${string}`;
  initialLiquidityUsdc?: number;
  now?: number;
}): Promise<KeeperResult> {
  const {
    rpcUrl,
    contract,
    privateKey,
    initialLiquidityUsdc = DEFAULT_OPEN_LIQUIDITY_USDC,
    now = Date.now(),
  } = args;

  const account = privateKeyToAccount(privateKey);
  const publicClient = getPredictionsPublicClient(rpcUrl);
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl),
    dataSuffix: getBuilderDataSuffix(),
  });

  const result: KeeperResult = { opened: [], closed: [], resolved: [], errors: [] };
  const onChain = await fetchOnChainMarkets(publicClient, contract, 48);

  for (const track of MARKET_TRACKS) {
    if (track.onChainEnabled === false) continue;
    const existing = matchOnChainMarket(onChain, track, now);
    const { open, close, resolve } = roundBounds(track, now);
    const openSec = Math.floor(open / 1000);
    const closeSec = Math.floor(close / 1000);
    const resolveSec = Math.floor(resolve / 1000);

    if (!existing && now < close) {
      try {
        const hash = await walletClient.writeContract({
          address: contract,
          abi: PREDICTIONS_ABI,
          functionName: "openMarket",
          args: [
            encodeTrackId(track.id),
            track.chainlinkFeed,
            BigInt(openSec),
            BigInt(closeSec),
            BigInt(resolveSec),
            liquidityRaw(initialLiquidityUsdc),
          ],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        const refreshed = await fetchOnChainMarkets(publicClient, contract, 32);
        const opened = matchOnChainMarket(refreshed, track, now);
        if (opened) result.opened.push(opened.marketId);
      } catch (e) {
        result.errors.push(
          `open ${track.id}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  }

  const latest = await fetchOnChainMarkets(publicClient, contract, 48);
  const nowSec = Math.floor(now / 1000);

  for (const m of latest) {
    if (m.phase === "open" && nowSec >= m.closeTime) {
      try {
        const hash = await walletClient.writeContract({
          address: contract,
          abi: PREDICTIONS_ABI,
          functionName: "closeMarket",
          args: [BigInt(m.marketId)],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        result.closed.push(m.marketId);
      } catch (e) {
        result.errors.push(
          `close ${m.marketId}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  }

  const afterClose = await fetchOnChainMarkets(publicClient, contract, 48);
  for (const m of afterClose) {
    const closable =
      m.phase === "closed" || (m.phase === "open" && nowSec >= m.resolveTime);
    if (closable && nowSec >= m.resolveTime) {
      if (m.phase === "open") {
        try {
          const hash = await walletClient.writeContract({
            address: contract,
            abi: PREDICTIONS_ABI,
            functionName: "closeMarket",
            args: [BigInt(m.marketId)],
          });
          await publicClient.waitForTransactionReceipt({ hash });
        } catch {
          // may already be closed
        }
      }
      try {
        const hash = await walletClient.writeContract({
          address: contract,
          abi: PREDICTIONS_ABI,
          functionName: "resolveMarket",
          args: [BigInt(m.marketId)],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        result.resolved.push(m.marketId);
      } catch (e) {
        result.errors.push(
          `resolve ${m.marketId}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  }

  return result;
}

export function mergeMarketWithChain(
  demo: import("@/lib/predictions/types").LiveMarket,
  chain: OnChainMarket | null
): import("@/lib/predictions/types").LiveMarket {
  if (!chain) return demo;

  return {
    ...demo,
    onChainMarketId: chain.marketId,
    isOnChain: true,
    phase: chain.phase,
    openPrice: chain.openPrice > 0 ? chain.openPrice : demo.openPrice,
    resolvePrice: chain.resolvePrice,
    pool: { yesReserve: chain.yesReserve, noReserve: chain.noReserve },
    yesWins: chain.yesWins,
    oneSided: chain.oneSided,
    openTime: chain.openTime * 1000,
    closeTime: chain.closeTime * 1000,
    resolveTime: chain.resolveTime * 1000,
  };
}

export function trackFromOnChain(m: OnChainMarket): MarketTrack | undefined {
  return MARKET_TRACKS.find((t) => encodeTrackId(t.id) === m.trackId);
}
