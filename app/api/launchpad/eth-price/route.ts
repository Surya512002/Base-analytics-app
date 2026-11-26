import { NextResponse } from "next/server";
import { fetchEthUsd } from "@/lib/prices/eth-usd";

export const dynamic = "force-dynamic";

/** ethUsd is 0 when no live source answers. */
export async function GET() {
  return NextResponse.json({ ethUsd: await fetchEthUsd() });
}
