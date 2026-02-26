import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import '@coinbase/onchainkit/styles.css'; 

// ✅ Import our new client-side provider wrapper
import { Providers } from "./providers"; 

const inter = Inter({ subsets: ["latin"] });

const APP_URL = "https://base-analytics-app.vercel.app";

// Change the ?v= parameter from v4 to v5
const OG_IMAGE_URL = `${APP_URL}/opengraph-image?v=v5`;

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL), 
  title: "Base Analytics | Mint Your Identity",
  description: "Check your onchain score, unlock 40+ unique badges, and boost your XP on Base.",
  openGraph: {
    title: "Base Analytics | Mint Your Identity",
    description: "Check your onchain score, unlock 40+ unique badges, and boost your XP on Base.",
    siteName: "Base Analytics",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: OG_IMAGE_URL, 
        width: 1200,
        height: 630,
      }
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Base Analytics | Mint Your Identity",
    description: "Check your onchain score and claim your badges entirely gasless.",
    creator: "@TamilCrypt0", 
    images: [OG_IMAGE_URL],
  },
  other: {
    "talentapp:project_verification": "37ce476751698fbb9f2da974b46068f696394868258b708d80061274f4176d90ce31c259e67591e2085dde5a275b70c5cc68739f7bf0c4f9f6605426030de439",
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: OG_IMAGE_URL, 
      button: {
        title: "Check Score & Mint Badges",
        action: {
          type: "launch_frame",
          name: "Base Analytics",
          url: APP_URL,
          splashImageUrl: `${APP_URL}/icon.png`,
          splashBackgroundColor: "#000510",
        },
      },
    }),
    'base:app_id': '698ebb8fe0d5d2cf831b5a3c',
  },
}; 

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* ✅ Wrap children in our custom Providers component */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
} 