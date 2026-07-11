import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { getAppUrl, appOgImage } from "@/lib/constants/app-url";

const APP_URL = getAppUrl();
const OG_IMAGE = appOgImage();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Base Analytics — Launch Tokens. Trade on Base.",
  description:
    "Discover liquid assets, route smart swaps across Base, launch B20 tokens, and analyze your onchain activity.",
  metadataBase: new URL(APP_URL),
  manifest: "/manifest.json",
  applicationName: "Base Analytics",
  openGraph: {
    title: "Base Analytics — Launch Tokens. Trade on Base.",
    description:
      "The Base trading terminal: B20 launchpad, smart multi-DEX swaps, wallet analytics, quests and vouchers.",
    url: APP_URL,
    siteName: "Base Analytics",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Base Analytics — Launch tokens and trade on Base" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Base Analytics — Launch Tokens. Trade on Base.",
    description:
      "Discover assets, route swaps across Uniswap, Aerodrome, Slipstream and 0x, launch B20, and analyze your wallet.",
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
