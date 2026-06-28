import { NextResponse } from "next/server";
import { analyzeWalletAddress } from "@/lib/analyze-wallet";
import type { FetchMode } from "@/lib/api/fetch-limits";
import { cacheGet, cacheSet } from "@/lib/redis-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const CACHE_TTL: Record<FetchMode, number> = {
  fast: 300,
  full: 900,
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.trim().toLowerCase();
  const refresh = searchParams.get("refresh") === "1";
  const mode = (searchParams.get("mode") === "fast" ? "fast" : "full") as FetchMode;

  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const cacheKey = `analyze-wallet:${mode}:${address}`;

  if (!refresh) {
    const cached = await cacheGet<
      Awaited<ReturnType<typeof analyzeWalletAddress>>
    >(cacheKey);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true, mode });
    }
  }

  try {
    const result = await analyzeWalletAddress(address, undefined, { mode });
    if (!result) {
      return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
    }

    await cacheSet(cacheKey, result, CACHE_TTL[mode]);
    return NextResponse.json({ ...result, cached: false, mode });
  } catch (err) {
    console.error("[analyze-wallet]", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
