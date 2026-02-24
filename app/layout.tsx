import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import '@coinbase/onchainkit/styles.css'; 

// ✅ Import our new client-side provider wrapper
import { Providers } from "./providers"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
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
  other: {
    // ✅ NEW: Talent Protocol Verification
    "talentapp:project_verification": "37ce476751698fbb9f2da974b46068f696394868258b708d80061274f4176d90ce31c259e67591e2085dde5a275b70c5cc68739f7bf0c4f9f6605426030de439",
    // Farcaster Frame Data
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