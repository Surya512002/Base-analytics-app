import type { Metadata } from "next";
import HomeApp from "@/components/home/HomeApp";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://base-analytics.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}): Promise<Metadata> {
  const { address } = await params;
  const token = address?.trim().toLowerCase();
  if (!token?.startsWith("0x") || token.length !== 42) {
    return { title: "Token · Base Analytics" };
  }

  try {
    const origin = BASE.replace(/\/$/, "");
    const [tokenRes, marketRes] = await Promise.all([
      fetch(`${origin}/api/launchpad/tokens`, { next: { revalidate: 60 } }),
      fetch(`${origin}/api/launchpad/market`, { next: { revalidate: 60 } }),
    ]);
    const tokenData = await tokenRes.json();
    const marketData = await marketRes.json();
    const found = (tokenData.tokens ?? []).find(
      (t: { address: string }) => t.address.toLowerCase() === token
    );
    const market = marketData.markets?.[token];
    const sym = found?.symbol ?? "TOKEN";
    const name = found?.name ?? "Base Token";
    const price = market?.priceUsd
      ? `$${market.priceUsd < 0.01 ? market.priceUsd.toExponential(2) : market.priceUsd.toFixed(4)}`
      : "—";
    const mcap = market?.marketCap
      ? market.marketCap >= 1e6
        ? `$${(market.marketCap / 1e6).toFixed(2)}M`
        : `$${market.marketCap.toFixed(0)}`
      : "—";
    const chg = market?.priceChange24h ?? 0;

    const ogParams = new URLSearchParams({
      v: "token",
      sym,
      tname: name,
      tprice: price,
      tchg: String(chg),
      tmcap: mcap,
      bust: "8",
    });

    return {
      title: `$${sym} · ${name} · Base Analytics`,
      description: `Trade $${sym} in-app on Base Analytics — Uniswap + Aerodrome, USD swap quotes. ${chg >= 0 ? "+" : ""}${chg.toFixed(1)}% 24h · MCap ${mcap}`,
      openGraph: {
        title: `$${sym} on Base`,
        description: `${name} · ${price} · Swap in-app via Uniswap & Aerodrome on Base Analytics`,
        images: [{ url: `${origin}/api/og?${ogParams}` }],
      },
      twitter: {
        card: "summary_large_image",
        title: `$${sym} on Base`,
        description: `Trade $${sym} in-app — Uniswap + Aerodrome · USD quotes · B20 launchpad`,
        images: [`${origin}/api/og?${ogParams}`],
      },
    };
  } catch {
    return { title: "Token · Base Analytics" };
  }
}

export default async function ExploreTokenPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const token = address?.trim().toLowerCase();
  const valid =
    token?.startsWith("0x") && token.length === 42 ? token : null;
  return <HomeApp forceTab="launchpad" initialToken={valid} />;
}
