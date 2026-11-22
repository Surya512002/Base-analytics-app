import { NextResponse } from "next/server";
import { limitByIp } from "@/lib/api/rate-limit";
import { requireSiweSession } from "@/lib/auth/siwe-session";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
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

/** True when the address has sent a transaction or is a deployed contract wallet on Base. */
async function hasBaseActivity(address: string): Promise<boolean> {
  try {
    const client = createBasePublicClient();
    const a = address as `0x${string}`;
    if ((await client.getTransactionCount({ address: a })) > 0) return true;
    const code = await client.getCode({ address: a });
    return Boolean(code && code !== "0x");
  } catch {
    return false;
  }
}

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
      // A signed-in wallet always counts. Most visitors connect without signing, so an unsigned
      // address counts too, but only if it has real activity on Base: made-up addresses don't.
      // shortcut: an attacker with real chain addresses can still add them; a signature is the only full proof.
      const session = await requireSiweSession(address.toLowerCase());
      if (!session.ok && !(await hasBaseActivity(address))) {
        return NextResponse.json(
          { ok: false, error: "Wallet has no activity on Base yet" },
          { status: 403, headers: NO_CACHE_HEADERS }
        );
      }
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
