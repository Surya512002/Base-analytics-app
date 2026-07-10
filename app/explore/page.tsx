import type { Metadata } from "next";
import { getAppUrl, appOgImage } from "@/lib/constants/app-url";
import { listLaunchedTokens } from "@/lib/launchpad/token-store";
import { fetchMarketSummaries } from "@/lib/launchpad/dexscreener";
import { isB20ExploreToken } from "@/lib/launchpad/token-meta";
import { isTradableListing } from "@/lib/launchpad/tradable";
import HomeApp from "@/components/home/HomeApp";

const appUrl = getAppUrl();

export const metadata: Metadata = {
  title: "Explore B20 Tokens on Base — Live Markets & In-App Swaps",
  description:
    "Discover B20 vanity tokens on Base Analytics. Live liquidity, trending rails, Uniswap & Aerodrome swaps with USD quotes — launch or trade without leaving the app.",
  openGraph: {
    title: "Explore · Base Analytics Launchpad",
    description: "B20 tokens, live DEX data, in-app trading on Base.",
    url: `${appUrl}/explore`,
    images: [{ url: appOgImage(), width: 1200, height: 630 }],
  },
  alternates: { canonical: `${appUrl}/explore` },
};

export default async function ExplorePage() {
  let featured: { name: string; symbol: string; address: string }[] = [];
  try {
    const tokens = await listLaunchedTokens();
    const b20 = tokens.filter(isB20ExploreToken);
    const markets = await fetchMarketSummaries(b20.map((t) => t.address));
    featured = b20
      .filter((t) => isTradableListing(t, markets))
      .sort(
        (a, b) =>
          (markets[b.address.toLowerCase()]?.volume24h ?? 0) -
          (markets[a.address.toLowerCase()]?.volume24h ?? 0)
      )
      .slice(0, 8)
      .map((t) => ({
        name: t.name,
        symbol: t.symbol,
        address: t.address,
      }));
  } catch {
    /* SSR optional */
  }

  return (
    <>
      <div className="sr-only" aria-hidden={false}>
        <h1>Explore B20 tokens on Base — Base Analytics launchpad</h1>
        <p>
          Trade trending tokens with in-app Uniswap and Aerodrome routing. Launch vanity B20
          addresses, track live volume, and swap with USD quotes.
        </p>
        {featured.length > 0 && (
          <ul>
            {featured.map((t) => (
              <li key={t.address}>
                <a href={`${appUrl}/explore/token/${t.address}`}>
                  {t.name} (${t.symbol})
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <HomeApp forceTab="launchpad" />
    </>
  );
}
