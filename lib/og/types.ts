export interface OgCardData {
  score?: number;
  rank?: string;
  badges?: number;
  days?: number;
  xp?: number;
  streak?: number;
  title?: string;
  subtitle?: string;
  variant?: "default" | "score" | "badge" | "referral";
}

export const OG_SIZE = { width: 1200, height: 630 };

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
  return params.toString();
}

export function getOgImageUrl(baseUrl: string, data: OgCardData = {}): string {
  const qs = getOgQueryString(data);
  return qs ? `${baseUrl}/api/og?${qs}` : `${baseUrl}/opengraph-image`;
}

export function parseOgParams(
  searchParams: URLSearchParams
): Required<
  Pick<OgCardData, "score" | "rank" | "badges" | "days" | "xp" | "streak">
> & {
  title: string;
  subtitle: string;
  variant: OgCardData["variant"];
} {
  const score = Math.min(
    100,
    Math.max(0, parseInt(searchParams.get("score") || "88", 10) || 88)
  );
  const badges = Math.max(0, parseInt(searchParams.get("badges") || "4", 10) || 4);
  const days = Math.max(0, parseInt(searchParams.get("days") || "91", 10) || 91);
  const xp = Math.max(0, parseInt(searchParams.get("xp") || "0", 10) || 0);
  const streak = Math.max(0, parseInt(searchParams.get("streak") || "0", 10) || 0);
  const rank = searchParams.get("rank") || "Base God 👑";
  const title = searchParams.get("title") || "";
  const subtitle = searchParams.get("subtitle") || "";
  const variant = (searchParams.get("v") as OgCardData["variant"]) || "default";
  return { score, rank, badges, days, xp, streak, title, subtitle, variant };
}
