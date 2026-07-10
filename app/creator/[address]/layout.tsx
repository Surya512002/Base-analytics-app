import type { Metadata } from "next";
import { getAppUrl, appOgImage } from "@/lib/constants/app-url";

type Props = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address: raw } = await params;
  const address = raw?.startsWith("0x") && raw.length === 42 ? raw.toLowerCase() : null;
  const appUrl = getAppUrl();
  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "creator";
  const title = `${short} — B20 Creator on Base`;
  const description = address
    ? `Tokens launched by ${short} on the Base Analytics B20 launchpad.`
    : "B20 token creator profile on Base.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: address ? `${appUrl}/creator/${address}` : appUrl,
      images: [{ url: appOgImage(), width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [appOgImage()] },
  };
}

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
