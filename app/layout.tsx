import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

// 1. Force Mobile "Native App" Feel (Prevents zooming)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Critical for "Mini-App" feel
  themeColor: "#0F172A",
};

// 2. Farcaster Frame Metadata
export const metadata: Metadata = {
  title: "Base Analytics",
  description: "Track your on-chain engagement and streak.",
  manifest: "/manifest.json",
  other: {
    "fc:frame": "vNext",
    "fc:frame:image": "https://base.org/images/base-open-graph.png", // Replace with your own screenshot later
    "fc:frame:button:1": "Launch Analytics",
    "fc:frame:button:1:action": "link", // This opens your app as a Mini-App
    "fc:frame:button:1:target": "https://your-vercel-url.app", // You will update this after deploying
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