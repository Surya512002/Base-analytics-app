import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// THIS IS THE CRITICAL PART FOR FARCASTER
const appUrl = "https://base-analytics-app.vercel.app";

const frameMetadata = JSON.stringify({
  version: "next",
  imageUrl: `${appUrl}/og-image.png`, // Make sure this image exists in public/
  button: {
    title: "Check Score",
    action: {
      type: "launch_frame",
      name: "Base Analytics",
      url: appUrl,
      splashImageUrl: `${appUrl}/icon.png`, // Make sure this icon exists in public/
      splashBackgroundColor: "#000510"
    }
  }
});

export const metadata: Metadata = {
  title: "Base Analytics",
  description: "Check your onchain score on Base",
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