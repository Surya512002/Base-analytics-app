import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const appUrl = "https://base-analytics-app.vercel.app";

// 1. Define the Frame Metadata for Farcaster
const frameMetadata = JSON.stringify({
  version: "next",
  imageUrl: `${appUrl}/og-image.png`,
  button: {
    title: "Check Score",
    action: {
      type: "launch_frame",
      name: "Base Analytics",
      url: appUrl,
      splashImageUrl: `${appUrl}/icon.png`,
      splashBackgroundColor: "#000510",
    },
  },
});

// 2. Export it so Next.js puts it in the <head>
export const metadata: Metadata = {
  title: "Base Analytics",
  description: "Check your onchain score on Base",
  openGraph: {
    title: "Base Analytics",
    description: "Check your onchain score on Base",
    images: [`${appUrl}/og-image.png`],
  },
  other: {
    "fc:frame": frameMetadata,
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