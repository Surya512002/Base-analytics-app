import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  // ✅ IMPORTANT: This fixes the blank image by setting the base URL
  metadataBase: new URL("https://base-analytics-app.vercel.app"), 
  
  title: "Base Analytics | XP Booster",
  description: "Check your onchain score and boost your XP on Base.",
  
  openGraph: {
    title: "Base Analytics & XP Booster",
    description: "Check your Onchain Score and farm XP on Base! 🚀",
    siteName: "Base Analytics",
    locale: "en_US",
    type: "website",
    // Next.js automatically finds app/opengraph-image.png
  },
  twitter: {
    card: "summary_large_image",
    title: "Base Analytics & XP Booster",
    description: "Farm XP on Base! 🚀",
    creator: "@suryaprakash.farcaster.eth", 
  },
  
  // 👇 ADD THIS SECTION 👇
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: "https://base-analytics-app.vercel.app/opengraph-image.png", // Must be 3:2 aspect ratio
      button: {
        title: "Check Score",
        action: {
          type: "launch_frame",
          name: "Base Analytics",
          url: "https://base-analytics-app.vercel.app",
          splashImageUrl: "https://base-analytics-app.vercel.app/icon.png", // Must be 200x200px
          splashBackgroundColor: "#000510",
        },
      },
    }),
    'base:app_id': '6985c4998dcaa0daf5755f7e',
  },
};
// UPDATED METADATA SECTION
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
} 