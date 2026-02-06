import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0F172A",
};

export const metadata: Metadata = {
  title: "Base Analytics",
  description: "Track your on-chain engagement and streak.",
  manifest: "/manifest.json",
  other: {
    // --- NEW: Base Verification ID ---
    "base:app_id": "6985c4998dcaa0daf5755f7e", 
    
    // --- EXISTING: Farcaster Frame Tags ---
    "fc:frame": "vNext",
    "fc:frame:image": "https://base.org/images/base-open-graph.png",
    "fc:frame:button:1": "Launch Analytics",
    "fc:frame:button:1:action": "link",
    "fc:frame:button:1:target": "https://base-analytics-app.vercel.app",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#F5F8FF] min-h-screen`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}