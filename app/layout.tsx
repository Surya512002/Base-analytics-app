import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

const APP_URL = "https://base-analytics-app.vercel.app";

export const metadata: Metadata = {
  title: "Base Analytics — What's Your Onchain Rank?",
  description:
    "Free wallet scan on Base. Discover your rank, mint gasless badges, farm Season XP.",
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: "Base Analytics — What's Your Onchain Rank?",
    description:
      "Free scan on Base. Shrimp → Dolphin → Shark → Whale → God. Mint badges & earn XP.",
    url: APP_URL,
    siteName: "Base Analytics",
    images: [{ url: `${APP_URL}/opengraph-image`, width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Base Analytics — What's Your Onchain Rank?",
    description:
      "Free scan on Base. Shrimp → Dolphin → Shark → Whale → God. Mint badges & earn XP.",
    images: [`${APP_URL}/opengraph-image`],
  },
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: `${APP_URL}/opengraph-image`,
      button: {
        title: "Get My Score — Free",
        action: {
          type: "launch_frame",
          name: "Base Analytics",
          url: APP_URL,
          splashImageUrl: `${APP_URL}/splash.png`,
          splashBackgroundColor: "#00040d",
        },
      },
    }),
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#00040d] text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
