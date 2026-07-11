import { OG_VERSION } from "@/lib/og/brand-kit";

/** Canonical public app URL for OG, share links, and metadata. */
export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "https://base-analytics-app.vercel.app"
  );
}

export function appOgImage(bust = OG_VERSION): string {
  return `${getAppUrl()}/opengraph-image?ogv=${bust}`;
}

export function appOgWalletImage(wallet: {
  address: string;
  score: number;
  walletRank?: string;
  uniqueDays?: number;
  txCount?: number;
  basename?: string | null;
}): string {
  const p = new URLSearchParams({
    v: "score",
    ogv: OG_VERSION,
    score: String(wallet.score),
    rank: wallet.walletRank ?? "Base",
    address: wallet.address,
    days: String(wallet.uniqueDays ?? 0),
    txs: String(wallet.txCount ?? 0),
  });
  if (wallet.basename) p.set("title", wallet.basename);
  return `${getAppUrl()}/api/og?${p.toString()}`;
}
