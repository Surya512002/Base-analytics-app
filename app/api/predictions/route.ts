import { NextResponse } from "next/server";
import { buildAllMarkets } from "@/lib/predictions/market-engine";
import { mergeMarketWithChain, runPredictionKeeper } from "@/lib/predictions/keeper";
import {
  fetchOnChainMarkets,
  getPredictionsPublicClient,
  matchOnChainMarket,
} from "@/lib/predictions/onchain";
import { MARKET_TRACKS, PROTOCOL_FEE_BPS, PROTOCOL_FEE_LABEL } from "@/lib/constants/predictions";
import { APP_TREASURY } from "@/lib/constants/treasury";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PREDICTIONS_CONTRACT = process.env.NEXT_PUBLIC_PREDICTIONS_CONTRACT as
  | `0x${string}`
  | undefined;
const BASE_RPC =
  process.env.BASE_RPC_URL ||
  (process.env.NEXT_PUBLIC_ALCHEMY_KEY
    ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`
    : "");
const KEEPER_KEY = process.env.PREDICTIONS_KEEPER_PRIVATE_KEY as
  | `0x${string}`
  | undefined;

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
  if (!PREDICTIONS_CONTRACT || !BASE_RPC || !KEEPER_KEY) return;
  try {
    await runPredictionKeeper({
      rpcUrl: BASE_RPC,
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
  const prices = await fetchSpotPrices();
  const now = Date.now();
  const demoMarkets = buildAllMarkets(prices, now);

  let onChain = false;
  let keeperRan = false;

  if (PREDICTIONS_CONTRACT && BASE_RPC) {
    await maybeRunKeeper();
    keeperRan = Boolean(KEEPER_KEY);

    try {
      const client = getPredictionsPublicClient(BASE_RPC);
      const chainMarkets = await fetchOnChainMarkets(client, PREDICTIONS_CONTRACT);
      const markets = demoMarkets.map((demo) => {
        const track = MARKET_TRACKS.find((t) => t.id === demo.trackId);
        if (!track) return demo;
        const chain = matchOnChainMarket(chainMarkets, track, now);
        return mergeMarketWithChain(demo, chain);
      });
      onChain = true;
      return NextResponse.json({
        markets,
        prices,
        protocolFeeBps: PROTOCOL_FEE_BPS,
        protocolFeeLabel: PROTOCOL_FEE_LABEL,
        treasury: APP_TREASURY,
        contract: PREDICTIONS_CONTRACT,
        onChain: true,
        keeperRan,
        updatedAt: new Date().toISOString(),
      });
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
