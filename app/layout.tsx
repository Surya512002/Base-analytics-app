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
  title: "Base Analytics — B20 Launchpad & In-App Swaps on Base",
  description:
    "Explore B20 tokens, swap via Uniswap & Aerodrome in-app with USD quotes, launch vanity tokens, and scan your wallet — quests, badges & vouchers on Base.",
  metadataBase: new URL(APP_URL),
  manifest: "/manifest.json",
  applicationName: "Base Analytics",
  openGraph: {
    title: "Base Analytics — Explore · Trade · Earn on Base",
    description:
      "B20 launchpad + in-app DEX swaps. Browse liquid tokens, trade without leaving the app, earn quest XP.",
    url: APP_URL,
    siteName: "Base Analytics",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Base Analytics — B20 launchpad & swaps" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Base Analytics — B20 Launchpad on Base",
    description:
      "Explore tokens, swap Uniswap/Aerodrome in-app, launch B20, earn XP. Wallet analytics & Basename identity.",
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
