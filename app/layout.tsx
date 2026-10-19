import type { Metadata, Viewport } from "next";
import { Figtree, Syne } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { getAppUrl, appOgImage } from "@/lib/constants/app-url";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

const APP_URL = getAppUrl();
const OG_IMAGE = appOgImage();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Base Analytics — Tokenized Stocks, B20 Launches & DEX Swaps on Base",
  description:
    "Trade Coinbase tokenized stocks, launch B20 vanity tokens with 50% creator fee share, route multi-DEX swaps, lend on Morpho, and gift crypto vouchers on Base.",
  metadataBase: new URL(APP_URL),
  manifest: "/manifest.json",
  applicationName: "Base Analytics",
  openGraph: {
    title: "Base Analytics — Tokenized Stocks, B20 Launches & DEX Swaps on Base",
    description:
      "The Base DeFi terminal: trade tokenized stocks ($TSLA, $NVDA), launch B20 tokens with instant 50% creator fee share, multi-DEX swaps, Morpho stock lending & crypto vouchers.",
    url: APP_URL,
    siteName: "Base Analytics",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Base Analytics — Tokenized Stocks, B20 Launches & Swaps on Base",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Base Analytics — Tokenized Stocks, B20 Launches & DEX Swaps on Base",
    description:
      "Trade tokenized stocks, launch B20 vanity tokens with 50% creator fees, route swaps across Uniswap & Aerodrome, lend on Morpho, and redeem vouchers on Base.",
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
    "twitter:image:alt": "Base Analytics — Tokenized Stocks, B20 Launches & Swaps on Base",
    "og:image": OG_IMAGE,
    "og:image:secure_url": OG_IMAGE,
    "og:image:width": "1200",
    "og:image:height": "630",
    "og:image:alt": "Base Analytics — Tokenized Stocks, B20 Launches & Swaps on Base",
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
