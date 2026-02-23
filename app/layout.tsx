import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'viem/chains';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  // ✅ 1. Fixes image loading issues
  metadataBase: new URL("https://base-analytics-app.vercel.app"), 
  
  title: "Base Analytics | XP Booster",
  description: "Check your onchain score and boost your XP on Base.",
  
  openGraph: {
    title: "Base Analytics & XP Booster",
    description: "Check your Onchain Score and farm XP on Base! 🚀",
    siteName: "Base Analytics",
    locale: "en_US",
    type: "website",
  },
  
  twitter: {
    card: "summary_large_image",
    title: "Base Analytics & XP Booster",
    description: "Farm XP on Base! 🚀",
    creator: "@suryaprakash.farcaster.eth", 
  },
  
  // ✅ 2. Frames v2 Configuration
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: "https://base-analytics-app.vercel.app/opengraph-image.png", 
      button: {
        title: "Check Score",
        action: {
          type: "launch_frame",
          name: "Base Analytics",
          url: "https://base-analytics-app.vercel.app",
          splashImageUrl: "https://base-analytics-app.vercel.app/icon.png",
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
  const paymasterUrl = process.env.NEXT_PUBLIC_PAYMASTER_URL;

  return (
    <html lang="en">
      <body className={inter.className}>
        <OnchainKitProvider 
          chain={base} 
          config={{ 
            paymaster: paymasterUrl, 
          }}
        >
          {children}
        </OnchainKitProvider>
      </body>
    </html>
  );
} 