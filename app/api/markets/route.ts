import { NextResponse } from "next/server";
import { runMarketDiscovery } from "@/lib/lending/discovery/engine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";
    const chainIdParam = searchParams.get("chainId");
    const chainId = chainIdParam ? parseInt(chainIdParam, 10) : 8453;

    const result = await runMarketDiscovery(chainId, forceRefresh);

    return NextResponse.json(
      {
        ok: true,
        markets: result.markets,
        protocolStatus: result.protocolStatus,
        lastUpdated: result.lastUpdated,
        cached: result.cached,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("[/api/markets] Discovery error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to run market discovery",
        markets: [],
        protocolStatus: {},
        lastUpdated: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
