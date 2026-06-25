import { APP_URL_WEB, MINIAPP_URL } from "@/lib/constants/env";
import { SEASON_NAME } from "@/lib/constants/season";
import type { WalletData } from "@/lib/types/wallet";

export function getReferralCode(a: string): string {
  return a.slice(2, 10).toUpperCase();
}

export function buildShare(
  _w: WalletData,
  ref: string,
  extra: string
): string {
  return `${extra}\n\n🔵 ${SEASON_NAME} — earn XP, mint badges & unlock future rewards!\n🎁 Use my link: ${APP_URL_WEB}?ref=${ref}\n#BaseAnalytics #Base #Onchain`;
}

export function warpcast(text: string): string {
  return `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(MINIAPP_URL)}`;
}

export function twitterShare(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
