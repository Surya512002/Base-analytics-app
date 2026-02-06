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
  other: {
    // --- 1. NEW MINI-APP METADATA (Required for v2) ---
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: "https://base-analytics-app.vercel.app/opengraph-image.png", // Ensure you have an OG image or use a public URL
      button: {
        title: "Launch Analytics",
        action: {
          type: "launch_frame",
          name: "Base Analytics",
          url: "https://base-analytics-app.vercel.app",
          splashImageUrl: "https://base-analytics-app.vercel.app/icon.png", // 200x200px icon
          splashBackgroundColor: "#f5f8ff"
        }
      }
    }),
    
    // --- 2. BASE VERIFICATION ---
    "base:app_id": "6985c4998dcaa0daf5755f7e", 
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