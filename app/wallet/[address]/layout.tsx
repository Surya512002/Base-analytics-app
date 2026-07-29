import type { Metadata } from "next";
import { getAppUrl, appOgImage, appOgWalletImage } from "@/lib/constants/app-url";

type Props = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address: raw } = await params;
  const address = raw?.startsWith("0x") && raw.length === 42 ? raw.toLowerCase() : null;
  const appUrl = getAppUrl();

  if (!address) {
    return { title: "Wallet profile — Base Analytics" };
  }

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  let title = `${short} — Base Analytics`;
  let description = `Onchain wallet profile on Base — score, activity, vouchers, and pay link.`;
  let ogImage = appOgImage();

  try {
    const res = await fetch(
      `${appUrl}/api/analyze-wallet?address=${encodeURIComponent(address)}`,
      {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(8_000),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const w = data.wallet;
      if (w?.score > 0) {
        const name = w.basename || short;
        title = `${name} · ${w.score} pts — Base Analytics`;
        description = `${w.walletRank ?? "Base wallet"} · ${w.txCount?.toLocaleString?.() ?? w.txCount} txs · ${w.uniqueDays} active days on Base.`;
        ogImage = appOgWalletImage({
          address,
          score: w.score,
          walletRank: w.walletRank,
          uniqueDays: w.uniqueDays,
          txCount: w.txCount,
          basename: w.basename,
        });
      }
    }
  } catch {
    /* fallback metadata */
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${appUrl}/wallet/${address}`,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: "profile",
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default function WalletProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
