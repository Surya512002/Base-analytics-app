import { NextResponse } from "next/server";
import { BASE_PUBLIC_RPC } from "@/lib/constants/env";
import { pingRedis } from "@/lib/redis-cache";
import { zeroXConfigured } from "@/lib/launchpad/zerox";

export const dynamic = "force-dynamic";

async function pingRpc(): Promise<{
  ok: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const url = BASE_PUBLIC_RPC;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_blockNumber",
        params: [],
      }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: `RPC HTTP ${res.status}` };
    }
    const data = (await res.json()) as { result?: string; error?: { message?: string } };
    if (data.error?.message) {
      return { ok: false, error: data.error.message };
    }
    return {
      ok: Boolean(data.result),
      latencyMs: Date.now() - start,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "RPC unreachable",
    };
  }
}

/** Deploy health — env flags plus live Redis/RPC pings. */
export async function GET() {
  const [redis, rpc] = await Promise.all([pingRedis(), pingRpc()]);

  const checks = {
    alchemy: Boolean(process.env.NEXT_PUBLIC_ALCHEMY_KEY?.trim() || process.env.ALCHEMY_API_KEY?.trim()),
    redisConfigured: Boolean(process.env.KV_REDIS_URL?.trim()),
    redis,
    rpc,
    voucherContract: Boolean(process.env.NEXT_PUBLIC_VOUCHER_CONTRACT?.trim()),
    zeroxAggregator: zeroXConfigured(),
    baseNotifications: Boolean(
      process.env.BASE_DASHBOARD_API_KEY?.trim() ||
        process.env.BASE_NOTIFICATIONS_API_KEY?.trim()
    ),
    appUrl: Boolean(
      process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim()
    ),
  };

  const ok =
    checks.alchemy &&
    checks.appUrl &&
    checks.rpc.ok &&
    (!checks.redisConfigured || checks.redis.ok);

  return NextResponse.json(
    {
      ok,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
