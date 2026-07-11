import { APP_URL_WEB, MINIAPP_URL } from "@/lib/constants/env";
import { SEASON_NAME } from "@/lib/constants/season";
import { getDaysLeft } from "@/lib/utils/season";
import type { WalletData } from "@/lib/types/wallet";
import { getOgImageUrl, type OgCardData } from "@/lib/og/types";
import { OG_VERSION } from "@/lib/og/brand-kit";
import { formatDexVolumeUsd } from "@/lib/utils/swap-volume";

export const SHARE_TAGLINE =
  "B20 launchpad on Base — explore tokens, swap in-app (Uniswap + Aerodrome), earn XP.";

export const SHARE_HASHTAGS = "#Base #B20 #DeFi #Onchain";

export function getReferralCode(a: string): string {
  return a.slice(2, 10).toUpperCase();
}

export function buildShareCardData(
  wallet: WalletData,
  opts: {
    ref: string;
    mintedCount: number;
    streak: number;
    weeklyXP: number;
    boosts?: number;
    variant?: OgCardData["variant"];
    title?: string;
    subtitle?: string;
  }
): OgCardData {
  return {
    score: wallet.score,
    rank: wallet.walletRank,
    badges: opts.mintedCount,
    days: getDaysLeft(),
    xp: opts.weeklyXP,
    streak: opts.streak,
    variant: opts.variant ?? "score",
    title: opts.title,
    subtitle:
      opts.subtitle ??
      `${wallet.score}/100 · ${opts.mintedCount} badges · swap & launch on Base`,
    address: wallet.address,
    activeDays: wallet.uniqueDays,
    txs: wallet.txCount,
    healthScore: wallet.walletHealthScore,
    boosts: opts.boosts,
  };
}

export function buildSharePageUrl(data: OgCardData, ref?: string): string {
  const params = new URLSearchParams();
  if (data.score != null) params.set("score", String(data.score));
  if (data.rank) params.set("rank", data.rank);
  if (data.badges != null) params.set("badges", String(data.badges));
  if (data.days != null) params.set("days", String(data.days));
  if (data.xp != null) params.set("xp", String(data.xp));
  if (data.streak != null) params.set("streak", String(data.streak));
  if (data.title) params.set("title", data.title);
  if (data.subtitle) params.set("subtitle", data.subtitle);
  if (data.variant) params.set("v", data.variant);
  if (data.address) params.set("addr", data.address);
  if (data.activeDays != null) params.set("activeDays", String(data.activeDays));
  if (data.txs != null) params.set("txs", String(data.txs));
  if (data.healthScore != null) params.set("health", String(data.healthScore));
  if (data.boosts != null) params.set("boosts", String(data.boosts));
  if (ref) params.set("ref", ref);
  return `${APP_URL_WEB}/share?${params.toString()}`;
}

function rankKey(rank: string): string {
  if (rank.includes("God")) return "god";
  if (rank.includes("Whale")) return "whale";
  if (rank.includes("Shark")) return "shark";
  if (rank.includes("Dolphin")) return "dolphin";
  return "shrimp";
}

export function buildScoreShareText(
  wallet: WalletData,
  streak: number,
  mintedCount: number
): string {
  const dexVol = formatDexVolumeUsd(wallet.dexVolumeUSD);
  const identity = wallet.basename ? `@${wallet.basename.replace(/\.base\.eth$/i, "")}` : "my wallet";
  const lines: Record<string, string> = {
    god: `Base God energy onchain.\n\n${wallet.score}/100 · ${wallet.uniqueDays} active days · ${wallet.dexTradeCount} in-app swaps · ${dexVol} volume.\n\nExploring B20 tokens & trading Uniswap/Aerodrome without leaving the app. Beat ${identity}?`,
    whale: `Whale stats on Base.\n\n${wallet.score}/100 · ${wallet.txCount.toLocaleString()} txs · ${dexVol} swap volume · ${streak}d streak.\n\nLaunch B20 tokens, swap with USD quotes, earn quest XP. What's your score?`,
    shark: `Hunting alpha on Base.\n\nScore ${wallet.score}/100 · ${mintedCount} badges · ${wallet.uniqueDays} days active.\n\nBase Analytics = B20 explore + in-app DEX + wallet scan. Challenge me.`,
    dolphin: `Climbing on Base.\n\n${wallet.score}/100 · ${wallet.activeMonths} active months · ${wallet.dexTradeCount} swaps in-app.\n\nTrending B20, live liquidity, Uniswap + Aerodrome routes. Scan your wallet free.`,
    shrimp: `Building on Base, one tx at a time.\n\n${wallet.score}/100 · ${wallet.uniqueDays} active days · ${streak}d streak.\n\nExplore tokens, swap in-app, launch B20 — all in one mini-app. Get your rank.`,
  };
  return lines[rankKey(wallet.walletRank)] || lines.shrimp;
}

