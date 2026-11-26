import type { WalletData } from "@/lib/types/wallet";
import { formatDexVolumeUsd } from "@/lib/utils/swap-volume";

export const SHARE_TAGLINE =
  "DeFi terminal on Base — explore tokens, swap in-app, lend & stake, send gift vouchers.";

export const SHARE_HASHTAGS = "#Base #DeFi #Onchain";

export function getReferralCode(a: string): string {
  return a.slice(2, 10).toUpperCase();
}

export function buildActivityShareText(
  wallet: WalletData,
  streak: number
): string {
  const dexVol = formatDexVolumeUsd(wallet.dexVolumeUSD);
  const identity = wallet.basename ? `@${wallet.basename.replace(/\.base\.eth$/i, "")}` : "my wallet";
  return `Onchain activity verified on @base.\n\n${wallet.uniqueDays} active days · ${streak}d streak · ${wallet.txCount.toLocaleString()} transactions · ${dexVol} swap volume.\n\nExplore tokens, swap, and maintain daily onchain habits with ${identity} on Base Analytics.`;
}

export function buildTokenShareText(symbol: string, name: string): string {
  return `$${symbol} on Base — ${name}\n\nTrade on Base Analytics: Uniswap + Aerodrome in-app, USD swap quotes, explore rails. No tab-hopping.`;
}

export function buildShareBody(text: string, url: string): string {
  return `${text}\n\n${url}\n\n${SHARE_HASHTAGS}`;
}

export function warpcast(text: string, embedUrl?: string): string {
  const params = new URLSearchParams();
  params.set("text", text);
  if (embedUrl) {
    params.append("embeds[]", embedUrl);
  }
  return `https://warpcast.com/~/compose?${params.toString()}`;
}

export function twitterShare(text: string, url?: string): string {
  const full = url ? `${text}\n\n${url}` : text;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(full)}`;
}
