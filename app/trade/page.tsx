import type { Metadata } from "next";
import { getAppUrl, appOgImage } from "@/lib/constants/app-url";
import HomeApp from "@/components/home/HomeApp";

const appUrl = getAppUrl();

export const metadata: Metadata = {
  title: "Trade on Base — Live Charts, Limit & Stop-Loss Orders",
  description:
    "Pro trading terminal on Base: live candlestick charts for coins and tokenized stocks, market swaps, limit orders, stop-loss, trailing stop and bracket orders.",
  openGraph: {
    title: "Trade · Base Analytics",
    description: "Charts, limit orders, stop-loss and swaps for coins and tokenized stocks on Base.",
    url: `${appUrl}/trade`,
    images: [{ url: appOgImage(), width: 1200, height: 630 }],
  },
  alternates: { canonical: `${appUrl}/trade` },
};

export default function TradePage() {
  return <HomeApp forceTab="trade" />;
}
