import type { Metadata } from "next";

const APP_URL = "https://base-analytics-app.vercel.app";
const REDEEM_OG = `${APP_URL}/redeem/opengraph-image`;

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
          splashBackgroundColor: "#040a14",
        },
      },
    }),
  },
};

export default function RedeemLayout({ children }: { children: React.ReactNode }) {
  return children;
}
