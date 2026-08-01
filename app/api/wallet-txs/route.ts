import { NextResponse } from "next/server";
import { fetchWalletTransfersMerged } from "@/lib/api/fetch-wallet-transfers";
import { cacheGet, cacheSet } from "@/lib/redis-cache";
import { requireAnalyticsUnlock } from "@/lib/utils/require-analytics-unlock";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const CACHE_TTL = 600;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.trim().toLowerCase();
  const refresh = searchParams.get("refresh") === "1";
  const depthParam = searchParams.get("depth");
  const depth =
    depthParam === "complete" ? "complete" : ("connect" as const);
  const skipV2 = searchParams.get("skipV2") === "1";

  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const locked = await requireAnalyticsUnlock(req, address);
  if (locked) return locked;

  const cacheKey = `wallet-txs:v9:${address}`;

  if (!refresh) {
    const cached = await cacheGet<{
      transfers: unknown[];
      sources: Record<string, number>;
    }>(cacheKey);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }
  }

  const basescanKey =
    process.env.BASESCAN_API_KEY ||
    process.env.NEXT_PUBLIC_BASESCAN_API_KEY ||
    "";

  try {
    const { transfers, sources, historyComplete, v2StreamStates } =
      await fetchWalletTransfersMerged(address, {
        depth,
        skipV2,
        basescanKey,
      });
    const payload = {
      transfers,
      sources,
      historyComplete,
      v2StreamStates,
      cached: false,
    };
    await cacheSet(
      cacheKey,
      { transfers, sources, historyComplete, v2StreamStates },
      CACHE_TTL
    );
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[wallet-txs]", err);
    return NextResponse.json({ transfers: [], sources: {} });
  }
}
