import { APP_URL_WEB, MINIAPP_URL } from "@/lib/constants/env";
import { SEASON_NAME } from "@/lib/constants/season";
import { getDaysLeft } from "@/lib/utils/season";
import type { WalletData } from "@/lib/types/wallet";
import { getOgImageUrl, type OgCardData } from "@/lib/og/types";
import { formatDexVolumeUsd } from "@/lib/utils/swap-volume";

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
    subtitle: opts.subtitle,
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
  const lines: Record<string, string> = {
    god: `I didn't choose the grind — it chose me.\n\n${wallet.score}/100 on Base Analytics. ${wallet.uniqueDays} active days · ${wallet.dexTradeCount} swaps · ${dexVol} volume.\n\nYour wallet talking or just whispering?`,
    whale: `Deep bags. Deeper conviction.\n\nScored ${wallet.score}/100 on Base — ${wallet.txCount.toLocaleString()} txs, ${dexVol} swap volume, ${streak}d streak.\n\nPull up your stats. I'll wait.`,
    shark: `I hunt alpha on Base, not excuses.\n\nOnchain score: ${wallet.score}/100 · ${wallet.uniqueDays} days active · ${mintedCount} badges minted.\n\nBet you can't beat my chart.`,
    dolphin: `Rising fast on Base — and the data proves it.\n\n${wallet.score}/100 score · ${wallet.activeMonths} active months · ${wallet.dexTradeCount} swaps.\n\nScan your wallet. Shock yourself.`,
    shrimp: `Every legend starts somewhere — I'm building on Base.\n\nScore ${wallet.score}/100 · ${wallet.uniqueDays} active days · ${streak}d streak.\n\nGet your rank before the season ends.`,
  };
  return lines[rankKey(wallet.walletRank)] || lines.shrimp;
}

export function buildBadgeShareText(name: string, level: string, wallet: WalletData): string {
  return `Just unlocked "${level}" for ${name} — gasless on Base.\n\nWallet sitting at ${wallet.score}/100 with ${wallet.uniqueDays} active days.\n\nOne badge closer to the top. What's your rank?`;
}

export function buildBadgesShareText(count: number, wallet: WalletData): string {
  return `${count} onchain badges — minted gasless on Base.\n\n${wallet.walletRank} · ${wallet.score}/100 · Season XP rolling.\n\nThe leaderboard doesn't lie. Check yours.`;
}

/** Cast / tweet body + referral (no hashtags). */
export function buildShareBody(mainText: string, ref: string): string {
  return `${mainText}\n\n${SEASON_NAME} on Base — free scan, gasless badges, real XP.\n→ ${APP_URL_WEB}?ref=${ref}`;
}

export function warpcast(text: string, pageUrl?: string): string {
  const embed = pageUrl || MINIAPP_URL;
  return `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(embed)}`;
}

export function twitterShare(text: string, pageUrl?: string): string {
  const base = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  return pageUrl ? `${base}&url=${encodeURIComponent(pageUrl)}` : base;
}

export function getSharePreviewUrl(data: OgCardData): string {
  return getOgImageUrl(APP_URL_WEB, data);
}

/** @deprecated Use buildShareBody + specific share text builders */
export function buildShare(
  _w: WalletData,
  ref: string,
  extra: string
): string {
  return buildShareBody(extra, ref);
}
