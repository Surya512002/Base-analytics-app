import { NextResponse } from "next/server";
import {
  getUniqueUserCount,
  getFormattedUniqueUserCount,
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

// Simple rate limiter: max 15 POST requests per IP per minute
const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= 15) {
    return true;
  }
  entry.count++;
  return false;
}

export async function GET() {
  const count = await getUniqueUserCount();
  const formatted = await getFormattedUniqueUserCount();
  return NextResponse.json(
    {
      ok: true,
      count,
      formatted,
    },
    { headers: NO_CACHE_HEADERS }
  );
}

export async function POST(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() || "unknown" : "127.0.0.1";

  if (isRateLimited(ip)) {
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
