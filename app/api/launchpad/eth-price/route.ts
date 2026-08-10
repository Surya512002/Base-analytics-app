import { NextResponse } from "next/server";

/** CDN-friendly — shared across visitors; reduces function invocations. */
export const revalidate = 120;

export async function GET() {
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { next: { revalidate: 120 } }
    );
    if (!r.ok) throw new Error("price fetch failed");
    const data = (await r.json()) as { ethereum?: { usd?: number } };
    const ethUsd = data.ethereum?.usd ?? 0;
    return NextResponse.json(
      { ethUsd },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=120, stale-while-revalidate=300, max-age=30",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { ethUsd: 2500 },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=60, stale-while-revalidate=120, max-age=15",
        },
      }
    );
  }
}
