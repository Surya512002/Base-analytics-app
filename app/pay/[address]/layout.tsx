import type { Metadata } from "next";
import { getAppUrl, appOgImage } from "@/lib/constants/app-url";

type Props = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address: raw } = await params;
  const address = raw?.startsWith("0x") && raw.length === 42 ? raw.toLowerCase() : null;
  const appUrl = getAppUrl();
  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "wallet";
  const title = `Pay ${short} — Base Voucher`;
  const description = address
    ? `Send ETH or USDC vouchers to ${short} on Base. Gas-sponsored gift cards via Base Analytics.`
    : "Send onchain gift cards on Base.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: address ? `${appUrl}/pay/${address}` : appUrl,
      images: [{ url: appOgImage(), width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [appOgImage()] },
  };
}

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
