import { NextResponse } from "next/server";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export type RecentTrade = {
  t: number;
  side: "buy" | "sell";
  priceUsd: number;
  amount: number;
  volumeUsd: number;
  tx: string;
};

type GeckoTrade = {
  attributes?: {
    block_timestamp?: string;
    tx_hash?: string;
    from_token_amount?: string;
    to_token_amount?: string;
    price_from_in_usd?: string;
    price_to_in_usd?: string;
    volume_in_usd?: string;
    from_token_address?: string;
    to_token_address?: string;
  };
};

export async function GET(request: Request) {
  const rl = await checkRateLimitAsync(`trade-trades:${getClientIp(request)}`, 60, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const { searchParams } = new URL(request.url);
  const pool = (searchParams.get("pool") ?? "").trim();
  const token = (searchParams.get("token") ?? "").trim().toLowerCase();
  if (!ADDRESS_RE.test(pool) || !ADDRESS_RE.test(token)) {
    return NextResponse.json({ ok: false, trades: [] }, { status: 400 });
  }

  try {
    const r = await fetch(`https://api.geckoterminal.com/api/v2/networks/base/pools/${pool}/trades`, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (!r.ok) return NextResponse.json({ ok: true, trades: [] });
    const body = (await r.json()) as { data?: GeckoTrade[] };
    const trades: RecentTrade[] = [];
    for (const row of body.data ?? []) {
      const a = row.attributes;
      if (!a?.block_timestamp) continue;
      const bought = (a.to_token_address ?? "").toLowerCase() === token;
      const sold = (a.from_token_address ?? "").toLowerCase() === token;
      if (!bought && !sold) continue;
      const priceUsd = Number(bought ? a.price_to_in_usd : a.price_from_in_usd);
      const amount = Number(bought ? a.to_token_amount : a.from_token_amount);
      const volumeUsd = Number(a.volume_in_usd);
      if (![priceUsd, amount, volumeUsd].every(Number.isFinite)) continue;
      trades.push({
        t: Math.floor(new Date(a.block_timestamp).getTime() / 1000),
        side: bought ? "buy" : "sell",
        priceUsd,
        amount,
        volumeUsd,
        tx: a.tx_hash ?? "",
      });
    }
    return NextResponse.json(
      { ok: true, trades: trades.slice(0, 40) },
      { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15" } }
    );
  } catch (e) {
    console.error("[/api/trade/trades]", e);
    return NextResponse.json({ ok: false, trades: [] }, { status: 502 });
  }
}
