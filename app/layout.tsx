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
    // Next.js automatically finds app/opengraph-image.png, we don't need to hardcode it if metadataBase is set
  },
  twitter: {
    card: "summary_large_image",
    title: "Base Analytics & XP Booster",
    description: "Farm XP on Base! 🚀",
    creator: "@suryaprakash.farcaster.eth", 
  },
};

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