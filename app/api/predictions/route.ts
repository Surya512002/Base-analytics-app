import { NextResponse } from "next/server";
import { buildAllMarkets } from "@/lib/predictions/market-engine";
import { mergeMarketWithChain, runPredictionKeeper } from "@/lib/predictions/keeper";
import {
  fetchOnChainMarkets,
  getPredictionsPublicClient,
  matchOnChainMarket,
} from "@/lib/predictions/onchain";
import { getBaseRpcUrls } from "@/lib/utils/base-rpc";
import { MARKET_TRACKS, PROTOCOL_FEE_BPS, PROTOCOL_FEE_LABEL } from "@/lib/constants/predictions";
import { APP_TREASURY } from "@/lib/constants/treasury";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PREDICTIONS_CONTRACT = process.env.NEXT_PUBLIC_PREDICTIONS_CONTRACT as
  | `0x${string}`
  | undefined;
const KEEPER_KEY = process.env.PREDICTIONS_KEEPER_PRIVATE_KEY as
  | `0x${string}`
  | undefined;

const KEEPER_MIN_INTERVAL_MS = 60_000;
const RESPONSE_CACHE_MS = 20_000;

let lastKeeperRun = 0;
let responseCache: { body: Record<string, unknown>; at: number } | null = null;

async function fetchSpotPrices(): Promise<Record<string, number>> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd",
      { next: { revalidate: 30 } }
    );
    if (!res.ok) throw new Error("price fetch failed");
    const data = (await res.json()) as {
      bitcoin?: { usd: number };
      ethereum?: { usd: number };
      solana?: { usd: number };
    };
    return {
      bitcoin: data.bitcoin?.usd ?? 0,
      ethereum: data.ethereum?.usd ?? 0,
      solana: data.solana?.usd ?? 0,
    };
  } catch {
    return { bitcoin: 97000, ethereum: 3600, solana: 145 };
  }
}

async function maybeRunKeeper(): Promise<void> {
  const rpcUrl =
    getBaseRpcUrls().find((u) => !u.includes("alchemy.com")) ??
    getBaseRpcUrls()[0];
  if (!PREDICTIONS_CONTRACT || !rpcUrl || !KEEPER_KEY) return;
  const now = Date.now();
  if (now - lastKeeperRun < KEEPER_MIN_INTERVAL_MS) return;
  lastKeeperRun = now;
  try {
    await runPredictionKeeper({
      rpcUrl,
      contract: PREDICTIONS_CONTRACT,
      privateKey: KEEPER_KEY,
      initialLiquidityUsdc: Number(
        process.env.PREDICTIONS_INITIAL_LIQUIDITY_USDC || "10000"
      ),
    });
  } catch (e) {
    console.error("[predictions keeper]", e);
  }
}

export async function GET() {
  const now = Date.now();
  if (responseCache && now - responseCache.at < RESPONSE_CACHE_MS) {
    return NextResponse.json(responseCache.body);
  }

  const prices = await fetchSpotPrices();
  const demoMarkets = buildAllMarkets(prices, now);

  let onChain = false;
  let keeperRan = false;

  if (PREDICTIONS_CONTRACT) {
    await maybeRunKeeper();
    keeperRan = Boolean(KEEPER_KEY);

    try {
      const client = getPredictionsPublicClient();
      const chainMarkets = await fetchOnChainMarkets(
        client,
        PREDICTIONS_CONTRACT,
        72
      );
      const markets = demoMarkets.map((demo) => {
        const track = MARKET_TRACKS.find((t) => t.id === demo.trackId);
        if (!track) return demo;
        const chain = matchOnChainMarket(chainMarkets, track, now);
        return mergeMarketWithChain(demo, chain);
      });
      onChain = true;
      const body = {
        markets,
        prices,
        protocolFeeBps: PROTOCOL_FEE_BPS,
        protocolFeeLabel: PROTOCOL_FEE_LABEL,
        treasury: APP_TREASURY,
        contract: PREDICTIONS_CONTRACT,
        onChain: true,
        keeperRan,
        updatedAt: new Date().toISOString(),
      };
      responseCache = { body, at: Date.now() };
      return NextResponse.json(body);
    } catch (e) {
      console.error("[predictions on-chain read]", e);
    }
  }

  return NextResponse.json({
    markets: demoMarkets,
    prices,
    protocolFeeBps: PROTOCOL_FEE_BPS,
    protocolFeeLabel: PROTOCOL_FEE_LABEL,
    treasury: APP_TREASURY,
    contract: PREDICTIONS_CONTRACT ?? null,
    onChain,
    keeperRan,
    updatedAt: new Date().toISOString(),
  });
}
