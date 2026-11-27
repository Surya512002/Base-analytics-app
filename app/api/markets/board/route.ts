import { NextResponse, after } from "next/server";
import { limitByIp } from "@/lib/api/rate-limit";
import { fetchAllCoinbaseTokenizedStocks } from "@/lib/stocks/coinbase-api";
import { getDiscovery } from "@/lib/launchpad/discovery";
import { listLaunchedTokens } from "@/lib/launchpad/token-store";
import { fetchMarketSummaries, type TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { MarketItem, MarketKind } from "@/lib/markets/board";
import { borrowedNameFilter } from "@/lib/markets/known-names";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Finding other tokens can take a while on a cold start; stocks should not wait for it. */
const DISCOVERY_WAIT_MS = 2_500;

function tokenItem(kind: MarketKind, t: LaunchedToken, m?: TokenMarketSummary | null): MarketItem {
  const live = m?.hasPool && m.priceUsd ? m : null;
  return {
    kind,
    address: t.address,
    symbol: t.symbol,
    name: t.name,
    decimals: t.decimals,
    // No pool means no price: the screen shows a dash.
    priceUsd: live?.priceUsd ?? null,
    change24h: live?.priceChange24h ?? null,
    volume24h: live?.volume24h ?? null,
    liquidityUsd: live?.liquidityUsd ?? null,
    iconUrl: t.imageUrl || undefined,
    createdAt: t.createdAt || undefined,
  };
}

/** Stocks, other Base tokens and tokens launched here, for Markets and the Home highlights. */
export async function GET(req: Request) {
  const limited = await limitByIp(req, "markets-board", 60);
  if (limited) return limited;

  // Each source can fail on its own; the others are still shown.
  const safe = <T,>(p: Promise<T>, fallback: T) =>
    p.catch((e) => {
      console.error("[markets/board]", e);
      return fallback;
    });
  const discovery = safe(getDiscovery(), null);
  // Let a slow lookup finish after the reply, so the next request finds it cached.
  after(() => discovery);
  const [stocks, found, registry] = await Promise.all([
    safe(fetchAllCoinbaseTokenizedStocks({}), []),
    Promise.race([discovery, new Promise<null>((resolve) => setTimeout(resolve, DISCOVERY_WAIT_MS, null))]),
    safe(listLaunchedTokens(), []),
  ]);
  // The same tokens the Launch screen counts as launched here.
  const launched = registry.filter((t) => t.source !== "external");
  const launchedMarkets = launched.length ? await safe(fetchMarketSummaries(launched.map((t) => t.address)), {}) : {};

  const items = new Map<string, MarketItem>();
  const add = borrowedNameFilter(stocks.map((s) => s.symbol), (x) => {
    const key = x.address.toLowerCase();
    if (!items.has(key)) items.set(key, x);
  });
  for (const t of launched) add(tokenItem("launched", t, (launchedMarkets as Record<string, TokenMarketSummary>)[t.address.toLowerCase()]));
  for (const s of stocks) {
    if (!s.nav || s.nav <= 0) continue;
    add({
      kind: "stock",
      address: s.address,
      symbol: s.symbol,
      name: s.name,
      decimals: s.decimals,
      priceUsd: s.nav,
      // The feed sends 0 when it has no change figure.
      change24h: s.change24h || null,
      volume24h: s.volume24hUsd ?? null,
      liquidityUsd: null,
      iconUrl: s.iconUrl,
    });
  }
  const markets = (found?.markets ?? {}) as Record<string, TokenMarketSummary>;
  for (const t of (found?.tokens ?? []) as LaunchedToken[]) {
    const item = tokenItem("token", t, markets[t.address.toLowerCase()]);
    if (item.priceUsd !== null) add(item);
  }

  if (items.size === 0) return NextResponse.json({ error: "Markets are unavailable" }, { status: 502 });
  return NextResponse.json(
    { items: [...items.values()], updatedAt: Date.now() },
    // A reply still missing the other tokens is only cached briefly.
    { headers: { "Cache-Control": found ? "public, s-maxage=30, stale-while-revalidate=120" : "public, s-maxage=5" } }
  );
}
