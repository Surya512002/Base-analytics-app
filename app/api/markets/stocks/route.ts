import { NextResponse } from "next/server";
import { fetchStockMarkets } from "@/lib/markets/markets-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";
    const query = searchParams.get("query")?.trim().toLowerCase();
    const category = searchParams.get("category")?.trim().toLowerCase();
    const sortBy = searchParams.get("sort") || "liquidity";
    const sortDir = searchParams.get("dir") || "desc";

    let stocks = await fetchStockMarkets(forceRefresh);

    if (query) {
      stocks = stocks.filter(
        (s) =>
          s.symbol.toLowerCase().includes(query) ||
          s.underlyingTicker.toLowerCase().includes(query) ||
          s.name.toLowerCase().includes(query) ||
          s.address.toLowerCase() === query
      );
    }

    if (category && category !== "all") {
      stocks = stocks.filter((s) => s.category.toLowerCase() === category);
    }

    // Sort
    stocks.sort((a, b) => {
      let valA: number = 0;
      let valB: number = 0;

      if (sortBy === "price") {
        valA = a.price;
        valB = b.price;
      } else if (sortBy === "change" || sortBy === "change24h") {
        valA = a.change24h;
        valB = b.change24h;
      } else if (sortBy === "liquidity") {
        valA = a.tradingLiquidity;
        valB = b.tradingLiquidity;
      } else if (sortBy === "impact" || sortBy === "priceImpact") {
        valA = a.priceImpact10k ?? 999;
        valB = b.priceImpact10k ?? 999;
      } else if (sortBy === "collateral") {
        valA = a.usedAsCollateral ?? 0;
        valB = b.usedAsCollateral ?? 0;
      } else {
        valA = a.tradingLiquidity;
        valB = b.tradingLiquidity;
      }

      return sortDir === "asc" ? valA - valB : valB - valA;
    });

    return NextResponse.json(
      {
        ok: true,
        data: stocks,
        total: stocks.length,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("[/api/markets/stocks] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load stock markets",
        data: [],
      },
      { status: 500 }
    );
  }
}
