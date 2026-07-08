import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

const APP_URL = "https://base-analytics-app.vercel.app";
const OG_IMAGE = `${APP_URL}/opengraph-image?v=5`;

export const metadata: Metadata = {
  title: "Base Analytics — Crypto Prediction Market on Base",
  description:
    "Trade BTC, ETH & SOL prediction markets on Base. 4h & daily rounds with live YES/NO odds, quests & wallet analytics.",
  metadataBase: new URL(APP_URL),
  manifest: "/manifest.json",
  applicationName: "Base Analytics",
  openGraph: {
    title: "Base Analytics — Crypto Prediction Market on Base",
    description:
      "Polymarket-style crypto predictions on Base. Hourly, 4h & daily rounds for BTC, ETH, SOL with CPMM pricing.",
    url: APP_URL,
    siteName: "Base Analytics",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Base Analytics prediction market" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Base Analytics — Crypto Prediction Market on Base",
    description:
      "Trade BTC/ETH/SOL predictions on Base. Earn XP, climb the leaderboard, win USDC on resolve.",
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
          splashBackgroundColor: "#020508",
        },
      },
    }),
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#020508] text-slate-200 antialiased theme-terminal">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
