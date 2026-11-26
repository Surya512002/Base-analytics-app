import type { Metadata } from "next";
import { getAppUrl, sectionShare } from "@/lib/constants/app-url";

const appUrl = getAppUrl();

export const metadata: Metadata = {
  title: "Explore · Base Analytics",
  description:
    "Discover B20 tokens on Base — live market data, dual-DEX trading, launches, and on-chain transparency.",
  openGraph: {
    title: "Explore B20 on Base — Base Analytics",
    description: "Live B20 tokens, in-app swaps, and launchpad on Base.",
    url: `${appUrl}/explore`,
    images: sectionShare("markets").images,
  },
  twitter: {
    card: "summary_large_image",
    images: sectionShare("markets").twitter.images,
  },
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
