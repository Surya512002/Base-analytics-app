import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

const APP_URL = "https://base-analytics-app.vercel.app";
const OG_IMAGE = `${APP_URL}/opengraph-image?v=4`;

export const metadata: Metadata = {
  title: "Base Analytics — Base Voucher & x402 on Base",
  description:
    "Create & redeem crypto gift cards (Base Voucher). x402 pay-per-use micropayments + free onchain wallet analytics.",
  metadataBase: new URL(APP_URL),
  manifest: "/manifest.json",
  applicationName: "Base Analytics",
  openGraph: {
    title: "Base Analytics — Base Voucher & x402 on Base",
    description:
      "Crypto gift cards as the main product. x402 HTTP 402 payments + wallet analytics — all on Base.",
    url: APP_URL,
    siteName: "Base Analytics",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Base Analytics homepage preview" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Base Analytics — Base Voucher & x402 on Base",
    description:
      "Base Voucher gift cards + x402 micropayments on Base. Create, redeem & share ETH/USDC vouchers.",
    images: [OG_IMAGE],
  },
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: OG_IMAGE,
      button: {
        title: "Open App — Free",
        action: {
          type: "launch_frame",
          name: "Base Analytics",
          url: APP_URL,
          splashImageUrl: `${APP_URL}/splash.png`,
          splashBackgroundColor: "#0052FF",
        },
      },
    }),
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#071220] text-slate-200 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