export function buildBadgeShareText(name: string, level: string, wallet: WalletData): string {
  return `Unlocked "${level}" for ${name} — gasless on Base.\n\nWallet ${wallet.score}/100 · ${wallet.uniqueDays} active days.\n\nBadges, B20 launches, in-app swaps & analytics on Base Analytics.`;
}

export function buildBadgesShareText(count: number, wallet: WalletData): string {
  return `${count} onchain badges minted gasless on Base.\n\n${wallet.walletRank} · ${wallet.score}/100 · quest XP rolling.\n\nExplore B20, swap Uniswap/Aerodrome in-app, climb the leaderboard.`;
}

export function buildTokenShareText(symbol: string, name: string): string {
  return `$${symbol} on Base — ${name}\n\nTrade on Base Analytics: Uniswap + Aerodrome in-app, USD swap quotes, B20 explore rails. No tab-hopping.`;
}

export function buildTokenSharePageUrl(
  symbol: string,
  name: string,
  opts?: { price?: string; change24h?: number; mcap?: string }
): string {
  const origin = APP_URL_WEB.replace(/\/$/, "");
  const params = new URLSearchParams({
    v: "token",
    sym: symbol,
    tname: name,
    ogv: OG_VERSION,
  });
  if (opts?.price) params.set("tprice", opts.price);
  if (opts?.change24h != null) params.set("tchg", String(opts.change24h));
  if (opts?.mcap) params.set("tmcap", opts.mcap);
  return `${origin}/api/og?${params.toString()}`;
}

/** Cast / tweet body + referral footer. */
export function buildShareBody(mainText: string, ref: string): string {
  return `${mainText}\n\n${SEASON_NAME} · ${SHARE_TAGLINE}\n${SHARE_HASHTAGS}\n→ ${APP_URL_WEB}?ref=${ref}`;
}

export function warpcast(text: string, pageUrl?: string): string {
  const embed = pageUrl || MINIAPP_URL;
  return `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(embed)}`;
}

export function twitterShare(text: string, pageUrl?: string): string {
  const base = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  return pageUrl ? `${base}&url=${encodeURIComponent(pageUrl)}` : base;
}

export function buildPredictionShareText(args: {
  asset: string;
  duration: string;
  yesPct: number;
  price: string;
  openPrice: string;
  ref?: string;
}): string {
  const dir = args.yesPct >= 50 ? "bullish" : "bearish";
  const lines = [
    `${args.asset} ${args.duration} · YES ${args.yesPct}%`,
    `Price ${args.price} · Open ${args.openPrice}`,
    `My read: ${dir} on Base Analytics`,
    `B20 launchpad + in-app swaps on Base`,
    SHARE_HASHTAGS,
  ];
  if (args.ref) {
    lines.push(`→ ${APP_URL_WEB}?ref=${args.ref}`);
  }
  return lines.join("\n");
}

export function getSharePreviewUrl(data: OgCardData): string {
  return getOgImageUrl(APP_URL_WEB, data);
}

/** @deprecated Use buildShareBody + specific share text builders */
export function buildShare(_w: WalletData, ref: string, extra: string): string {
  return buildShareBody(extra, ref);
}
