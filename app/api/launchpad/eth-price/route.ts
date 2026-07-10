import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET() {
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { next: { revalidate: 60 } }
    );
    if (!r.ok) throw new Error("price fetch failed");
    const data = (await r.json()) as { ethereum?: { usd?: number } };
    const ethUsd = data.ethereum?.usd ?? 0;
    return NextResponse.json({ ethUsd });
  } catch {
    return NextResponse.json({ ethUsd: 2500 });
  }
}
