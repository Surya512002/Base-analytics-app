import { NextResponse } from "next/server";
import { fetchAllCoinbaseTokenizedStocks } from "@/lib/stocks/coinbase-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const query = searchParams.get("query")?.trim().toLowerCase();
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const pageToken = searchParams.get("page_token") || searchParams.get("cursor");
    const sortBy = searchParams.get("sort") || "volume";
    const refresh = searchParams.get("refresh") === "1";

    let stocks = await fetchAllCoinbaseTokenizedStocks({
      forceRefresh: refresh,
      pageToken,
    });

    if (category && category !== "all") {
      stocks = stocks.filter((s) => s.category === category);
    }

    if (query) {
      stocks = stocks.filter(
        (s) =>
          s.symbol.toLowerCase().includes(query) ||
          s.name.toLowerCase().includes(query) ||
          s.underlyingTicker.toLowerCase().includes(query) ||
          s.address.toLowerCase() === query
      );
    }

    // Sort order
    if (sortBy === "volume") {
      stocks.sort((a, b) => b.volume24hUsd - a.volume24hUsd);
    } else if (sortBy === "gainers") {
      stocks.sort((a, b) => b.change24h - a.change24h);
    } else if (sortBy === "mcap") {
      stocks.sort((a, b) => b.mcapUsd - a.mcapUsd);
    } else if (sortBy === "nav") {
      stocks.sort((a, b) => b.nav - a.nav);
    }

    const total = stocks.length;
    const offset = pageToken && !isNaN(Number(pageToken)) ? parseInt(pageToken, 10) : 0;
    const paginated = stocks.slice(offset, offset + limit);
    const nextPageToken = offset + limit < total ? String(offset + limit) : null;

    const country =
      request.headers.get("x-user-country") ||
      request.headers.get("x-vercel-ip-country") ||
      request.headers.get("cf-ipcountry") ||
      request.headers.get("x-mock-country") ||
      process.env.COMPLIANCE_MOCK_COUNTRY ||
      null;

    const { evaluateRegionCompliance, getComplianceConfig } = await import("@/src/config/compliance");
    const compliance = evaluateRegionCompliance(country);

    return NextResponse.json(
      {
        stocks: paginated,
        total,
        page_token: pageToken,
        next_page_token: nextPageToken,
        has_more: nextPageToken !== null,
        timestamp: Date.now(),
        compliance: {
          isRestricted: compliance.isRestricted,
          mode: compliance.mode,
          canEnter: compliance.canEnter,
          canExit: compliance.canExit,
          country: country === "UNKNOWN" ? null : country,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch tokenized stocks";
    return NextResponse.json({ error: msg, stocks: [] }, { status: 500 });
  }
}
