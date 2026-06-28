import { NextResponse } from "next/server";
import { fetchWalletTransfersMerged } from "@/lib/api/fetch-wallet-transfers";
import { cacheGet, cacheSet } from "@/lib/redis-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const CACHE_TTL = 600;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.trim().toLowerCase();
  const refresh = searchParams.get("refresh") === "1";

  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const cacheKey = `wallet-txs:v3:${address}`;

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
    const { transfers, sources } = await fetchWalletTransfersMerged(
      address,
      basescanKey
    );
    const payload = { transfers, sources, cached: false };
    await cacheSet(cacheKey, { transfers, sources }, CACHE_TTL);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[wallet-txs]", err);
    return NextResponse.json({ transfers: [], sources: {} });
  }
}
