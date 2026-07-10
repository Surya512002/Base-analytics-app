import type { Metadata } from "next";
import { getAppUrl, appOgImage } from "@/lib/constants/app-url";

const appUrl = getAppUrl();

export const metadata: Metadata = {
  title: "Explore · Base Analytics",
  description:
    "Discover B20 tokens on Base — live market data, dual-DEX trading, launches, and on-chain transparency.",
  openGraph: {
    title: "Explore B20 on Base — Base Analytics",
    description: "Live B20 tokens, in-app swaps, and launchpad on Base.",
    url: `${appUrl}/explore`,
    images: [{ url: appOgImage(), width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: [appOgImage()],
  },
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
