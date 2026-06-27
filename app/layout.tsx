import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

const APP_URL = "https://base-analytics-app.vercel.app";

export const metadata: Metadata = {
  title: "Base Analytics - What's Your Onchain Rank?",
  description:
    "Free wallet scan on Base. Discover your rank, mint gasless badges, farm Season XP.",
  metadataBase: new URL(APP_URL),
  manifest: "/manifest.json",
  applicationName: "Base Analytics",
  openGraph: {
    title: "Base Analytics - What's Your Onchain Rank?",
    description:
      "Free scan on Base. Shrimp → Dolphin → Shark → Whale → God. Mint badges & earn XP.",
    url: APP_URL,
    siteName: "Base Analytics",
    images: [{ url: `${APP_URL}/opengraph-image`, width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Base Analytics - What's Your Onchain Rank?",
    description:
      "Free scan on Base. Shrimp → Dolphin → Shark → Whale → God. Mint badges & earn XP.",
    images: [`${APP_URL}/opengraph-image`],
  },
  // Tab + home-screen icons: app/icon.tsx + app/apple-icon.tsx (Next.js file convention)
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: `${APP_URL}/opengraph-image`,
      button: {
        title: "Get My Score - Free",
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
