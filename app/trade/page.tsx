import type { Metadata } from "next";
import { getAppUrl, sectionShare } from "@/lib/constants/app-url";
import HomeApp from "@/components/home/HomeApp";

const appUrl = getAppUrl();

export const metadata: Metadata = {
  title: "Trade on Base — Live Charts, Limit & Stop-Loss Orders",
  description:
    "Pro trading terminal on Base: live candlestick charts for coins and tokenized stocks, market swaps, limit orders, stop-loss, trailing stop and bracket orders.",
  twitter: sectionShare("trade").twitter,
  openGraph: {
    title: "Trade · Base Analytics",
    description: "Charts, limit orders, stop-loss and swaps for coins and tokenized stocks on Base.",
    url: `${appUrl}/trade`,
    images: sectionShare("trade").images,
  },
  alternates: { canonical: `${appUrl}/trade` },
};

export default function TradePage() {
  return <HomeApp forceTab="trade" />;
}
