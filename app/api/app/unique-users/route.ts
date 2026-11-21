import { NextResponse } from "next/server";
import { limitByIp } from "@/lib/api/rate-limit";
import {
  getUserActivityStats,
  verifyAndRecordUserTransaction,
  isValidEthAddress,
  isValidTxHash,
} from "@/lib/redis-unique-users";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET() {
  const stats = await getUserActivityStats();
  return NextResponse.json(
    {
      ok: true,
      count: stats.total,
      formatted: stats.total.toLocaleString(),
      today: stats.today,
      newToday: stats.newToday,
      last7: stats.last7,
      source: stats.source,
    },
    { headers: NO_CACHE_HEADERS }
  );
}

export async function POST(req: Request) {
  if (await limitByIp(req, "unique-users", 15)) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded. Please wait a moment." },
      { status: 429, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const body = await req.json();
    const address = typeof body?.address === "string" ? body.address.trim() : "";
    const txHash = typeof body?.txHash === "string" ? body.txHash.trim() : "";

    if (!isValidEthAddress(address)) {
      return NextResponse.json(
        { ok: false, error: "A valid Ethereum wallet address is required." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const action = typeof body?.action === "string" ? body.action.trim() : "";
    if (action === "connect") {
      const { recordUniqueUser } = await import("@/lib/redis-unique-users");
      const count = await recordUniqueUser(address);
      const formatted = count.toLocaleString();
      return NextResponse.json(
        {
          ok: true,
          count,
          formatted,
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    if (!isValidTxHash(txHash)) {
      return NextResponse.json(
        { ok: false, error: "A valid confirmed Base on-chain transaction hash (txHash) is required." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const result = await verifyAndRecordUserTransaction(address, txHash);
    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.error || "Transaction verification failed." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const formatted = result.count.toLocaleString();
    return NextResponse.json(
      {
        ok: true,
        count: result.count,
        formatted,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to process transaction verification request." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
