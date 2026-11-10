import { NextResponse } from "next/server";
import { fetchMarketsOverview } from "@/lib/markets/markets-service";
import { MarketsOverviewSchema } from "@/lib/markets/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    const overview = await fetchMarketsOverview(forceRefresh);
    const validated = MarketsOverviewSchema.safeParse(overview);

    if (!validated.success) {
      console.warn("[/api/markets/overview] Validation warning:", validated.error.issues);
    }

    return NextResponse.json(
      {
        ok: true,
        data: overview,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("[/api/markets/overview] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load markets overview",
      },
      { status: 500 }
    );
  }
}
