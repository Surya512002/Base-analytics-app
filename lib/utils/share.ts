import { APP_URL_WEB } from "@/lib/constants/env";
import type { WalletData } from "@/lib/types/wallet";
import { getOgImageUrl } from "@/lib/og/types";
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

export function buildTokenSharePageUrl(
  symbol: string,
  name: string,
  optsOrPrice?:
    | string
    | {
        price?: string;
        change24h?: number;
        mcap?: string;
        tokenAddress?: string;
      },
  change24h?: number,
  mcapUsd?: string,
  tokenAddress?: string
): string {
  const isObj = typeof optsOrPrice === "object" && optsOrPrice !== null;
  const price = isObj ? optsOrPrice.price : optsOrPrice;
  const chg = isObj ? optsOrPrice.change24h : change24h;
  const mc = isObj ? optsOrPrice.mcap : mcapUsd;
  const addr = isObj ? optsOrPrice.tokenAddress : tokenAddress;

  const ogUrl = getOgImageUrl(APP_URL_WEB, {
    variant: "token",
    tokenSymbol: symbol,
    tokenName: name,
    tokenPrice: price,
    tokenChange24h: chg,
    tokenMcap: mc,
  });
  const pageUrl = addr
    ? `${APP_URL_WEB}/launchpad?token=${addr}`
    : `${APP_URL_WEB}/launchpad`;
  return `${pageUrl}#og=${encodeURIComponent(ogUrl)}`;
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
