import { NextResponse } from "next/server";
import { analyzeWalletAddress } from "@/lib/analyze-wallet";
import type { AlchemyTransfer } from "@/lib/types/wallet";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: {
    address?: string;
    transfers?: AlchemyTransfer[];
    historyComplete?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const address = body.address?.trim().toLowerCase();
  const transfers = body.transfers;

  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  if (!Array.isArray(transfers) || transfers.length === 0) {
    return NextResponse.json({ error: "Missing transfers" }, { status: 400 });
  }

  try {
    const result = await analyzeWalletAddress(address, { transfers });
    if (!result) {
      return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
    }
    return NextResponse.json({
      ...result,
      historyComplete: body.historyComplete === true,
    });
  } catch (err) {
    console.error("[analyze-from-transfers]", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
