import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Base Analytics | Royal Onchain Stats",
  description: "The better way to analyse your onchain activity. Check your Score, Streak, and Wallet History on Base.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",       // Logo in Browser Tab
    apple: "/icon.png",      // Logo on iPhone Home Screen
  },
  openGraph: {
    title: "Base Analytics",
    description: "My Onchain Score & Activity Heatmap. Built for Base.",
    url: "https://base-analytics-app.vercel.app",
    siteName: "Base Analytics",
    images: [
      {
        url: "/og-image.png", // Image shown on Farcaster & Twitter
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
    title: "Base Analytics",
    description: "Check your Onchain Score on Base.",
    images: ["/og-image.png"], // Same image for Twitter/X
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#000510] text-slate-200 antialiased`}>
        {children}
      </body>
    </html>
  );
} 