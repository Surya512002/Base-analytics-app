import { NextResponse } from "next/server";
import { fetchUserOperationActivity } from "@/lib/api/user-operations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.trim().toLowerCase();
  const full = searchParams.get("full") === "1";

  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    const transfers = await fetchUserOperationActivity(address, {
      timeoutMs: full ? 55_000 : 12_000,
      maxChunks: full ? 40 : 8,
    });
    return NextResponse.json({ transfers, count: transfers.length });
  } catch (err) {
    console.error("[wallet-user-ops]", err);
    return NextResponse.json({ transfers: [], count: 0 });
  }
}
