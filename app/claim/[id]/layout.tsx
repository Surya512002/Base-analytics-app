import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getAppUrl } from "@/lib/constants/app-url";
import { OG_VERSION } from "@/lib/og/brand-kit";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const safeId = /^\d{1,12}$/.test(id) ? id : "0";
  const app = getAppUrl();
  const image = `${app}/claim/${safeId}/opengraph-image?ogv=${OG_VERSION}`;
  const title = "You've been sent a gift on Base";
  const description = "See who sent it, when it expires and how refunds work — then claim it to your wallet on Base.";
  return {
    title,
    description,
    openGraph: { title, description, url: `${app}/claim/${safeId}`, images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    // Claim pages are personal links; keep them out of search results.
    robots: { index: false, follow: false },
    // Farcaster / Base App embed: the gift card image with a button that opens this claim page.
    // (The claim secret lives in the URL fragment, which is never part of shared metadata.)
    other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl: image,
        button: {
          title: "Claim gift",
          action: {
            type: "launch_frame",
            name: "Base Analytics",
            url: `${app}/claim/${safeId}`,
            splashImageUrl: `${app}/splash.png`,
            splashBackgroundColor: "#030712",
          },
        },
      }),
      "fc:frame:image": image,
    },
  };
}

export default function ClaimLayout({ children }: { children: ReactNode }) {
  return children;
}
