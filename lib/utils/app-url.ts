import type { AppTab } from "@/hooks/useWalletApp";

const TAB_ALIASES: Record<string, AppTab> = {
  launchpad: "launchpad",
  launch: "launchpad",
  terminal: "launchpad",
  explore: "launchpad",
  markets: "launchpad",
  swap: "swap",
  trade: "swap",
  dex: "swap",
  predictions: "launchpad",
  predict: "launchpad",
  dashboard: "launchpad",
  analytics: "launchpad",
  checkin: "launchpad",
  "check-in": "launchpad",
  actions: "launchpad",
  habits: "launchpad",
  streaks: "launchpad",
  quests: "launchpad",
  rankings: "launchpad",
  leaderboard: "launchpad",
  voucher: "basehub",
  vouchers: "basehub",
  basehub: "basehub",
  badges: "launchpad",
  achievements: "launchpad",
  rewards: "lend",
  stake: "lend",
  staking: "lend",
  lend: "lend",
  lending: "lend",
  borrow: "lend",
  borrowing: "lend",
  earn: "lend",
  vaults: "lend",
};

export function buildLendPath(): string {
  return "/lend";
}

export function buildLaunchPath(): string {
  return "/launch";
}

export function resolveTabFromUrl(search?: string): AppTab | null {
  if (typeof window === "undefined" && !search) return null;
  const raw = search ?? (typeof window !== "undefined" ? window.location.search : "");
  const searchParams = new URLSearchParams(raw);
  const t = searchParams.get("tab");
  if (t && TAB_ALIASES[t]) return TAB_ALIASES[t];

  // Infer basehub if voucher claim parameters are present
  if (
    searchParams.has("card") ||
    searchParams.has("cardId") ||
    searchParams.has("voucher") ||
    searchParams.has("c")
  ) {
    return "basehub";
  }

  if (typeof window !== "undefined" && window.location.hash) {
    const hash = window.location.hash.replace(/^#/, "");
    const hashParams = new URLSearchParams(hash);
    if (hashParams.has("id") || hashParams.has("card")) {
      return "basehub";
    }
  }

  return null;
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

export function buildSwapTokenPath(address: string): string {
  return `/swap/token/${address}`;
}

export function buildSwapPath(): string {
  return "/swap";
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

export function buildGiftVoucherDeepLink(amountUsdc = "5"): string {
  return `/?tab=basehub&create=1&asset=USDC&total=${amountUsdc}&cards=1`;
}

