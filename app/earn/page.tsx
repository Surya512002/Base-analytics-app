import type { Metadata } from "next";
import { getAppUrl, appOgImage } from "@/lib/constants/app-url";
import HomeApp from "@/components/home/HomeApp";

const appUrl = getAppUrl();

export const metadata: Metadata = {
  title: "Earn & Stake on Base Network — Stocks, Gauges & Morpho Vaults",
  description:
    "Earn yield by staking tokenized equities, lending to Morpho Blue vaults, and supplying liquidity to Aerodrome gauges on Base network.",
  openGraph: {
    title: "Earn & Stake on Base · Base Analytics",
    description: "High-yield staking, tokenized stock yields, and Morpho vaults on Base.",
    url: `${appUrl}/earn`,
    images: [{ url: appOgImage(), width: 1200, height: 630 }],
  },
  alternates: { canonical: `${appUrl}/earn` },
};

export default function EarnPage() {
  return <HomeApp forceTab="lend" />;
}
