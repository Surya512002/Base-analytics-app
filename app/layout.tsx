import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { getAppUrl, appOgImage } from "@/lib/constants/app-url";

const figtree = localFont({
  src: "../public/fonts/figtree-latin.woff2",
  variable: "--font-figtree",
  display: "swap",
  weight: "300 900",
});

const syne = localFont({
  src: "../public/fonts/syne-latin.woff2",
  variable: "--font-syne",
  display: "swap",
  weight: "400 800",
});

const APP_URL = getAppUrl();
const OG_IMAGE = appOgImage();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Base Analytics — 260+ Tokenized Stocks, Beefy Yields & B20 Launchpad on Base",
  description:
    "The onchain equities & yield terminal on Base: trade 260+ tokenized US stocks ($NVDA, $AAPL, $TSLA), earn auto-compounding yields up to 1,070% APY on Beefy & Aerodrome, launch vanity B20 tokens with 50% creator fee share, and route multi-DEX swaps.",
  metadataBase: new URL(APP_URL),
  manifest: "/manifest.json",
  applicationName: "Base Analytics",
  openGraph: {
    title: "Base Analytics — 260+ Tokenized Stocks, Beefy Yields & B20 Launchpad on Base",
    description:
      "Trade 260+ tokenized US equities ($NVDA, $AAPL, $TSLA) with 24/5 liquidity, auto-compounding stock vaults on Beefy & Aerodrome up to 1,070% APY, vanity B20 token launches with 50% creator fees, and smart multi-DEX swaps on Base.",
    url: APP_URL,
    siteName: "Base Analytics",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Base Analytics — 260+ Tokenized Stocks, Beefy Yields & B20 Launchpad on Base",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Base Analytics — 260+ Tokenized Stocks, Beefy Yields & B20 Launchpad on Base",
    description:
      "Trade 260+ tokenized stocks, earn up to 1,070% APY on Beefy & Aerodrome vaults, launch B20 vanity tokens with 50% creator fees, and route multi-DEX swaps on Base.",
    images: [OG_IMAGE],
  },
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: OG_IMAGE,
      button: {
        title: "Launch Base Analytics",
        action: {
          type: "launch_frame",
          name: "Base Analytics",
          url: APP_URL,
          splashImageUrl: `${APP_URL}/splash.png`,
          splashBackgroundColor: "#030712",
        },
      },
    }),
    "fc:frame:image": OG_IMAGE,
    "twitter:image": OG_IMAGE,
    "twitter:image:alt": "Base Analytics — 260+ Tokenized Stocks, Beefy Yields & B20 Launchpad on Base",
    "og:image": OG_IMAGE,
    "og:image:secure_url": OG_IMAGE,
    "og:image:width": "1200",
    "og:image:height": "630",
    "og:image:alt": "Base Analytics — 260+ Tokenized Stocks, Beefy Yields & B20 Launchpad on Base",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${syne.variable}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://auth.farcaster.xyz" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");var isDark=t!=="light";if(isDark){document.documentElement.classList.add("dark");document.documentElement.setAttribute("data-theme","dark");}else{document.documentElement.classList.remove("dark");document.documentElement.setAttribute("data-theme","light");}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-w-0 w-full bg-[var(--background)] text-[var(--foreground)] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
