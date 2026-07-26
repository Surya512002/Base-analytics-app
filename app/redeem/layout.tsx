import type { Metadata } from "next";
import { getAppUrl } from "@/lib/constants/app-url";
import { OG_VERSION } from "@/lib/og/brand-kit";

const APP_URL = getAppUrl();
const REDEEM_OG = `${APP_URL}/redeem/opengraph-image?ogv=${OG_VERSION}`;

export const metadata: Metadata = {
  title: "Redeem Base Voucher — Crypto Gift Card on Base",
  description:
    "Redeem your Base Voucher gift card. Enter Card ID + secret, connect wallet, claim ETH or USDC on Base.",
  openGraph: {
    title: "Redeem Base Voucher — Crypto Gift Card",
    description: "Claim your onchain ETH/USDC gift card on Base. Fully decentralized.",
    url: `${APP_URL}/redeem`,
    images: [{ url: REDEEM_OG, width: 1200, height: 630, alt: "Redeem Base Voucher" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Redeem Base Voucher on Base",
    description: "Claim ETH or USDC from your crypto gift card — onchain on Base.",
    images: [REDEEM_OG],
  },
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: REDEEM_OG,
      button: {
        title: "Redeem Gift Card",
        action: {
          type: "launch_frame",
          name: "Redeem Base Voucher",
          url: `${APP_URL}/redeem`,
          splashImageUrl: `${APP_URL}/splash.png`,
          splashBackgroundColor: "#0a0a0b",
        },
      },
    }),
  },
};

export default function RedeemLayout({ children }: { children: React.ReactNode }) {
  return children;
}
