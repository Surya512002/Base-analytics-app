import { OG_VERSION } from "./brand-kit";

export interface OgCardData {
  score?: number;
  rank?: string;
  badges?: number;
  days?: number;
  xp?: number;
  streak?: number;
  title?: string;
  subtitle?: string;
  variant?: "default" | "score" | "badge" | "referral" | "token";
  address?: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenPrice?: string;
  tokenChange24h?: number;
  tokenMcap?: string;
  activeDays?: number;
  txs?: number;
  healthScore?: number;
  boosts?: number;
}

export const OG_SIZE = { width: 1200, height: 630 };

export function shortenAddress(addr: string): string {
  const a = addr.trim();
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

export function getOgQueryString(data: OgCardData): string {
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
  if (data.tokenSymbol) params.set("sym", data.tokenSymbol);
  if (data.tokenName) params.set("tname", data.tokenName);
  if (data.tokenPrice) params.set("tprice", data.tokenPrice);
  if (data.tokenChange24h != null) params.set("tchg", String(data.tokenChange24h));
  if (data.tokenMcap) params.set("tmcap", data.tokenMcap);
  return params.toString();
}

export function getOgImageUrl(baseUrl: string, data: OgCardData = {}): string {
  const qs = getOgQueryString(data);
  const bust = `ogv=${OG_VERSION}`;
  if (!qs) return `${baseUrl}/opengraph-image?${bust}`;
  return `${baseUrl}/api/og?${qs}&${bust}`;
}

export function parseOgParams(searchParams: URLSearchParams): OgCardData & {
  score: number;
  rank: string;
  badges: number;
  days: number;
  xp: number;
  streak: number;
  title: string;
  subtitle: string;
  variant: OgCardData["variant"];
} {
  const score = Math.min(
    100,
    Math.max(0, parseInt(searchParams.get("score") || "72", 10) || 72)
  );
  const badges = Math.max(0, parseInt(searchParams.get("badges") || "3", 10) || 3);
  const days = Math.max(0, parseInt(searchParams.get("days") || "91", 10) || 91);
  const xp = Math.max(0, parseInt(searchParams.get("xp") || "120", 10) || 120);
  const streak = Math.max(0, parseInt(searchParams.get("streak") || "5", 10) || 5);
  const rank = searchParams.get("rank") || "Base Shark";
  const title = searchParams.get("title") || "";
  const subtitle = searchParams.get("subtitle") || "";
  const variant = (searchParams.get("v") as OgCardData["variant"]) || "default";
  const address = searchParams.get("addr") || "0x3799cafa388da047cAF7c999e31c844705FadfAe";
  const activeDays = Math.max(
    0,
    parseInt(searchParams.get("activeDays") || "47", 10) || 47
  );
  const txs = Math.max(0, parseInt(searchParams.get("txs") || "1248", 10) || 1248);
  const healthScore = Math.min(
    100,
    Math.max(0, parseInt(searchParams.get("health") || String(score), 10) || score)
  );
  const boosts = Math.max(0, parseInt(searchParams.get("boosts") || "12", 10) || 12);
  return {
    score,
    rank,
    badges,
    days,
    xp,
    streak,
    title,
    subtitle,
    variant,
    address,
    activeDays,
    txs,
    healthScore,
    boosts,
  };
}
