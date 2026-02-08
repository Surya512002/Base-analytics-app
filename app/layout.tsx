import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Base Analytics | XP Booster",
  description: "Check your onchain score and boost your XP on Base.",
  // ✅ THIS FIXES THE BLANK IMAGE IN FEEDS
  openGraph: {
    title: "Base Analytics & XP Booster",
    description: "Check your Onchain Score and farm XP on Base! 🚀",
    url: "https://base-analytics-app.vercel.app", // Your actual Vercel URL
    siteName: "Base Analytics",
    images: [
      {
        url: "https://base-analytics-app.vercel.app/opengraph-image.png", // Ensure this image exists in your /public or /app folder
        width: 1200,
        height: 630,
        alt: "Base Analytics Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Base Analytics & XP Booster",
    description: "Check your Onchain Score and farm XP on Base! 🚀",
    creator: "@suryaprakash.farcaster.eth", // Mentions you in Twitter card data
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