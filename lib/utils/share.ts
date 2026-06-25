import { APP_URL_WEB, MINIAPP_URL } from "@/lib/constants/env";
import { SEASON_NAME } from "@/lib/constants/season";
import { getDaysLeft } from "@/lib/utils/season";
import type { WalletData } from "@/lib/types/wallet";
import { getOgImageUrl, type OgCardData } from "@/lib/og/types";

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
  if (ref) params.set("ref", ref);
  return `${APP_URL_WEB}/share?${params.toString()}`;
}

export function buildShare(
  _w: WalletData,
  ref: string,
  extra: string
): string {
  return `${extra}\n\n🔵 ${SEASON_NAME} — earn XP, mint badges & unlock future rewards!\n🎁 ${APP_URL_WEB}?ref=${ref}\n#BaseAnalytics #Base #Onchain`;
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
