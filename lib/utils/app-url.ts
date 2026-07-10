import type { AppTab } from "@/hooks/useWalletApp";

const TAB_ALIASES: Record<string, AppTab> = {
  launchpad: "launchpad",
  launch: "launchpad",
  terminal: "launchpad",
  trade: "launchpad",
  explore: "launchpad",
  markets: "launchpad",
  predictions: "launchpad",
  predict: "launchpad",
  dashboard: "dashboard",
  analytics: "dashboard",
  checkin: "checkin",
  "check-in": "checkin",
  quests: "checkin",
  rankings: "checkin",
  leaderboard: "checkin",
  voucher: "basehub",
  vouchers: "basehub",
  basehub: "basehub",
  badges: "achievements",
  achievements: "achievements",
  rewards: "checkin",
  stake: "checkin",
  staking: "checkin",
};

export type RewardsHubView = "checkin" | "stake";

export function resolveRewardsViewFromUrl(search?: string): RewardsHubView {
  if (typeof window === "undefined" && !search) return "checkin";
  const raw = search ?? window.location.search;
  const params = new URLSearchParams(raw);
  const tab = params.get("tab");
  const view = params.get("view");
  if (view === "stake") return "stake";
  if (tab === "rewards" || tab === "stake" || tab === "staking") return "stake";
  return "checkin";
}

export function syncRewardsHubUrl(view: RewardsHubView) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("tab", "checkin");
  if (view === "stake") url.searchParams.set("view", "stake");
  else url.searchParams.delete("view");
  url.searchParams.delete("token");
  window.history.replaceState({}, "", url);
}

export function isRewardsHubTab(tab: AppTab): boolean {
  return tab === "checkin" || tab === "rewards";
}

export function resolveTabFromUrl(search?: string): AppTab | null {
  if (typeof window === "undefined" && !search) return null;
  const raw = search ?? window.location.search;
  const t = new URLSearchParams(raw).get("tab");
  return t && TAB_ALIASES[t] ? TAB_ALIASES[t] : null;
}

export function resolveTokenFromUrl(search?: string): string | null {
  if (typeof window === "undefined" && !search) return null;
  const raw = search ?? window.location.search;
  const token = new URLSearchParams(raw).get("token")?.trim().toLowerCase();
  if (!token?.startsWith("0x") || token.length !== 42) return null;
  return token;
}

export function syncTabUrl(tab: AppTab, opts?: { token?: string | null }) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  if (opts?.token) url.searchParams.set("token", opts.token);
  else url.searchParams.delete("token");
  window.history.replaceState({}, "", url);
}

export function buildExploreTokenPath(address: string): string {
  return `/explore/token/${address}`;
}

export function buildExplorePath(): string {
  return "/explore";
}

export function buildRedeemDeepLink(cardId: string, secret?: string): string {
  const qs = new URLSearchParams({ tab: "basehub" });
  qs.set("card", cardId);
  if (secret) qs.set("secret", secret);
  return `/?${qs.toString()}`;
}

export function buildQuestDeepLink(questId: string): string {
  return `/?tab=checkin&quest=${encodeURIComponent(questId)}`;
}

export function resolveQuestHighlightFromUrl(search?: string): string | null {
  if (typeof window === "undefined" && !search) return null;
  const raw = search ?? window.location.search;
  return new URLSearchParams(raw).get("quest");
}

export function syncQuestHighlightUrl(questId: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("tab", "checkin");
  if (questId) url.searchParams.set("quest", questId);
  else url.searchParams.delete("quest");
  window.history.replaceState({}, "", url);
}

export function buildGiftVoucherDeepLink(amountUsdc = "5"): string {
  return `/?tab=basehub&create=1&asset=USDC&total=${amountUsdc}&cards=1`;
}

